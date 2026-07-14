import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getSamplePrimaryIdentifier, resolveSampleClient } from "@/lib/sampleDisplay";

const asText = (value, fallback = "-") => {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const safeName = (value, fallback = "Sample") =>
  asText(value, fallback)
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || fallback;

const formatDateDmy = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return asText(value);
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yyyy = String(parsed.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return asText(value);
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

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

const normalizeMultiplier = (sample) => {
  const flatCount = sample?.flats ?? sample?.flat_count ?? sample?.location?.flat_no ?? sample?.location?.flats ?? "";
  const floorCount = sample?.location?.floor ?? sample?.floors ?? sample?.floor ?? "";
  const flatText = asText(flatCount, "");
  const floorText = asText(floorCount, "");
  const flatNum = Number(String(flatText).replace(/,/g, "").trim());
  const floorNum = Number(String(floorText).replace(/,/g, "").trim());
  if (Number.isFinite(flatNum) && Number.isFinite(floorNum) && flatNum > 0 && floorNum > 0) {
    return `${flatNum} x ${floorNum} = ${flatNum * floorNum}`;
  }
  if (flatText || floorText) {
    return [flatText, floorText].filter(Boolean).join(" x ");
  }
  return "-";
};

const normalizeFlats = (flats) => {
  if (Array.isArray(flats)) {
    const parts = flats.map((value) => asText(value, "")).filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "-";
  }
  if (flats && typeof flats === "object") {
    return normalizeFlats(flats.flats ?? flats.flat_no ?? flats.flatNo ?? flats.location ?? "");
  }
  return asText(flats, "-");
};

const getFieldValue = (row, key) => {
  const fields = parseMaybeJson(row?.add_fields, []);
  if (!Array.isArray(fields)) return "";
  const normalizeKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetKey = normalizeKey(key);
  const found = fields.find((field) => normalizeKey(field?.key) === targetKey);
  return found?.value ?? "";
};

const getEffectiveSampleQty = (row) => {
  const candidates = [
    row?.total_qty,
    row?.totalQty,
    getFieldValue(row, "total_qty"),
    getFieldValue(row, "totalQty"),
    row?.selected_qty,
    row?.selectedQty,
    getFieldValue(row, "selected_qty"),
    getFieldValue(row, "selectedQty"),
    row?.quantity,
    row?.qty,
    getFieldValue(row, "quantity"),
    getFieldValue(row, "qty"),
    row?.issued_qty,
    row?.issuedQty,
    getFieldValue(row, "issued_qty"),
    getFieldValue(row, "issuedQty"),
  ];
  for (const candidate of candidates) {
    const num = Number(String(candidate ?? "").replace(/,/g, "").trim());
    if (Number.isFinite(num) && num > 0) return String(num);
  }

  const qtyPerFlat = row?.qty_per_flat ?? row?.qtyPerFlat ?? getFieldValue(row, "qty_per_flat") ?? getFieldValue(row, "qtyPerFlat");
  const flats =
    row?.flat_count ??
    row?.flatCount ??
    row?.boq_flat_multiplier ??
    row?.boqFlatMultiplier ??
    getFieldValue(row, "flat_count") ??
    getFieldValue(row, "flatCount") ??
    getFieldValue(row, "boq_flat_multiplier") ??
    getFieldValue(row, "boqFlatMultiplier");
  const floors =
    row?.floors ??
    row?.floor_count ??
    row?.floorCount ??
    row?.boq_floor_multiplier ??
    row?.boqFloorMultiplier ??
    getFieldValue(row, "floors") ??
    getFieldValue(row, "floor_count") ??
    getFieldValue(row, "floorCount") ??
    getFieldValue(row, "boq_floor_multiplier") ??
    getFieldValue(row, "boqFloorMultiplier");
  const qty = Number(String(qtyPerFlat ?? "").replace(/,/g, "").trim());
  const flatNum = Number(String(flats ?? "").replace(/,/g, "").trim());
  const floorNum = Number(String(floors ?? "").replace(/,/g, "").trim());
  if (Number.isFinite(qty) && qty > 0 && Number.isFinite(flatNum) && flatNum > 0 && Number.isFinite(floorNum) && floorNum > 0) {
    return String(qty * flatNum * floorNum);
  }

  const rawQty = Number(String(row?.quantity ?? row?.qty ?? "").replace(/,/g, "").trim());
  if (Number.isFinite(rawQty) && rawQty > 0) return String(rawQty);
  return "";
};

const normalizeSampleItems = (sample, client = "") => {
  const raw = parseMaybeJson(sample?.item_description ?? sample?.items ?? sample?.item_descriptions, []);
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return [];

  const looksLikeAddFields = list.some((row) => row && typeof row === "object" && Array.isArray(row.add_fields));
  if (looksLikeAddFields) {
    return list.map((row, index) => {
      const qty =
        getEffectiveSampleQty(row) ||
        getFieldValue(row, "selected_qty") ||
        getFieldValue(row, "qty") ||
        getFieldValue(row, "quantity") ||
        "";
      const rate = getFieldValue(row, "rate") || "";
      const amount = getFieldValue(row, "amount") || getFieldValue(row, "value") || "";
      const computedAmount = (() => {
        const q = Number(String(qty).replace(/,/g, "").trim());
        const r = Number(String(rate).replace(/,/g, "").trim());
        if (Number.isFinite(q) && Number.isFinite(r)) return String(q * r);
        return "";
      })();

      return {
        sr_no: String(index + 1),
        item_name:
          getSamplePrimaryIdentifier(row, client) ||
          getFieldValue(row, "item_name") ||
          getFieldValue(row, "itemName") ||
          row?.item_name ||
          row?.itemName ||
          row?.description ||
          row?.item_name ||
          "",
        description:
          getFieldValue(row, "description") ||
          getFieldValue(row, "item") ||
          getFieldValue(row, "material_description") ||
          row?.description ||
          row?.item_name ||
          row?.name ||
          "",
        item_no:
          getFieldValue(row, "item_no") ||
          getFieldValue(row, "itemNo") ||
          row?.item_no ||
          row?.itemNo ||
          row?.sr_no ||
          row?.srNo ||
          "",
        item_code:
          getFieldValue(row, "item_code") ||
          getFieldValue(row, "itemCode") ||
          getFieldValue(row, "code") ||
          getFieldValue(row, "item_no") ||
          row?.item_code ||
          row?.itemCode ||
          row?.code ||
          row?.item_no ||
          "",
        boq_item_code:
          getFieldValue(row, "boq_item_code") ||
          getFieldValue(row, "boqItemCode") ||
          row?.boq_item_code ||
          row?.boqItemCode ||
          "",
        specification: row?.specification ?? row?.spec ?? getFieldValue(row, "specification") ?? getFieldValue(row, "spec") ?? "",
        brand_name: row?.brand_name ?? row?.brandName ?? getFieldValue(row, "brand_name") ?? getFieldValue(row, "brandName") ?? "",
        unit: row?.unit ?? row?.uom ?? row?.UOM ?? getFieldValue(row, "unit") ?? getFieldValue(row, "uom") ?? getFieldValue(row, "UOM") ?? "",
        quantity: getEffectiveSampleQty(row) || qty,
        value: computedAmount || amount,
      };
    });
  }

  return list.map((row, index) => ({
    sr_no: String(index + 1),
    item_name:
      getSamplePrimaryIdentifier(row, client) ||
      row?.item_name ||
      row?.itemName ||
      getFieldValue(row, "item_name") ||
      getFieldValue(row, "itemName") ||
      "",
    description: row?.description ?? row?.material_description ?? row?.item ?? row?.name ?? row?.item_name ?? row?.itemName ?? "",
    item_no:
      row?.item_no ??
      row?.itemNo ??
      getFieldValue(row, "item_no") ??
      getFieldValue(row, "itemNo") ??
      row?.sr_no ??
      row?.srNo ??
      "",
    item_code:
      row?.item_code ??
      row?.itemCode ??
      row?.code ??
      row?.item_no ??
      getFieldValue(row, "item_code") ??
      getFieldValue(row, "itemCode") ??
      getFieldValue(row, "code") ??
      getFieldValue(row, "item_no") ??
      "",
    boq_item_code:
      row?.boq_item_code ??
      row?.boqItemCode ??
      getFieldValue(row, "boq_item_code") ??
      getFieldValue(row, "boqItemCode") ??
      "",
    specification:
      row?.specification ??
      row?.specifications ??
      row?.spec ??
      getFieldValue(row, "specification") ??
      getFieldValue(row, "specifications") ??
      getFieldValue(row, "spec") ??
      getFieldValue(row, "specs") ??
      "",
    brand_name: row?.brand_name ?? row?.brandName ?? "",
    unit: row?.unit ?? row?.uom ?? row?.UOM ?? "",
    quantity: getEffectiveSampleQty(row) || row?.quantity || row?.qty || row?.req_qty || "",
    value: row?.value ?? row?.amount ?? "",
  }));
};

const normalizeAdditionalFields = (sample) => {
  const raw = parseMaybeJson(sample?.add_fields, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((field) => ({
      key: asText(field?.key, ""),
      value: asText(field?.value, ""),
    }))
    .filter((field) => field.key || field.value);
};

const getSamplePdfFileName = (sample) => {
  const sampleId = sample?.sample_id || sample?.id || "sample";
  const nameSeed = sample?.building_name || sample?.site_name || sample?.work_done || "sample";
  return `Sample-${sampleId}-${safeName(nameSeed)}.pdf`;
};

export const downloadSamplePdf = async (sampleInput, { fileName } = {}) => {
  const sample = sampleInput?.sample || sampleInput?.data || sampleInput || {};
  const sampleClient = resolveSampleClient(sample, sample?.project_id);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setDrawColor(0);
  doc.setTextColor(0);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const frameX = margin;
  const frameY = margin;
  const frameW = pageWidth - margin * 2;
  const frameH = pageHeight - margin * 2;
  const titleH = 10;
  const headerRowH = 8;
  const splitW = 130;
  const splitX = frameX + splitW;

  const renderFrame = () => {
    doc.setLineWidth(0.5);
    doc.rect(frameX, frameY, frameW, frameH);
  };

  const drawCell = (label, value, x, cellEndX, y) => {
    if (!label) return 1;
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.text(label, x, y);
    const labelW = doc.getTextWidth(label);
    doc.setFont("times", "normal");
    const text = asText(value);
    const textX = x + labelW + 1;
    const maxWidth = Math.max(30, cellEndX - (textX + 1));
    const wrapped = doc.splitTextToSize(text, maxWidth);
    doc.text(wrapped, textX, y);
    return Array.isArray(wrapped) ? wrapped.length : 1;
  };

  const rows = [
    [
      { label: "Sample ID :-", value: sample?.sample_id || sample?.id || "-" },
      { label: "Date :-", value: formatDateDmy(sample?.created_at || sample?.updated_at || sample?.date) },
    ],
    [
      { label: "Project :-", value: sample?.project_id || "-" },
      { label: "Updated :-", value: formatDateTime(sample?.updated_at) },
    ],
    [
      { label: "Building :-", value: sample?.building_name || "-" },
      { label: "Site :-", value: sample?.site_name || "-" },
    ],
    [
      { label: "Flat/Zone :-", value: normalizeFlats(sample?.flats || sample?.location?.flats || sample?.location?.flat_no) },
      { label: "Floor/Shaft :-", value: asText(sample?.location?.floor ?? sample?.floors ?? sample?.floor ?? "-") },
    ],
    [
      { label: "Work Done :-", value: sample?.work_done || "-" },
      { label: "Total :-", value: normalizeMultiplier(sample) },
    ],
  ];

  const measuredRows = rows.map(([left, right]) => {
    const leftLabelW = (() => {
      doc.setFont("times", "bold");
      doc.setFontSize(10.5);
      return doc.getTextWidth(left.label);
    })();
    const rightLabelW = (() => {
      doc.setFont("times", "bold");
      doc.setFontSize(10.5);
      return doc.getTextWidth(right.label || "");
    })();
    doc.setFont("times", "normal");

    const leftMaxWidth = Math.max(30, splitX - ((frameX + 2.5) + leftLabelW + 3));
    const rightMaxWidth = Math.max(30, (frameX + frameW - 2.5) - ((splitX + 2.5) + rightLabelW + 3));
    const leftLines = doc.splitTextToSize(asText(left.value), leftMaxWidth);
    const rightLines = right.label ? doc.splitTextToSize(asText(right.value), rightMaxWidth) : [];
    const leftCount = Array.isArray(leftLines) ? leftLines.length : 1;
    const rightCount = Array.isArray(rightLines) ? rightLines.length : 1;
    const height = Math.max(headerRowH, leftCount * 4.2 + 4, right.label ? rightCount * 4.2 + 4 : headerRowH);
    return { left, right, height };
  });

  const headerH = measuredRows.reduce((sum, row) => sum + row.height, 0);
  const headerY = frameY + titleH;
  const tableStartY = frameY + titleH + headerH;
  const items = normalizeSampleItems(sample, sampleClient);
  const additionalFields = normalizeAdditionalFields(sample);
  const isBoqLinkedRow = (item = {}) =>
    Boolean(
      item?.boq_id ||
        item?.boqId ||
        item?.boq_key ||
        item?.boqKey ||
        item?.boq_match_key ||
        item?.boqMatchKey ||
        item?.boq_item_code ||
        item?.boqItemCode
    );
  const getDisplayItemNo = (item = {}) => {
    const itemNo = asText(item.item_no, "");
    if (itemNo) return itemNo;
    if (!isBoqLinkedRow(item)) return asText(item.item_name, "-");
    return "-";
  };

  renderFrame();
  doc.setLineWidth(0.5);
  doc.line(frameX, frameY + titleH, frameX + frameW, frameY + titleH);

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("Sample", frameX + frameW / 2, frameY + 7, { align: "center" });

  doc.setLineWidth(0.5);
  doc.rect(frameX, headerY, frameW, headerH);
  doc.line(splitX, headerY, splitX, headerY + headerH);

  let runningY = headerY;
  measuredRows.forEach((row, index) => {
    const baseline = runningY + 5.4;
    drawCell(row.left.label, row.left.value, frameX + 2.5, splitX, baseline);
    drawCell(row.right.label, row.right.value, splitX + 2.5, frameX + frameW, baseline);
    runningY += row.height;
    if (index < measuredRows.length - 1) {
      doc.line(frameX, runningY, frameX + frameW, runningY);
    }
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: frameX, right: frameX },
    tableWidth: "wrap",
    theme: "grid",
    head: [
      sampleClient === "hiranandani"
        ? ["Sr No", "Item No", "Description", "BOQ Item Code", "Specification", "Brand", "Unit", "Quantity"]
        : sampleClient === "lodha"
          ? ["Sr No", "Item No", "BOQ Item Code", "Description", "Specification", "Brand", "Unit", "Quantity"]
          : ["Sr No", "Item Code", "Item Name", "Description", "BOQ Item Code", "Specification", "Brand", "Unit", "Quantity"],
    ],
    body: items.map((item) =>
      sampleClient === "hiranandani"
        ? [
            asText(item.sr_no, ""),
            getDisplayItemNo(item),
            asText(item.description || item.item_name, "-"),
            asText(item.boq_item_code || item.item_code, "-"),
            asText(item.specification, "-"),
            asText(item.brand_name, "-"),
            asText(item.unit, "-"),
            asText(item.quantity, "-"),
          ]
        : sampleClient === "lodha"
          ? [
              asText(item.sr_no, ""),
              getDisplayItemNo(item),
              asText(item.boq_item_code || item.item_code, "-"),
              asText(item.description || item.item_name, "-"),
              asText(item.specification, "-"),
              asText(item.brand_name, "-"),
              asText(item.unit, "-"),
              asText(item.quantity, "-"),
            ]
        : [
            asText(item.sr_no, ""),
            asText(item.item_code || item.boq_item_code, "-"),
            asText(item.item_name, "-"),
            asText(item.description, "-"),
            asText(item.boq_item_code || item.item_code, "-"),
            asText(item.specification, "-"),
            asText(item.brand_name, "-"),
            asText(item.unit, "-"),
            asText(item.quantity, "-"),
          ]
    ),
    styles: {
      font: "times",
      fontSize: 8.8,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      fontSize: 8.5,
    },
    columnStyles:
      sampleClient === "hiranandani"
        ? {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 16, halign: "center" },
            2: { cellWidth: 36 },
            3: { cellWidth: 24, halign: "center" },
            4: { cellWidth: 28 },
            5: { cellWidth: 16, halign: "center" },
            6: { cellWidth: 12, halign: "center" },
            7: { cellWidth: 14, halign: "center" },
          }
        : sampleClient === "lodha"
          ? {
              0: { cellWidth: 10, halign: "center" },
              1: { cellWidth: 16, halign: "center" },
              2: { cellWidth: 24, halign: "center" },
              3: { cellWidth: 34 },
              4: { cellWidth: 28 },
              5: { cellWidth: 16, halign: "center" },
              6: { cellWidth: 12, halign: "center" },
              7: { cellWidth: 14, halign: "center" },
            }
        : {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 14, halign: "center" },
            2: { cellWidth: 24 },
            3: { cellWidth: 24 },
            4: { cellWidth: 20, halign: "center" },
            5: { cellWidth: 24 },
            6: { cellWidth: 16, halign: "center" },
            7: { cellWidth: 12, halign: "center" },
            8: { cellWidth: 14, halign: "center" },
          },
    didDrawPage: () => {
      renderFrame();
    },
  });

  const afterItemsY = doc.lastAutoTable?.finalY || tableStartY;
  let nextY = afterItemsY + 6;

  if (additionalFields.length > 0) {
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("Additional Fields", frameX + 1, nextY);
    nextY += 2;

    autoTable(doc, {
      startY: nextY,
      margin: { left: frameX, right: frameX },
      tableWidth: frameW,
      theme: "grid",
      head: [["Key", "Value"]],
      body: additionalFields.map((field) => [field.key, field.value]),
      styles: {
        font: "times",
        fontSize: 9.5,
        cellPadding: 1.5,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        valign: "middle",
      },
      headStyles: {
        fontStyle: "bold",
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: frameW - 45 },
      },
      didDrawPage: () => {
        renderFrame();
      },
    });
  }

  doc.save(fileName || getSamplePdfFileName(sample));
};
