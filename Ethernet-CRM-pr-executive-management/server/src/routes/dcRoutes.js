import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  uploadDCFile,
  createDC,
  getDCsByProject,
  getDCsByPO,
  getDCById,
  updateDC,
  deleteDC
} from '../controllers/dcController.js';

const router = express.Router();
const UPLOAD_FOLDER = path.join(process.cwd(), 'uploads', 'dc');

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

router.post('/upload', upload.single('file'), uploadDCFile);
router.post('/', createDC);
router.get('/project/:projectId', getDCsByProject);
router.get('/po/:poId', getDCsByPO);
router.get('/:id', getDCById);
router.put('/:id', updateDC);
router.delete('/:id', deleteDC);

export default router;
