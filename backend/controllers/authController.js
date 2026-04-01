import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Helper function to generate and send JWT token
const sendToken = (user, code, res) => {
  res.status(code).json({
    success: true,
    token: jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRES_IN || '30d' 
    }),
    user: { 
      id: user._id, 
      username: user.username, 
      email: user.email, 
      wishlist: user.wishlist, 
      theme: user.theme, 
      currency: user.currency 
    },
  });
};

// 1. Standard Register
export const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) throw ApiError.badRequest('All fields required');
  const user = await User.create({ username, email, password });
  sendToken(user, 201, res);
});

// 2. Standard Login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw ApiError.badRequest('Email and password required');
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  sendToken(user, 200, res);
});

// 3. Get Current User (This was the one missing causing the crash!)
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// 4. New Firebase OAuth Login
export const firebaseLogin = asyncHandler(async (req, res) => {
  const { email, displayName, uid, provider } = req.body;

  if (!email) throw ApiError.badRequest('Email is required from OAuth provider');

  // Check if user already exists in MongoDB
  let user = await User.findOne({ email });

  if (!user) {
    // Generate a secure random password since they use OAuth
    const randomPassword = Math.random().toString(36).slice(-10) + 'A1!'; 
    
    // Create base username from display name or email
    const baseUsername = displayName 
      ? displayName.replace(/\s+/g, '').toLowerCase() 
      : email.split('@')[0];
    
    // Ensure username is unique
    let username = baseUsername;
    let counter = 1;
    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    user = await User.create({
      username,
      email,
      password: randomPassword, 
    });
  }

  // Send back your app's standard JWT token
  sendToken(user, 200, res);
});
