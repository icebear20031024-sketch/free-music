import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from './error-handler.js';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('errorHandler', () => {
  it('should format standard error and return status code 500', () => {
    const err = new Error('Test Error');
    const req = { method: 'GET', url: '/test' } as Request;
    
    let statusCode = 0;
    let responseBody: any = null;
    const res = {
      status: vi.fn().mockImplementation((code) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn().mockImplementation((body) => {
        responseBody = body;
        return res;
      }),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(logger.error).toHaveBeenCalled();
    expect(statusCode).toBe(500);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error).toBe('Test Error');
  });

  it('should use custom status code if provided', () => {
    const err = { statusCode: 404, message: 'Not Found' };
    const req = { method: 'GET', url: '/test' } as Request;
    
    let statusCode = 0;
    const res = {
      status: vi.fn().mockImplementation((code) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(statusCode).toBe(404);
  });
});
