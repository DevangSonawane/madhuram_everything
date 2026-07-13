import express from 'express';
import {
  createVendor,
  getVendors,
  getVendorsByProject,
  getVendorById,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
} from '../controllers/vendorController.js';

const router = express.Router();

router.post('/', createVendor);
router.get('/', getVendors);
router.get('/project/:projectId', getVendorsByProject);
router.get('/:id', getVendorById);
router.put('/:id', updateVendor);
router.patch('/:id/status', updateVendorStatus);
router.delete('/:id', deleteVendor);

export default router;
