# Node.js Express PhonePe Payment Gateway Integration

Welcome to the Node.js Express PhonePe Payment Gateway Integration repository! This project demonstrates the seamless integration of the PhonePe payment gateway into a Node.js and Express application. Follow the comprehensive guide below to set up the payment gateway for User Acceptance Testing (UAT).

## Features

- **/pay API**: Initiates payments and redirects users to the PhonePe payment flow.
- **/payment/validate/:merchantTransactionId API**: Validates payment status using `merchantTransactionId`.

## UAT Testing Credentials

For testing purposes in the UAT environment, use the following credentials:
**Debit Card**
- **Card Number**: `4242424242424242`
- **Expiry Month**: `12`
- **Expiry Year**: `44`
- **CVV**: `936`
- **OTP**: `123456`



**Credit Card**
anchor image
“card_number”: “4208585190116667”,
“card_type”: “CREDIT_CARD”,
“card_issuer”: “VISA”,
“expiry_month”: 06,
“expiry_year”: 2027,
“cvv”: “508”

Note: The OTP to be used on the Bank Page: 123456

## How to Run

1. **Clone the project:**

   ```bash
   git clone https://github.com/Avinashkumar8694/zero-phonepe-integration.git
   cd phonepe-express
2. **Install dependencies:**
   npm install
3. **Run the app**
    npm start
4. **Open in your browser:**
    Access the payment initiation endpoint with a test amount:
    http://localhost:3002/pay?amount=300
    
## **API Endpoints**
### /pay
### Method: GET
### Description: Initiates a payment process with PhonePe.
### Parameters:
amount (query parameter): The amount to be paid (in decimal format).
## /payment/validate/
### Method: GET
### Description: Checks the status of a payment using the merchantTransactionId.
### URL Parameter:
#### merchantTransactionId: The transaction ID provided during payment initiation.


#### Reference:
For a detailed guide on integrating PhonePe with Node.js and Express, visit the **[Medium article](https://medium.com/@VivekNThakkar/integrating-phonepe-payment-gateway-with-node-js-and-express-js-66c64fa1657e)** and **other resources #google ☻︎**.
This `README.md` provides a clear overview of the project's features, installation steps, API endpoints, and contact information. It also includes a reference to the detailed guide mentioned.

