const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.madhuram.enterprises').replace(/\/$/, '');

const MIR_STRING_FIELDS = [
  'project_name',
  'project_code',
  'client_name',
  'pmc',
  'contractor',
  'vendor_code',
  'challan_no',
  'mir_refrence_no',
  'material_code',
  'inspection_date_time',
  'client_submission_date',
  'refrence_docs_attached',
];
const MIR_ONLY_REQUIRED_FIELDS = new Set(['challan_no', 'mir_refrence_no']);

const MIR_CREATE_REQUIRED_FIELDS = [
  'challan_no',
  'mir_refrence_no',
  'po_id',
];

const isPlainObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

// Many endpoints have inconsistent response envelopes (sometimes returning arrays directly,
// other times nesting them under `data`, `rows`, etc.). This helper unwraps common shapes.
const unwrapListResponse = (payload, { maxDepth = 4, keys = ['data', 'rows', 'result', 'results', 'mirs', 'mir'] } = {}) => {
  let current = payload;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (Array.isArray(current)) return current;
    if (!isPlainObject(current)) return null;

    for (const key of keys) {
      const candidate = current?.[key];
      if (Array.isArray(candidate)) return candidate;
    }

    const next = current?.data;
    if (isPlainObject(next)) {
      current = next;
      continue;
    }
    return null;
  }
  return null;
};

const toTrimmedString = (value) => {
  if (value == null) return '';
  return String(value).trim();
};
const normalizeEmptyLike = (value) => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return '';
  const normalized = trimmed.toLowerCase();
  if (normalized === '-' || normalized === '_' || normalized === 'na' || normalized === 'n/a' || normalized === 'null' || normalized === 'undefined') {
    return '';
  }
  return trimmed;
};
const todayDateOnly = () => new Date().toISOString().slice(0, 10);
const nowIsoDateTime = () => new Date().toISOString();
const withMirDefault = (field, value) => {
  if (value) return value;
  if (field === 'inspection_date_time') return nowIsoDateTime();
  if (field === 'client_submission_date') return todayDateOnly();
  if (MIR_ONLY_REQUIRED_FIELDS.has(field)) return value;
  return '-';
};

const toValidInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const isIsoDate = (value) => {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
};

const isIsoDateTime = (value) => {
  if (typeof value !== 'string') return false;
  if (!value.includes('T')) return false;
  return !Number.isNaN(Date.parse(value));
};

const parseArrayLike = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const normalizeProjectStartDateForApi = (value) => {
  if (!value) return '';
  if (typeof value !== 'string') return value;
  if (value.includes('T')) return value;

  let normalized = value.trim();
  const ddMmYyyy = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddMmYyyy) {
    const [, dd, mm, yyyy] = ddMmYyyy;
    normalized = `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Fallback: send raw value; backend may still accept/normalize it.
  return value;
};

const normalizeDynamicField = (value) => {
  const list = parseArrayLike(value, []);
  return list
    .filter((entry) => entry != null)
    .map((entry) => {
      if (!isPlainObject(entry)) return null;
      const key = toTrimmedString(entry.key);
      if (!key) return null;
      const normalizedValue = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value ?? '');
      return { key, value: normalizedValue };
    })
    .filter(Boolean);
};

const normalizeMirItems = (value) => {
  const list = parseArrayLike(value, []);
  return list.map((item, index) => {
    if (!isPlainObject(item)) {
      return {
        srno: index + 1,
        hsn: '',
        description: '',
        name: '',
        qty: 0,
        UOM: '',
        Rate: 0,
        Amount: 0,
        remark: '',
        inventory_id: null,
        issued_qty: null,
        inspected: false,
      };
    }

    const srno = Number(item.srno);
    const qty = Number(item.qty);
    const rate = Number(item.Rate);
    const amount = Number(item.Amount);
    const hsn = toTrimmedString(item.hsn);
    const description = toTrimmedString(item.description);
    const name = toTrimmedString(item.name);
    const uom = toTrimmedString(item.UOM ?? item.uom ?? item.unit ?? item.Unit);
    const remark = item.remark == null ? '' : String(item.remark);
    const inspected = Boolean(item.inspected);
    const inventoryId = toValidInteger(item.inventory_id ?? item.inventoryId);
    const issuedQtyRaw = item.issued_qty ?? item.issuedQty;
    const issuedQty = Number(issuedQtyRaw);

    return {
      srno: Number.isFinite(srno) ? srno : index + 1,
      hsn,
      description,
      name,
      qty: Number.isFinite(qty) ? qty : 0,
      UOM: uom,
      Rate: Number.isFinite(rate) ? rate : 0,
      Amount: Number.isFinite(amount) ? amount : 0,
      remark,
      inventory_id: inventoryId ?? null,
      issued_qty: Number.isFinite(issuedQty) ? issuedQty : null,
      inspected,
    };
  });
};

const validateMirPayload = (payload = {}, { strictRequired = false } = {}) => {
  const errors = [];

  MIR_STRING_FIELDS.forEach((field) => {
    if (!toTrimmedString(payload[field])) {
      if (strictRequired && MIR_CREATE_REQUIRED_FIELDS.includes(field)) {
        errors.push(`${field} is required`);
      }
      return;
    }

    if (field === 'client_submission_date' && !isIsoDate(payload[field])) {
      errors.push('client_submission_date must be in YYYY-MM-DD format');
    }
    if (field === 'inspection_date_time' && !isIsoDateTime(payload[field])) {
      errors.push('inspection_date_time must be an ISO datetime string');
    }
  });

  if (payload.project_id != null && toValidInteger(payload.project_id) == null) {
    errors.push('project_id must be a positive integer when provided');
  }
  if (toValidInteger(payload.po_id) == null) {
    if (strictRequired && MIR_CREATE_REQUIRED_FIELDS.includes('po_id')) {
      errors.push('po_id must be a positive integer');
    }
  }

  if (!Array.isArray(payload.dynamic_field)) {
    errors.push('dynamic_field must be an array');
  }
  if (!Array.isArray(payload.items)) {
    errors.push('items must be an array');
  } else if (strictRequired && MIR_CREATE_REQUIRED_FIELDS.includes('items') && payload.items.length === 0) {
    errors.push('items must contain at least one row');
  }

  return { valid: errors.length === 0, errors };
};

const normalizeMirPayload = (data = {}, options = {}) => {
  const errors = [];
  const payload = {};

  MIR_STRING_FIELDS.forEach((field) => {
    payload[field] = withMirDefault(field, toTrimmedString(data[field]));
  });

  payload.project_id = toValidInteger(data.project_id);
  payload.po_id = toValidInteger(data.po_id);

  const mirSubmited = data.mir_submited;
  if (typeof mirSubmited === 'boolean') {
    payload.mir_submited = mirSubmited;
  } else if (mirSubmited === 'true' || mirSubmited === '1' || mirSubmited === 1) {
    payload.mir_submited = true;
  } else if (mirSubmited === 'false' || mirSubmited === '0' || mirSubmited === 0) {
    payload.mir_submited = false;
  } else {
    payload.mir_submited = false;
  }

  payload.dynamic_field = normalizeDynamicField(data.dynamic_field);
  payload.items = normalizeMirItems(data.items);

  const fieldValidation = validateMirPayload(payload, options);
  return {
    payload,
    errors: [...errors, ...fieldValidation.errors],
  };
};

const getMirCreatePath = (payload = {}) => {
  const templateType = String(payload?.template_type || '').trim().toLowerCase();
  const dynamicTemplateType = (() => {
    const dynamicField = parseArrayLike(payload?.dynamic_field, []);
    const entry = Array.isArray(dynamicField)
      ? dynamicField.find((item) => item?.key === 'template_type')
      : null;
    return String(entry?.value || '').trim().toLowerCase();
  })();

  const effectiveTemplateType = templateType || dynamicTemplateType;
  if (effectiveTemplateType === 'lodha') return '/api/mir/lodha';
  if (effectiveTemplateType === 'hiranandani') return '/api/mir/hiranandani';
  return '/api/mir';
};

const getMirUpdatePath = (id, payload = {}) => {
  const templateType = String(payload?.template_type || '').trim().toLowerCase();
  const dynamicTemplateType = (() => {
    const dynamicField = parseArrayLike(payload?.dynamic_field, []);
    const entry = Array.isArray(dynamicField)
      ? dynamicField.find((item) => item?.key === 'template_type')
      : null;
    return String(entry?.value || '').trim().toLowerCase();
  })();

  const effectiveTemplateType = templateType || dynamicTemplateType;
  if (effectiveTemplateType === 'lodha') return `/api/mir/lodha/${id}`;
  if (effectiveTemplateType === 'hiranandani') return `/api/mir/hiranandani/${id}`;
  return `/api/mir/${id}`;
};

const postMirCreate = async (data = {}) => {
  const { payload, errors } = normalizeMirPayload(data, { strictRequired: true });
  if (errors.length > 0) {
    return {
      success: false,
      status: 400,
      error: `Invalid MIR payload: ${errors[0]}`,
      validationErrors: errors,
    };
  }

  const endpoint = getMirCreatePath(data);
  console.log(`[MIR][POST] Final payload -> ${endpoint}:`, payload);

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const api = {
  // Auth
  login: async (email, password) => {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  signup: async (userData) => {
    const payload = {
      username: userData.username,
      name: userData.name,
      email: userData.email,
      phone_number: userData.phone_number,
      password: userData.password,
      role: userData.role,
      project_id: userData.project_id ?? null,
      project: userData.project ?? userData.project_list ?? [],
    };
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  createUser: async (userData) => {
    const payload = {
      username: userData.username,
      name: userData.name,
      email: userData.email,
      phone_number: userData.phone_number,
      password: userData.password,
      role: userData.role,
      project_id: userData.project_id ?? null,
      project: userData.project ?? userData.project_list ?? [],
    };
    if (userData.check_in_time) {
      payload.check_in_time = userData.check_in_time;
    }
    if (userData.check_out_time) {
      payload.check_out_time = userData.check_out_time;
    }
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  logout: async () => {
    const token = getToken();
    if (!token) return { success: true }; // Already "logged out" locally

    const response = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}` // Assuming Bearer token, though doc doesn't explicitly say header format, it's standard.
      },
    });
    // Logout is client-side mainly, so we just return success usually
    return response.ok ? { success: true } : handleResponse(response);
  },

  forgotPassword: async (data) => {
    const response = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Users
  getUsers: async () => {
    const response = await fetch(`${BASE_URL}/api/auth/users`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getUserById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/auth/users/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateUser: async (id, data) => {
    const payload = { ...data };
    if (Array.isArray(payload.project_list) && !Array.isArray(payload.project)) {
      payload.project = payload.project_list;
    }

    const response = await fetch(`${BASE_URL}/api/auth/users/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  updateUserAccessControl: async (id, accessControl) => {
    const response = await fetch(`${BASE_URL}/api/auth/users/${id}/access-control`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_control: accessControl }),
    });
    return handleResponse(response);
  },


  deleteUser: async (id) => {
    const response = await fetch(`${BASE_URL}/api/auth/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Access Control
  getAccessCatalog: async () => {
    const response = await fetch(`${BASE_URL}/api/access/catalog`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getAccessUser: async (userId) => {
    const response = await fetch(`${BASE_URL}/api/access/user/${userId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getAccessAllUsers: async () => {
    const response = await fetch(`${BASE_URL}/api/access/all-users`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  revokeAccessUser: async (userId) => {
    const response = await fetch(`${BASE_URL}/api/access/user/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  checkAccess: async (userId, { keys, page } = {}) => {
    const params = new URLSearchParams();
    if (Array.isArray(keys)) {
      params.set('keys', keys.join(','));
    } else if (keys) {
      params.set('keys', keys);
    }
    if (page) params.set('page', page);

    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/access/check/${userId}${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateAccessUserPage: async (userId, pagePath, payload = {}) => {
    const encodedPagePath = encodeURIComponent(pagePath);
    const response = await fetch(`${BASE_URL}/api/access/user/${userId}/page/${encodedPagePath}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  updateAccessUserFunction: async (userId, functionKey, payload = {}) => {
    const encodedFunctionKey = encodeURIComponent(functionKey);
    const response = await fetch(`${BASE_URL}/api/access/user/${userId}/function/${encodedFunctionKey}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  updateAccessUserBulk: async (userId, payload = {}) => {
    const response = await fetch(`${BASE_URL}/api/access/user/${userId}/bulk`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  // Dashboard
  getDashboardStats: async ({ projectId, userId } = {}) => {
    const params = new URLSearchParams();
    if (projectId != null && projectId !== '') params.set('project_id', String(projectId));
    if (userId != null && userId !== '') params.set('user_id', String(userId));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/dashboard/stats${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getDashboardActivity: async ({ userId, projectId, entityType, action, limit, offset } = {}) => {
    if (userId == null || userId === '') {
      throw new Error('userId is required for dashboard activity');
    }
    const params = new URLSearchParams();
    params.set('user_id', String(userId));
    if (projectId != null && projectId !== '') params.set('project_id', String(projectId));
    if (entityType) params.set('entity_type', entityType);
    if (action) params.set('action', action);
    if (limit != null) params.set('limit', String(limit));
    if (offset != null) params.set('offset', String(offset));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/dashboard/activity${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  deleteDashboardActivity: async (id) => {
    const response = await fetch(`${BASE_URL}/api/dashboard/activity/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Notifications (Dashboard module)
  getNotifications: async ({ userId, isRead, limit, offset } = {}) => {
    const params = new URLSearchParams();
    if (userId != null && userId !== '') params.set('user_id', String(userId));
    if (typeof isRead === 'boolean') params.set('is_read', String(isRead));
    if (limit != null) params.set('limit', String(limit));
    if (offset != null) params.set('offset', String(offset));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/dashboard/notifications${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getUnreadNotificationCount: async (userId) => {
    const params = new URLSearchParams();
    if (userId != null && userId !== '') params.set('user_id', String(userId));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/dashboard/notifications/unread-count${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  markNotificationRead: async (id) => {
    const response = await fetch(`${BASE_URL}/api/dashboard/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  markAllNotificationsRead: async (userId) => {
    const params = new URLSearchParams();
    if (userId != null && userId !== '') params.set('user_id', String(userId));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/dashboard/notifications/read-all${query ? `?${query}` : ''}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  deleteNotification: async (id) => {
    const response = await fetch(`${BASE_URL}/api/dashboard/notifications/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getDashboardSocketUrl: ({ userId, token } = {}) => {
    const explicit = (import.meta.env.VITE_DASHBOARD_WS_URL || '').trim();
    const wsBase = explicit || BASE_URL.replace(/^http/i, 'ws');
    const wsUrl = new URL(`${wsBase}/ws/activity`);
    if (userId != null && userId !== '') wsUrl.searchParams.set('user_id', String(userId));
    if (token) wsUrl.searchParams.set('token', token);
    return wsUrl.toString();
  },

  // Projects
  createProject: async (projectData) => {
    const formData = new FormData();
    
    // According to API docs: POST /api/projects uses multipart form data
    // Request fields: project_name, project_startdate, client_name, location, floor,
    // estimate_value, wo_number, work_order_file, pr_po_tracking[], samples[], mas_file, ml_management[],
    // flats, refuge_flat, toilets, user_id, location_latitude, location_longitude, location_radius, location_name
    
    // Required/Text fields
    formData.append('project_name', projectData.project_name || '');
    
    // API expects project_startdate in CREATE request (ISO format).
    // Accept both YYYY-MM-DD and DD/MM/YYYY safely.
    const startDate = normalizeProjectStartDateForApi(projectData.product_duration || projectData.project_startdate || '');
    formData.append('project_startdate', startDate);
    
    formData.append('client_name', projectData.client_name || '');
    formData.append('location', projectData.location || '');
    formData.append('floor', projectData.floor || '');
    formData.append('estimate_value', projectData.estimate_value || '');
    formData.append('wo_number', projectData.wo_number || '');
    formData.append('work_order_information', projectData.work_order_information || '');

    if (projectData.user_id != null && String(projectData.user_id).trim()) {
      formData.append('user_id', String(projectData.user_id).trim());
    }

    const flats = projectData.flats ?? projectData.number_of_flats;
    if (flats != null && String(flats).trim() !== '') formData.append('flats', String(flats));

    const refugeFlat = projectData.refuge_flat ?? projectData.refuse_per_flat;
    if (refugeFlat != null && String(refugeFlat).trim() !== '') {
      formData.append('refuge_flat', String(refugeFlat));
    }

    const toilets = projectData.toilets ?? projectData.toilets_per_flat;
    if (toilets != null && String(toilets).trim() !== '') formData.append('toilets', String(toilets));

    if (projectData.location_latitude != null && String(projectData.location_latitude).trim() !== '') {
      formData.append('location_latitude', String(projectData.location_latitude));
    }
    if (projectData.location_longitude != null && String(projectData.location_longitude).trim() !== '') {
      formData.append('location_longitude', String(projectData.location_longitude));
    }
    if (projectData.location_radius != null && String(projectData.location_radius).trim() !== '') {
      formData.append('location_radius', String(projectData.location_radius));
    }
    if (projectData.location_name != null && String(projectData.location_name).trim() !== '') {
      formData.append('location_name', String(projectData.location_name));
    }
    
    // Arrays - pr_po_tracking
    const prPoTracking = projectData.pr_po_tracking && Array.isArray(projectData.pr_po_tracking) 
      ? projectData.pr_po_tracking 
      : [];
    prPoTracking.forEach((item, index) => {
      formData.append(`pr_po_tracking[${index}]`, item);
    });
    
    // Arrays - samples
    const samples = projectData.samples && Array.isArray(projectData.samples) 
      ? projectData.samples 
      : [];
    samples.forEach((item, index) => {
      formData.append(`samples[${index}]`, item);
    });
    
    // ml_management - API expects array format in CREATE: ["asda"]
    const mlManagement = projectData.ml_management;
    if (mlManagement) {
      if (Array.isArray(mlManagement)) {
        mlManagement.forEach((item, index) => {
          formData.append(`ml_management[${index}]`, item);
        });
      } else if (mlManagement.ml_task && mlManagement.ml_task.trim()) {
        // Convert object to array format for create
        formData.append('ml_management[0]', mlManagement.ml_task);
      }
    }
    
    // Files
    if (projectData.work_order_file instanceof File) {
      formData.append('work_order_file', projectData.work_order_file);
    }
    if (typeof projectData.work_order_file_path === 'string' && projectData.work_order_file_path.trim()) {
      formData.append('work_order_file_path', projectData.work_order_file_path.trim());
    }
    
    if (projectData.mas_file instanceof File) {
      formData.append('mas_file', projectData.mas_file);
    }

    const response = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: getAuthHeaders(), // Don't set Content-Type, browser will set it with boundary for FormData
      body: formData,
    });
    return handleResponse(response);
  },

  getProjects: async () => {
    const response = await fetch(`${BASE_URL}/api/projects`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getProjectById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/projects/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateProject: async (id, projectData) => {
    const formData = new FormData();
    
    // According to API docs: PUT /api/projects/{id} uses multipart form data
    // Request fields: project_name, project_startdate, client_name, location, floor,
    // estimate_value, wo_number, work_order_file, pr_po_tracking[], samples[], mas_file, ml_management[],
    // flats, refuge_flat, toilets, location_latitude, location_longitude, location_radius, location_name
    
    // Text fields
    formData.append('project_name', projectData.project_name || '');
    
    const startDate = normalizeProjectStartDateForApi(
      projectData.project_startdate || projectData.product_duration || ''
    );
    formData.append('project_startdate', startDate);
    
    formData.append('client_name', projectData.client_name || '');
    formData.append('location', projectData.location || '');
    formData.append('floor', projectData.floor || '');
    formData.append('estimate_value', projectData.estimate_value || '');
    formData.append('wo_number', projectData.wo_number || '');

    const flats = projectData.flats ?? projectData.number_of_flats;
    if (flats != null && String(flats).trim() !== '') formData.append('flats', String(flats));

    const refugeFlat = projectData.refuge_flat ?? projectData.refuse_per_flat;
    if (refugeFlat != null && String(refugeFlat).trim() !== '') {
      formData.append('refuge_flat', String(refugeFlat));
    }

    const toilets = projectData.toilets ?? projectData.toilets_per_flat;
    if (toilets != null && String(toilets).trim() !== '') formData.append('toilets', String(toilets));

    if (projectData.location_latitude != null && String(projectData.location_latitude).trim() !== '') {
      formData.append('location_latitude', String(projectData.location_latitude));
    }
    if (projectData.location_longitude != null && String(projectData.location_longitude).trim() !== '') {
      formData.append('location_longitude', String(projectData.location_longitude));
    }
    if (projectData.location_radius != null && String(projectData.location_radius).trim() !== '') {
      formData.append('location_radius', String(projectData.location_radius));
    }
    if (projectData.location_name != null && String(projectData.location_name).trim() !== '') {
      formData.append('location_name', String(projectData.location_name));
    }
    
    // Arrays - pr_po_tracking
    const prPoTracking = projectData.pr_po_tracking && Array.isArray(projectData.pr_po_tracking) 
      ? projectData.pr_po_tracking 
      : [];
    prPoTracking.forEach((item, index) => {
      formData.append(`pr_po_tracking[${index}]`, item);
    });
    
    // Arrays - samples
    const samples = projectData.samples && Array.isArray(projectData.samples) 
      ? projectData.samples 
      : [];
    samples.forEach((item, index) => {
      formData.append(`samples[${index}]`, item);
    });
    
    // ml_management - API expects array format
    const mlManagement = projectData.ml_management;
    if (mlManagement) {
      if (Array.isArray(mlManagement)) {
        mlManagement.forEach((item, index) => {
          formData.append(`ml_management[${index}]`, item);
        });
      } else if (mlManagement.ml_task && String(mlManagement.ml_task).trim()) {
        formData.append('ml_management[0]', String(mlManagement.ml_task).trim());
      }
    }
    
    // Files (only if new files are provided)
    if (projectData.work_order_file instanceof File) {
      formData.append('work_order_file', projectData.work_order_file);
    }
    if (projectData.mas_file instanceof File) {
      formData.append('mas_file', projectData.mas_file);
    }

    const response = await fetch(`${BASE_URL}/api/projects/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  deleteProject: async (id) => {
    const response = await fetch(`${BASE_URL}/api/projects/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Helper to get file URL
  getFileUrl: (filename) => {
    if (!filename) return null;
    return `${BASE_URL}/uploads/${filename}`;
  },

  /**
   * In dev (localhost), returns same-origin URL so fetch goes through Vite proxy and avoids CORS.
   * In production, returns the given absolute URL as-is.
   */
  getCompressedFileFetchUrl: (absoluteUrl) => {
    if (typeof window === 'undefined') return absoluteUrl;
    try {
      const u = new URL(absoluteUrl);
      if (u.hostname === 'api.madhuram.enterprises' && u.pathname.startsWith('/uploads/')) {
        const pathAfterUploads = u.pathname.slice('/uploads/'.length);
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return `${window.location.origin}/api-uploads/${pathAfterUploads}`;
        }
      }
    } catch {
      return absoluteUrl;
    }
    return absoluteUrl;
  },

  /**
   * Compression API: POST /api/compress
   * Uploads a file and compresses it.
   * - Images: iteratively reduces quality/resolution so output is under 10MB.
   * - Other files: Gzip compression (best effort).
   * Request body: file (required, binary). Response: original_size, compressed_size, url, message.
   */
  compressFile: async (file) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file); // required field per API: file * string(binary)
    } else {
      return { success: false, error: 'Invalid file' };
    }

    const response = await fetch(`${BASE_URL}/api/compress`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  getApiFileUrl: (path) => {
    if (!path) return '';
    if (typeof path === 'string' && /^https?:\/\//i.test(path)) return path;
    const cleaned = path.startsWith('/') ? path : `/${path}`;
    // In dev, proxy uploads via Vite (`/api-uploads` -> `https://api.madhuram.enterprises/uploads`)
    // so we can fetch blobs without running into CORS restrictions.
    if (import.meta?.env?.DEV && cleaned.startsWith('/uploads/')) {
      return `/api-uploads${cleaned.slice('/uploads'.length)}`;
    }
    return `${BASE_URL}${cleaned}`;
  },

  // BOQ (Bill of Quantities) – Base URL: https://api.madhuram.enterprises, Storage: /uploads/boq
  parseBoqPdf: async (data) => {
    const formData = new FormData();
    if (data.boq_file instanceof File) formData.append('boq_file', data.boq_file);
    if (data.project_id) formData.append('project_id', data.project_id);
    if (data.save != null) formData.append('save', String(data.save));
    if (data.category) formData.append('category', data.category);
    if (data.client) formData.append('client', String(data.client));

    const response = await fetch(`${BASE_URL}/api/boq/parse-pdf`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  // BOQ – Lodha specific parser endpoint (some backends expose a dedicated route).
  parseBoqPdfLodha: async (data) => {
    const formData = new FormData();
    if (data?.boq_file instanceof File) formData.append('boq_file', data.boq_file);
    if (data?.project_id) formData.append('project_id', data.project_id);
    if (data?.save != null) formData.append('save', String(data.save));

    const response = await fetch(`${BASE_URL}/api/boq/parse-pdf/lodha`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  // Quotations – Import BOQ Excel and parse quotation data
  importQuotationExcel: async ({
    file,
    project_name,
    client_name,
    save,
    created_by,
    created_by_name,
    drawingFiles,
    drawing_files,
  } = {}) => {
    const formData = new FormData();
    if (file instanceof File) formData.append('file', file);
    if (project_name) formData.append('project_name', project_name);
    if (client_name) formData.append('client_name', client_name);
    if (save != null) formData.append('save', String(save));
    if (created_by) formData.append('created_by', created_by);
    if (created_by_name) formData.append('created_by_name', created_by_name);
    if (Array.isArray(drawingFiles)) {
      drawingFiles.forEach((file) => {
        if (file instanceof File) formData.append('drawing', file);
      });
    } else if (drawingFiles instanceof File) {
      formData.append('drawing', drawingFiles);
    }
    if (drawing_files) formData.append('drawing_files', drawing_files);

    const response = await fetch(`${BASE_URL}/api/quotations/import/excel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  // Quotations – Dynamic fields (column definitions)
  getQuotationFields: async ({ active_only = true } = {}) => {
    const params = new URLSearchParams();
    if (typeof active_only === 'boolean') params.set('active_only', String(active_only));
    const query = params.toString();
    const response = await fetch(
      `${BASE_URL}/api/quotations/fields${query ? `?${query}` : ''}`,
      {
        headers: getAuthHeaders(),
        cache: 'no-store',
      }
    );
    return handleResponse(response);
  },

  createQuotationField: async (payload) => {
    const response = await fetch(`${BASE_URL}/api/quotations/fields`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  updateQuotationField: async (id, payload) => {
    const response = await fetch(`${BASE_URL}/api/quotations/fields/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  deactivateQuotationField: async (id) => {
    const response = await fetch(`${BASE_URL}/api/quotations/fields/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Quotations – Upload BOQ or Drawing files independently
  uploadQuotationFiles: async ({ boqFiles = [], drawingFiles = [] } = {}) => {
    const formData = new FormData();
    if (Array.isArray(boqFiles)) {
      boqFiles.forEach((file) => {
        if (file instanceof File) formData.append('boq', file);
      });
    } else if (boqFiles instanceof File) {
      formData.append('boq', boqFiles);
    }
    if (Array.isArray(drawingFiles)) {
      drawingFiles.forEach((file) => {
        if (file instanceof File) formData.append('drawing', file);
      });
    } else if (drawingFiles instanceof File) {
      formData.append('drawing', drawingFiles);
    }

    const response = await fetch(`${BASE_URL}/api/quotation/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  // Quotations – Create a new quotation with BOQ items
  createQuotation: async (payload) => {
    const response = await fetch(`${BASE_URL}/api/quotations`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  // Quotations – Get all quotations
  getQuotations: async ({ status, is_revised_offer } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (typeof is_revised_offer === 'boolean') params.set('is_revised_offer', String(is_revised_offer));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/quotations${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    return handleResponse(response);
  },

  getQuotationById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/quotations/${id}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    return handleResponse(response);
  },

  updateQuotation: async (id, payload) => {
    const response = await fetch(`${BASE_URL}/api/quotations/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  deleteQuotation: async (id) => {
    const response = await fetch(`${BASE_URL}/api/quotations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateQuotationStatus: async (id, payload) => {
    const response = await fetch(`${BASE_URL}/api/quotations/${id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  createBOQ: async (data) => {
    const formData = new FormData();
    formData.append('category', data.category || '');
    formData.append('project_id', data.project_id);
    if (data.item_code != null && data.item_code !== '') formData.append('item_code', data.item_code);
    if (data.description != null && data.description !== '') formData.append('description', data.description);
    if (data.floor != null && data.floor !== '') formData.append('floor', data.floor);
    if (data.unit != null && data.unit !== '') formData.append('unit', data.unit);
    if (data.quantity != null && data.quantity !== '') formData.append('quantity', data.quantity);
    if (data.rate != null && data.rate !== '') formData.append('rate', data.rate);
    if (data.amount != null && data.amount !== '') formData.append('amount', data.amount);
    if (data.boq_file instanceof File) formData.append('boq_file', data.boq_file);

    const response = await fetch(`${BASE_URL}/api/boq`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  createBOQLodha: async (data) => {
    const formData = new FormData();
    formData.append('project_id', data.project_id);
    // New endpoint expects: description, section, item_no, hsn, unit, qty, rate, amount
    formData.append('description', data.description || data.item_description || '');
    if (data.section != null && data.section !== '') formData.append('section', data.section);
    if (data.item_no != null && data.item_no !== '') formData.append('item_no', data.item_no);
    if (data.hsn != null && data.hsn !== '') formData.append('hsn', data.hsn);
    if (data.unit != null && data.unit !== '') formData.append('unit', data.unit);
    if (data.qty != null && data.qty !== '') formData.append('qty', String(data.qty));
    if (data.rate != null && data.rate !== '') formData.append('rate', String(data.rate));
    if (data.amount != null && data.amount !== '') formData.append('amount', String(data.amount));
    if (data.project_name) formData.append('project_name', data.project_name);
    // backward compat (some backends used `category`)
    if (data.category) formData.append('category', data.category);
    if (data.floor) formData.append('floor', data.floor);
    if (data.boq_file instanceof File) formData.append('boq_file', data.boq_file);
    const response = await fetch(`${BASE_URL}/api/boq/lodha`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  createBOQHiranandani: async (data) => {
    const formData = new FormData();
    formData.append('project_id', data.project_id);
    // New endpoint expects: description, section, item_no, sac_code, uom, order_qty, unit_price, value
    formData.append('description', data.description || data.service_description || '');
    if (data.section != null && data.section !== '') formData.append('section', data.section);
    if (data.item_no != null && data.item_no !== '') formData.append('item_no', data.item_no);
    if (data.sac_code != null && data.sac_code !== '') formData.append('sac_code', data.sac_code);
    if (data.order_qty != null && data.order_qty !== '') formData.append('order_qty', String(data.order_qty));
    if (data.uom != null && data.uom !== '') formData.append('uom', data.uom);
    if (data.unit_price != null && data.unit_price !== '') formData.append('unit_price', String(data.unit_price));
    if (data.value != null && data.value !== '') formData.append('value', String(data.value));
    if (data.project_name) formData.append('project_name', data.project_name);
    // backward compat (some backends used `category`)
    if (data.category) formData.append('category', data.category);
    if (data.floor) formData.append('floor', data.floor);
    if (data.boq_file instanceof File) formData.append('boq_file', data.boq_file);
    const response = await fetch(`${BASE_URL}/api/boq/hiranandani`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  // Save already-parsed BOQ items (client-side parsed) without re-parsing the PDF on the server.
  // Tries bulk endpoints first; falls back to sequential creates.
  saveBOQItems: async ({ project_id, items = [], boq_file_name, client } = {}) => {
    const normalizedItems = Array.isArray(items) ? items : [];
    const pid = project_id;
    const cli = (client || '').toString().trim().toLowerCase();

    const tryBulk = async (url) => {
      const response = await fetch(`${BASE_URL}${url}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: pid,
          boq_file_name: boq_file_name || '',
          client: cli || undefined,
          items: normalizedItems,
        }),
      });
      return handleResponse(response);
    };

    // Attempt bulk endpoints (if backend supports them).
    const bulkCandidates = ['/api/boq/save-items', '/api/boq/bulk'];
    for (const path of bulkCandidates) {
      try {
        const res = await tryBulk(path);
        if (res?.success) return res;
        // If endpoint exists but validation failed, surface error immediately.
        if (res?.status && res.status !== 404) return res;
      } catch {
        // ignore and fall back
      }
    }

    // Fallback: sequential create calls.
    const created = [];
    for (const item of normalizedItems) {
      const category = item?.category || 'General';
      const description = item?.description || '';
      const unit = item?.unit || '';
      const floor = item?.floor || '';
      const quantity = item?.quantity ?? '';
      const rate = item?.rate ?? '';
      const amount = item?.amount ?? '';
      const code = item?.item_code ?? item?.code ?? '';

      let res;
      if (cli === 'lodha') {
        res = await api.createBOQLodha({
          project_id: pid,
          description,
          section: category,
          item_no: item?.item_no || item?.code || '',
          hsn: item?.hsn || item?.item_code || '',
          unit,
          qty: quantity,
          rate,
          amount,
          category,
          floor,
        });
      } else if (cli === 'hiranandani') {
        res = await api.createBOQHiranandani({
          project_id: pid,
          description,
          section: category,
          item_no: item?.item_no || item?.code || '',
          sac_code: item?.sac_code || item?.item_code || '',
          order_qty: quantity,
          uom: unit,
          unit_price: rate,
          value: amount,
          category,
          floor,
        });
      } else {
        res = await api.createBOQ({
          project_id: pid,
          category,
          item_code: code,
          description,
          floor,
          unit,
          quantity,
          rate,
          amount,
        });
      }

      if (!res?.success) return res;
      created.push(res?.data ?? res);
    }

    return { success: true, data: { created: created.length, items: created } };
  },

  getBOQs: async () => {
    const response = await fetch(`${BASE_URL}/api/boq`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getBOQById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/boq/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getBOQsByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/boq/project/${projectId}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    return handleResponse(response);
  },

  // BOQ – Slim item list for a project (tries multiple endpoints + fallback).
  // Returns a consistent shape:
  // { project_id, total, items: [{ item_no, description, unit, qty, section }] }
  getBoqItemsForProject: async (projectId) => {
    const tryFetch = async (url) => {
      try {
        const response = await fetch(url, {
          headers: getAuthHeaders(),
          cache: 'no-store',
        });
        return await handleResponse(response);
      } catch (error) {
        return { success: false, error: error?.message || 'Request failed' };
      }
    };

    const pid = projectId;

    // Prefer the dedicated slim endpoint when available:
    // GET /api/boq/project/{projectId}/items
    const dedicated = await tryFetch(`${BASE_URL}/api/boq/project/${pid}/items`);
    if (dedicated?.success) {
      const data = dedicated.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      if (list.length > 0) {
        const items = list.map((row, index) => ({
          item_no:
            normalizeEmptyLike(row?.item_no) ||
            normalizeEmptyLike(row?.itemNo) ||
            normalizeEmptyLike(row?.item_code) ||
            normalizeEmptyLike(row?.itemCode) ||
            (row?.boq_id != null ? String(row.boq_id) : String(index + 1)),
          item_code: normalizeEmptyLike(row?.item_code) || normalizeEmptyLike(row?.itemCode) || '',
          description:
            normalizeEmptyLike(row?.description) ||
            normalizeEmptyLike(row?.item_description) ||
            normalizeEmptyLike(row?.service_description) ||
            '',
          unit: normalizeEmptyLike(row?.unit) || normalizeEmptyLike(row?.uom) || '',
          qty:
            row?.qty != null
              ? String(row.qty)
              : row?.quantity != null
                ? String(row.quantity)
                : row?.order_qty != null
                  ? String(row.order_qty)
                  : '',
          rate: row?.rate != null ? String(row.rate) : row?.unit_price != null ? String(row.unit_price) : '',
          amount: row?.amount != null ? String(row.amount) : row?.value != null ? String(row.value) : '',
          hsn: normalizeEmptyLike(row?.hsn) || normalizeEmptyLike(row?.hsn_sac_code) || '',
          sac_code: normalizeEmptyLike(row?.sac_code) || '',
          client: normalizeEmptyLike(row?.client) || normalizeEmptyLike(row?.boq_client) || normalizeEmptyLike(row?.client_format) || '',
          section: normalizeEmptyLike(row?.section) || normalizeEmptyLike(row?.category) || '',
        }));
        // Some slim endpoints omit rate/amount entirely. If we got rows but no
        // usable rate data, continue to the full endpoint fallback.
        const toNumOrZero = (v) => {
          if (v == null || v === '') return 0;
          const n = Number(String(v).replace(/,/g, '').trim());
          return Number.isFinite(n) ? n : 0;
        };
        // Treat "missing" as: no positive rate/amount present anywhere (some slim endpoints return empty/0 placeholders).
        const hasAnyRateOrAmount = items.some((it) => toNumOrZero(it?.rate) > 0 || toNumOrZero(it?.amount) > 0);
        if (!hasAnyRateOrAmount) {
          // fall through to /api/boq/project/{pid}
        } else {
          return {
            success: true,
            data: {
              project_id: Number(pid) || pid,
              total: items.length,
              items,
            },
          };
        }
      }
    }

    // Prefer the existing persisted BOQ rows endpoint first (it includes category + item_code).
    const byProject = await tryFetch(`${BASE_URL}/api/boq/project/${pid}`);
    if (byProject?.success) {
      const rows = Array.isArray(byProject.data) ? byProject.data : [];
      if (rows.length > 0) {
        const items = rows.map((row, index) => ({
          item_no:
            normalizeEmptyLike(row?.item_code) ||
            normalizeEmptyLike(row?.item_no) ||
            (row?.boq_id != null ? String(row.boq_id) : String(index + 1)),
          item_code: normalizeEmptyLike(row?.item_code) || '',
          description:
            normalizeEmptyLike(row?.description) ||
            normalizeEmptyLike(row?.item_description) ||
            normalizeEmptyLike(row?.service_description) ||
            '',
          unit:
            normalizeEmptyLike(row?.unit) ||
            normalizeEmptyLike(row?.uom) ||
            '',
          qty:
            row?.quantity != null
              ? String(row.quantity)
              : row?.qty != null
                ? String(row.qty)
                : row?.order_qty != null
                  ? String(row.order_qty)
                  : '',
          rate:
            row?.rate != null
              ? String(row.rate)
              : row?.unit_price != null
                ? String(row.unit_price)
                : '',
          amount:
            row?.amount != null
              ? String(row.amount)
              : row?.value != null
                ? String(row.value)
                : '',
          hsn: normalizeEmptyLike(row?.hsn) || normalizeEmptyLike(row?.hsn_sac_code) || '',
          sac_code: normalizeEmptyLike(row?.sac_code) || '',
          client: normalizeEmptyLike(row?.client) || normalizeEmptyLike(row?.boq_client) || normalizeEmptyLike(row?.client_format) || '',
          section: normalizeEmptyLike(row?.category) || normalizeEmptyLike(row?.section) || '',
        }));
        return {
          success: true,
          data: {
            project_id: Number(pid) || pid,
            total: items.length,
            items,
          },
        };
      }
    }

    const slimCandidates = [
      `${BASE_URL}/api/boq/items/${pid}`,
      `${BASE_URL}/api/boq/items/project/${pid}`,
      `${BASE_URL}/api/boq/items?projectId=${encodeURIComponent(String(pid))}`,
    ];

    for (const url of slimCandidates) {
      const res = await tryFetch(url);
      const data = res?.data;
      if (res?.success && data && Array.isArray(data.items)) {
        return res;
      }
    }

    // If /api/boq/project succeeded but returned empty rows, keep that result (404/empty handling varies by backend).
    if (byProject?.success) {
      return {
        success: true,
        data: { project_id: Number(pid) || pid, total: 0, items: [] },
      };
    }

    return byProject;
  },

  // Back-compat: older name used in some pages.
  getBoqSlimItems: async (projectId) => {
    return await api.getBoqItemsForProject(projectId);
  },

  updateBOQ: async (id, data) => {
    const formData = new FormData();
    const fields = ['category', 'item_code', 'description', 'floor', 'unit', 'quantity', 'rate', 'amount', 'project_id'];
    fields.forEach((f) => {
      if (data[f] != null && data[f] !== '') formData.append(f, data[f]);
    });

    // Some BOQ backends/clients store qty under alternate keys (e.g. `qty` or `order_qty`).
    // When updating quantity, send the value under these keys too for compatibility.
    if (data.quantity != null && data.quantity !== '') {
      if (data.qty == null || data.qty === '') formData.append('qty', data.quantity);
      if (data.order_qty == null || data.order_qty === '') formData.append('order_qty', data.quantity);
    }
    if (data.boq_file instanceof File) formData.append('boq_file', data.boq_file);

    const response = await fetch(`${BASE_URL}/api/boq/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  deleteBOQ: async (id) => {
    const response = await fetch(`${BASE_URL}/api/boq/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // MIR (Material Inspection Request) – Base URL: https://api.madhuram.enterprises, Storage: /uploads/mir
  uploadMirReference: async (file) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      return { success: false, error: 'Invalid file' };
    }

    const response = await fetch(`${BASE_URL}/api/mir/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  uploadMirAttachments: async (files = []) => {
    const normalized = Array.isArray(files) ? files : [files];
    const attachments = [];

    for (const file of normalized) {
      if (!(file instanceof File)) continue;
      const uploadResult = await api.uploadMirReference(file);
      if (!uploadResult.success) return uploadResult;
      const filePath = uploadResult.data?.filePath || uploadResult.data?.path || "";
      attachments.push({
        name: file.name || filePath || "Attachment",
        path: filePath,
        size: file.size ?? null,
        type: file.type ?? "",
      });
    }

    return { success: true, data: { attachments } };
  },

  validateMirPayload: (payload, options = {}) => validateMirPayload(payload, options),

  createMir: async (data) => {
    return postMirCreate(data);
  },

  createLodhaMir: async (data) => {
    const payload = { ...data, template_type: 'lodha' };
    return postMirCreate(payload);
  },

  createHiranandaniMir: async (data) => {
    const payload = { ...data, template_type: 'hiranandani' };
    return postMirCreate(payload);
  },

  getMirs: async () => {
    const response = await fetch(`${BASE_URL}/api/mir`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse(response);
    if (!result?.success) return result;
    const unwrapped = unwrapListResponse(result.data);
    return { ...result, data: unwrapped ?? (Array.isArray(result.data) ? result.data : []) };
  },

  getMirById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/mir/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getMirsByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/mir/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse(response);
    if (!result?.success) return result;
    const unwrapped = unwrapListResponse(result.data);
    return { ...result, data: unwrapped ?? (Array.isArray(result.data) ? result.data : []) };
  },

  updateMir: async (id, data) => {
    const { payload, errors } = normalizeMirPayload(data, { strictRequired: true });
    if (errors.length > 0) {
      return {
        success: false,
        status: 400,
        error: `Invalid MIR payload: ${errors[0]}`,
        validationErrors: errors,
      };
    }
    const endpoint = getMirUpdatePath(id, data);
    console.log(`[MIR][PUT] Final payload -> ${endpoint}:`, payload);

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  updateLodhaMir: async (id, data) => {
    const payload = { ...data, template_type: 'lodha' };
    return api.updateMir(id, payload);
  },

  updateHiranandaniMir: async (id, data) => {
    const payload = { ...data, template_type: 'hiranandani' };
    return api.updateMir(id, payload);
  },

  toggleMirSubmitted: async (id, { user_id, user_name } = {}) => {
    const response = await fetch(`${BASE_URL}/api/mir/${id}/toggle-submitted`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user_id != null ? String(user_id) : '',
        user_name: user_name != null ? String(user_name) : '',
      }),
    });
    return handleResponse(response);
  },

  deleteMir: async (id) => {
    const response = await fetch(`${BASE_URL}/api/mir/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Attendance – Base URL: https://api.madhuram.enterprises, Storage: /uploads/attendance
  uploadAttendanceImage: async (file, { userId, userName } = {}) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      return { success: false, error: 'Invalid file' };
    }
    if (userId) formData.append('user_id', userId);
    if (userName) formData.append('user_name', userName);

    const response = await fetch(`${BASE_URL}/api/attendance/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  createAttendance: async (data) => {
    const response = await fetch(`${BASE_URL}/api/attendance`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });
    return handleResponse(response);
  },

  getAttendance: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters?.start_date) params.set('start_date', String(filters.start_date));
    if (filters?.end_date) params.set('end_date', String(filters.end_date));
    if (filters?.status) params.set('status', String(filters.status));
    if (filters?.project_id != null && String(filters.project_id).trim() !== '') {
      params.set('project_id', String(filters.project_id));
    }
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/attendance${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getAttendanceByProject: async (projectId) => {
    return api.getAttendance({ project_id: projectId });
  },

  getAttendanceByUser: async (userId) => {
    const response = await fetch(`${BASE_URL}/api/attendance/user/${userId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getAttendanceById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/attendance/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateAttendance: async (id, data) => {
    const response = await fetch(`${BASE_URL}/api/attendance/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });
    return handleResponse(response);
  },

  checkoutAttendance: async (id, data) => {
    const response = await fetch(`${BASE_URL}/api/attendance/checkout/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });
    return handleResponse(response);
  },

  updateAttendanceStatus: async (id, status) => {
    const response = await fetch(`${BASE_URL}/api/attendance/${id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    return handleResponse(response);
  },

  deleteAttendance: async (id, { userId, userName } = {}) => {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (userName) params.set('user_name', userName);
    const query = params.toString();

    const response = await fetch(`${BASE_URL}/api/attendance/${id}${query ? `?${query}` : ''}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Leave (Admin)
  grantLeaveAdmin: async (data) => {
    const response = await fetch(`${BASE_URL}/api/leave/admin/grant`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });
    return handleResponse(response);
  },

  getLeaves: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', String(filters.status));
    if (filters?.leave_type) params.set('leave_type', String(filters.leave_type));
    if (filters?.from_date) params.set('from_date', String(filters.from_date));
    if (filters?.to_date) params.set('to_date', String(filters.to_date));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/leave${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getLeavesByUser: async (userId) => {
    const response = await fetch(`${BASE_URL}/api/leave/user/${userId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // PR (Purchase Requisition) – Base URL: https://api.madhuram.enterprises, Storage: /uploads/pr
  uploadPrFile: async (file) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      return { success: false, error: 'Invalid file' };
    }

    const response = await fetch(`${BASE_URL}/api/pr/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  uploadPrSignature: async (file) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      return { success: false, error: 'Invalid file' };
    }

    const response = await fetch(`${BASE_URL}/api/pr/upload-signature`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  createPr: async (data) => {
    const response = await fetch(`${BASE_URL}/api/pr`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getPrs: async () => {
    const response = await fetch(`${BASE_URL}/api/pr`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getPrById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/pr/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getPrsByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/pr/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getPrsBySample: async (sampleId) => {
    const response = await fetch(`${BASE_URL}/api/pr/sample/${sampleId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Backpath (Relationship graph)
  getBackpathByPr: async (prId, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v == null || v === "") return;
      query.set(k, String(v));
    });
    const qs = query.toString();
    const response = await fetch(`${BASE_URL}/api/backpath/pr/${prId}${qs ? `?${qs}` : ""}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getBackpathBySample: async (sampleId, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v == null || v === "") return;
      query.set(k, String(v));
    });
    const qs = query.toString();
    const response = await fetch(`${BASE_URL}/api/backpath/sample/${sampleId}${qs ? `?${qs}` : ""}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getBackpathByPo: async (poId, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v == null || v === "") return;
      query.set(k, String(v));
    });
    const qs = query.toString();
    const response = await fetch(`${BASE_URL}/api/backpath/po/${poId}${qs ? `?${qs}` : ""}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updatePr: async (id, data) => {
    const response = await fetch(`${BASE_URL}/api/pr/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deletePr: async (id) => {
    const userFromStorage = (() => {
      try {
        return JSON.parse(localStorage.getItem('inventory_user') || 'null');
      } catch {
        return null;
      }
    })();
    const user_id = userFromStorage?.user_id ?? userFromStorage?.id ?? userFromStorage?.uid ?? null;
    const body = user_id != null ? JSON.stringify({ user_id }) : undefined;
    const response = await fetch(`${BASE_URL}/api/pr/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
    });
    return handleResponse(response);
  },

  // PR Email
  uploadPrEmailAttachments: async (prId, files = []) => {
    const normalized = Array.isArray(files) ? files : [files];
    const formData = new FormData();
    normalized.forEach((file) => {
      if (file instanceof File) formData.append("files", file);
    });

    const response = await fetch(`${BASE_URL}/api/pr/${prId}/upload-email-attachment`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  sendPrEmail: async ({ prId, to, cc = [], message = "", attachments = [], attachmentFiles = [] } = {}) => {
    if (!prId) return { success: false, error: "PR id is required to send email." };

    const userFromStorage = (() => {
      try {
        return JSON.parse(localStorage.getItem("inventory_user") || "null");
      } catch {
        return null;
      }
    })();
    const user_id = String(userFromStorage?.user_id ?? userFromStorage?.id ?? userFromStorage?.userId ?? "").trim();
    const user_name = String(userFromStorage?.user_name ?? userFromStorage?.name ?? userFromStorage?.username ?? "").trim();

    let resolvedAttachments = Array.isArray(attachments) ? attachments : [];
    const uploadCandidates = Array.isArray(attachmentFiles) ? attachmentFiles : [];
    if (uploadCandidates.length > 0) {
      const uploadResult = await api.uploadPrEmailAttachments(prId, uploadCandidates);
      if (!uploadResult.success) return uploadResult;
      resolvedAttachments = Array.isArray(uploadResult.data?.attachments) ? uploadResult.data.attachments : [];
    }

    const response = await fetch(`${BASE_URL}/api/pr/${prId}/send-email`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: String(to || "").trim(),
        cc: Array.isArray(cc) ? cc.filter(Boolean).map(String) : [],
        message: String(message || "").trim(),
        attachments: resolvedAttachments,
        user_id,
        user_name,
      }),
    });
    return handleResponse(response);
  },

  getPrEmailLogs: async (prId) => {
    const response = await fetch(`${BASE_URL}/api/pr/${prId}/email-logs`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // PO Email
  uploadPoEmailAttachments: async (poId, files = []) => {
    const normalized = Array.isArray(files) ? files : [files];
    const formData = new FormData();
    normalized.forEach((file) => {
      if (file instanceof File) formData.append("files", file);
    });

    const response = await fetch(`${BASE_URL}/api/po/${poId}/upload-email-attachment`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  sendPoEmail: async ({ poId, to, cc = [], message = "", attachments = [], attachmentFiles = [] } = {}) => {
    const userFromStorage = (() => {
      try {
        return JSON.parse(localStorage.getItem("inventory_user") || "null");
      } catch {
        return null;
      }
    })();
    const user_id = String(userFromStorage?.user_id ?? userFromStorage?.id ?? userFromStorage?.userId ?? "").trim();
    const user_name = String(userFromStorage?.user_name ?? userFromStorage?.name ?? userFromStorage?.username ?? "").trim();

    let resolvedAttachments = Array.isArray(attachments) ? attachments : [];
    const uploadCandidates = Array.isArray(attachmentFiles) ? attachmentFiles : [];
    if (poId && uploadCandidates.length > 0) {
      const uploadResult = await api.uploadPoEmailAttachments(poId, uploadCandidates);
      if (!uploadResult.success) return uploadResult;
      resolvedAttachments = Array.isArray(uploadResult.data?.attachments) ? uploadResult.data.attachments : [];
    }

    const response = await fetch(`${BASE_URL}/api/po/${poId}/send-email`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: String(to || "").trim(),
        cc: Array.isArray(cc) ? cc.filter(Boolean).map(String) : [],
        message: String(message || "").trim(),
        attachments: resolvedAttachments,
        user_id,
        user_name,
      }),
    });
    return handleResponse(response);
  },

  getPoEmailLogs: async (poId, { user_id } = {}) => {
    const params = new URLSearchParams();
    if (user_id) params.set("user_id", String(user_id));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/po/${poId}/email-logs${query ? `?${query}` : ""}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // PO (Purchase Orders) – Base URL: https://api.madhuram.enterprises, Storage: /uploads/po
  uploadPoFile: async (file) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      return { success: false, error: 'Invalid file' };
    }

    const response = await fetch(`${BASE_URL}/api/po/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  parsePoFile: async (file) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      return { success: false, error: 'Invalid file' };
    }

    const response = await fetch(`${BASE_URL}/api/po-parser/parse`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  createPo: async (data) => {
    const response = await fetch(`${BASE_URL}/api/po`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getPosByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/po/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getRecentPoByProject: async (projectId) => {
    const result = await api.getPosByProject(projectId);
    if (!result?.success) return result;
    const rows = Array.isArray(result.data) ? result.data : [];
    return {
      ...result,
      data: rows[0] || null,
    };
  },

  getPoById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/po/${id}`, {
      cache: 'no-store',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updatePo: async (id, data) => {
    const response = await fetch(`${BASE_URL}/api/po/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deletePo: async (id) => {
    const response = await fetch(`${BASE_URL}/api/po/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  uploadDcFile: async (file) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      return { success: false, error: 'Invalid file' };
    }
    const response = await fetch(`${BASE_URL}/api/dc/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  createDc: async (data) => {
    const response = await fetch(`${BASE_URL}/api/dc`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getDcsByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/dc/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getDcsByPo: async (poId) => {
    const response = await fetch(`${BASE_URL}/api/dc/po/${poId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getDcById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/dc/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateDc: async (id, data) => {
    const response = await fetch(`${BASE_URL}/api/dc/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteDc: async (id, meta = {}) => {
    const payload = {
      user_id: meta.user_id ?? "",
      user_name: meta.user_name ?? "",
    };
    const response = await fetch(`${BASE_URL}/api/dc/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  // ITR (Installation Test Report)
  uploadItrReference: async (file, meta = {}) => {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      return { success: false, error: 'Invalid file' };
    }
    if (meta.user_id != null && meta.user_id !== '') {
      formData.append('user_id', String(meta.user_id));
    }
    if (meta.user_name != null && String(meta.user_name).trim() !== '') {
      formData.append('user_name', String(meta.user_name));
    }

    const response = await fetch(`${BASE_URL}/api/itr/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  createItr: async (data) => {
    const response = await fetch(`${BASE_URL}/api/itr`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getItrs: async () => {
    const response = await fetch(`${BASE_URL}/api/itr`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getItrById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/itr/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getItrsByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/itr/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateItr: async (id, data) => {
    const response = await fetch(`${BASE_URL}/api/itr/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteItr: async (id) => {
    const response = await fetch(`${BASE_URL}/api/itr/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateItrStatus: async (id, data = {}) => {
    const response = await fetch(`${BASE_URL}/api/itr/${id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: data.status ?? '',
        inspection_code: data.inspection_code ?? data.inspectionCode ?? '',
        lodha_pmc_comments: data.lodha_pmc_comments ?? data.lodhaPmcComments ?? '',
        user_id: data.user_id,
        user_name: data.user_name,
      }),
    });
    return handleResponse(response);
  },

  uploadSampleFiles: async (files) => {
    const formData = new FormData();
    if (Array.isArray(files)) {
      files.forEach((file) => {
        if (file instanceof File) formData.append('file', file);
      });
    } else if (files instanceof File) {
      formData.append('file', files);
    }
    const response = await fetch(`${BASE_URL}/api/sample/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  getSamples: async () => {
    const response = await fetch(`${BASE_URL}/api/sample`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getSampleById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/sample/${encodeURIComponent(String(id))}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getSamplesByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/sample/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  _normalizeSamplePayload: (data = {}, { stringifyJsonFields = false } = {}) => {
    const parseJsonMaybe = (value, fallback) => {
      if (value == null) return fallback;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        try {
          return JSON.parse(trimmed);
        } catch {
          return fallback;
        }
      }
      return value;
    };

    const toIntOrNull = (value) => {
      if (value == null || value === '') return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      const i = Math.trunc(n);
      return i > 0 ? i : null;
    };

    const toNumberOrNull = (value) => {
      if (value == null || value === '') return null;
      const n = Number(String(value).replace(/,/g, '').trim());
      return Number.isFinite(n) ? n : null;
    };

    const pickInventoryIdFromAddFields = (addFields) => {
      const list = Array.isArray(addFields) ? addFields : [];
      const hit = list.find((field) => {
        const key = String(field?.key || '').trim();
        return key === 'inventory_id' || key === 'inventoryId';
      });
      return hit?.value ?? null;
    };

    const normalizeItem = (item) => {
      if (!item) return null;
      const addFields = parseJsonMaybe(item.add_fields ?? item.addFields, []);
      const fieldVal = (key) => {
        const list = Array.isArray(addFields) ? addFields : [];
        const hit = list.find((field) => String(field?.key || '').trim() === key);
        return hit?.value ?? '';
      };
      const inventoryIdRaw =
        item.inventory_id ??
        item.inventoryId ??
        pickInventoryIdFromAddFields(addFields);
      const issuedQtyRaw = item.issued_qty ?? item.issuedQty;
      const boqIdRaw =
        item.boq_id ??
        item.boqId ??
        fieldVal('boq_id') ??
        fieldVal('boqId') ??
        '';
      const boqQtyRaw =
        item.boq_qty ??
        item.boqQty ??
        fieldVal('boq_qty') ??
        fieldVal('boqQty') ??
        fieldVal('quantity') ??
        fieldVal('qty') ??
        '';
      const boqIssuedQtyRaw =
        item.boq_issued_qty ??
        item.boqIssuedQty ??
        fieldVal('boq_issued_qty') ??
        fieldVal('boqIssuedQty') ??
        '';
      const itemCodeRaw =
        item.item_code ??
        item.itemCode ??
        item.code ??
        item.boq_item_code ??
        item.hsn ??
        fieldVal('item_code') ??
        fieldVal('itemCode') ??
        fieldVal('code') ??
        fieldVal('boq_item_code') ??
        fieldVal('hsn') ??
        '';

      const itemNameRaw =
        item.item_name ??
        item.itemName ??
        fieldVal('item_name') ??
        fieldVal('itemName') ??
        item.description ??
        fieldVal('description') ??
        '';
      const brandNameRaw =
        item.brand_name ??
        item.brandName ??
        fieldVal('brand_name') ??
        fieldVal('brandName') ??
        '';
      const descriptionRaw =
        item.description ??
        item.item_description ??
        fieldVal('description') ??
        fieldVal('material_description') ??
        fieldVal('item') ??
        fieldVal('name') ??
        itemNameRaw ??
        '';
      const specificationRaw =
        item.specification ??
        item.spec ??
        fieldVal('specification') ??
        fieldVal('spec') ??
        fieldVal('specs') ??
        '';
      const qtyRaw =
        item.quantity ??
        fieldVal('selected_qty') ??
        fieldVal('quantity') ??
        fieldVal('qty') ??
        fieldVal('req_qty') ??
        '';
      const qtyPerFlatRaw =
        item.qty_per_flat ??
        item.qtyPerFlat ??
        fieldVal('qty_per_flat') ??
        fieldVal('qtyPerFlat') ??
        '';
      const totalQtyRaw =
        item.total_qty ??
        item.totalQty ??
        fieldVal('total_qty') ??
        fieldVal('totalQty') ??
        '';
      const flatCountRaw =
        item.flat_count ??
        item.flatCount ??
        fieldVal('flat_count') ??
        fieldVal('flatCount') ??
        '';
      const floorCountRaw =
        item.floors ??
        item.floor_count ??
        item.floorCount ??
        fieldVal('floors') ??
        fieldVal('floor_count') ??
        fieldVal('floorCount') ??
        '';
      const selectedQtyRaw =
        item.selected_qty ??
        item.selectedQty ??
        fieldVal('selected_qty') ??
        fieldVal('selectedQty') ??
        '';
      const boqBaseQtyRaw =
        item.boq_base_qty ??
        item.boqBaseQty ??
        fieldVal('boq_base_qty') ??
        fieldVal('boqBaseQty') ??
        '';
      const boqRemainingQtyRaw =
        item.boq_remaining_quantity ??
        item.boqRemainingQuantity ??
        fieldVal('boq_remaining_quantity') ??
        fieldVal('boqRemainingQuantity') ??
        '';
      const boqMatchKeyRaw =
        item.boq_match_key ??
        item.boqMatchKey ??
        fieldVal('boq_match_key') ??
        fieldVal('boqMatchKey') ??
        '';
      const boqKeyRaw =
        item.boq_key ??
        item.boqKey ??
        fieldVal('boq_key') ??
        fieldVal('boqKey') ??
        '';
      const boqItemCodeRaw =
        item.boq_item_code ??
        item.boqItemCode ??
        fieldVal('boq_item_code') ??
        fieldVal('boqItemCode') ??
        '';
      const valueRaw =
        item.value ??
        fieldVal('value') ??
        fieldVal('amount') ??
        '';

      const rateRaw = fieldVal('rate');
      const hsnRaw = fieldVal('hsn') || fieldVal('item_code') || '';
      const unitRaw = fieldVal('unit') || fieldVal('uom') || fieldVal('UOM') || '';
      const computedValue = (() => {
        const q = toNumberOrNull(qtyRaw);
        const r = toNumberOrNull(rateRaw);
        if (q == null || r == null) return null;
        return q * r;
      })();

      const normalized = {
        sr_no: toIntOrNull(item.sr_no ?? item.srNo ?? item.sr ?? fieldVal('sr_no') ?? fieldVal('srno')) ?? 0,
        item_name: String(itemNameRaw ?? descriptionRaw ?? '').trim(),
        brand_name: String(brandNameRaw ?? '').trim(),
        description: String(descriptionRaw ?? '').trim(),
        quantity: toNumberOrNull(qtyRaw),
        value: computedValue ?? toNumberOrNull(valueRaw),
        add_fields: Array.isArray(addFields) ? addFields : [],
      };

      const qtyPerFlat = toNumberOrNull(qtyPerFlatRaw);
      if (qtyPerFlat != null) normalized.qty_per_flat = qtyPerFlat;

      const totalQty = toNumberOrNull(totalQtyRaw);
      if (totalQty != null) normalized.total_qty = totalQty;

      const selectedQty = toNumberOrNull(selectedQtyRaw);
      if (selectedQty != null) normalized.selected_qty = selectedQty;

      const flatCount = toNumberOrNull(flatCountRaw);
      if (flatCount != null) normalized.flat_count = flatCount;

      const floorCount = toNumberOrNull(floorCountRaw);
      if (floorCount != null) normalized.floors = floorCount;

      const boqBaseQty = toNumberOrNull(boqBaseQtyRaw);
      if (boqBaseQty != null) normalized.boq_base_qty = boqBaseQty;

      const boqRemainingQty = toNumberOrNull(boqRemainingQtyRaw);
      if (boqRemainingQty != null) normalized.boq_remaining_quantity = boqRemainingQty;

      const boqMatchKey = String(boqMatchKeyRaw || '').trim();
      if (boqMatchKey) normalized.boq_match_key = boqMatchKey;

      const boqKey = String(boqKeyRaw || '').trim();
      if (boqKey) normalized.boq_key = boqKey;

      const boqItemCode = String(boqItemCodeRaw || '').trim();
      if (boqItemCode) normalized.boq_item_code = boqItemCode;

      const specification = String(specificationRaw || '').trim();
      if (specification) normalized.specification = specification;

      const hsnNum = String(hsnRaw || '').trim();
      if (hsnNum) normalized.hsn = hsnNum;

      const unit = String(item.unit ?? item.uom ?? item.UOM ?? unitRaw ?? '').trim();
      if (unit) normalized.unit = unit;

      const itemCode = String(itemCodeRaw || '').trim();
      if (itemCode) normalized.item_code = itemCode;
      if (itemCode) normalized.code = itemCode;

      const rate = toNumberOrNull(item.rate ?? rateRaw);
      if (rate != null) normalized.rate = rate;

      const inventoryId = toIntOrNull(inventoryIdRaw);
      if (inventoryId) normalized.inventory_id = inventoryId;

      const issuedQty = toNumberOrNull(issuedQtyRaw);
      if (issuedQty != null) normalized.issued_qty = issuedQty;

      const boqId = toIntOrNull(boqIdRaw);
      if (boqId) normalized.boq_id = boqId;

      const boqQty = toNumberOrNull(boqQtyRaw);
      if (boqQty != null) normalized.boq_qty = boqQty;

      const boqIssuedQty = toNumberOrNull(boqIssuedQtyRaw);
      if (boqIssuedQty != null) normalized.boq_issued_qty = boqIssuedQty;

      return normalized.description ? normalized : null;
    };

    const source = data || {};
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(source, 'sample_id')) {
      payload.sample_id = toIntOrNull(source.sample_id) ?? source.sample_id;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'project_id')) {
      payload.project_id = toIntOrNull(source.project_id) ?? source.project_id;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'building_name')) payload.building_name = source.building_name;
    if (Object.prototype.hasOwnProperty.call(source, 'site_name')) payload.site_name = source.site_name;
    if (Object.prototype.hasOwnProperty.call(source, 'flats')) {
      const flatsValue = source.flats;
      payload.flats = Array.isArray(flatsValue)
        ? flatsValue.map((value) => String(value).trim()).filter(Boolean).join(', ')
        : flatsValue;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'flat_no')) {
      payload.flat_no = source.flat_no;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'work_done')) payload.work_done = source.work_done;
    if (Object.prototype.hasOwnProperty.call(source, 'sample_file')) payload.sample_file = source.sample_file;

    const locationRaw = Object.prototype.hasOwnProperty.call(source, 'location')
      ? source.location
      : undefined;
    if (locationRaw !== undefined) {
      const loc = parseJsonMaybe(locationRaw, {});
      const coordinates = loc?.coordinates ?? loc?.cooordinates ?? '';
      payload.location = {
        floor: loc?.floor ?? '',
        flat_no: loc?.flat_no ?? loc?.flatNo ?? '',
        block: loc?.block ?? '',
        wing: loc?.wing ?? '',
        coordinates: coordinates ?? '',
        cooordinates: coordinates ?? '',
      };
    }

    const itemRaw = Object.prototype.hasOwnProperty.call(source, 'item_description')
      ? source.item_description
      : Object.prototype.hasOwnProperty.call(source, 'items')
        ? source.items
        : undefined;
    if (itemRaw !== undefined) {
      const list = parseJsonMaybe(itemRaw, []);
      const normalizedList = (Array.isArray(list) ? list : [])
        .map(normalizeItem)
        .filter(Boolean);
      payload.item_description = normalizedList;
    }

    const addFieldsRaw = Object.prototype.hasOwnProperty.call(source, 'add_fields')
      ? source.add_fields
      : undefined;
    if (addFieldsRaw !== undefined) {
      payload.add_fields = parseJsonMaybe(addFieldsRaw, []);
    }

    if (stringifyJsonFields) {
      ['location', 'item_description', 'add_fields'].forEach((key) => {
        if (payload[key] != null && typeof payload[key] !== 'string') {
          payload[key] = JSON.stringify(payload[key]);
        }
      });
    }

    return payload;
  },

  updateSample: async (id, data) => {
    const payload = api._normalizeSamplePayload(data, { stringifyJsonFields: false });
    const response = await fetch(`${BASE_URL}/api/sample/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  deleteSample: async (id) => {
    const response = await fetch(`${BASE_URL}/api/sample/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  createSample: async (data) => {
    const post = async (path, payload) => {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    };
    const candidates = [
      '/api/sample/create-sample',
      '/api/sample/create',
      '/api/sample',
    ];
    let lastError = null;
    for (const path of candidates) {
      const payload = api._normalizeSamplePayload(data, { stringifyJsonFields: false });
      const res = await post(path, payload);
      if (res.success) return res;
      lastError = res;

      if (res.status === 401 || res.status === 403) return res;
      if (res.status === 404) continue;
    }
    return lastError || { success: false, error: 'Create path not found', status: 404 };
  },

  // Vendors
  createVendor: async (data) => {
    const payload = {};
    ['vendor_name', 'vendor_company_name', 'vendor_email', 'mobile_number', 'location', 'status'].forEach((k) => {
      if (data[k] != null && String(data[k]).trim() !== '') payload[k] = data[k];
    });

    const response = await fetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  getVendors: async () => {
    const response = await fetch(`${BASE_URL}/api/vendors`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getVendorsByProject: async () => {
    // Backend does not support project-specific vendor fetch (404).
    // Always return the full vendor list instead.
    return api.getVendors();
  },

  getVendorById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/vendors/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateVendor: async (id, data) => {
    const payload = {};
    ['vendor_name', 'vendor_company_name', 'vendor_email', 'mobile_number', 'location', 'status'].forEach((k) => {
      if (data[k] != null && String(data[k]).trim() !== '') payload[k] = data[k];
    });

    const response = await fetch(`${BASE_URL}/api/vendors/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  updateVendorStatus: async (id, status) => {
    const response = await fetch(`${BASE_URL}/api/vendors/${id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    return handleResponse(response);
  },

  deleteVendor: async (id) => {
    const response = await fetch(`${BASE_URL}/api/vendors/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Vendor Price Lists
  uploadVendorPriceListFile: async (file, meta = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (meta.vendor_id) formData.append('vendor_id', String(meta.vendor_id));
    if (meta.project_id) formData.append('project_id', String(meta.project_id));
    if (meta.user_id) formData.append('user_id', String(meta.user_id));
    if (meta.user_name) formData.append('user_name', String(meta.user_name));

    const response = await fetch(`${BASE_URL}/api/vendor-price-list/bulk-upload-inventory`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  getVendorPriceLists: async (vendorId) => {
    const response = await fetch(`${BASE_URL}/api/vendor-price-list/vendor/${vendorId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getVendorPriceListById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/vendor-price-list/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  createVendorPriceList: async (data) => {
    const response = await fetch(`${BASE_URL}/api/vendor-price-list`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateVendorPriceList: async (id, data) => {
    const response = await fetch(`${BASE_URL}/api/vendor-price-list/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteVendorPriceList: async (id) => {
    const response = await fetch(`${BASE_URL}/api/vendor-price-list/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateVendorPriceListStatus: async (id, status) => {
    const response = await fetch(`${BASE_URL}/api/vendor-price-list/${id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    return handleResponse(response);
  },

  compareVendorPriceListItems: async (params = {}) => {
    const query = new URLSearchParams();
    const allowedParams = [
      'q',
      'item_name',
      'product_name',
      'category',
      'vendor_id',
      'vendor_ids',
      'project_id',
      'status',
      'limit',
      'offset',
    ];

    allowedParams.forEach((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === '') return;
      query.set(key, String(value));
    });

    const queryString = query.toString();
    const response = await fetch(`${BASE_URL}/api/vendor-price-list/compare${queryString ? `?${queryString}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Vendor Comparison (PDF upload + review)
  uploadVendorComparisonFiles: async (files = []) => {
    const formData = new FormData();
    (Array.isArray(files) ? files : [])
      .filter(Boolean)
      .forEach((file) => {
        formData.append('files', file);
      });

    const response = await fetch(`${BASE_URL}/api/vendor-comparison/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  createVendorComparison: async (data = {}) => {
    const response = await fetch(`${BASE_URL}/api/vendor-comparison`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  listVendorComparisons: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.project_id != null && params.project_id !== '') {
      query.set('project_id', String(params.project_id));
    }
    if (params.pr_no != null && params.pr_no !== '') {
      query.set('pr_no', String(params.pr_no));
    }
    const queryString = query.toString();
    const response = await fetch(`${BASE_URL}/api/vendor-comparison${queryString ? `?${queryString}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getVendorComparisonById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/vendor-comparison/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateVendorComparison: async (id, data = {}) => {
    const response = await fetch(`${BASE_URL}/api/vendor-comparison/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteVendorComparison: async (id) => {
    const response = await fetch(`${BASE_URL}/api/vendor-comparison/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Aliases (naming used by some screens/docs)
  getVendorComparisons: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.project_id != null && params.project_id !== '') {
      query.set('project_id', String(params.project_id));
    }
    const queryString = query.toString();
    const response = await fetch(`${BASE_URL}/api/vendor-comparison${queryString ? `?${queryString}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getVendorComparison: async (id) => {
    const response = await fetch(`${BASE_URL}/api/vendor-comparison/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  createInventory: async (data) => {
    const quantityNumber = Number(data.quantity);
    const payload = {
      brand: data.brand,
      quantity: quantityNumber,
      current_quantity: Number.isFinite(quantityNumber) ? quantityNumber : undefined,
      name: data.name,
      price: Number(data.price),
      unit: data.unit ?? data.units ?? '',
      units: data.units ?? data.unit ?? '',
      width: data.width ?? null,
      height: data.height ?? null,
      stockin: Boolean(data.stockin),
      billing: Boolean(data.billing),
      project_id: data.project_id ?? null,
      notes: data.notes ?? '',
      user_id: data.user_id ?? null,
      user_name: data.user_name ?? '',
    };
    const response = await fetch(`${BASE_URL}/api/inventory`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  getInventories: async () => {
    const response = await fetch(`${BASE_URL}/api/inventory`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoryById: async (id) => {
    const response = await fetch(`${BASE_URL}/api/inventory/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoriesByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/inventory/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateInventory: async (id, data) => {
    const payload = {};
    ['brand', 'name'].forEach((k) => {
      if (data[k] != null && String(data[k]).trim() !== '') payload[k] = data[k];
    });
    if (data.quantity != null && data.quantity !== '') {
      payload.quantity = Number(data.quantity);
      // Many deployments use `current_quantity` as the real available balance.
      if (data.current_quantity == null) payload.current_quantity = Number(data.quantity);
    }
    if (data.current_quantity != null && data.current_quantity !== '') payload.current_quantity = Number(data.current_quantity);
    if (data.price != null && data.price !== '') payload.price = Number(data.price);
    if (data.unit != null) payload.unit = data.unit;
    if (payload.unit == null && data.units != null) payload.unit = data.units;
    if (data.units != null) payload.units = data.units;
    if (payload.units == null && data.unit != null) payload.units = data.unit;
    if (data.width != null && data.width !== '') payload.width = Number(data.width);
    if (data.height != null && data.height !== '') payload.height = Number(data.height);
    if (typeof data.stockin === 'boolean') payload.stockin = data.stockin;
    if (typeof data.billing === 'boolean') payload.billing = data.billing;

    const response = await fetch(`${BASE_URL}/api/inventory/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  updateInventoryStockIn: async (id, stockin) => {
    const response = await fetch(`${BASE_URL}/api/inventory/${id}/stockin`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stockin: Boolean(stockin) }),
    });
    return handleResponse(response);
  },

  updateInventoryBilling: async (id, billing) => {
    const response = await fetch(`${BASE_URL}/api/inventory/${id}/billing`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ billing: Boolean(billing) }),
    });
    return handleResponse(response);
  },

  deleteInventory: async (id) => {
    const response = await fetch(`${BASE_URL}/api/inventory/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  searchInventories: async ({ q, project_id } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (project_id) params.set('project_id', String(project_id));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/inventory/search${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoryItemHistory: async (id) => {
    const response = await fetch(`${BASE_URL}/api/inventory/${id}/history`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoryItemBackground: async (id) => {
    const response = await fetch(`${BASE_URL}/api/inventory/${id}/background`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  createInventoryMovement: async (id, data) => {
    // Some deployments don't expose a movement endpoint. In that case, fallback to updating
    // the inventory quantity directly (best-effort) for stock-out/stock-in.
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/${id}/movement`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      // If endpoint doesn't exist, fall back.
      if (response.status !== 404) return handleResponse(response);
    } catch {
      // fall through to fallback logic below
    }

    const movementType = String(data?.movement_type || '').toLowerCase();
    const qty = Number(data?.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: 'Invalid movement quantity' };
    }

    const currentRes = await api.getInventoryById(id);
    if (!currentRes?.success || !currentRes?.data) return currentRes;

    const currentQty = Number(currentRes.data.current_quantity ?? currentRes.data.quantity);
    const baseQty = Number.isFinite(currentQty) ? currentQty : 0;
    const delta = movementType === 'stock_in' ? qty : -qty;
    const nextQty = Math.max(0, baseQty + delta);

    // Update both `quantity` and `current_quantity` where supported.
    // Some backends use `current_quantity` as the real available balance.
    return api.updateInventory(id, { quantity: nextQty, current_quantity: nextQty });
  },

  syncDcInventory: async (id, data) => {
    const body = data ? JSON.stringify(data) : undefined;
    const response = await fetch(`${BASE_URL}/api/dc/${id}/sync-inventory`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
    });
    return handleResponse(response);
  },

  searchInventoryTrace: async ({ q, project_id, min_qty } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (project_id) params.set('project_id', String(project_id));
    if (min_qty != null) params.set('min_qty', String(min_qty));
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/inventory-trace/search${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  autoMatchPrInventory: async (prId, { force } = {}) => {
    const response = await fetch(`${BASE_URL}/api/inventory-trace/match/pr/${prId}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force: Boolean(force) }),
    });
    return handleResponse(response);
  },

  autoMatchSampleInventory: async (sampleId, { force } = {}) => {
    const response = await fetch(`${BASE_URL}/api/inventory-trace/match/sample/${sampleId}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force: Boolean(force) }),
    });
    return handleResponse(response);
  },

  getInventoryChain: async (inventoryId) => {
    const response = await fetch(`${BASE_URL}/api/inventory-trace/chain/inventory/${inventoryId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getSampleChain: async (sampleId) => {
    const response = await fetch(`${BASE_URL}/api/inventory-trace/chain/sample/${sampleId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getPrChain: async (prId) => {
    const response = await fetch(`${BASE_URL}/api/inventory-trace/chain/pr/${prId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getDcChain: async (dcId) => {
    const response = await fetch(`${BASE_URL}/api/inventory-trace/chain/dc/${dcId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoryHistory: async (filters = {}) => {
    const params = new URLSearchParams();
    const allowed = ['inventory_id', 'user_id', 'change_type', 'source_type', 'project_id', 'from', 'to', 'page', 'limit', 'sort'];
    allowed.forEach((k) => {
      if (filters[k] != null && filters[k] !== '') params.set(k, String(filters[k]));
    });
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/inventory-history${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoryHistorySummary: async ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/inventory-history/summary${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoryHistoryByItem: async (inventoryId, filters = {}) => {
    const params = new URLSearchParams();
    const allowed = ['change_type', 'from', 'to', 'page', 'limit', 'sort'];
    allowed.forEach((k) => {
      if (filters[k] != null && filters[k] !== '') params.set(k, String(filters[k]));
    });
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/inventory-history/item/${inventoryId}${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoryHistoryByUser: async (userId, filters = {}) => {
    const params = new URLSearchParams();
    const allowed = ['change_type', 'from', 'to', 'page', 'limit', 'sort'];
    allowed.forEach((k) => {
      if (filters[k] != null && filters[k] !== '') params.set(k, String(filters[k]));
    });
    const query = params.toString();
    const response = await fetch(`${BASE_URL}/api/inventory-history/user/${userId}${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getInventoryHistoryEntry: async (historyId) => {
    const response = await fetch(`${BASE_URL}/api/inventory-history/${historyId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  downloadBulkInventoryTemplate: async () => {
    const response = await fetch(`${BASE_URL}/api/vendor-price-list/bulk-upload-inventory/template`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Hiranandani Invoice
  createHiranandaniInvoice: async (payload) => {
    const response = await fetch(`${BASE_URL}/api/hiranandani-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  getHiranandaniInvoicesByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/hiranandani-invoice/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse(response);
    if (!result?.success) return result;
    const unwrapped = unwrapListResponse(result.data);
    return { ...result, data: unwrapped ?? (Array.isArray(result.data) ? result.data : []) };
  },

  getHiranandaniInvoices: async () => {
    const response = await fetch(`${BASE_URL}/api/hiranandani-invoice`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse(response);
    if (!result?.success) return result;
    const unwrapped = unwrapListResponse(result.data);
    return { ...result, data: unwrapped ?? (Array.isArray(result.data) ? result.data : []) };
  },

  getHiranandaniInvoice: async (id) => {
    const response = await fetch(`${BASE_URL}/api/hiranandani-invoice/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateHiranandaniInvoice: async (id, payload) => {
    const response = await fetch(`${BASE_URL}/api/hiranandani-invoice/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  deleteHiranandaniInvoice: async (id) => {
    const userFromStorage = (() => {
      try {
        return JSON.parse(localStorage.getItem('inventory_user') || 'null');
      } catch {
        return null;
      }
    })();
    const user_id = userFromStorage?.user_id ?? userFromStorage?.id ?? userFromStorage?.uid ?? null;
    if (user_id == null) return { success: false, error: "Missing user_id. Please login again." };
    const body = JSON.stringify({ user_id });
    const response = await fetch(`${BASE_URL}/api/hiranandani-invoice/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body,
    });
    return handleResponse(response);
  },

  // Lodha Invoice
  createLodhaInvoice: async (payload) => {
    const response = await fetch(`${BASE_URL}/api/lodha-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  getLodhaInvoicesByProject: async (projectId) => {
    const response = await fetch(`${BASE_URL}/api/lodha-invoice/project/${projectId}`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse(response);
    if (!result?.success) return result;
    const unwrapped = unwrapListResponse(result.data);
    return { ...result, data: unwrapped ?? (Array.isArray(result.data) ? result.data : []) };
  },

  getLodhaInvoices: async () => {
    const response = await fetch(`${BASE_URL}/api/lodha-invoice`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse(response);
    if (!result?.success) return result;
    const unwrapped = unwrapListResponse(result.data);
    return { ...result, data: unwrapped ?? (Array.isArray(result.data) ? result.data : []) };
  },

  getLodhaInvoice: async (id) => {
    const response = await fetch(`${BASE_URL}/api/lodha-invoice/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateLodhaInvoice: async (id, payload) => {
    const response = await fetch(`${BASE_URL}/api/lodha-invoice/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(response);
  },

  deleteLodhaInvoice: async (id) => {
    const userFromStorage = (() => {
      try {
        return JSON.parse(localStorage.getItem('inventory_user') || 'null');
      } catch {
        return null;
      }
    })();
    const user_id = userFromStorage?.user_id ?? userFromStorage?.id ?? userFromStorage?.uid ?? null;
    if (user_id == null) return { success: false, error: "Missing user_id. Please login again." };
    const body = JSON.stringify({ user_id });
    const response = await fetch(`${BASE_URL}/api/lodha-invoice/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body,
    });
    return handleResponse(response);
  },
};

// Helper to get token from storage
const getToken = () => {
  const userStr = localStorage.getItem('inventory_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (!user) return null;
      // Support multiple backend/login payload shapes.
      return (
        user.token ||
        user.access_token ||
        user.accessToken ||
        user.jwt ||
        user.id_token ||
        user?.data?.token ||
        user?.data?.access_token ||
        null
      );
    } catch {
      return null;
    }
  }
  return null;
};

// Helper for auth headers
const getAuthHeaders = () => {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Helper to handle response
const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const isMultipart = contentType.includes('multipart');
  
  let data = null;
  try {
    if (isJson) {
      data = await response.json();
    } else if (isMultipart || contentType.includes('application/octet-stream') || contentType.includes('application/pdf')) {
      // If response is a file/blob, return it as data
      const blob = await response.blob();
      return { success: true, data: blob, isBlob: true };
    } else {
      // Try to parse as JSON anyway, might be text/json
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
  } catch {
    // Invalid JSON (e.g. HTML error page)
    if (!response.ok) {
      return { success: false, error: response.statusText || 'Invalid response', status: response.status };
    }
  }

  if (!response.ok) {
    // Handle specific error codes with user-friendly messages
    let error = (data && (data.error || data.message)) || response.statusText;
    
    if (response.status === 413) {
      error = 'File too large for compression. The file exceeds the server\'s maximum request size. Please compress the file manually using a compression tool (like 7-Zip, WinRAR, or online tools) before uploading.';
    } else if (response.status === 400) {
      error = data?.error || 'Invalid request. Please check your input and try again.';
    } else if (response.status === 401) {
      error = 'Authentication failed. Please log in again.';
    } else if (response.status === 404) {
      error = data?.error || 'Resource not found.';
    } else if (response.status === 500) {
      error = data?.error || 'Server error. Please try again later.';
    }
    
    return { success: false, error, status: response.status };
  }

  return { success: true, data };
};
