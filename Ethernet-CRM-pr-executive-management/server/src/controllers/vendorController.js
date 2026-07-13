import Vendor from '../models/Vendor.js';

const ALLOWED_STATUS = new Set(['active', 'inactive', 'blocked']);

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const sanitizeVendorPayload = (body = {}, { forCreate = false } = {}) => {
  const payload = {};

  if (body.project_id !== undefined) payload.project_id = toInt(body.project_id);
  if (body.vendor_name !== undefined) payload.vendor_name = String(body.vendor_name || '').trim();
  if (body.vendor_company_name !== undefined) payload.vendor_company_name = String(body.vendor_company_name || '').trim();
  if (body.vendor_email !== undefined) payload.vendor_email = String(body.vendor_email || '').trim();
  if (body.mobile_number !== undefined) payload.mobile_number = String(body.mobile_number || '').trim();
  if (body.location !== undefined) payload.location = String(body.location || '').trim();
  if (body.status !== undefined) payload.status = String(body.status || '').trim();

  if (forCreate && payload.status == null) payload.status = 'active';

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
};

export const createVendor = async (req, res) => {
  try {
    const payload = sanitizeVendorPayload(req.body, { forCreate: true });

    if (!payload.vendor_name) {
      return res.status(400).json({ error: 'vendor_name is required' });
    }

    if (payload.status && !ALLOWED_STATUS.has(payload.status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values are: active, inactive, blocked' });
    }

    const created = await Vendor.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create vendor error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getVendors = async (_req, res) => {
  try {
    const rows = await Vendor.findAll({ order: [['created_at', 'DESC']] });
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get vendors error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getVendorsByProject = async (req, res) => {
  try {
    const projectId = toInt(req.params.projectId);
    if (projectId == null) return res.status(400).json({ error: 'Invalid projectId' });

    const rows = await Vendor.findAll({
      where: { project_id: projectId },
      order: [['created_at', 'DESC']],
    });
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get vendors by project error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getVendorById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'Invalid id' });

    const row = await Vendor.findByPk(id);
    if (!row) return res.status(404).json({ error: 'Vendor not found' });

    return res.status(200).json(row);
  } catch (error) {
    console.error('Get vendor by id error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateVendor = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'Invalid id' });

    const row = await Vendor.findByPk(id);
    if (!row) return res.status(404).json({ error: 'Vendor not found' });

    const payload = sanitizeVendorPayload(req.body);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (payload.status && !ALLOWED_STATUS.has(payload.status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values are: active, inactive, blocked' });
    }

    await row.update(payload);
    return res.status(200).json(row);
  } catch (error) {
    console.error('Update vendor error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateVendorStatus = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'Invalid id' });

    const status = String(req.body?.status || '').trim();
    if (!ALLOWED_STATUS.has(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values are: active, inactive, blocked' });
    }

    const row = await Vendor.findByPk(id);
    if (!row) return res.status(404).json({ error: 'Vendor not found' });

    await row.update({ status });
    return res.status(200).json(row);
  } catch (error) {
    console.error('Update vendor status error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteVendor = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'Invalid id' });

    const row = await Vendor.findByPk(id);
    if (!row) return res.status(404).json({ error: 'Vendor not found' });

    await row.destroy();
    return res.status(200).json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
