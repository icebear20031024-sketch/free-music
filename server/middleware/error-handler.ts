import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  logger.error(`Error handling ${req.method} ${req.url}:`, err);
  
  const error = err as { statusCode?: number; message?: string; stack?: string };
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
}
