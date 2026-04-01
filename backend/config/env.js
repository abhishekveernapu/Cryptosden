const REQUIRED = [
  'MONGO_URI', 'JWT_SECRET','CRYPTOPANIC_API_KEY',
  'COINGECKO_API_KEY','COINGECKO_API_KEY2','COINGECKO_API_KEY3','COINGECKO_API_KEY4', 'COINGECKO_API_KEY5',
];

const OPTIONAL = [
   'SMTP_USER', 'SMTP_PASS',
];

export const validateEnv = () => {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(' Missing required env vars:');
    missing.forEach(k => console.error(`   - ${k}`));
    process.exit(1);
  }
  OPTIONAL
    .filter(k => !process.env[k])
    .forEach(k => console.warn(`  Optional env missing: ${k}`));
  console.log('Environment validated');
};
