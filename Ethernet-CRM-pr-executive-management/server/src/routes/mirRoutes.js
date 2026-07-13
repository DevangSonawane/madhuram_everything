import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  uploadMirReference,
  createMir,
  getMirs,
  getMirById,
  getMirsByProject,
  updateMir,
  deleteMir,
} from '../controllers/mirController.js';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads', 'mir');

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename(_req, file, cb) {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), uploadMirReference);
router.post('/', createMir);
router.get('/', getMirs);
router.get('/project/:projectId', getMirsByProject);
router.get('/:id', getMirById);
router.put('/:id', updateMir);
router.delete('/:id', deleteMir);

export default router;
