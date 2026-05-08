import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { createUploadRecord, removeUploadRecord, validateImage } from '../services/storageService.js';

export const uploadController = asyncHandler(async (req, res) => {
  const target = req.files?.target?.[0];
  const portrait = req.files?.portrait?.[0];

  try {
    const [targetMeta, portraitMeta] = await Promise.all([
      validateImage(target, 'Gambar target'),
      validateImage(portrait, 'Foto portrait'),
    ]);

    if (portraitMeta.width < 256 || portraitMeta.height < 256) {
      throw new AppError('Foto portrait terlalu kecil. Gunakan minimal 256x256 px agar wajah terbaca jelas.', 400);
    }

    const record = createUploadRecord(req.files);

    res.status(201).json({
      success: true,
      uploadId: record.id,
      message: 'Upload berhasil. Gambar siap diproses AI.',
      files: {
        target: targetMeta,
        portrait: portraitMeta,
      },
    });
  } catch (error) {
    await Promise.allSettled([
      target?.path ? removeTempFile(target.path) : null,
      portrait?.path ? removeTempFile(portrait.path) : null,
    ]);
    throw error;
  }
});

async function removeTempFile(filePath) {
  const { rm } = await import('node:fs/promises');
  await rm(filePath, { force: true });
}
