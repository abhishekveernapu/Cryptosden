Based on the provided project files, here is a comprehensive `README.md` file for the **CryptosDen** repository. 

```markdown
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
```
