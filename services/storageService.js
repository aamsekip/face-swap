import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler.js';

const rootDir = process.cwd();
const tmpDir = path.join(rootDir, 'uploads', 'tmp');
const resultDir = path.join(rootDir, 'uploads', 'results');
const dataDir = path.join(rootDir, 'data');
const historyPath = path.join(dataDir, 'history.json');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploads = new Map();

export async function ensureStorage() {
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(resultDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(historyPath);
  } catch {
    await fs.writeFile(historyPath, '[]', 'utf8');
  }
}

export async function validateImage(file, label) {
  if (!file) {
    throw new AppError(`${label} wajib diupload.`, 400);
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new AppError(`${label} harus berupa JPG, PNG, atau WEBP.`, 400);
  }

  const metadata = await sharp(file.path).metadata();
  if (!metadata.width || !metadata.height) {
    throw new AppError(`${label} bukan file gambar yang valid.`, 400);
  }

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: file.size,
    mimetype: file.mimetype,
  };
}

export function createUploadRecord(files) {
  const id = uuidv4();
  const record = {
    id,
    target: files.target[0],
    portrait: files.portrait[0],
    createdAt: Date.now(),
  };

  uploads.set(id, record);
  return record;
}

export function getUploadRecord(id) {
  return uploads.get(id);
}

export async function removeUploadRecord(id) {
  const record = uploads.get(id);
  if (!record) return;

  uploads.delete(id);
  await Promise.allSettled([
    fs.rm(record.target.path, { force: true }),
    fs.rm(record.portrait.path, { force: true }),
  ]);
}

export async function saveResultImage(buffer, mimeType = 'image/png') {
  const extension = mimeType.includes('webp') ? 'webp' : mimeType.includes('jpeg') ? 'jpg' : 'png';
  const id = uuidv4();
  const filename = `${id}.${extension}`;
  const outputPath = path.join(resultDir, filename);

  await fs.writeFile(outputPath, buffer);
  return {
    id,
    filename,
    path: outputPath,
    url: `/uploads/results/${filename}`,
    createdAt: new Date().toISOString(),
  };
}

export async function addHistoryItem(item) {
  const history = await readHistory();
  const nextHistory = [item, ...history].slice(0, 30);
  await fs.writeFile(historyPath, JSON.stringify(nextHistory, null, 2), 'utf8');
  return nextHistory;
}

export async function readHistory() {
  try {
    const content = await fs.readFile(historyPath, 'utf8');
    return JSON.parse(content || '[]');
  } catch {
    return [];
  }
}

export async function getResultById(id) {
  const history = await readHistory();
  return history.find((item) => item.id === id);
}

export function publicUrl(req, urlPath) {
  const configuredBaseUrl = process.env.PUBLIC_BASE_URL;
  const baseUrl = configuredBaseUrl || `${req.protocol}://${req.get('host')}`;
  return new URL(urlPath, baseUrl).toString();
}

export async function cleanupExpiredFiles() {
  const now = Date.now();
  const uploadTtl = Number(process.env.UPLOAD_TTL_MINUTES || 60) * 60 * 1000;
  const resultTtl = Number(process.env.RESULT_TTL_MINUTES || 1440) * 60 * 1000;

  for (const [id, record] of uploads.entries()) {
    if (now - record.createdAt > uploadTtl) {
      await removeUploadRecord(id);
    }
  }

  const files = await fs.readdir(resultDir).catch(() => []);
  await Promise.allSettled(
    files.map(async (file) => {
      const filePath = path.join(resultDir, file);
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > resultTtl) {
        await fs.rm(filePath, { force: true });
      }
    })
  );
}

export function startCleanupJob() {
  setInterval(() => {
    cleanupExpiredFiles().catch((error) => console.error('Cleanup job failed:', error.message));
  }, 15 * 60 * 1000).unref();
}
