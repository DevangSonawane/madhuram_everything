import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  uploadItrFile,
  createItr,
  getItrs,
  getItrById,
  getItrsByProject,
  updateItr,
  deleteItr,
} from '../controllers/itrController.js';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads', 'itr');

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

router.post('/upload', upload.single('file'), uploadItrFile);
router.post('/', createItr);
router.get('/', getItrs);
router.get('/project/:projectId', getItrsByProject);
router.get('/:id', getItrById);
router.put('/:id', updateItr);
router.delete('/:id', deleteItr);

export default router;
