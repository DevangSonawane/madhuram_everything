import { jsPDF } from "jspdf";

const asText = (value, fallback = "") => {
  const raw = value == null ? "" : String(value);
  const cleaned = raw.trim();
  return cleaned ? cleaned : fallback;
};

const safeName = (value, fallback = "ITR") =>
  asText(value, fallback).replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });

const loadImageDataUrl = async (urls) => {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob?.size) return await blobToDataUrl(blob);
    } catch {
      // Try next candidate.
    }
  }
  return "";
};

const drawCell = (doc, x, y, w, h, text = "", options = {}) => {
  const {
    fill,
    font = "helvetica",
    style = "normal",
    size = 8,
    align = "left",
    valign = "middle",
    padding = 1.4,
    lineWidth = 0.25,
  } = options;

  doc.setLineWidth(lineWidth);
  doc.setDrawColor(0);
  if (fill) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(x, y, w, h, "FD");
  } else {
    doc.rect(x, y, w, h);
  }
  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(0);
  const lines = doc.splitTextToSize(asText(text), Math.max(1, w - padding * 2));
  const lineH = size * 0.36;
  const textH = lines.length * lineH;
  const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - padding : x + padding;
  let ty = y + padding + lineH;
  if (valign === "middle") ty = y + (h - textH) / 2 + lineH * 0.8;
  if (valign === "bottom") ty = y + h - padding;
  doc.text(lines, tx, ty, { align });
};

const drawCheck = (doc, x, y, checked = false) => {
  doc.rect(x, y, 3.2, 3.2);
  if (checked) {
    doc.setLineWidth(0.45);
    doc.line(x + 0.6, y + 1.7, x + 1.4, y + 2.6);
    doc.line(x + 1.4, y + 2.6, x + 2.8, y + 0.7);
  }
};

const DISCIPLINE_UI_TO_TEMPLATE = {
  "Structural / Civil": "Structural /Civil",
  "Arch / Finishing": "Arch/Finishing",
  Mechanical: "Mechanical",
  Electrical: "Electrical",
  Landscape: "Landscape",
  Plumbing: "Plumbing",
  Facade: "Facade",
  Others: "Others(Specify)",
  ID: "ID",
  Surveying: "Surveying",
};

const DISCIPLINE_TEMPLATE_LABELS = [
  // Left column
  "Surveying",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Others(Specify)",
  // Right column
  "Structural /Civil",
  "Arch/Finishing",
  "Landscape",
  "Facade",
  "ID",
];

const normalizeItr = (input = {}) => {
  const payload = input?.payload && typeof input.payload === "object" ? input.payload : input;
  const contractorPart = payload.contractorPart || payload.contractor_part || {};
  const measurement = contractorPart.measurement || payload.measurement || {};
  const attachments = contractorPart.attachments || payload.attachments || {};
  const clearances = contractorPart.clearances || payload.clearances || {};
  const lodhaPmc = payload.lodhaPmc || payload.lodha_pmc || {};
  const signOffs = lodhaPmc.signOffs || lodhaPmc.sign_offs || {};
  const rawWorkItems = Array.isArray(payload.workItems)
    ? payload.workItems
    : Array.isArray(payload.work_items)
      ? payload.work_items
      : [];

  const disciplineRaw = contractorPart.discipline || payload.discipline || "";
  const discipline = Array.isArray(disciplineRaw) ? disciplineRaw.map(String) : [String(disciplineRaw || "")];
  const disciplineSet = new Set(
    discipline
      .map((v) => v.trim())
      .filter(Boolean)
      .map((label) => DISCIPLINE_UI_TO_TEMPLATE[label] || label),
  );

  return {
    projectName: asText(payload.projectName || payload.project_name),
    projectCode: asText(payload.projectCode || payload.project_code),
    clientEmployer: asText(payload.clientEmployer || payload.client_employer),
    pmcEngineer: asText(payload.pmcEngineer || payload.pmc_engineer),
    contractor: asText(payload.contractor),
    vendorCode: asText(payload.vendorCode || payload.vendor_code),
    materialCode: asText(payload.materialCode || payload.material_code),
    itrRefNo: asText(payload.itrRefNo || payload.itr_ref_no),
    revNo: asText(payload.revNo || payload.rev_no),
    submissionDateTime: formatDateTime(payload.wirItrSubmissionDateTime || payload.wir_itr_submission_date_time),
    inspectionDateTime: formatDateTime(payload.inspectionDateTime || payload.inspection_date_time),
    submittedTo: asText(payload.submittedTo || payload.submitted_to),
    submittedBy: asText(payload.submittedBy || payload.submitted_by),
    workOrderNo: asText(payload.workOrderNo || payload.work_order_no),
    location: {
      towerBlock: asText(contractorPart.locationRef || payload.towerBlock || payload.tower_block),
      floorLevel: asText(contractorPart.floorLevel || payload.floorLevel || payload.floor_level),
      roomArea: asText(contractorPart.areaRef || payload.roomArea || payload.room_area),
      gridReference: asText(contractorPart.gridReference || payload.gridReference || payload.grid_reference),
    },
    disciplineSet,
    measurement: {
      previousQty: asText(measurement.previousQty ?? payload.previousQty ?? payload.previous_quantity),
      currentQty: asText(measurement.currentQty ?? payload.currentQty ?? payload.current_quantity),
      cumulativeQty: asText(measurement.cumulativeQty ?? payload.cumulativeQty ?? payload.cumulative_quantity),
      unit: asText(measurement.unit ?? payload.unit ?? payload.quantity_unit),
    },
    descriptionOfWorks: asText(contractorPart.descriptionOfWorks || payload.descriptionOfWorks || payload.description_of_works),
    workItems: rawWorkItems.map((item) => ({
      boqCode: asText(item?.boqCode || item?.boq_code || item?.boq_id || item?.boqId),
      itemDescription: asText(item?.itemDescription || item?.item_description || item?.description || item?.name),
      quantity: asText(item?.quantity ?? item?.qty ?? item?.boq_qty ?? item?.boqQty),
      unit: asText(item?.unit || item?.uom || ""),
      prepared: Boolean(item?.prepared || item?.is_prepared || item?.isPrepared),
    })),
    attachments: {
      drawingAttached: asText(attachments.drawingAttached || attachments.drawing_attached || ""),
      methodStatementAttached: asText(attachments.methodStatementAttached || attachments.method_statement_attached || ""),
      attachedTestCerts: asText(attachments.attachedTestCerts || attachments.test_certificates_attached || ""),
      checklistAttached: asText(attachments.checklistAttached || attachments.checklist_attached || ""),
      jointMeasurementAttached: asText(attachments.jointMeasurementAttached || attachments.joint_measurement_attached || ""),
      specificDrawingRefNo: asText(attachments.specificDrawingRefNo || attachments.drawing_ref_no || ""),
    },
    otherSections: {
      mep: clearances.mep || {},
      surveyor: clearances.surveyor || {},
      interface: clearances.interface || {},
    },
    contractorManager: {
      comments: asText(contractorPart.contractorManagerComments || payload.contractor_manager_comments),
      readyDate: asText(contractorPart.readyForInspectionDate || payload.ready_for_inspection_date),
      readyTime: asText(contractorPart.readyForInspectionTime || payload.ready_for_inspection_time),
      signedBy: asText(contractorPart.readySignedBy || payload.ready_signed_by),
    },
    lodhaPmc: {
      comments: asText(lodhaPmc.comments || payload.comments),
      resultCode: asText(lodhaPmc.resultCode || lodhaPmc.inspectionCode || lodhaPmc.inspection_code || ""),
      signOffs: {
        engineerCivil: signOffs.engineerManagerCivil || signOffs.engineer_manager_civil || {},
        engineerMep: signOffs.engineerManagerMep || signOffs.engineer_manager_mep || {},
        towerIncharge: signOffs.towerIncharge || signOffs.tower_incharge || {},
        qaa: signOffs.qaaDepartment || signOffs.qaa_department || {},
      },
    },
  };
};

const codeToNumeric = (value) => {
  const raw = asText(value).toUpperCase();
  if (raw.startsWith("CODE_")) return raw.replace("CODE_", "");
  if (raw.startsWith("CODE ")) return raw.replace("CODE ", "");
  const m = raw.match(/\b([1-4])\b/);
  return m ? m[1] : "";
};

const wrapLines = (doc, text, width, maxLines = 2) => {
  const lines = doc.splitTextToSize(asText(text), Math.max(1, width));
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  const last = String(clipped[maxLines - 1] || "").replace(/\.\.\.$/, "");
  clipped[maxLines - 1] = `${last.replace(/\s+$/, "")}...`;
  return clipped;
};

export const downloadItrPdf = async (itrInput, options = {}) => {
  const data = normalizeItr(itrInput);
  const fileName =
    options.fileName ||
    (options.itrId ? `ITR -${options.itrId}.pdf` : `${safeName(data.itrRefNo, "ITR")}.pdf`);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const x = 10;
  const y = 12;
  const w = 190;
  const beige = [198, 195, 160];

  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const headerUrl = new URL(`${normalizedBaseUrl}assets/lodha-header.png`, window.location.origin).toString();
  const header = await loadImageDataUrl([
    headerUrl,
    "/assets/lodha-header.png",
    "/assets/lodha-itr-header.png",
  ]);

  const drawPageChrome = () => {
    doc.setLineWidth(0.6);
    doc.rect(x, y, w, frameH);
    if (header) {
      doc.addImage(header, "PNG", x + 1, y + 1, w - 2, 16.5, undefined, "FAST");
    }
  };

  // Outer frame
  const pageH = doc.internal.pageSize.getHeight();
  const frameH = Math.max(0, pageH - y - 15);
  drawPageChrome();

  // Header image
  if (header) {
    doc.addImage(header, "PNG", x + 1, y + 1, w - 2, 16.5, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("LODHA", x + 10, y + 12);
  }

  // Title bar
  const titleY = y + 18;
  drawCell(doc, x, titleY, w, 8, "WORK INSPECTION REQUEST - (WIR)", {
    fill: beige,
    style: "bold",
    size: 11,
    align: "center",
    lineWidth: 0.6,
  });

  // === Top info table ===
  const topY = titleY + 8;
  const labelW = 32;
  const valueW = 74;
  const label2W = 40;
  const value2W = 44;
  const rowH = 6;

  const leftX = x;
  const midX = x + labelW;
  const rightLabelX = x + labelW + valueW;
  const rightValueX = rightLabelX + label2W;

  const drawTopRow = (rowIndex, label, value, label2, value2) => {
    const ry = topY + rowIndex * rowH;
    drawCell(doc, leftX, ry, labelW, rowH, label, { style: "bold", size: 7.6 });
    drawCell(doc, midX, ry, valueW, rowH, value, { size: 7.6 });
    drawCell(doc, rightLabelX, ry, label2W, rowH, label2, { style: "bold", size: 7.2 });
    drawCell(doc, rightValueX, ry, value2W, rowH, value2, { size: 7.2 });
  };

  drawTopRow(0, "Project Name", data.projectName, "WIR/ ITR Ref.No:", data.itrRefNo);
  drawTopRow(1, "Project Code", data.projectCode, "Rev. No:", data.revNo);
  drawCell(doc, leftX, topY + 2 * rowH, labelW, rowH * 2, "Client/Employer", { style: "bold", size: 7.4, valign: "middle" });
  drawCell(doc, midX, topY + 2 * rowH, valueW, rowH * 2, data.clientEmployer, { size: 7.0, valign: "middle" });
  drawCell(doc, rightLabelX, topY + 2 * rowH, label2W, rowH, "WIR/ ITR Submission\n(Date & Time)", { style: "bold", size: 6.4 });
  drawCell(doc, rightValueX, topY + 2 * rowH, value2W, rowH, data.submissionDateTime, { size: 6.4 });
  drawCell(doc, rightLabelX, topY + 3 * rowH, label2W, rowH, "Inspection\n(Date & Time)", { style: "bold", size: 6.4 });
  drawCell(doc, rightValueX, topY + 3 * rowH, value2W, rowH, data.inspectionDateTime, { size: 6.4 });

  drawTopRow(4, "PMC/Engineer", data.pmcEngineer, "WIR/ITR Submitted To:", data.submittedTo);
  drawTopRow(5, "Contractor", data.contractor, "WIR/ITR Submitted By:", data.submittedBy);
  drawTopRow(6, "Vendor Code", data.vendorCode, "WORK ORDER NO :", data.workOrderNo);
  drawCell(doc, leftX, topY + 7 * rowH, labelW, rowH, "Material code", { style: "bold", size: 7.4 });
  drawCell(doc, midX, topY + 7 * rowH, valueW, rowH, data.materialCode, { size: 7.4 });
  drawCell(doc, rightLabelX, topY + 7 * rowH, label2W + value2W, rowH, "", {});

  // Part A: title bar
  let cy = topY + 8 * rowH;
  drawCell(doc, x, cy, w, 6, "Part A: By the Contractor:", { fill: beige, style: "bold", size: 8.2, lineWidth: 0.6 });
  cy += 6;

  // Location + Discipline block
  drawCell(doc, x, cy, w, 5, "Location Reference for the Inspection :", { style: "bold", size: 7.4 });
  cy += 5;
  const locLeftW = 118;
  const discW = w - locLeftW;
  const locBlockH = 22;
  drawCell(doc, x, cy, locLeftW, locBlockH, "", {});
  drawCell(doc, x + locLeftW, cy, discW, locBlockH, "", {});

  // Location labels/values inside left area
  const locLabelW = 36;
  const locValW = locLeftW - locLabelW;
  const locRowH = locBlockH / 4;
  const drawLocRow = (idx, label, value) => {
    const ry = cy + idx * locRowH;
    drawCell(doc, x, ry, locLabelW, locRowH, label, { style: "bold", size: 7.0 });
    drawCell(doc, x + locLabelW, ry, locValW, locRowH, value, { size: 7.0 });
  };
  drawLocRow(0, "Tower / Block Ref:", data.location.towerBlock);
  drawLocRow(1, "Floor / Level :", data.location.floorLevel);
  drawLocRow(2, "Grid Reference :", data.location.gridReference);
  drawLocRow(3, "Room/Area Ref:", data.location.roomArea);

  // Discipline checkboxes inside right area (2 columns)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.text("Discipline:", x + locLeftW + 2, cy + 4.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  const discStartY = cy + 6.2;
  const discColX1 = x + locLeftW + 2;
  const discColX2 = x + locLeftW + 2 + discW / 2;
  const discRowStep = 3.15;
  DISCIPLINE_TEMPLATE_LABELS.forEach((label, idx) => {
    const isLeft = idx < 5;
    const colX = isLeft ? discColX1 : discColX2;
    const rowIdx = isLeft ? idx : idx - 5;
    const boxY = discStartY + rowIdx * discRowStep;
    drawCheck(doc, colX, boxY, data.disciplineSet.has(label));
    doc.text(label, colX + 5, boxY + 2.6);
  });

  cy += locBlockH;

  // Measurement qty update row
  drawCell(doc, x, cy, w, 5, "Measurement Qty update (Unit: Cum/Sqm/Nos) :", { style: "bold", size: 7.2 });
  cy += 5;
  const qtyCellW = w / 3;
  drawCell(doc, x, cy, qtyCellW, 5, `Previous Qty: ${asText(data.measurement.previousQty)}`, { size: 6.6 });
  drawCell(doc, x + qtyCellW, cy, qtyCellW, 5, `Current Qty: ${asText(data.measurement.currentQty)}`, { size: 6.6 });
  drawCell(doc, x + 2 * qtyCellW, cy, qtyCellW, 5, `Cumulative Qty: ${asText(data.measurement.cumulativeQty)}`, { size: 6.6 });
  cy += 5;

  // Selected sample items / description table
  const selectedWorkItems = Array.isArray(data.workItems) ? data.workItems : [];
  const tableRows = selectedWorkItems.length
    ? selectedWorkItems
    : asText(data.descriptionOfWorks)
      ? [{ itemDescription: data.descriptionOfWorks, boqCode: "", quantity: "", unit: "", prepared: false }]
      : [];

  drawCell(doc, x, cy, w, 5, "Description of works / activity for which inspection is requested for:", { style: "bold", size: 7.0 });
  cy += 5;
  drawCell(doc, x, cy, w, 5, "Selected sample items", { style: "bold", size: 6.8, align: "center" });
  cy += 5;

  const tableCols = [12, 24, 96, 18, 14, 26];
  const tableHeaders = ["Sr No", "BOQ Code", "Item Description", "Qty", "Unit", "Prepared"];
  let tableX = x;
  tableHeaders.forEach((header, index) => {
    drawCell(doc, tableX, cy, tableCols[index], 5, header, { style: "bold", size: 6.4, align: "center" });
    tableX += tableCols[index];
  });
  cy += 5;

  tableRows.forEach((row, index) => {
    const descLines = wrapLines(doc, row.itemDescription || row.descriptionOfWorks || row.name || "-", tableCols[2] - 3, 2);
    const rowH = Math.max(6, descLines.length * 3.2 + 1.6);
    const cells = [
      [tableCols[0], String(index + 1), { align: "center", size: 6.4 }],
      [tableCols[1], row.boqCode || "-", { size: 6.4 }],
      [tableCols[2], descLines.join("\n"), { size: 6.2, valign: "top" }],
      [tableCols[3], row.quantity || "-", { align: "center", size: 6.4 }],
      [tableCols[4], row.unit || "-", { align: "center", size: 6.4 }],
      [tableCols[5], "", { align: "center", size: 6.4 }],
    ];
    let cellX = x;
    cells.forEach(([cellW, cellText, cellOptions], cellIndex) => {
      drawCell(doc, cellX, cy, cellW, rowH, cellText, {
        ...cellOptions,
        valign: cellIndex === 2 ? "top" : "middle",
      });
      cellX += cellW;
    });
    const preparedCenterX = x + tableCols[0] + tableCols[1] + tableCols[2] + tableCols[3] + tableCols[4] + tableCols[5] / 2 - 1.6;
    const preparedCenterY = cy + rowH / 2 - 1.6;
    drawCheck(doc, preparedCenterX, preparedCenterY, Boolean(row.prepared));
    cy += rowH;
  });

  // ============================================================
  // FIX 1: Attachments — 2-column layout matching the reference PDF
  // Left column: Drawing attached, Test Certs, Drawing Ref No
  // Right column: Method Statement, Checklist, Joint Measurement
  // ============================================================
  const attBoxH = 16;
  drawCell(doc, x, cy, w, attBoxH, "", {});

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text("Attachments-", x + 2, cy + 4.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);

  // Column split: left half and right half
  const attHalfW = w / 2;
  const attLeftX = x;
  const attRightX = x + attHalfW;

  // Helper to draw a Yes/No/N/A row in a given column
  const drawAttRow = (label, value, colX, rowY) => {
    const normalized = asText(value).toUpperCase();
    const yes = normalized === "YES";
    const no = normalized === "NO";
    const na = normalized === "NA" || normalized === "N/A";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text(label, colX + 2, rowY);

    // Yes / No / N/A checkboxes near right side of that column
    const checkStartX = colX + attHalfW - 38;
    drawCheck(doc, checkStartX, rowY - 3.0, yes);
    doc.text("Yes", checkStartX + 4.6, rowY);
    drawCheck(doc, checkStartX + 14, rowY - 3.0, no);
    doc.text("No", checkStartX + 18.6, rowY);
    drawCheck(doc, checkStartX + 27, rowY - 3.0, na);
    doc.text("N/A", checkStartX + 31.6, rowY);
  };

  // Left column rows (starting after "Attachments-" label)
  const attRow1Y = cy + 6.9;
  const attRow2Y = cy + 10.0;

  // Left col row 1: Drawing attached
  drawAttRow("Drawing attached to show the location(s)", data.attachments.drawingAttached, attLeftX, attRow1Y);
  // Left col row 2: Test Certs
  drawAttRow("Attached Test Certificates / Reports", data.attachments.attachedTestCerts, attLeftX, attRow2Y);
  // Left col row 3: Specify Drawing Ref No (no checkboxes, just a line)
  const specY = cy + 13.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.text("Specifiy Drawing Ref No:", attLeftX + 2, specY);
  doc.setLineWidth(0.25);
  doc.line(attLeftX + 36, specY + 1.2, attLeftX + attHalfW - 2, specY + 1.2);
  doc.text(asText(data.attachments.specificDrawingRefNo, ""), attLeftX + 37, specY);

  // Right column rows
  drawAttRow("Method statement /ITP attd", data.attachments.methodStatementAttached, attRightX, attRow1Y);
  drawAttRow("Checklist Sheet attached", data.attachments.checklistAttached, attRightX, attRow2Y);
  drawAttRow("Joint Measurement Sheet attd", data.attachments.jointMeasurementAttached, attRightX, specY);

  cy += attBoxH;

  // ============================================================
  // Other sections sign-off table (now with all 3 rows including Interface Clearance)
  // ============================================================
  drawCell(doc, x, cy, w, 5, "Other Sections' Comments & Sign-off: ( Where ever applicable based on scope)", {
    style: "bold",
    size: 6.8,
    align: "center",
  });
  cy += 5;

  // Table header
  const cols = [32, 28, 18, 24, 24, 64];
  const headers = ["Section", "Name", "Date", "Designation", "Signature", "Comment's If Any"];
  let tx = x;
  headers.forEach((h, i) => {
    drawCell(doc, tx, cy, cols[i], 5, h, { style: "bold", size: 6.6, align: "center" });
    tx += cols[i];
  });
  cy += 5;

  // FIX 2: All 3 clearance rows — MEP, Surveyor, Interface
  const otherRows = [
    ["MEP Clearance", data.otherSections.mep?.name, data.otherSections.mep?.date, data.otherSections.mep?.designation, "", data.otherSections.mep?.comments],
    ["Surveyor Clearance", data.otherSections.surveyor?.name, data.otherSections.surveyor?.date, data.otherSections.surveyor?.designation, "", data.otherSections.surveyor?.comments],
    ["Interface Clearance", data.otherSections.interface?.name, data.otherSections.interface?.date, data.otherSections.interface?.designation, "", data.otherSections.interface?.comments],
  ];
  otherRows.forEach((r) => {
    let cx = x;
    r.forEach((cell, i) => {
      drawCell(doc, cx, cy, cols[i], 6, asText(cell), { size: 6.6, valign: "middle" });
      cx += cols[i];
    });
    cy += 6;
  });

  // ============================================================
  // FIX 3: Contractor Manager Comments + Ready For Inspection
  // These belong in Part A — BEFORE the Part B header
  // ============================================================

  // Contractor manager comments box
  const contractorCommentsLabelW = 68;
  const contractorCommentsH = 12;
  drawCell(doc, x, cy, contractorCommentsLabelW, contractorCommentsH, "Contractor Manager / Engineer Comments:", { style: "bold", size: 7.0, valign: "top" });
  drawCell(doc, x + contractorCommentsLabelW, cy, w - contractorCommentsLabelW, contractorCommentsH, asText(data.contractorManager.comments), { size: 6.7, valign: "top" });
  cy += contractorCommentsH;

  // Ready for inspection row (still Part A)
  const readyRowH = 6.5;
  drawCell(doc, x, cy, w, readyRowH, "", {});
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.9);
  doc.text("Contractor Manager/Engineer: Ready for", x + 2, cy + 3.1);
  doc.text("Lodha inspection and/or testing on:", x + 2, cy + 5.6);
  doc.setFont("helvetica", "normal");
  doc.text("Date:", x + 92, cy + 5.6);
  doc.text("Time:", x + 126, cy + 5.6);
  doc.text("Signed by:", x + 160, cy + 5.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.text(asText(data.contractorManager.readyDate), x + 102, cy + 5.6);
  doc.text(asText(data.contractorManager.readyTime), x + 136, cy + 5.6);
  doc.text(asText(data.contractorManager.signedBy), x + 175, cy + 5.6, { align: "right" });
  cy += readyRowH;

  // ============================================================
  // Part B — header comes AFTER the ready-for-inspection row
  // ============================================================
  const codeNum = codeToNumeric(data.lodhaPmc.resultCode);
  const templateRefY = y + frameH - 2.5;
  const codeBoxH = 18;
  const codeBoxY = templateRefY - 4 - codeBoxH;

  const partBHeaderH = 6;
  const partBCommentsH = 14;
  const signRowH = 7;
  const partBTotalH = partBHeaderH + partBCommentsH + signRowH * 4;
  const partBStartY = codeBoxY - 2 - partBTotalH;
  let partBActualY;

  if (cy > partBStartY) {
    doc.addPage();
    drawPageChrome();
    partBActualY = y + 18;
  } else {
    partBActualY = Math.max(cy, partBStartY);
  }

  // Part B header — positioned right after Part A's ready-for-inspection row

  drawCell(doc, x, partBActualY, w, partBHeaderH, "Part B: Lodha/PMC", {
    fill: beige,
    style: "bold",
    size: 8.0,
    lineWidth: 0.6,
  });

  // Comments box
  drawCell(doc, x, partBActualY + partBHeaderH, w, partBCommentsH, "Comments :", { style: "bold", size: 7.0, valign: "top" });
  drawCell(doc, x + 24, partBActualY + partBHeaderH, w - 24, partBCommentsH, asText(data.lodhaPmc.comments), { size: 6.7, valign: "top" });

  // Signoff rows
  const signRows = [
    ["Engineer/ Manager- CIVIL", data.lodhaPmc.signOffs.engineerCivil],
    ["Engineer/ Manager- MEP", data.lodhaPmc.signOffs.engineerMep],
    ["TOWER INCHARGE", data.lodhaPmc.signOffs.towerIncharge],
    ["QAA DEPARTMENT", data.lodhaPmc.signOffs.qaa],
  ];
  let signY = partBActualY + partBHeaderH + partBCommentsH;
  signRows.forEach(([role, sign]) => {
    drawCell(doc, x, signY, w, signRowH, "", {});
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text("Name:", x + 2, signY + 4.7);
    doc.text("Signature:", x + 62, signY + 4.7);
    doc.text("Date:", x + 126, signY + 4.7);
    doc.text(role, x + w - 2, signY + 4.7, { align: "right" });
    doc.text(asText(sign?.name), x + 14, signY + 4.7);
    doc.text(asText(sign?.signature), x + 80, signY + 4.7);
    doc.text(asText(sign?.date), x + 138, signY + 4.7);
    signY += signRowH;
  });

  // ============================================================
  // FIX 4: Code boxes — match the reference PDF style with
  // small checkbox corner and proper label layout
  // ============================================================
  const codeBoxW = w / 4;
  const codeDescriptions = [
    "Work may proceed",
    "Conditionally approved.\nWork may proceed and\nresubmit incorporating\ncomments indicated",
    "Revise & Resubmit. Work may not\nproceed.",
    "For information and records only.\nWork may proceed.",
  ];

  for (let i = 0; i < 4; i++) {
    const bx = x + i * codeBoxW;
    const isSelected = i + 1 === Number(codeNum);

    // Outer box
    doc.setLineWidth(0.25);
    doc.setDrawColor(0);
    doc.rect(bx, codeBoxY, codeBoxW, codeBoxH);

    // Small checkbox in top-left corner (matching "└Code N" style in reference)
    const cbSize = 3.0;
    doc.rect(bx + 2, codeBoxY + 2, cbSize, cbSize);
    if (isSelected) {
      // Fill checkbox if selected
      doc.setFillColor(0);
      doc.rect(bx + 2, codeBoxY + 2, cbSize, cbSize, "F");
    }

    // "Code N" label next to checkbox
    doc.setFont("helvetica", isSelected ? "bold" : "normal");
    doc.setFontSize(7.2);
    doc.text(`Code ${i + 1}`, bx + cbSize + 4, codeBoxY + 4.6);

    // Description text below
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    const descLines = doc.splitTextToSize(codeDescriptions[i], codeBoxW - 4);
    doc.text(descLines, bx + 2, codeBoxY + 8.0);
  }

  // FIX 5: Remove the floating "Code N" label that was overlapping QAA DEPARTMENT
  // (The selected code is now indicated by the filled checkbox inside the code box itself)

  // Footer template ref
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  doc.text("Template Ref: CO-LOD-GENE-QA-UCN-TMT-001, Rev- 02, Date: 08-02-2024", x + w / 2, templateRefY, { align: "center" });

  doc.save(fileName);
};
