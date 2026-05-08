import fs from 'node:fs/promises';
import { AppError } from '../middleware/errorHandler.js';

const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const apiVersion = process.env.GEMINI_API_VERSION || 'v1beta';

export function buildFaceSwapPrompt(customInstruction = '') {
  const basePrompt = `Replace the face in the target thumbnail with the face from the uploaded portrait while preserving the original pose, lighting, composition, camera angle, expression, cinematic quality, and background. Only change the target face. Keep the body, hair silhouette when appropriate, clothing, background, text, objects, and thumbnail layout intact. Make the result realistic, seamless, detailed, natural, high quality, and free from artifacts.`;
  const trimmedInstruction = String(customInstruction || '').trim();

  if (!trimmedInstruction) {
    return basePrompt;
  }

  return `${basePrompt}\n\nAdditional user instruction: ${trimmedInstruction}`;
}

async function fileToInlineData(file) {
  const data = await fs.readFile(file.path);
  return {
    mimeType: file.mimetype,
    data: data.toString('base64'),
  };
}

export async function generateFaceSwap({ target, portrait, customInstruction }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY belum disetel. Tambahkan API key ke file .env.', 500);
  }

  const prompt = buildFaceSwapPrompt(customInstruction);
  const [targetInlineData, portraitInlineData] = await Promise.all([
    fileToInlineData(target),
    fileToInlineData(portrait),
  ]);

  const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${prompt}\n\nImage 1 is the target thumbnail. Image 2 is the replacement portrait. Return exactly one edited image as the final answer.` },
            { text: 'Image 1: target thumbnail' },
            { inlineData: targetInlineData },
            { text: 'Image 2: replacement portrait with one main face' },
            { inlineData: portraitInlineData },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = payload?.error?.message || 'Request ke Gemini API gagal.';
    throw new AppError(apiMessage, response.status >= 500 ? 502 : response.status, payload);
  }

  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);

  if (!imagePart) {
    const textFallback = parts.map((part) => part.text).filter(Boolean).join(' ');
    throw new AppError(
      textFallback || 'Gemini tidak mengembalikan gambar. Coba prompt lain atau gunakan gambar yang lebih jelas.',
      502,
      payload
    );
  }

  const inlineData = imagePart.inlineData || imagePart.inline_data;
  return {
    prompt,
    model,
    buffer: Buffer.from(inlineData.data, 'base64'),
    mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png',
  };
}
