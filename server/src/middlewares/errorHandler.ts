import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Global API Error Handling Middleware
 * Intercepts uncaught exceptions, Zod validation errors, and operational errors,
 * formatting them into structured JSON responses.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  console.error('API Error:', err);

  // Zod Input Validation Error Handler
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Known HTTP operational status code or fallback 500
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
