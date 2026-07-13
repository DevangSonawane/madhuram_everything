import path from 'path';
import Sample from '../models/Sample.js';
import { parseJsonLike } from '../utils/jsonField.js';

const toInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const resolveSample = async (identifier) => {
  const raw = String(identifier ?? '').trim();
  if (!raw) return null;

  const numericId = toInt(raw);
  if (numericId != null) {
    const byPk = await Sample.findByPk(numericId);
    if (byPk) return byPk;

    // Some deployments expose `id` in the database while others use `sample_id`.
    const bySampleId = await Sample.findOne({ where: { sample_id: numericId } });
    if (bySampleId) return bySampleId;

    const byLegacyId = await Sample.findOne({ where: { id: numericId } });
    if (byLegacyId) return byLegacyId;
  }

  const byRawSampleId = await Sample.findOne({ where: { sample_id: raw } });
  if (byRawSampleId) return byRawSampleId;

  const byRawLegacyId = await Sample.findOne({ where: { id: raw } });
  if (byRawLegacyId) return byRawLegacyId;

  return null;
};

const buildPayload = (body = {}, isUpdate = false) => {
  const payload = {
    project_id: Object.prototype.hasOwnProperty.call(body, 'project_id') ? toInt(body.project_id) : undefined,
    building_name: body.building_name,
    site_name: body.site_name,
    location: parseJsonLike(body.location, {}),
    work_done: body.work_done,
    item_description: parseJsonLike(body.item_description, []),
    add_fields: parseJsonLike(body.add_fields, []),
    sample_file: body.sample_file,
  };

  if (isUpdate) {
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });
  }

  return payload;
};

export const uploadSampleFiles = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  return res.status(200).json({
    filePaths: req.files.map((file) => path.posix.join('/uploads/sample', file.filename)),
  });
};

export const createSample = async (req, res) => {
  try {
    const payload = buildPayload(req.body);
    if (payload.project_id == null) {
      return res.status(400).json({ error: 'Invalid project_id: Project does not exist' });
    }

    const created = await Sample.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create sample error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getSamples = async (_req, res) => {
  const rows = await Sample.findAll({ order: [['created_at', 'DESC']] });
  return res.status(200).json(rows);
};

export const getSampleById = async (req, res) => {
  const row = await resolveSample(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sample not found' });
  return res.status(200).json(row);
};

export const getSamplesByProject = async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (Number.isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  const rows = await Sample.findAll({
    where: { project_id: projectId },
    order: [['created_at', 'DESC']],
  });
  return res.status(200).json(rows);
};

export const updateSample = async (req, res) => {
  const row = await resolveSample(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sample not found' });

  const payload = buildPayload(req.body, true);
  if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No fields to update' });

  await row.update(payload);
  return res.status(200).json(row);
};

export const deleteSample = async (req, res) => {
  const row = await resolveSample(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sample not found' });

  await row.destroy();
  return res.status(200).json({ message: 'Sample deleted successfully' });
};
