import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { generateFaceSwap } from '../services/geminiService.js';
import {
  addHistoryItem,
  getResultById,
  getUploadRecord,
  publicUrl,
  readHistory,
  removeUploadRecord,
  saveResultImage,
} from '../services/storageService.js';

export const generateController = asyncHandler(async (req, res) => {
  const { uploadId, prompt = '' } = req.body;

  if (!uploadId) {
    throw new AppError('uploadId wajib dikirim. Upload gambar terlebih dahulu.', 400);
  }

  const record = getUploadRecord(uploadId);
  if (!record) {
    throw new AppError('Upload tidak ditemukan atau sudah kedaluwarsa. Silakan upload ulang.', 404);
  }

  const result = await generateFaceSwap({
    target: record.target,
    portrait: record.portrait,
    customInstruction: prompt,
  });

  const saved = await saveResultImage(result.buffer, result.mimeType);
  const historyItem = {
    id: saved.id,
    url: saved.url,
    absoluteUrl: publicUrl(req, saved.url),
    prompt: result.prompt,
    customInstruction: prompt,
    model: result.model,
    createdAt: saved.createdAt,
  };

  await addHistoryItem(historyItem);
  await removeUploadRecord(uploadId);

  res.json({
    success: true,
    message: 'Face swap selesai dibuat.',
    result: historyItem,
  });
});

export const resultController = asyncHandler(async (req, res) => {
  const result = await getResultById(req.params.id);
  if (!result) {
    throw new AppError('Result tidak ditemukan atau sudah dihapus oleh cleanup otomatis.', 404);
  }

  res.json({ success: true, result });
});

export const historyController = asyncHandler(async (req, res) => {
  const history = await readHistory();
  res.json({ success: true, history });
});
