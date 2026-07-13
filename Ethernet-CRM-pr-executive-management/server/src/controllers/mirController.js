import path from 'path';
import MIR from '../models/MIR.js';
import Project from '../models/Project.js';
import Inventory from '../models/Inventory.js';
import { parseJsonLike } from '../utils/jsonField.js';

const toInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const emptyToNull = (v) => (v === '' ? null : v);

const toBool = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  return Boolean(v);
};

const ensureArray = (value, fallback = []) => (Array.isArray(value) ? value : fallback);

const toNum = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const applyInventoryStockOut = async ({ items, context = '' } = {}) => {
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    const inventoryId = toInt(item?.inventory_id ?? item?.inventoryId);
    if (!inventoryId) {
      console.log('[stock-out] skipping item — no inventory_id', item);
      continue;
    }
    // Prefer issued_qty, fall back to qty
    const qty = toNum(item?.issued_qty ?? item?.issuedQty ?? item?.qty ?? item?.quantity);
    if (qty == null || qty <= 0) {
      console.log(`[stock-out] skipping item — qty is ${qty}`, item);
      continue;
    }

    const row = await Inventory.findByPk(inventoryId);
    if (!row) {
      console.log(`[stock-out] inventory row not found for id=${inventoryId}`);
      continue;
    }

    const current = toNum(row.current_quantity ?? row.quantity) ?? 0;
    const next = Math.max(0, current - qty);

    await row.update({
      quantity: next,
      current_quantity: next,
      stockin: next > 0,
    });

    console.log(`[stock-out] (${context}) inv=${inventoryId} current=${current} deduct=${qty} next=${next}`);
  }
};

const buildPayload = (body = {}, isUpdate = false) => {
  const payload = {
    project_name: emptyToNull(body.project_name),
    project_code: emptyToNull(body.project_code),
    client_name: emptyToNull(body.client_name),
    pmc: emptyToNull(body.pmc),
    contractor: emptyToNull(body.contractor),
    vendor_code: emptyToNull(body.vendor_code),
    challan_no: emptyToNull(body.challan_no),
    mir_refrence_no: emptyToNull(body.mir_refrence_no),
    material_code: emptyToNull(body.material_code),
    inspection_date_time: emptyToNull(body.inspection_date_time),
    client_submission_date: emptyToNull(body.client_submission_date),
    refrence_docs_attached: emptyToNull(body.refrence_docs_attached),
    mir_submited: toBool(body.mir_submited),
    dynamic_field: ensureArray(parseJsonLike(body.dynamic_field, []), []),
    po_id: Object.prototype.hasOwnProperty.call(body, 'po_id') ? toInt(body.po_id) : undefined,
    items: ensureArray(parseJsonLike(body.items, []), []),
    project_id: Object.prototype.hasOwnProperty.call(body, 'project_id') ? toInt(body.project_id) : undefined,
  };

  if (isUpdate) {
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });
  }

  return payload;
};

export const uploadMirReference = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  return res.status(200).json({ filePath: path.posix.join('/uploads/mir', req.file.filename) });
};

export const createMir = async (req, res) => {
  try {
    const payload = buildPayload(req.body);
    if (payload.project_id == null) return res.status(400).json({ error: 'Invalid project_id: Project does not exist' });

    const project = await Project.findByPk(payload.project_id);
    if (!project) return res.status(400).json({ error: 'Invalid project_id: Project does not exist' });

    console.log('MIR create payload items:', JSON.stringify(payload.items));
    const created = await MIR.create(payload);
    // Auto stock-out inventory when items include inventory_id.
    await applyInventoryStockOut({
      items: payload.items,
      context: `MIR create ${created?.mir_id || ''}`.trim(),
    });
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create MIR error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMirs = async (_req, res) => {
  try {
    // Order by primary key to avoid timestamp column mismatches in legacy DBs.
    const rows = await MIR.findAll({ order: [['mir_id', 'DESC']] });
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get MIRs error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMirById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const row = await MIR.findByPk(id);
    if (!row) return res.status(404).json({ error: 'MIR not found' });
    return res.status(200).json(row);
  } catch (error) {
    console.error('Get MIR by id error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMirsByProject = async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

    const rows = await MIR.findAll({
      where: { project_id: projectId },
      order: [['mir_id', 'DESC']],
    });
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get MIRs by project error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateMir = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const row = await MIR.findByPk(id);
    if (!row) return res.status(404).json({ error: 'MIR not found' });

    const oldItems = ensureArray(row.items, []);
    const payload = buildPayload(req.body, true);
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No fields to update' });

    if (payload.project_id != null) {
      const project = await Project.findByPk(payload.project_id);
      if (!project) return res.status(400).json({ error: 'Invalid project_id: Project does not exist' });
    }

    await row.update(payload);
    // Auto stock-out only for items that newly gained an inventory_id.
    if (payload.items) {
      const oldBySr = new Map();
      for (const it of ensureArray(oldItems, [])) {
        const sr = toInt(it?.srno);
        if (sr != null && !oldBySr.has(sr)) oldBySr.set(sr, it);
      }
      const newlyLinked = ensureArray(payload.items, []).filter((it) => {
        const sr = toInt(it?.srno);
        const nextInv = toInt(it?.inventory_id ?? it?.inventoryId);
        if (!nextInv) return false;
        const prev = sr != null ? oldBySr.get(sr) : null;
        const prevInv = toInt(prev?.inventory_id ?? prev?.inventoryId);
        return !prevInv;
      });
      await applyInventoryStockOut({
        items: newlyLinked,
        context: `MIR update ${id}`,
      });
    }
    return res.status(200).json(row);
  } catch (error) {
    console.error('Update MIR error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteMir = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const row = await MIR.findByPk(id);
    if (!row) return res.status(404).json({ error: 'MIR not found' });

    await row.destroy();
    return res.status(200).json({ message: 'MIR deleted successfully' });
  } catch (error) {
    console.error('Delete MIR error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
