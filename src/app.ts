import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import sha256 from 'sha256';
import uniqid from 'uniqid';
import * as dotenv from 'dotenv';
dotenv.config();
import { mainDataSource, auditLogDataSource } from './config/database.config';
import { Transaction } from './entities/Transaction';
import { Refund } from './entities/Refund';
import { AuditLog } from './entities/AuditLog';
// Initialize data sources
mainDataSource.initialize().then(() => {
  console.log('Main database connected');
}).catch((error) => {
  console.error('Error connecting to the main database', error);
});

auditLogDataSource.initialize().then(() => {
  console.log('Audit log database connected');
}).catch((error) => {
  console.error('Error connecting to the audit log database', error);
});

const app = express();

// Environment variables
const MERCHANT_ID = process.env.MERCHANT_ID || "PGTESTPAYUAT86";
const PHONE_PE_HOST_URL = process.env.PHONE_PE_HOST_URL || "https://api-preprod.phonepe.com/apis/pg-sandbox";
const SALT_INDEX = Number(process.env.SALT_INDEX) || 1;
const SALT_KEY = process.env.SALT_KEY || "96434309-7796-489d-8924-ab56988a6076";
const APP_BE_URL = process.env.APP_BE_URL || "http://localhost:3000";

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Retry logic function
async function makeRequestWithRetry(url: string, options: any, retries = 3, delay = 1000) {
  try {
    return await axios(url, options);
  } catch (error) {
    if (retries === 0 || error.response?.status !== 429) {
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    return makeRequestWithRetry(url, options, retries - 1, delay * 2);
  }
}

// Log audit actions
async function logAudit(action: string, details: string,metadata: Object) {
  const auditLog = new AuditLog();
  auditLog.action = action;
  auditLog.details = details;
  auditLog.metadata = metadata;

  await auditLogDataSource.getRepository(AuditLog).save(auditLog);
}

// Endpoints
app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});

app.get("/pay", async (req, res) => {
  try {
    const amount = parseFloat(req.query.amount as string);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).send("Invalid amount");
    }

    let userId:any = req.query.user || "SYSTEM";
    let merchantTransactionId = uniqid();

    let normalPayLoad = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: userId,
      amount: amount * 100,
      redirectUrl: `${APP_BE_URL}?txn_id=${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      mobileNumber: "9999999999",
      paymentInstrument: { type: "PAY_PAGE" },
    };

    let base64EncodedPayload = Buffer.from(JSON.stringify(normalPayLoad), "utf8").toString("base64");
    let string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    const response = await axios(`${PHONE_PE_HOST_URL}/pg/v1/pay`,
      {
        method: 'POST',
        data: { request: base64EncodedPayload },
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          accept: "application/json",
        }
      }
    );

    if (response.data?.data?.instrumentResponse) {
      // const { merchantTransactionId } = response.data.data.instrumentResponse;
      await mainDataSource.getRepository(Transaction).insert({
        merchantTransactionId,
        userId,
        amount,
        status: 'INITIATED',
      });
      logAudit('Payment Initiated', `Transaction ID: ${merchantTransactionId}, Amount: ${amount}`, response.data?.data);
      res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
    } else {
      res.status(500).send("Error initiating payment");
    }
  } catch (error) {
    console.error("Error in /pay:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/payment/validate/:merchantTransactionId", async (req, res) => {
  const { merchantTransactionId } = req.params;

  if (!merchantTransactionId) {
    return res.status(400).send("Missing transaction ID");
  }

  try {
    let statusUrl = `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;

    let string = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}` + SALT_KEY;
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    const response = await makeRequestWithRetry(
      statusUrl,
      {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          "X-MERCHANT-ID": MERCHANT_ID,
          accept: "application/json",
        }
      }
    );

    if (response.data) {
      if (response.data.code === "PAYMENT_SUCCESS") {
        await mainDataSource.getRepository(Transaction).update({ merchantTransactionId }, { status: 'SUCCESS' });
        logAudit('Payment Status Updated', `Transaction ID: ${merchantTransactionId}, Status: SUCCESS`, response.data);
        res.send(response.data);
      } else {
        await mainDataSource.getRepository(Transaction).update({ merchantTransactionId }, { status: 'FAILED' });
        logAudit('Payment Status Updated', `Transaction ID: ${merchantTransactionId}, Status: FAILED`, response.data);
        res.status(400).send("Payment failed or pending");
      }
    } else {
      res.status(500).send("Error fetching payment status");
    }
  } catch (error) {
    console.error("Error in /payment/validate:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/refund", async (req, res) => {
  const { merchantTransactionId, amount } = req.body;

  if (!merchantTransactionId || !amount) {
    return res.status(400).send("Missing transaction ID or amount");
  }

  try {
    const transaction = await mainDataSource.getRepository(Transaction).findOneBy({ merchantTransactionId });
    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    let refundPayload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: transaction.merchantTransactionId,
      amount: amount * 100,
      reason: "Refund request",
    };

    let base64EncodedPayload = Buffer.from(JSON.stringify(refundPayload), "utf8").toString("base64");
    let string = base64EncodedPayload + "/pg/v1/refund" + SALT_KEY;
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    const response = await makeRequestWithRetry(
      `${PHONE_PE_HOST_URL}/pg/v1/refund`,
      {
        method: 'POST',
        data: { request: base64EncodedPayload },
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          accept: "application/json",
        }
      }
    );

    if (response.data) {
      await mainDataSource.getRepository(Refund).insert({
        merchantTransactionId,
        amount,
        status: 'REQUESTED',
      });
      logAudit('Refund Requested', `Transaction ID: ${merchantTransactionId}, Amount: ${amount}`, response.data);
      res.send(response.data);
    } else {
      res.status(500).send("Error initiating refund");
    }
  } catch (error) {
    console.error("Error in /refund:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/refund/status/:refundId", async (req, res) => {
  const { refundId } = req.params;

  if (!refundId) {
    return res.status(400).send("Missing refund ID");
  }

  try {
    const refund = await mainDataSource.getRepository(Refund).findOneBy({ id: parseInt(refundId) });
    if (!refund) {
      return res.status(404).send("Refund not found");
    }

    let statusUrl = `${PHONE_PE_HOST_URL}/pg/v1/refund/${MERCHANT_ID}/${refundId}`;

    let string = `/pg/v1/refund/${MERCHANT_ID}/${refundId}` + SALT_KEY;
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    const response = await makeRequestWithRetry(
      statusUrl,
      {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          "X-MERCHANT-ID": MERCHANT_ID,
          accept: "application/json",
        }
      }
    );

    if (response.data) {
      await mainDataSource.getRepository(Refund).update({ id: parseInt(refundId) }, { status: response.data.status });
      logAudit('Refund Status Updated', `Refund ID: ${refundId}, Status: ${response.data.status}`,response.data);
      res.send(response.data);
    } else {
      res.status(500).send("Error fetching refund status");
    }
  } catch (error) {
    console.error("Error in /refund/status:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(3002, () => {
  console.log("Server running on port 3002");
});
