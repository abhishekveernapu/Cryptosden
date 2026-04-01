import mongoose from 'mongoose';

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME || 'cryptosden',
  });
  isConnected = true;
  console.log(`MongoDB: ${conn.connection.host}`);
  mongoose.connection.on('disconnected', () => {
    console.warn('  MongoDB disconnected');
    isConnected = false;
  });
};

export default connectDB;
