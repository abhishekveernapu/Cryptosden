import jwt  from 'jsonwebtoken';
import User from '../models/User.js';

export const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token   = socket.handshake.auth?.token;
      if (!token) return next(new Error('Auth required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('username email');
      if (!user) return next(new Error('User not found'));
      socket.user   = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 ${socket.user.username} connected`);
    socket.join(`user:${socket.user._id}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 ${socket.user.username} disconnected (${reason})`);
    });
  });
};

export const notifyUser  = (io, userId, data) => io.to(`user:${userId}`).emit('notification', data);
export const broadcast   = (io, event, data)  => io.emit(event, data);
