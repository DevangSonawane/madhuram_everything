const normalizeClientName = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const parseMaybeJson = (value, fallback) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const getRowFieldValue = (row, key) => {
  const fields = parseMaybeJson(row?.add_fields, []);
  if (!Array.isArray(fields)) return "";
  const normalizeKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetKey = normalizeKey(key);
  const found = fields.find((field) => normalizeKey(field?.key) === targetKey);
  return found?.value ?? "";
};

const getStoredBoqClient = (projectId) => {
  if (typeof window === "undefined") return "";
  const pid = String(projectId || "").trim();
  if (!pid) return "";
  try {
    return normalizeClientName(localStorage.getItem(`boqClient:${pid}`));
  } catch {
    return "";
  }
};

const getClientFromFields = (value) => {
  const client = normalizeClientName(value);
  if (client === "lodha" || client === "hiranandani") return client;
  return "";
};

const inferSampleClientFromRows = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];
  const hasHiraSignal = list.some((row) => {
    const itemNo = String(row?.item_no ?? row?.itemNo ?? getRowFieldValue(row, "item_no") ?? getRowFieldValue(row, "itemNo") ?? "").trim();
    const sac = String(row?.sac_code ?? row?.sacCode ?? getRowFieldValue(row, "sac_code") ?? getRowFieldValue(row, "sacCode") ?? "").trim();
    return Boolean(sac) || /^\(\d+\)$/.test(itemNo);
  });
  const hasLodhaSignal = list.some((row) => {
    const itemNo = String(row?.item_no ?? row?.itemNo ?? getRowFieldValue(row, "item_no") ?? getRowFieldValue(row, "itemNo") ?? "").trim();
    const hsn = String(row?.hsn ?? row?.hsn_code ?? row?.hsnCode ?? getRowFieldValue(row, "hsn") ?? getRowFieldValue(row, "hsn_code") ?? "").trim();
    return Boolean(hsn) || /^\d+(\.\d+){1,3}$/.test(itemNo);
  });

  if (hasHiraSignal && !hasLodhaSignal) return "hiranandani";
  if (hasLodhaSignal && !hasHiraSignal) return "lodha";
  return "";
};

const resolveSampleClient = (sample = {}, projectId) => {
  const directCandidates = [
    sample?.sample_client,
    sample?.sampleClient,
    sample?.client,
    sample?.boq_client,
    sample?.boqClient,
    getRowFieldValue(sample, "sample_client"),
    getRowFieldValue(sample, "sampleClient"),
    getRowFieldValue(sample, "client"),
    getRowFieldValue(sample, "boq_client"),
    getRowFieldValue(sample, "boqClient"),
  ];

  for (const candidate of directCandidates) {
    const client = getClientFromFields(candidate);
    if (client) return client;
  }

  const storedClient = getStoredBoqClient(projectId ?? sample?.project_id);
  if (storedClient) return storedClient;

  const items = parseMaybeJson(sample?.item_description ?? sample?.items ?? sample?.item_descriptions, []);
  const inferred = inferSampleClientFromRows(Array.isArray(items) ? items : []);
  if (inferred) return inferred;

  return "";
};

const getSamplePrimaryIdentifierLabel = (client) => {
  const normalized = normalizeClientName(client);
  if (normalized === "hiranandani") return "Item No";
  if (normalized === "lodha") return "Item Code";
  return "Item Name";
};

const getSamplePrimaryIdentifier = (row = {}, client = "") => {
  const normalized = normalizeClientName(client);
  const manualNameCandidates = [
    row?.item_name,
    row?.itemName,
    getRowFieldValue(row, "item_name"),
    getRowFieldValue(row, "itemName"),
    row?.name,
    row?.product_name,
    row?.productName,
    row?.material_name,
    row?.materialName,
    row?.service_name,
    row?.serviceName,
    getRowFieldValue(row, "name"),
    getRowFieldValue(row, "product_name"),
    getRowFieldValue(row, "productName"),
    getRowFieldValue(row, "material_name"),
    getRowFieldValue(row, "materialName"),
    getRowFieldValue(row, "service_name"),
    getRowFieldValue(row, "serviceName"),
  ];

  if (normalized === "hiranandani") {
    return (
      manualNameCandidates.find((value) => String(value ?? "").trim() !== "") ??
      row?.item_no ??
      row?.itemNo ??
      getRowFieldValue(row, "item_no") ??
      getRowFieldValue(row, "itemNo") ??
      row?.item_code ??
      row?.itemCode ??
      row?.sac_code ??
      row?.sacCode ??
      getRowFieldValue(row, "sac_code") ??
      getRowFieldValue(row, "sacCode") ??
      row?.code ??
      row?.sr_no ??
      row?.srNo ??
      row?.description ??
      row?.item_name ??
      row?.itemName ??
      ""
    );
  }
  if (normalized === "lodha") {
    return (
      manualNameCandidates.find((value) => String(value ?? "").trim() !== "") ??
      row?.item_no ??
      row?.itemNo ??
      getRowFieldValue(row, "item_no") ??
      getRowFieldValue(row, "itemNo") ??
      row?.item_code ??
      row?.itemCode ??
      row?.code ??
      getRowFieldValue(row, "item_code") ??
      getRowFieldValue(row, "itemCode") ??
      getRowFieldValue(row, "code") ??
      row?.description ??
      row?.item_name ??
      row?.itemName ??
      ""
    );
  }

  return (
    manualNameCandidates.find((value) => String(value ?? "").trim() !== "") ??
    row?.description ??
    row?.item_no ??
    row?.itemNo ??
    row?.item_code ??
    row?.itemCode ??
    row?.code ??
    ""
  );
};

export {
  getSamplePrimaryIdentifier,
  getSamplePrimaryIdentifierLabel,
  inferSampleClientFromRows,
  resolveSampleClient,
};
