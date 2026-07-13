import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  uploadPriceListFile,
  getVendorPriceLists,
  getVendorPriceListById,
  createVendorPriceList,
  updateVendorPriceList,
  deleteVendorPriceList,
  updateVendorPriceListStatus,
} from '../controllers/vendorPriceListController.js';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'price_lists');

const ensureDir = () => {
  fs.mkdirSync(uploadDir, { recursive: true });
};

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      ensureDir();
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), uploadPriceListFile);
router.get('/vendor/:vendorId', getVendorPriceLists);
router.get('/:id', getVendorPriceListById);
router.post('/', createVendorPriceList);
router.put('/:id', updateVendorPriceList);
router.delete('/:id', deleteVendorPriceList);
router.patch('/:id/status', updateVendorPriceListStatus);

export default router;
