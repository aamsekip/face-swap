export class AppError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function notFoundHandler(req, res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} tidak ditemukan.`, 404));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `Ukuran file terlalu besar. Maksimal ${process.env.MAX_FILE_SIZE_MB || 8}MB per gambar.`,
    });
  }

  return res.status(status).json({
    success: false,
    message: error.message || 'Terjadi kesalahan pada server.',
    details: isProduction ? undefined : error.details,
  });
}
