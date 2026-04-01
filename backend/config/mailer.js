import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendAlertEmail = async (toEmail, subject, html) => {
  if (!process.env.SMTP_USER) return;  // skip if not configured
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      toEmail,
      subject,
      html,
    });
  } catch (err) {
    console.error(' Email send failed:', err.message);
  }
};

export const buildAlertEmailHtml = (coinName, type, change, price, message) => `
<!DOCTYPE html>
<html>
<body style="font-family:Inter,sans-serif;background:#0d1117;color:#e6edf3;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#161b22;border-radius:12px;padding:24px;border:1px solid #30363d">
    <h2 style="color:${type==='pump'?'#3fb950':'#f85149'};margin:0 0 12px">
      ${type==='pump'?'🚀':'📉'} CryptosDen Alert
    </h2>
    <p style="font-size:16px;margin:0 0 8px">${message}</p>
    <p style="color:#8b949e;font-size:14px">
      Current Price: <strong style="color:#e6edf3">$${price?.toLocaleString()}</strong>
      &nbsp;|&nbsp;
      24h Change: <strong style="color:${change>=0?'#3fb950':'#f85149'}">${change?.toFixed(2)}%</strong>
    </p>
    <hr style="border-color:#30363d;margin:16px 0"/>
    <p style="color:#8b949e;font-size:12px">
      ⚠️ This is not financial advice. Always do your own research.<br/>
      <a href="${process.env.FRONTEND_URL}" style="color:#58a6ff">Visit CryptosDen</a>
    </p>
  </div>
</body>
</html>`;
