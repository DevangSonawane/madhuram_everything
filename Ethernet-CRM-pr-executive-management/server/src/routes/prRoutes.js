import express from 'express';
import multer from 'multer';
import { sendPrEmail } from '../controllers/prEmailController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/email', upload.single('attachment'), sendPrEmail);

export default router;
