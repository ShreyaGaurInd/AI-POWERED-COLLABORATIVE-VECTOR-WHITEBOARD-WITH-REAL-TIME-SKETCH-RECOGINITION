import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ENV } from '../config/env.js';
import { sendVerificationEmail } from '../services/mailService.js';

// Curated avatar colors for clean profile avatars
const AVATAR_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

function getRandomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Generate secure 6-digit numeric verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Zod validation schemas
const registerSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
  avatarColor: z.string().optional(),
});

const verifyEmailSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const resendCodeSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Register a new user & generate email verification code
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response) {
  const { email, password, fullName, avatarColor } = registerSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  const verificationCode = generateVerificationCode();
  const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

  if (existingUser) {
    if (existingUser.isVerified) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists and is verified. Please log in.',
      });
    }

    // If existing account was never verified, update credentials & send new code
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName,
        passwordHash,
        avatarColor: avatarColor || existingUser.avatarColor,
        verificationCode,
        verificationExpires,
      },
    });
  } else {
    // Create new unverified user
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName,
        avatarColor: avatarColor || getRandomColor(),
        isVerified: false,
        verificationCode,
        verificationExpires,
      },
    });
  }

  // Send verification email via Nodemailer
  await sendVerificationEmail({
    to: normalizedEmail,
    fullName,
    code: verificationCode,
  });

  return res.status(200).json({
    success: true,
    message: 'Verification code sent to your email address.',
    data: {
      email: normalizedEmail,
      verificationRequired: true,
    },
  });
}

/**
 * Verify Email with 6-digit Code
 * POST /api/auth/verify-email
 */
export async function verifyEmail(req: Request, res: Response) {
  const { email, code } = verifyEmailSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Account not found. Please register first.',
    });
  }

  if (user.isVerified) {
    return res.status(400).json({
      success: false,
      message: 'Your email is already verified. You can log in directly.',
    });
  }

  // Check code match
  if (!user.verificationCode || user.verificationCode !== code.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code. Please check and try again.',
    });
  }

  // Check code expiration
  if (!user.verificationExpires || new Date() > user.verificationExpires) {
    return res.status(400).json({
      success: false,
      message: 'Verification code has expired. Please request a new one.',
    });
  }

  // Mark user as verified & clear code
  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationCode: null,
      verificationExpires: null,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarColor: true,
      createdAt: true,
    },
  });

  // Issue JWT token upon successful verification
  const token = jwt.sign(
    { userId: verifiedUser.id, email: verifiedUser.email },
    ENV.JWT_SECRET,
    { expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );

  return res.status(200).json({
    success: true,
    message: 'Email verified successfully! Welcome to CollabBoard.',
    data: {
      user: verifiedUser,
      token,
    },
  });
}

/**
 * Resend Verification Code
 * POST /api/auth/resend-code
 */
export async function resendVerificationCode(req: Request, res: Response) {
  const { email } = resendCodeSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Account not found.',
    });
  }

  if (user.isVerified) {
    return res.status(400).json({
      success: false,
      message: 'Account is already verified. Please log in.',
    });
  }

  const verificationCode = generateVerificationCode();
  const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationCode,
      verificationExpires,
    },
  });

  await sendVerificationEmail({
    to: normalizedEmail,
    fullName: user.fullName,
    code: verificationCode,
  });

  return res.json({
    success: true,
    message: 'A fresh verification code has been sent to your email.',
  });
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Incorrect email or password.',
    });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Incorrect email or password.',
    });
  }

  // Ensure user has verified their email
  if (!user.isVerified) {
    const verificationCode = generateVerificationCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode,
        verificationExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await sendVerificationEmail({
      to: normalizedEmail,
      fullName: user.fullName,
      code: verificationCode,
    });

    return res.status(403).json({
      success: false,
      requiresVerification: true,
      email: normalizedEmail,
      message: 'Please verify your email address to continue.',
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    ENV.JWT_SECRET,
    { expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );

  return res.json({
    success: true,
    message: 'Logged in successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt,
      },
      token,
    },
  });
}

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
export async function getMe(req: Request, res: Response) {
  return res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
}
