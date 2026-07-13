import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  compressFile,
} from '../controllers/projectController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const projectsDir = path.join(process.cwd(), 'uploads', 'projects');
const compressedDir = path.join(process.cwd(), 'uploads', 'compressed');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const makeFilename = (originalname) => {
  const ext = path.extname(originalname);
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
};

const projectStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      ensureDir(projectsDir);
      cb(null, projectsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename(_req, file, cb) {
    cb(null, makeFilename(file.originalname));
  },
});

const compressStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      ensureDir(compressedDir);
      cb(null, compressedDir);
    } catch (error) {
      cb(error);
    }
  },
  filename(_req, file, cb) {
    cb(null, makeFilename(file.originalname));
  },
});

const projectUpload = multer({ storage: projectStorage });
const compressUpload = multer({ storage: compressStorage });

router.use(authenticate);

router.post(
  '/projects',
  projectUpload.fields([
    { name: 'work_order_file', maxCount: 1 },
    { name: 'mas_file', maxCount: 1 },
  ]),
  createProject,
);
router.get('/projects', getProjects);
router.get('/projects/:id', getProjectById);
router.put(
  '/projects/:id',
  projectUpload.fields([
    { name: 'work_order_file', maxCount: 1 },
    { name: 'mas_file', maxCount: 1 },
  ]),
  updateProject,
);
router.delete('/projects/:id', deleteProject);

router.post('/compress', compressUpload.single('file'), compressFile);

export default router;
