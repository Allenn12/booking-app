

export class AppError extends Error {
  constructor(message, statusCode = 500, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const ERRORS = {
  CONFLICT: (msg) => new AppError(msg, 409, 'CONFLICT'),
  VALIDATION: (msg) => new AppError(msg, 400, 'VALIDATION'),
  DATABASE: (msg) => new AppError(msg, 500, 'DATABASE'),
  NOT_FOUND: (msg) => new AppError(msg, 404, 'NOT_FOUND'),
  AUTH: (msg) => new AppError(msg, 401, 'AUTH'),
  FORBIDDEN: (msg) => new AppError(msg, 403, 'FORBIDDEN'),
  RATE_LIMIT: (msg) => new AppError(msg, 429, 'RATE_LIMIT'),
  PAYMENT_REQUIRED: (msg) => new AppError(msg, 403, 'PAYMENT_REQUIRED')
};

export default AppError;