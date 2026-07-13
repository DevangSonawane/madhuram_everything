import express from 'express';
import {
  createInventory,
  getInventories,
  getInventoryById,
  getInventoriesByProject,
  updateInventory,
  deleteInventory,
} from '../controllers/inventoryController.js';

const router = express.Router();

router.post('/', createInventory);
router.get('/', getInventories);
router.get('/project/:projectId', getInventoriesByProject);
router.get('/:id', getInventoryById);
router.put('/:id', updateInventory);
router.delete('/:id', deleteInventory);

export default router;
