# CryptosDen

CryptosDen is an advanced cryptocurrency tracking and analytics platform. It provides users with real-time market data, AI/ML-driven price predictions, sentiment analysis, and market anomaly detection.

## 🚀 Key Features

* **Machine Learning Price Predictions:** Utilizes deep learning with TensorFlow.js to train Gated Recurrent Unit (GRU) models on historical price data for market forecasting.
* **Real-Time Data & WebSockets:** Delivers live price updates and alerts to the client using Socket.io.
* **Advanced Market Analytics:** Automatically runs background services for anomaly detection, sentiment analysis (via CryptoPanic), and trust scoring.
* **Interactive Dashboards:** Built with React and Vite, featuring rich data visualization powered by Chart.js.
* **User Accounts & Custom Alerts:** Secure user authentication using bcryptjs and jsonwebtoken, with customizable market alerts delivered via email using Nodemailer.

## 🛠️ Tech Stack

### Frontend
* **Core:** React 18, Vite
* **Routing:** React Router DOM
* **Data Fetching:** Axios
* **Visualizations:** Chart.js
* **Real-time:** Socket.io-client
* **Auth/DB:** Firebase

### Backend
* **Core:** Node.js (v20.20.1), Express
* **Database:** MongoDB (via Mongoose)
* **Machine Learning:** @tensorflow/tfjs-node
* **Real-time:** Socket.io
* **Task Scheduling:** Node-cron

## ⚙️ System Architecture & Automated Jobs

The backend features a robust scheduling system that autonomously maintains data freshness and trains AI models:

* **Every 5 Minutes:** Updates top coins data.
* **Every 15 Minutes:** Gathers and runs sentiment analysis.
* **Every 30 Minutes:** Executes market anomaly detection algorithms.
* **Hourly:** Computes and updates platform trust scores.
* **Daily at 1:00 AM:** Fetches extensive price history for supported coins.
* **Daily at 2:00 AM & 5:00 AM:** Performs deep market and fields updates.
* **Daily at 3:00 AM:** Initiates GRU model training (heavy services are paused during this window to allocate resources to TensorFlow).

## 💻 Installation & Setup

### Prerequisites
* Node.js v20.20.1
* MongoDB
* API Keys (CoinGecko, CryptoPanic, SMTP credentials)

### Backend Setup
1. Navigate to the backend directory.
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your `.env` file with `PORT`, `FRONTEND_URL`, `COINGECKO_API_KEY`, `CRYPTOPANIC_API_KEY`, and `SMTP_USER`.
4. Start the development server:
   ```bash
   npm run dev
   ```
   *(Alternatively, use `npm run train` to manually trigger the GRU model training script)*.

### Frontend Setup
1. Navigate to the frontend directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
## 🔐 Environment Variables

To run this project, you will need to create a `.env` file in your `backend` directory and add the following environment variables.

### Core Configuration
* **`PORT`**: The port the backend will run on (Default: `8080`).
* **`FRONTEND_URL`**: The origin URL of your frontend to allow CORS (Default: `http://localhost:5173`).
* **`MONGO_URI`**: Your MongoDB connection string for the database.
* **`JWT_SECRET`**: A strong, random string used by `jsonwebtoken` to sign authentication tokens.

### API Keys & Services
The backend relies on several third-party services. The platform uses a key-rotation strategy for CoinGecko to bypass strict free-tier rate limits.

* **`COINGECKO_API_KEY`**, **`COINGECKO_API_KEY2`**, **`...`**, **`COINGECKO_API_KEY5`**: 
  * **What it is:** Keys used to fetch real-time market data, historical charts, and exchange rates.
  * **How to get it:** Go to the [CoinGecko API portal](https://www.coingecko.com/en/api), create a free developer account, and generate Demo API keys. You can generate multiple keys or use keys from different free accounts to populate variables 1 through 5.
* **`CRYPTOPANIC_API_KEY`**:
  * **What it is:** Used by the sentiment analysis service to fetch the latest cryptocurrency news.
  * **How to get it:** Create a free account on [CryptoPanic](https://cryptopanic.com/), navigate to your account settings or the API section, and generate your developer authentication token.
* **`SMTP_USER`** & **`SMTP_PASS`**:
  * **What it is:** Credentials used by Nodemailer to dispatch custom market alerts to users.
  * **How to get it:** You can use a standard Gmail account. Go to your Google Account Security settings, enable 2-Step Verification, and create an "App Password" to use as your `SMTP_PASS`, while your email address is your `SMTP_USER`. Alternatively, use a service like SendGrid, Mailgun, or AWS SES.

### Example `.env` file:
```env
PORT=8080
FRONTEND_URL=http://localhost:5173
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/cryptosden
JWT_SECRET=your_super_secret_jwt_string

# API Keys
COINGECKO_API_KEY=your_cg_key_1
COINGECKO_API_KEY5=your_cg_key_2

CRYPTOPANIC_API_KEY=your_cryptopanic_key

# Email configuration
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_google_app_password
```
