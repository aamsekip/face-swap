import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateController, historyController, resultController } from '../controllers/generateController.js';
import { uploadController } from '../controllers/uploadController.js';
import { uploadImages } from '../middleware/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

router.post('/upload', uploadImages, uploadController);
router.post('/generate', generateController);
router.get('/result/:id', resultController);
router.get('/history', historyController);

export default router;
