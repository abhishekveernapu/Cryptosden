export class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors     = errors;
    this.isApiError = true;
  }
  static badRequest(msg)   { return new ApiError(400, msg); }
  static unauthorized(msg) { return new ApiError(401, msg || 'Unauthorized'); }
  static forbidden(msg)    { return new ApiError(403, msg || 'Forbidden'); }
  static notFound(msg)     { return new ApiError(404, msg || 'Not found'); }
  static conflict(msg)     { return new ApiError(409, msg); }
  static rateLimit(msg)    { return new ApiError(429, msg || 'Too many requests'); }
  static internal(msg)     { return new ApiError(500, msg || 'Internal server error'); }
}

export default ApiError; 
