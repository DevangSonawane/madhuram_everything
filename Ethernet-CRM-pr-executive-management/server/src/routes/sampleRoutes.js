import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  uploadSampleFiles,
  createSample,
  getSamples,
  getSampleById,
  getSamplesByProject,
  updateSample,
  deleteSample,
} from '../controllers/sampleController.js';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads', 'sample');

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

router.post('/upload', upload.array('file'), uploadSampleFiles);
router.post('/', createSample);
router.post('/create-sample', createSample);
router.get('/', getSamples);
router.get('/project/:projectId', getSamplesByProject);
router.get('/:id', getSampleById);
router.put('/:id', updateSample);
router.delete('/:id', deleteSample);

export default router;
