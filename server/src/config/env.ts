import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

/**
 * Validated Environment Variables Configuration
 * Provides centralized access to application-wide configuration.
 */
export const ENV = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/collab_whiteboard',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_collab_whiteboard_2025',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};
