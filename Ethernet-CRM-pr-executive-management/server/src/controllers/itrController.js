import path from 'path';
import ITR from '../models/ITR.js';
import { parseJsonLike } from '../utils/jsonField.js';

const toInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const buildPayload = (body = {}, isUpdate = false) => {
  const payload = {
    project_id: Object.prototype.hasOwnProperty.call(body, 'project_id') ? toInt(body.project_id) : undefined,
    project_name: body.project_name,
    project_code: body.project_code,
    client_name: body.client_name,
    pmc_engineer: body.pmc_engineer,
    contractor: body.contractor,
    vendor_code: body.vendor_code,
    material_code: body.material_code,
    itr_ref_no: body.itr_ref_no,
    wir_itr_submission_date_time: body.wir_itr_submission_date_time,
    inspection_date_time: body.inspection_date_time,
    submitted_to: body.submitted_to,
    submitted_by: body.submitted_by,
    source: body.source,
    source_file_name: body.source_file_name,
    result_code: body.result_code,
    itr_submited: body.itr_submited,
    contractor_part: parseJsonLike(body.contractor_part, {}),
    lodha_pmc: parseJsonLike(body.lodha_pmc, {}),
    dynamic_field: parseJsonLike(body.dynamic_field, []),
  };

  if (isUpdate) {
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });
  }

  return payload;
};

export const uploadItrFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  return res.status(200).json({ filePath: path.posix.join('/uploads/itr', req.file.filename) });
};

export const createItr = async (req, res) => {
  try {
    const payload = buildPayload(req.body);
    if (payload.project_id == null) return res.status(400).json({ error: 'project_id is required' });

    const created = await ITR.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create ITR error:', error);
    return res.status(500).json({ error: 'error message here' });
  }
};

export const getItrs = async (_req, res) => {
  try {
    const rows = await ITR.findAll({ order: [['created_at', 'DESC']] });
    return res.status(200).json(rows);
  } catch {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getItrsByProject = async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (Number.isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  const rows = await ITR.findAll({
    where: { project_id: projectId },
    order: [['created_at', 'DESC']],
  });
  return res.status(200).json(rows);
};

export const getItrById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const row = await ITR.findByPk(id);
  if (!row) return res.status(404).json({ error: 'ITR not found' });
  return res.status(200).json(row);
};

export const updateItr = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const row = await ITR.findByPk(id);
    if (!row) return res.status(404).json({ error: 'ITR not found' });

    const payload = buildPayload(req.body, true);
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No fields to update' });

    await row.update(payload);
    return res.status(200).json(row);
  } catch (error) {
    console.error('Update ITR error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteItr = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const row = await ITR.findByPk(id);
  if (!row) return res.status(404).json({ error: 'ITR not found' });

  await row.destroy();
  return res.status(200).json({ message: 'ITR deleted successfully' });
};
