import path from 'path';
import fs from 'fs/promises';
import Project from '../models/Project.js';
import User from '../models/User.js';
import { parseJsonLike } from '../utils/jsonField.js';

const toArrayFromIndexedBody = (body, key) => {
  if (Array.isArray(body[key])) return body[key];
  if (typeof body[key] === 'string') return parseJsonLike(body[key], [body[key]]);

  const entries = Object.entries(body)
    .filter(([k]) => k.startsWith(`${key}[`))
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([, v]) => v).filter((v) => v !== undefined && v !== null && v !== '');
};

const toMlManagement = (body) => {
  if (body['ml_management[ml_task]'] !== undefined) {
    return { ml_task: body['ml_management[ml_task]'] || '' };
  }

  const arr = toArrayFromIndexedBody(body, 'ml_management');
  if (arr.length > 0) return { ml_task: String(arr[0] || '') };

  const raw = body.ml_management;
  if (raw == null || raw === '') return { ml_task: '' };
  if (typeof raw === 'string') {
    const parsed = parseJsonLike(raw, raw);
    if (Array.isArray(parsed)) return { ml_task: String(parsed[0] || '') };
    if (parsed && typeof parsed === 'object') return { ml_task: String(parsed.ml_task || '') };
    return { ml_task: String(parsed || '') };
  }
  if (Array.isArray(raw)) return { ml_task: String(raw[0] || '') };
  if (typeof raw === 'object') return { ml_task: String(raw.ml_task || '') };
  return { ml_task: '' };
};

const toAssignedProjectKeySet = (value) => {
  if (Array.isArray(value)) {
    return new Set(
      value
        .flatMap((entry) => {
          if (entry == null) return [];
          if (typeof entry === 'object') {
            return [entry.id, entry.project_id, entry.name, entry.project_name];
          }
          return [entry];
        })
        .map((item) => String(item).trim().toLowerCase())
        .filter(Boolean)
    );
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return toAssignedProjectKeySet(parsed);
    } catch {
      return new Set();
    }
  }
  return new Set();
};

const canUserAccessProject = (project, assignedKeys) => {
  if (!project || !(assignedKeys instanceof Set) || assignedKeys.size === 0) return false;
  const candidates = [
    project.project_id,
    project.id,
    project.project_name,
    project.name,
  ]
    .map((item) => String(item ?? '').trim().toLowerCase())
    .filter(Boolean);
  return candidates.some((key) => assignedKeys.has(key));
};

const buildProjectPayload = (req, isUpdate = false) => {
  const body = req.body || {};
  const uploadedPathFromBody = typeof body.work_order_file_path === 'string' ? body.work_order_file_path.trim() : '';
  const normalizedBodyPath = uploadedPathFromBody.startsWith('/uploads/')
    ? uploadedPathFromBody
    : (uploadedPathFromBody.includes('/uploads/') ? uploadedPathFromBody.slice(uploadedPathFromBody.indexOf('/uploads/')) : '');

  const payload = {
    project_name: body.project_name,
    project_startdate: body.project_startdate || null,
    product_duration: body.product_duration || null,
    client_name: body.client_name || null,
    location: body.location || null,
    floor: body.floor || null,
    estimate_value: body.estimate_value || null,
    wo_number: body.wo_number || null,
    work_order_information: body.work_order_information || null,
    pr_po_tracking: toArrayFromIndexedBody(body, 'pr_po_tracking'),
    samples: toArrayFromIndexedBody(body, 'samples'),
    ml_management: toMlManagement(body),
  };

  if (req.files?.work_order_file?.[0]) {
    payload.work_order_file = path.posix.join('/uploads/projects', req.files.work_order_file[0].filename);
  } else if (normalizedBodyPath) {
    payload.work_order_file = normalizedBodyPath;
  }
  if (req.files?.mas_file?.[0]) {
    payload.mas_file = path.posix.join('/uploads/projects', req.files.mas_file[0].filename);
  }

  if (isUpdate) {
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key];
    });
  }

  return payload;
};

export const createProject = async (req, res) => {
  try {
    const payload = buildProjectPayload(req);

    if (!payload.project_name || !String(payload.project_name).trim()) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!payload.product_duration && payload.project_startdate) {
      const d = new Date(payload.project_startdate);
      if (!Number.isNaN(d.getTime())) payload.product_duration = d.toISOString().slice(0, 10);
    }

    const created = await Project.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
};

export const getProjects = async (_req, res) => {
  try {
    let projects = await Project.findAll({ order: [['created_at', 'DESC']] });
    const isAdmin = String(_req?.user?.role || '').toLowerCase() === 'admin';

    if (!isAdmin) {
      const dbUser = await User.findByPk(_req?.user?.id);
      const assignedKeys = toAssignedProjectKeySet(dbUser?.project_list);
      projects = projects.filter((project) => canUserAccessProject(project, assignedKeys));
    }

    return res.status(200).json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid project id' });

    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isAdmin = String(req?.user?.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      const dbUser = await User.findByPk(req?.user?.id);
      const assignedKeys = toAssignedProjectKeySet(dbUser?.project_list);
      if (!canUserAccessProject(project, assignedKeys)) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    return res.status(200).json(project);
  } catch (error) {
    console.error('Get project by id error:', error);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
};

export const updateProject = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid project id' });

    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const payload = buildProjectPayload(req, true);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await project.update(payload);
    return res.status(200).json(project);
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid project id' });

    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await project.destroy();
    return res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
};

export const compressFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const absolutePath = path.join(process.cwd(), 'uploads', 'compressed');
    await fs.mkdir(absolutePath, { recursive: true });

    const filePath = path.posix.join('/uploads/compressed', req.file.filename);
    return res.status(200).json({
      original_size: req.file.size,
      compressed_size: req.file.size,
      url: filePath,
      message: 'File uploaded',
    });
  } catch (error) {
    console.error('Compress file error:', error);
    return res.status(500).json({ error: 'Failed to process file' });
  }
};
