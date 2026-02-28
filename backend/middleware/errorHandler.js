export function errorHandler(err, req, res, next) {
  console.error('❌ Error caught by errorHandler:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'UNKNOWN_ERROR';
  
  // Handle specific MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Duplicate entry - resource already exists';
    code = 'CONFLICT';
  }
  
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Invalid reference - foreign key constraint failed';
    code = 'VALIDATION';
  }
  
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    statusCode = 503;
    message = 'Database connection lost';
    code = 'DATABASE';
  }
  
  // Response format
  const response = {
    success: false,
    error: message,
    code: code
  };
  
  // Add stack trace samo u development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
}

export default errorHandler;
