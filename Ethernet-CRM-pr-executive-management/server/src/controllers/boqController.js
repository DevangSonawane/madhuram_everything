import path from 'path';
import BOQ from '../models/BOQ.js';

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const buildPayload = (req, isUpdate = false) => {
  const b = req.body || {};
  const payload = {
    category: b.category,
    item_no: b.item_no,
    item_code: b.item_code,
    description: b.description,
    floor: b.floor,
    unit: b.unit,
    quantity: toNumber(b.quantity),
    rate: toNumber(b.rate),
    amount: toNumber(b.amount),
    project_id: b.project_id != null && b.project_id !== '' ? parseInt(b.project_id, 10) : undefined,
  };

  if (req.file) {
    payload.boq_file = path.posix.join('/uploads/boq', req.file.filename);
  }

  if (isUpdate) {
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });
  }

  return payload;
};

export const createBOQ = async (req, res) => {
  try {
    const payload = buildPayload(req);
    if (!payload.category || payload.project_id == null || Number.isNaN(payload.project_id)) {
      return res.status(400).json({ error: 'Invalid project_id' });
    }

    const created = await BOQ.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create BOQ error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const createBOQLodha = async (req, res) => {
  try {
    const b = req.body || {};
    const payload = buildPayload(req);

    // Lodha layout: description, section, item_no, hsn, unit, qty, rate, amount
    payload.description = b.description ?? b.item_description ?? payload.description;
    payload.category = b.section ?? b.category ?? payload.category;
    payload.item_no = b.item_no ?? payload.item_no;
    payload.item_code = b.hsn ?? payload.item_code;
    payload.unit = b.unit ?? payload.unit;
    payload.quantity = toNumber(b.qty ?? payload.quantity);
    payload.rate = toNumber(b.rate ?? payload.rate);
    payload.amount = toNumber(b.amount ?? payload.amount);

    if (!payload.description || !payload.category || payload.project_id == null || Number.isNaN(payload.project_id)) {
      return res.status(400).json({ error: 'Missing required fields or invalid project_id' });
    }

    const created = await BOQ.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create Lodha BOQ error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const createBOQHiranandani = async (req, res) => {
  try {
    const b = req.body || {};
    const payload = buildPayload(req);

    // Hiranandani layout: description, section, item_no, sac_code, uom, order_qty, unit_price, value
    payload.description = b.description ?? b.service_description ?? payload.description;
    payload.category = b.section ?? b.category ?? payload.category;
    payload.item_no = b.item_no ?? payload.item_no;
    payload.item_code = b.sac_code ?? payload.item_code;
    payload.unit = b.uom ?? b.unit ?? payload.unit;
    payload.quantity = toNumber(b.order_qty ?? payload.quantity);
    payload.rate = toNumber(b.unit_price ?? payload.rate);
    payload.amount = toNumber(b.value ?? payload.amount);

    if (!payload.description || !payload.category || payload.project_id == null || Number.isNaN(payload.project_id)) {
      return res.status(400).json({ error: 'Missing required fields or invalid project_id' });
    }

    const created = await BOQ.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create Hiranandani BOQ error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const createBOQRustomjee = async (req, res) => {
  try {
    const b = req.body || {};
    const payload = buildPayload(req);

    // Rustomjee layout: sr_no, description, unit, qty, rate, amount
    payload.item_no = b.sr_no ?? b.item_no ?? payload.item_no;
    payload.description = b.description ?? payload.description;
    payload.unit = b.unit ?? payload.unit;
    payload.quantity = toNumber(b.qty ?? payload.quantity);
    payload.rate = toNumber(b.rate ?? payload.rate);
    payload.amount = toNumber(b.amount ?? payload.amount);
    payload.category = b.section ?? b.category ?? payload.category ?? 'Rustomjee';

    if (!payload.description || payload.project_id == null || Number.isNaN(payload.project_id)) {
      return res.status(400).json({ error: 'Missing required fields or invalid project_id' });
    }

    const created = await BOQ.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create Rustomjee BOQ error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const getBOQs = async (_req, res) => {
  try {
    const rows = await BOQ.findAll({ order: [['created_at', 'DESC']] });
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const getBOQById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const row = await BOQ.findByPk(id);
  if (!row) return res.status(404).json({ error: 'BOQ not found' });
  return res.status(200).json(row);
};

export const getBOQsByProject = async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (Number.isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  const rows = await BOQ.findAll({
    where: { project_id: projectId },
    order: [['created_at', 'DESC']],
  });
  return res.status(200).json(rows);
};

export const updateBOQ = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const row = await BOQ.findByPk(id);
    if (!row) return res.status(404).json({ error: 'BOQ not found' });

    const payload = buildPayload(req, true);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await row.update(payload);
    return res.status(200).json(row);
  } catch (error) {
    console.error('Update BOQ error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const deleteBOQ = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const row = await BOQ.findByPk(id);
  if (!row) return res.status(404).json({ error: 'BOQ not found' });

  await row.destroy();
  return res.status(200).json({ message: 'BOQ deleted successfully' });
};
