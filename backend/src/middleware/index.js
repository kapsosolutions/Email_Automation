import multer from 'multer';
import path from 'node:path';
import { ACCEPTED_EXTENSIONS } from '../services/spreadsheet.js';

/** Wrap async route handlers so rejections reach the error middleware. */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Not found') => new HttpError(404, message);

/**
 * Spreadsheets are held in memory, parsed, and discarded. Nothing is written
 * to disk, so there is no upload directory to secure or clean up.
 */
export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      cb(badRequest(`Unsupported file type "${ext || 'unknown'}". Use CSV, XLS or XLSX.`));
      return;
    }
    cb(null, true);
  },
}).single('file');

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  const status = error.status || error.statusCode || 500;

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'File is larger than the 15 MB limit.'
        : `Upload failed: ${error.message}`;
    res.status(400).json({ error: message });
    return;
  }

  if (error?.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation failed',
      details: Object.values(error.errors || {}).map((e) => e.message),
    });
    return;
  }

  if (error?.name === 'CastError') {
    res.status(400).json({ error: `Invalid id "${error.value}"` });
    return;
  }

  if (status >= 500) console.error('[api]', error);

  res.status(status).json({
    error: error.message || 'Something went wrong',
    ...(error.details ? { details: error.details } : {}),
  });
}

export default { asyncHandler, uploadSpreadsheet, errorHandler, notFoundHandler, HttpError };
