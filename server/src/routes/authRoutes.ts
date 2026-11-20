import { Router } from 'express';
import {
  register,
  verifyEmail,
  resendVerificationCode,
  login,
  getMe,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

export const authRouter = Router();

// Public auth endpoints
authRouter.post('/register', register);
authRouter.post('/verify-email', verifyEmail);
authRouter.post('/resend-code', resendVerificationCode);
authRouter.post('/login', login);

// Protected user profile endpoint
authRouter.get('/me', authenticate, getMe);
