import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type:      String,
    required:  [true, 'Username is required'],
    unique:    true,
    trim:      true,
    minlength: 3,
    maxlength: 30,
    match:     [/^[a-zA-Z0-9_]+$/, 'Username: letters, numbers, underscores only'],
  },
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
    match:     [/^\S+@\S+\.\S+$/, 'Invalid email'],
  },
  password: {
    type:      String,
    required:  [true, 'Password is required'],
    minlength: 6,
    select:    false,
  },
  // Wishlist: max 5 coins
  wishlist: {
    type:     [String],
    validate: {
      validator: (v) => v.length <= 5,
      message:   'Wishlist cannot exceed 5 cryptocurrencies',
    },
    default: [],
  },
  theme:    { type: String, enum: ['dark', 'light'], default: 'dark' },
  currency: { type: String, enum: ['usd','inr','eur','gbp'], default: 'usd' },
  emailAlerts: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
