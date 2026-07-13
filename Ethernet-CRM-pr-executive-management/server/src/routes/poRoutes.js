import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  uploadPOFile,
  createPO,
  getPOsByProject,
  getPOById,
  updatePO,
  deletePO
} from '../controllers/poController.js';

const router = express.Router();
const UPLOAD_FOLDER = path.join(process.cwd(), 'uploads', 'po');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
      cb(null, UPLOAD_FOLDER);
    } catch (error) {
      cb(error);
    }
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const uniqueName = `${timestamp}-${Math.round(Math.random() * 1e6)}${extension}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), uploadPOFile);
router.post('/', createPO);
router.get('/project/:projectId', getPOsByProject);
router.get('/:id', getPOById);
router.put('/:id', updatePO);
router.delete('/:id', deletePO);

export default router;
