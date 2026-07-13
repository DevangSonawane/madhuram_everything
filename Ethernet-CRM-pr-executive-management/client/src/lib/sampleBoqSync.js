const parseMaybeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getFieldValue = (row, key) =>
  (Array.isArray(row?.add_fields) ? row.add_fields : []).find((field) => String(field?.key || "").trim() === key)?.value ?? "";

const normalizeEmptyLike = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "-" || lower === "_" || lower === "na" || lower === "n/a" || lower === "null" || lower === "undefined") {
    return "";
  }
  return text;
};

const toFiniteNumber = (value) => {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

const getSampleRowMultiplier = (row = {}) => {
  const flatCount =
    toFiniteNumber(getFieldValue(row, "flat_count")) ??
    toFiniteNumber(getFieldValue(row, "boq_flat_multiplier")) ??
    toFiniteNumber(row?.flat_count) ??
    toFiniteNumber(row?.flats) ??
    1;
  const floorCount =
    toFiniteNumber(getFieldValue(row, "floors")) ??
    toFiniteNumber(getFieldValue(row, "boq_floor_multiplier")) ??
    toFiniteNumber(row?.floor_count) ??
    toFiniteNumber(row?.floors) ??
    1;

  return Math.max(1, (flatCount || 1) * (floorCount || 1));
};

const getSampleRowQty = (row = {}) => {
  const explicitTotal =
    toFiniteNumber(row?.total_qty) ??
    toFiniteNumber(row?.quantity) ??
    toFiniteNumber(row?.qty) ??
    toFiniteNumber(row?.issued_qty) ??
    toFiniteNumber(getFieldValue(row, "total_qty")) ??
    toFiniteNumber(getFieldValue(row, "selected_qty")) ??
    toFiniteNumber(getFieldValue(row, "boq_base_qty")) ??
    toFiniteNumber(getFieldValue(row, "boq_issued_qty")) ??
    0;
  if (explicitTotal > 0) return explicitTotal;

  const perFlatQty =
    toFiniteNumber(row?.qty_per_flat) ??
    toFiniteNumber(row?.quantity_per_flat) ??
    toFiniteNumber(row?.per_flat_qty) ??
    toFiniteNumber(getFieldValue(row, "qty_per_flat")) ??
    toFiniteNumber(getFieldValue(row, "boq_qty_per_flat")) ??
    0;
  if (perFlatQty > 0) return perFlatQty * getSampleRowMultiplier(row);

  return 0;
};

const normalizeBoqItem = (apiItem) => ({
  id: apiItem?.boq_id ?? apiItem?.id,
  code: apiItem?.item_code ?? apiItem?.code ?? apiItem?.item_no,
  item_code: apiItem?.item_code,
  item_no: apiItem?.item_no ?? apiItem?.itemNo,
  section: apiItem?.category ?? apiItem?.section ?? apiItem?.section_name ?? apiItem?.sectionName,
  description: apiItem?.description ?? apiItem?.item_description ?? apiItem?.service_description,
  qty: apiItem?.quantity ?? apiItem?.qty ?? apiItem?.order_qty ?? apiItem?.orderQty,
});

const buildBoqMatches = (rows = [], boqRows = []) => {
  const normalizedBoqs = (Array.isArray(boqRows) ? boqRows : []).map(normalizeBoqItem).filter((row) => row?.id != null);
  const aggregate = new Map();
  let unmatched = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const selectedQty = getSampleRowQty(row);
    if (selectedQty <= 0) continue;

    const rowBoqId = normalizeEmptyLike(getFieldValue(row, "boq_id") || row?.boq_id || row?.boqId);
    const rowMatchKey = normalizeEmptyLike(getFieldValue(row, "boq_match_key") || row?.boq_match_key || row?.boqMatchKey);
    const rowBoqKey = normalizeEmptyLike(getFieldValue(row, "boq_key") || row?.boq_key || row?.boqKey);

    const match = normalizedBoqs.find((boq) => {
      const boqId = normalizeEmptyLike(boq?.id);
      const boqMatchKey = normalizeEmptyLike(boq?.boq_match_key || boq?.boqMatchKey);
      const boqKey = normalizeEmptyLike(boq?.boq_key || boq?.boqKey);
      return (
        (rowBoqId && boqId && String(rowBoqId) === String(boqId)) ||
        (rowMatchKey && boqMatchKey && String(rowMatchKey) === String(boqMatchKey)) ||
        (rowBoqKey && boqKey && String(rowBoqKey) === String(boqKey))
      );
    });

    if (!match) {
      unmatched += 1;
      continue;
    }
    aggregate.set(String(match.id), (aggregate.get(String(match.id)) || 0) + selectedQty);
  }

  return { aggregate, unmatched };
};

export const syncSampleBoqQuantities = async (api, projectId, beforeRows = [], afterRows = []) => {
  const pid = String(projectId || "").trim();
  if (!pid) return { success: false, error: "Missing project id" };

  const fullRes = await api.getBOQsByProject(pid);
  if (!fullRes?.success) {
    return { success: false, error: fullRes?.error || "Could not fetch BOQ items for deduction." };
  }

  const fullRows = Array.isArray(fullRes.data)
    ? fullRes.data
    : Array.isArray(fullRes.data?.boqs)
      ? fullRes.data.boqs
      : Array.isArray(fullRes.data?.data)
        ? fullRes.data.data
        : [];
  const normalizedBoqs = fullRows.map(normalizeBoqItem).filter((row) => row?.id != null);
  const currentQtyById = new Map(
    normalizedBoqs.map((boq) => [String(boq.id), toFiniteNumber(boq.qty) ?? 0])
  );

  const beforeMatch = buildBoqMatches(parseMaybeArray(beforeRows), normalizedBoqs);
  const afterMatch = buildBoqMatches(parseMaybeArray(afterRows), normalizedBoqs);
  const allIds = new Set([...beforeMatch.aggregate.keys(), ...afterMatch.aggregate.keys()]);
  const unmatched = beforeMatch.unmatched + afterMatch.unmatched;

  let updated = 0;
  let failed = 0;

  for (const boqId of allIds) {
    const beforeQty = beforeMatch.aggregate.get(boqId) || 0;
    const afterQty = afterMatch.aggregate.get(boqId) || 0;
    const delta = afterQty - beforeQty;
    if (delta === 0) continue;

    const currentQty = currentQtyById.get(boqId) ?? 0;
    const nextQty = Math.max(0, currentQty - delta);
    const updateRes = await api.updateBOQ(boqId, { quantity: String(nextQty) });
    if (updateRes?.success) updated += 1;
    else failed += 1;
  }

  return { success: failed === 0 && unmatched === 0, data: { updated, failed, unmatched } };
};
