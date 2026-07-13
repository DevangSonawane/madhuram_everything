import path from 'path';
import fs from 'fs/promises';
import PurchaseOrder from '../models/PO.js';

const UPLOAD_FOLDER = path.join(process.cwd(), 'uploads', 'po');

const safeParseItems = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (err) {
      return [];
    }
  }
  return [];
};

const safeParseNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeDateValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY or DD-MM-YYYY
  const dayFirstMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const parsedDate = new Date(raw);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.toISOString().slice(0, 10);
};

const buildPayload = (body) => {
  const payload = {};
  const stringFields = [
    'company_name',
    'company_subtitle',
    'company_email',
    'company_gst',
    'indent_no',
    'order_no',
    'vendor_name',
    'site',
    'site_address',
    'primary_contact_name',
    'primary_contact_number',
    'secondary_contact_name',
    'secondary_contact_number',
    'delivery',
    'payment',
    'notes',
    'status'
  ];

  stringFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  });

  // Preserve the existing database column while accepting the new API field name.
  if (Object.prototype.hasOwnProperty.call(body, 'site_address')) {
    payload.vendor_address = body.site_address;
  } else if (Object.prototype.hasOwnProperty.call(body, 'vendor_address')) {
    payload.vendor_address = body.vendor_address;
  }

  const numericFields = [
    'discount',
    'discount_amount',
    'after_discount',
    'cgst',
    'cgst_amount',
    'sgst',
    'sgst_amount',
    'total_amount'
  ];

  numericFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const value = safeParseNumber(body[field]);
      payload[field] = value;
    }
  });

  const dateFields = ['indent_date', 'po_date'];
  dateFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = normalizeDateValue(body[field]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(body, 'items')) {
    payload.items = safeParseItems(body.items);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'project_id')) {
    const projectId = parseInt(body.project_id, 10);
    payload.project_id = Number.isNaN(projectId) ? null : projectId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'sample_id')) {
    const sampleId = parseInt(body.sample_id, 10);
    payload.sample_id = Number.isNaN(sampleId) ? null : sampleId;
  }

  return payload;
};

const ensureUploadFolder = async () => {
  try {
    await fs.mkdir(UPLOAD_FOLDER, { recursive: true });
  } catch (err) {
    console.warn('Unable to create PO upload folder:', err.message);
  }
};

export const uploadPOFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await ensureUploadFolder();
    const filePath = path.posix.join('/uploads/po', req.file.filename);

    return res.status(200).json({ filePath });
  } catch (error) {
    console.error('Upload PO file error:', error);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
};

export const createPO = async (req, res) => {
  try {
    const payload = buildPayload(req.body);

    if (payload.project_id == null) {
      return res.status(400).json({ message: 'project_id is required' });
    }

    if (payload.sample_id == null) {
      return res.status(400).json({ message: 'sample_id is required' });
    }

    const companyName = payload.company_name?.toString().trim();
    if (!companyName) {
      return res.status(400).json({ message: 'company_name is required' });
    }

    payload.company_name = companyName;
    
    payload.items = payload.items || [];

    const newPO = await PurchaseOrder.create(payload);
    return res.status(201).json(newPO);
  } catch (error) {
    console.error('Create PO error:', error);
    return res.status(500).json({ error: 'Failed to create purchase order' });
  }
};

export const getPOsByProject = async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid projectId' });
    }

    const records = await PurchaseOrder.findAll({
      where: { project_id: projectId },
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error('Get POs by project error:', error);
    return res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
};

export const getPOById = async (req, res) => {
  try {
    const poId = parseInt(req.params.id, 10);
    if (Number.isNaN(poId)) {
      return res.status(400).json({ message: 'Invalid PO id' });
    }

    const po = await PurchaseOrder.findOne({ where: { po_id: poId } });
    if (!po) {
      return res.status(404).json({ error: 'PO not found' });
    }

    return res.status(200).json(po);
  } catch (error) {
    console.error('Get PO by id error:', error);
    return res.status(500).json({ error: 'Failed to fetch PO' });
  }
};

export const updatePO = async (req, res) => {
  try {
    const poId = parseInt(req.params.id, 10);
    if (Number.isNaN(poId)) {
      return res.status(400).json({ message: 'Invalid PO id' });
    }

    const po = await PurchaseOrder.findOne({ where: { po_id: poId } });
    if (!po) {
      return res.status(404).json({ error: 'PO not found' });
    }

    const payload = buildPayload(req.body);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'No fields provided for update' });
    }

    // Enforce sample_id as mandatory in PO records.
    if (Object.prototype.hasOwnProperty.call(payload, 'sample_id') && payload.sample_id == null) {
      return res.status(400).json({ message: 'sample_id is required' });
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'sample_id') && po.sample_id == null) {
      return res.status(400).json({ message: 'sample_id is required' });
    }

    await po.update(payload);
    return res.status(200).json(po);
  } catch (error) {
    console.error('Update PO error:', error);
    return res.status(500).json({ error: 'Failed to update PO' });
  }
};

export const deletePO = async (req, res) => {
  try {
    const poId = parseInt(req.params.id, 10);
    if (Number.isNaN(poId)) {
      return res.status(400).json({ message: 'Invalid PO id' });
    }

    const po = await PurchaseOrder.findOne({ where: { po_id: poId } });
    if (!po) {
      return res.status(404).json({ error: 'PO not found' });
    }

    await po.destroy();
    return res.status(200).json({ message: 'PO deleted successfully' });
  } catch (error) {
    console.error('Delete PO error:', error);
    return res.status(500).json({ error: 'Failed to delete PO' });
  }
};
