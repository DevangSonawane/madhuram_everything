import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  createBOQ,
  createBOQLodha,
  createBOQHiranandani,
  getBOQs,
  getBOQById,
  getBOQsByProject,
  updateBOQ,
  deleteBOQ,
} from '../controllers/boqController.js';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads', 'boq');

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

router.post('/', upload.single('boq_file'), createBOQ);
router.post('/lodha', upload.single('boq_file'), createBOQLodha);
router.post('/hiranandani', upload.single('boq_file'), createBOQHiranandani);
router.get('/', getBOQs);
router.get('/project/:projectId', getBOQsByProject);
router.get('/:id', getBOQById);
router.put('/:id', upload.single('boq_file'), updateBOQ);
router.delete('/:id', deleteBOQ);

export default router;
