// importing modules
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const rateLimit = require('express-rate-limit');

// creating express application
const app = express();

// UAT environment
const MERCHANT_ID = "PGTESTPAYUAT86";
const PHONE_PE_HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const SALT_INDEX = 1;
const SALT_KEY = "96434309-7796-489d-8924-ab56988a6076";
const APP_BE_URL = "http://localhost:3000"; // our application

// setting up middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Implement rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Retry logic function
async function makeRequestWithRetry(url, options, retries = 0, delay = 1000) {
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

// Defining a test route
app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});

// Endpoint to initiate a payment
app.get("/pay", async (req, res) => {
  try {
    // Transaction amount
    const amount = parseFloat(req.query.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).send("Invalid amount");
    }

    // User ID is the ID of the user present in our application DB
    let userId = "MUID123";

    // Generate a unique merchant transaction ID for each transaction
    let merchantTransactionId = uniqid();

    // Redirect URL => PhonePe will redirect the user to this URL once payment is completed
    let normalPayLoad = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: userId,
      amount: amount * 100, // converting to paise
      redirectUrl: `${APP_BE_URL}?txn_id=${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      mobileNumber: "9999999999",
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    // Make base64 encoded payload
    let base64EncodedPayload = Buffer.from(JSON.stringify(normalPayLoad), "utf8").toString("base64");

    // X-VERIFY => SHA256(base64EncodedPayload + "/pg/v1/pay" + SALT_KEY) + ### + SALT_INDEX
    let string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    const response = await makeRequestWithRetry(
      `${PHONE_PE_HOST_URL}/pg/v1/pay`,
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

    if (response.data && response.data.data && response.data.data.instrumentResponse) {
      res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
    } else {
      res.status(500).send("Error initiating payment");
    }
  } catch (error) {
    console.error("Error in /pay:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to check the status of payment
app.get("/payment/validate/:merchantTransactionId", async (req, res) => {
  const { merchantTransactionId } = req.params;

  if (!merchantTransactionId) {
    return res.status(400).send("Missing transaction ID");
  }

  try {
    let statusUrl = `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;

    // Generate X-VERIFY
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
        res.send(response.data);
      } else {
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

// Starting the server
const port = 3002;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});
