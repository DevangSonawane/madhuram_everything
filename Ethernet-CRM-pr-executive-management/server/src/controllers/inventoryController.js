import Inventory from '../models/Inventory.js';

const toInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const toNum = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

export const createInventory = async (req, res) => {
  try {
    const quantity = toNum(req.body.quantity);
    const currentQuantity = toNum(req.body.current_quantity);
    const payload = {
      project_id: toInt(req.body.project_id),
      brand: req.body.brand,
      quantity,
      current_quantity: currentQuantity ?? quantity,
      name: req.body.name,
      price: toNum(req.body.price),
      unit: req.body.unit ?? null,
      width: toNum(req.body.width),
      height: toNum(req.body.height),
      stockin: Boolean(req.body.stockin),
      billing: req.body.billing != null ? Boolean(req.body.billing) : false,
      source_dc_id: toInt(req.body.source_dc_id),
      source_po_id: toInt(req.body.source_po_id),
      source_pr_id: toInt(req.body.source_pr_id),
      source_sample_id: toInt(req.body.source_sample_id),
    };

    if (
      payload.project_id == null ||
      payload.quantity == null ||
      !payload.name ||
      payload.price == null ||
      typeof req.body.stockin === 'undefined'
    ) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const created = await Inventory.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create inventory error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getInventories = async (_req, res) => {
  const rows = await Inventory.findAll({ order: [['created_at', 'DESC']] });
  return res.status(200).json(rows);
};

export const getInventoryById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const row = await Inventory.findByPk(id);
  if (!row) return res.status(404).json({ error: 'Inventory item not found' });
  return res.status(200).json(row);
};

export const getInventoriesByProject = async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (Number.isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  const rows = await Inventory.findAll({
    where: { project_id: projectId },
    order: [['created_at', 'DESC']],
  });
  return res.status(200).json(rows);
};

export const updateInventory = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const row = await Inventory.findByPk(id);
  if (!row) return res.status(404).json({ error: 'Inventory item not found' });

  const payload = {};
  if (req.body.brand !== undefined) payload.brand = req.body.brand;
  if (req.body.quantity !== undefined) payload.quantity = toNum(req.body.quantity);
  if (req.body.current_quantity !== undefined) payload.current_quantity = toNum(req.body.current_quantity);
  if (req.body.name !== undefined) payload.name = req.body.name;
  if (req.body.price !== undefined) payload.price = toNum(req.body.price);
  if (req.body.unit !== undefined) payload.unit = req.body.unit;
  if (req.body.width !== undefined) payload.width = toNum(req.body.width);
  if (req.body.height !== undefined) payload.height = toNum(req.body.height);
  if (req.body.stockin !== undefined) payload.stockin = Boolean(req.body.stockin);
  if (req.body.billing !== undefined) payload.billing = Boolean(req.body.billing);
  if (req.body.source_dc_id !== undefined) payload.source_dc_id = toInt(req.body.source_dc_id);
  if (req.body.source_po_id !== undefined) payload.source_po_id = toInt(req.body.source_po_id);
  if (req.body.source_pr_id !== undefined) payload.source_pr_id = toInt(req.body.source_pr_id);
  if (req.body.source_sample_id !== undefined) payload.source_sample_id = toInt(req.body.source_sample_id);

  if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No fields to update' });

  await row.update(payload);
  return res.status(200).json(row);
};

export const deleteInventory = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const row = await Inventory.findByPk(id);
  if (!row) return res.status(404).json({ error: 'Inventory item not found' });

  await row.destroy();
  return res.status(200).json({ message: 'Inventory item deleted successfully' });
};
