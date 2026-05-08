import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { AppError } from './errorHandler.js';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 8);

const storage = multer.diskStorage({
  destination: 'uploads/tmp',
  filename: (req, file, callback) => {
    const safeExt = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${safeExt}`;
    callback(null, uniqueName);
  },
});

function imageFileFilter(req, file, callback) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return callback(new AppError('Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.', 400));
  }

  callback(null, true);
}

export const uploadImages = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
    files: 2,
  },
}).fields([
  { name: 'target', maxCount: 1 },
  { name: 'portrait', maxCount: 1 },
]);
