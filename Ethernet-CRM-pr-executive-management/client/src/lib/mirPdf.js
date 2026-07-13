import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DISCIPLINE_OPTIONS,
  HIRANANDANI_APPROVAL_CODES,
  LODHA_RESULT_CODES,
  MIR_TEMPLATE_TYPES,
  getMirTemplatePayload,
  getMirTemplateType,
  normalizeHiranandaniMir,
  normalizeLodhaMir,
} from "@/pages/mirShared";

const asText = (value, fallback = "") => {
  const raw = value == null ? "" : String(value);
  const cleaned = raw.trim();
  return cleaned ? cleaned : fallback;
};

const safeName = (value, fallback = "MIR") =>
  asText(value, fallback).replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

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

const drawLineField = (doc, label, value, x, y, w, labelW = 44) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.text(label, x, y);
  const valueX = x + labelW;
  doc.line(valueX, y + 1.2, x + w, y + 1.2);
  doc.setFont("times", "normal");
  doc.text(asText(value), valueX + 1, y);
};

const drawInlineField = (doc, label, value, x, y, valueW) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.text(label, x, y);
  const valueX = x + doc.getTextWidth(label) + 2;
  doc.line(valueX, y + 3.2, valueX + valueW, y + 3.2);
  doc.setFont("times", "normal");
  doc.text(asText(value), valueX + 1, y);
};

const normalizeMirItems = (input) => {
  const rawItems =
    input?.items ??
    input?.materialRows ??
    input?.inventory_items ??
    input?.inventoryItems ??
    input?.deduction_items ??
    [];
  const list = Array.isArray(rawItems) ? rawItems : [];
  return list
    .filter((item) => item?.include_in_mir !== false && item?.print_in_mir !== false && item?.selected !== false && item?.checked !== false)
    .map((item, index) => {
      const qty = item?.qty ?? item?.quantity ?? item?.sample_total_qty ?? item?.total_qty ?? "";
      return {
        sr_no: item?.srno ?? item?.sr_no ?? item?.srNo ?? String(index + 1),
        item_code: item?.item_code ?? item?.itemCode ?? item?.code ?? item?.item_no ?? item?.itemNo ?? item?.hsn ?? "",
        description: item?.description ?? item?.material_description ?? item?.name ?? item?.item_name ?? item?.material ?? "",
        name: item?.name ?? "",
        uom: item?.UOM ?? item?.uom ?? item?.unit ?? item?.Unit ?? "",
        qty,
        hsn: item?.hsn ?? "",
        remark: item?.remark ?? "",
      };
    });
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
};

const addLodhaHeader = async (doc, data, pageNo) => {
  const x = 10;
  const y = 14;
  const w = 190;
  const beige = [198, 195, 160];
  const header = await loadImageDataUrl([
    "/mir-headers/lodha.png",
    "/mir-headers/lodha-mir-header.png",
    "/assets/lodha.png",
    "/assets/lodha-mir-header.png",
  ]);
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, 238);
  if (header) {
    doc.addImage(header, "PNG", x + 1, y + 1, w - 2, 18, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LODHA", x + 11, y + 12);
    doc.setFontSize(7);
    doc.text("BUILDING A BETTER LIFE", x + 11, y + 16);
  }
  drawCell(doc, x, y + 20, w, 8, "MATERIAL INSPECTION REQUEST - (MIR)", {
    fill: beige,
    style: "bold",
    size: 11,
    align: "center",
    lineWidth: 0.6,
  });
  drawCell(doc, x, y + 28, 27, 7, "Project Name", { style: "bold", size: 8.6 });
  drawCell(doc, x + 27, y + 28, 80, 7, data.projectName, { font: "times", size: 9 });
  drawCell(doc, x + 107, y + 28, 35, 7, "MIR Ref.No", { style: "bold", size: 8.6 });
  drawCell(doc, x + 142, y + 28, 48, 7, data.mirRefNo, { font: "times", size: 9 });
  drawCell(doc, x, y + 35, 27, 7, "Project Code", { style: "bold", size: 8.6 });
  drawCell(doc, x + 27, y + 35, 80, 7, data.projectCode, { font: "times", size: 9 });
  drawCell(doc, x + 107, y + 35, 35, 7, "Material Code", { style: "bold", size: 8.6 });
  drawCell(doc, x + 142, y + 35, 48, 7, data.materialCode, { font: "times", size: 9 });
  if (pageNo === 2) return y + 42;

  drawCell(doc, x, y + 42, 27, 12, "Client/Employer", { style: "bold", size: 8.2 });
  drawCell(doc, x + 27, y + 42, 80, 12, data.requestSubmission.clientEmployer, { font: "times", size: 8.8 });
  drawCell(doc, x + 107, y + 42, 35, 12, "Request submission\n(Date & Time)", { style: "bold", size: 8 });
  drawCell(doc, x + 142, y + 42, 48, 12, data.requestSubmission.clientSubmissionDateTime, { font: "times", size: 8.4 });
  drawCell(doc, x, y + 54, 27, 12, "PMC/LODHA\nEngineer", { style: "bold", size: 8.2 });
  drawCell(doc, x + 27, y + 54, 80, 12, data.requestSubmission.pmcEngineer, { font: "times", size: 8.8 });
  drawCell(doc, x + 107, y + 54, 35, 12, "Inspection\n(Date & Time)", { style: "bold", size: 8 });
  drawCell(doc, x + 142, y + 54, 48, 12, data.requestSubmission.inspectionDateTime, { font: "times", size: 8.4 });
  drawCell(doc, x, y + 66, 27, 8, "Contractor", { style: "bold", size: 8.6 });
  drawCell(doc, x + 27, y + 66, 80, 8, data.requestSubmission.contractor, { font: "times", size: 8.8 });
  drawCell(doc, x + 107, y + 66, 35, 8, "MIR Submitted To", { style: "bold", size: 8.1 });
  drawCell(doc, x + 142, y + 66, 48, 8, data.requestSubmission.submittedTo, { font: "times", size: 8.8 });
  drawCell(doc, x, y + 74, 27, 11, "Vendor Code", { style: "bold", size: 8.6 });
  drawCell(doc, x + 27, y + 74, 80, 11, data.requestSubmission.vendorCode, { font: "times", size: 8.8 });
  drawCell(doc, x + 107, y + 74, 35, 11, "Ref.Doc.Attached", { style: "bold", size: 8.1 });
  drawCell(doc, x + 142, y + 74, 48, 11, data.requestSubmission.refDocAttached, { font: "times", size: 8.4 });
  return y + 85;
};

const drawLodhaPdf = async (input, fileName) => {
  const data = normalizeLodhaMir(input);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const x = 10;
  const w = 190;
  const beige = [198, 195, 160];
  let y = await addLodhaHeader(doc, data, 1);

  DISCIPLINE_OPTIONS.forEach((item, index) => {
    const cx = x + 3 + index * 23.2;
    drawCheck(doc, cx, y + 2, data.requestSubmission.discipline.includes(item));
    doc.setFontSize(7.2);
    doc.text(item, cx + 5, y + 4.5);
  });
  y += 10;
  drawCell(doc, x, y, w, 7, "Part A: By the Contractor", { fill: beige, style: "bold", size: 9, lineWidth: 0.6 });
  y += 10;
  drawLineField(doc, "Material Submittal approved (Yes/NO). if Yes,Approval Reference No:", data.contractorPart.approvalRefNo, x + 1, y, w - 3, 101);
  y += 10;
  drawCell(doc, x, y, w, 7, "Description of Supplied Materials", { fill: beige, style: "bold", size: 8.8, lineWidth: 0.6 });
  y += 9;
  const itemRows = normalizeMirItems(data);
  autoTable(doc, {
    startY: y,
    margin: { left: x, right: x },
    tableWidth: w,
    theme: "grid",
    head: [["Sr. No.", "Item Code", "Description", "Name", "UOM", "Qty"]],
    body: (itemRows.length ? itemRows : [{ sr_no: "", item_code: "", description: "", name: "", uom: "", qty: "" }]).map((item) => [
      asText(item.sr_no, ""),
      asText(item.item_code, "-"),
      asText(item.description, "-"),
      asText(item.name, "-"),
      asText(item.uom, "-"),
      asText(item.qty, "-"),
    ]),
    styles: {
      font: "times",
      fontSize: 7.6,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      fontSize: 7.4,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 62 },
      3: { cellWidth: 46 },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 30, halign: "center" },
    },
  });
  y = doc.lastAutoTable.finalY + 5;
  doc.line(x, y, x + w, y);
  drawLineField(doc, "Previous Quantity:", data.contractorPart.previousQty, x + 1, y + 6, 62, 31);
  drawLineField(doc, "Current Qty:", data.contractorPart.currentQty, x + 78, y + 6, 50, 22);
  drawLineField(doc, "Cumulative Qty:", data.contractorPart.cumulativeQty, x + 130, y + 6, 57, 28);
  y += 13;
  drawLineField(doc, "BOQ Reference :", data.contractorPart.boqReference, x + 1, y, 176, 28);
  y += 8;
  drawLineField(doc, "Manufacturer - Country of Origin:", data.contractorPart.manufacturerCountry, x + 1, y, 176, 51);
  y += 8;
  drawLineField(doc, "Supplier :", data.contractorPart.supplier, x + 1, y, 176, 28);
  y += 8;
  drawLineField(doc, "Supplied Quantity and Delivery Note Number:", data.contractorPart.deliveryNoteNumber, x + 1, y, 176, 75);
  y += 8;
  drawLineField(doc, "Date of Receipt of Material On Site:", data.contractorPart.receiptDate, x + 1, y, 176, 62);
  y += 8;
  drawLineField(doc, "Storage Location:", data.contractorPart.storageLocation, x + 1, y, 176, 33);
  y += 14;
  drawLineField(doc, "Any material which requires test certificate shall be delivered along with the MTC:", data.contractorPart.testCertificateDelivered, x + 1, y, 176, 132);
  y += 8;
  drawLineField(doc, "Any material which requires field test is conducted and test results are complying with the acceptance criteria/values:", data.contractorPart.fieldTestComplianceNote, x + 1, y, 176, 151);
  y += 12;
  drawLineField(doc, "Any material which requires third party test, is it under contractor scope? (Yes/No)", data.contractorPart.thirdPartyTestContractorComplianceNote, x + 1, y, 176, 135);
  y += 12;
  drawLineField(doc, "Any material which requires third party test, is it under Lodha's scope? (Yes/No)", data.contractorPart.thirdPartyTestLodhaComplianceNote, x + 1, y, 176, 135);
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Contractor:", x + 1, y);
  y += 7;
  drawInlineField(doc, "Name:", data.contractorPart.contractorName, x + 1, y, 58);
  drawInlineField(doc, "Signature:", data.contractorPart.contractorSignature, x + 79, y, 42);
  drawInlineField(doc, "Date:", data.contractorPart.contractorDate, x + 132, y, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.text("P.T.O  Page1", x + 166, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Template Ref: ${data.templateRef}, Rev- ${data.templateRevision}, Date: ${data.templateDate}`, 105, 286, { align: "center" });

  doc.addPage();
  y = await addLodhaHeader(doc, data, 2);
  drawCell(doc, x, y, w, 7, "Part B: Lodha/PMC", { fill: beige, style: "bold", size: 9, lineWidth: 0.6 });
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Inspection Reports:", x + 1, y);
  y += 6;
  const reportRows = [
    ["Physical Damage?", "physicalDamage"],
    ["Details Given in Delivery Note Correct? (Type, Size, Wt., Qty. etc.)", "deliveryNoteCorrect"],
    ["Conform with Approved Material Submittal", "conformApprovedSubmittal"],
    ["Any material which requires test certificate shall be delivered along with the MTC:", "mtcDelivered"],
    ["Any material which requires field test is conducted and test results are complying with the acceptance criteria/values", "fieldTestCompliance"],
    ["Any material which requires third party test, is it under contractor scope? (Yes/No)", "thirdPartyContractorScope"],
    ["Any material which requires third party test, is it under Lodha's scope? (Yes/No)", "thirdPartyLodhaScope"],
  ];
  reportRows.forEach(([label, key]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    doc.text(doc.splitTextToSize(label, 118), x + 1, y);
    drawCheck(doc, x + 130, y - 3, data.lodhaPmc.inspectionReports[key] === "Yes");
    doc.text("Yes", x + 139, y);
    drawCheck(doc, x + 154, y - 3, data.lodhaPmc.inspectionReports[key] === "No");
    doc.text("No", x + 163, y);
    y += label.length > 78 ? 12 : 8;
  });
  y += 2;
  drawLineField(doc, "Civil & Finishing Materials - Project Manager Sign:", data.lodhaPmc.signOffs.civilProjectManager, x + 1, y, 85, 74);
  drawLineField(doc, "Landscape Materials - Landscape Architect Sign:", data.lodhaPmc.signOffs.landscapeArchitect, x + 100, y, 86, 72);
  y += 8;
  drawLineField(doc, "Project Quality Manager Sign:", data.lodhaPmc.signOffs.civilQualityManager, x + 1, y, 85, 47);
  y += 8;
  drawLineField(doc, "Facade Materials - Facade Manager Sign:", data.lodhaPmc.signOffs.facadeManager, x + 1, y, 85, 63);
  drawLineField(doc, "MEP Materials (MEP Manager) Sign:", data.lodhaPmc.signOffs.mepManager, x + 100, y, 86, 59);
  y += 8;
  drawCell(doc, x, y, w, 24, `Comments:\n${data.lodhaPmc.comments}`, { size: 8, valign: "top" });
  y += 32;
  drawCell(doc, x, y, w, 7, "Lodha/PMC", { fill: beige, style: "bold", size: 9, lineWidth: 0.6 });
  y += 10;
  doc.setFontSize(8.5);
  doc.text("The above materials have been inspected on site and found, at time of inspection, to be:", x + 1, y);
  y += 8;
  LODHA_RESULT_CODES.forEach((item) => {
    drawCheck(doc, x + 4, y - 3, data.lodhaPmc.resultCode === item.code);
    doc.setFont("helvetica", "bold");
    doc.text(item.code, x + 14, y);
    doc.setFont("helvetica", "italic");
    doc.text(doc.splitTextToSize(`- ${item.label}`, 150), x + 29, y);
    y += 8;
  });
  y += 8;
  drawInlineField(doc, "Name:", data.lodhaPmc.resultName, x + 7, y, 50);
  drawInlineField(doc, "Signature:", data.lodhaPmc.resultSignature, x + 78, y, 48);
  drawInlineField(doc, "Date:", data.lodhaPmc.resultDate, x + 148, y, 30);
  y += 15;
  doc.setFont("helvetica", "bolditalic");
  doc.text("Distribution:", x + 1, y);
  drawCheck(doc, x + 64, y - 3, data.lodhaPmc.distribution.lodha);
  doc.setFont("helvetica", "normal");
  doc.text("Lodha", x + 74, y);
  drawCheck(doc, x + 93, y - 3, data.lodhaPmc.distribution.contractor);
  doc.text("Contractor", x + 103, y);
  drawCheck(doc, x + 125, y - 3, Boolean(data.lodhaPmc.distribution.others));
  doc.text(`Others ${asText(data.lodhaPmc.distribution.others, "....................")} Page 2`, x + 135, y);
  doc.text(`Template Ref: ${data.templateRef}, Rev- ${data.templateRevision}, Date: ${data.templateDate}`, 105, 286, { align: "center" });
  doc.save(fileName || `${safeName(data.mirRefNo, "Lodha-MIR")}.pdf`);
};

const drawHiranandaniPdf = async (input, fileName) => {
  const data = normalizeHiranandaniMir(input);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const x = 8;
  const w = 194;
  const green = [146, 208, 0];
  const header = await loadImageDataUrl([
    "/mir-headers/hiranandani.png",
    "/mir-headers/hiranandani-mir-header.png",
    "/assets/hiranandani.png",
    "/assets/hiranandani-mir-header.png",
  ]);
  if (header) doc.addImage(header, "PNG", x, 5, w, 22, undefined, "FAST");
  else {
    doc.rect(x + 4, 5, 24, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 51, 153);
    doc.setFontSize(12);
    doc.text(data.companyTitle, 105, 18, { align: "center" });
    doc.setTextColor(0);
  }
  let y = 28;
  drawCell(doc, x, y, w / 2, 7, "CONTROL FORMS", { style: "bold", size: 8 });
  drawCell(doc, x + w / 2, y, w / 2, 7, data.controlForm, { style: "bold", size: 8 });
  y += 7;
  drawCell(doc, x, y, w / 2, 7, `Title : ${data.title}`, { style: "bold", size: 8 });
  drawCell(doc, x + w / 2, y, w / 2, 7, data.revision, { style: "bold", size: 8 });
  y += 7;
  drawCell(doc, x, y, w / 2, 8, `Project Name : ${data.projectName}`, { style: "bold", size: 8 });
  drawCell(doc, x + w / 2, y, w / 2, 8, `Location : ${data.location}`, { style: "bold", size: 8 });
  y += 8;
  drawCell(doc, x, y, w, 9, `Name of the Supplier : ${data.supplierName}`, { style: "bold", size: 8 });
  y += 9;
  drawCell(doc, x, y, w / 2, 9, `Material to be inspected : ${data.materialToInspect}`, { style: "bold", size: 8 });
  drawCell(doc, x + w / 2, y, w / 2, 9, `Location of Storage: ${data.storageLocation}`, { style: "bold", size: 8 });
  y += 9;
  drawCell(doc, x, y, w / 2, 8, `Date of Inspection : ${data.inspectionDate}`, { style: "bold", size: 8 });
  drawCell(doc, x + w / 2, y, w / 2, 8, `MIR No : ${data.mirNo}`, { style: "bold", size: 8 });
  y += 8;
  drawCell(doc, x, y, w, 13, `Attachments\n${data.attachments}`, { style: "bold", size: 8, valign: "top" });
  y += 13;
  drawCell(doc, x, y, w, 7, "NOTES / DETAILS", { fill: green, style: "bold", size: 8 });
  y += 7;
  const leftNotes = [
    ["Manufacturer:", data.notes.manufacturer],
    ["Manufacturer Date:", data.notes.manufacturerDate],
    ["Expiry Date:", data.notes.expiryDate],
    ["Batch No:", data.notes.batchNo],
    ["Source / Country of Origin:", data.notes.sourceCountry],
    ["Quantity Delivered:", data.notes.quantityDelivered],
  ];
  const rightNotes = [
    ["Purchase Order No.:", data.notes.purchaseOrderNo],
    ["Challan / Invoice Note No:", data.notes.challanInvoiceNo],
    ["Delivery Date:", data.notes.deliveryDate],
    ["Material Submittal Ref:", data.notes.materialSubmittalRef],
    ["Specification Ref:", data.notes.specificationRef],
    ["Drawings Ref:", data.notes.drawingsRef],
  ];
  leftNotes.forEach((row, index) => {
    drawCell(doc, x, y, w / 2, 8, `${row[0]} ${row[1]}`, { size: 8 });
    drawCell(doc, x + w / 2, y, w / 2, 8, `${rightNotes[index][0]} ${rightNotes[index][1]}`, { size: 8 });
    y += 8;
  });
  y += 12;
  const rows = data.materialRows.length
    ? data.materialRows
    : (() => {
        const fallbackItems = normalizeMirItems(input);
        return fallbackItems.length
          ? fallbackItems.map((item) => ({
              material: item.description || item.name || item.item_code || "",
              size: item.hsn || "",
              quantity: item.qty || "",
              unit: item.uom || "",
              name: item.name || "",
          }))
          : [{ material: "", size: "", quantity: "", unit: "" }];
      })();
  autoTable(doc, {
    startY: y,
    margin: { left: x, right: x },
    tableWidth: w,
    theme: "grid",
    body: rows.concat(Array.from({ length: Math.max(0, 6 - rows.length) }, () => ({}))).map((row) => [
      asText(row.name ? `${row.material}\nName: ${row.name}` : row.material),
      asText(row.size),
      asText(row.quantity),
      asText(row.unit),
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.25, minCellHeight: 8 },
    columnStyles: { 0: { cellWidth: 74 }, 1: { cellWidth: 24 }, 2: { cellWidth: 28 }, 3: { cellWidth: 20 } },
  });
  y = doc.lastAutoTable.finalY + 16;
  drawCell(doc, x, y, w, 14, "The Contractor hereby certifies that the materials delivered are in accordance with the drawings, specifications and local\nregulations and building standards", { size: 8, valign: "middle" });
  y += 14;
  drawCell(doc, x, y, 68, 18, "MIR Raised by:", { style: "bold", size: 8, valign: "top" });
  drawCell(doc, x + 68, y, 68, 18, data.mirRaisedByName || "Name of the Contractors representative", { size: 8, valign: "bottom" });
  drawCell(doc, x + 136, y, 58, 18, data.mirRaisedByDateSignature || "Date & Signature", { font: "times", style: "italic", size: 8, valign: "bottom" });
  y += 18;
  drawCell(doc, x, y, 68, 18, "Received by:", { style: "bold", size: 8, valign: "top" });
  drawCell(doc, x + 68, y, 68, 18, data.receivedByName || "Name of the Client representative", { size: 8, valign: "bottom" });
  drawCell(doc, x + 136, y, 58, 18, data.receivedByDateSignature || "Date & Signature", { font: "times", style: "italic", size: 8, valign: "bottom" });
  y += 18;
  drawCell(doc, x, y, 136, 7, "Inspection Engineers comments", { fill: green, style: "bold", size: 8 });
  drawCell(doc, x + 136, y, 58, 7, "Approvals", { fill: green, style: "bold", size: 8 });
  y += 7;
  drawCell(doc, x, y, 136, 42, data.inspectionEngineerComments, { size: 8, valign: "top" });
  HIRANANDANI_APPROVAL_CODES.forEach((item, index) => {
    drawCell(doc, x + 136, y + index * 10.5, 58, 10.5, `${item.code} - ${item.label}`, { size: 8 });
  });

  doc.addPage();
  y = 12;
  drawCell(doc, x, y, 136, 20, "Checked by (Client Represenatative) :", { style: "bold", size: 8, valign: "top" });
  drawCell(doc, x + 136, y, 58, 20, data.checkedByDateSignature || "Date & Signature", { size: 8, valign: "bottom" });
  y += 20;
  drawCell(doc, x, y, w, 14, "Inspection / Approval of the works does not relieve the contactor of his obligation in completing the works in accordance\nwith contract documents, drawings and any other local regulations and standards", { size: 7.5 });
  y += 14;
  drawCell(doc, x, y, 68, 18, "Issued by:", { style: "bold", size: 8, valign: "top" });
  drawCell(doc, x + 68, y, 68, 18, data.issuedByName || "Name of the contractors representative", { size: 8, valign: "bottom" });
  drawCell(doc, x + 136, y, 58, 18, data.issuedByDateSignature || "Date & Signature", { size: 8, valign: "bottom" });
  y += 18;
  drawCell(doc, x, y, 68, 18, "Received by:", { style: "bold", size: 8, valign: "top" });
  drawCell(doc, x + 68, y, 68, 18, data.receivedByName || "Name of the Client representative", { size: 8, valign: "bottom" });
  drawCell(doc, x + 136, y, 58, 18, data.receivedByDateSignature || "Date & Signature", { size: 8, valign: "bottom" });
  y += 18;
  drawCell(doc, x, y, w, 7, "Follow Up / close-Out report", { fill: green, style: "bold", size: 8 });
  y += 7;
  drawCell(doc, x, y, 136, 10, `Action Taken:\n${data.closeOut.actionTaken}`, { style: "bold", size: 8, valign: "top" });
  drawCell(doc, x + 136, y, 58, 10, `Checked by:\n${data.closeOut.checkedBy}`, { style: "bold", size: 8, valign: "top" });
  y += 10;
  drawCell(doc, x, y, 68, 14, "Completed", { style: data.closeOut.status === "Completed" ? "bold" : "normal", size: 8, valign: "top" });
  drawCell(doc, x + 68, y, 68, 14, "Ongoing", { style: data.closeOut.status === "Ongoing" ? "bold" : "normal", size: 8, valign: "top" });
  drawCell(doc, x + 136, y, 58, 14, data.closeOut.dateSignature || "Date & Signature", { size: 8, valign: "bottom" });
  doc.save(fileName || `${safeName(data.mirNo, "Hiranandani-MIR")}.pdf`);
};

export const downloadMirPdf = async (mirOrTemplateData, options = {}) => {
  const templateType = options.templateType || getMirTemplateType(mirOrTemplateData);
  const templatePayload = options.templatePayload || getMirTemplatePayload(mirOrTemplateData);
  const mergedPayload = {
    ...(templatePayload || {}),
    ...(mirOrTemplateData || {}),
  };
  if (templateType === MIR_TEMPLATE_TYPES.HIRANANDANI) {
    return drawHiranandaniPdf(mergedPayload, options.fileName);
  }
  return drawLodhaPdf(mergedPayload, options.fileName);
};

export const buildLodhaPayloadFromMir = (form, lodha) => {
  const normalized = normalizeLodhaMir(lodha);
  return {
    ...normalized,
    projectName: form.project_name,
    projectCode: form.project_code,
    mirRefNo: form.mir_refrence_no,
    materialCode: form.material_code,
    requestSubmission: {
      ...normalized.requestSubmission,
      clientEmployer: form.client_name,
      pmcEngineer: form.pmc,
      contractor: form.contractor,
      vendorCode: form.vendor_code,
      clientSubmissionDateTime: form.client_submission_date,
      inspectionDateTime: form.inspection_date_time,
      refDocAttached: form.add_attachment,
    },
    items: Array.isArray(form.items) ? form.items : normalized.items || [],
  };
};

export const buildHiranandaniPayloadFromMir = (form, hiranandani) => {
  const normalized = normalizeHiranandaniMir(hiranandani);
  const items = Array.isArray(form.items) ? form.items : normalized.items || [];
  return {
    ...normalized,
    projectName: form.project_name,
    supplierName: form.contractor,
    inspectionDate: form.inspection_date_time,
    mirNo: form.mir_refrence_no,
    storageLocation: normalized.storageLocation,
    items,
    materialRows: Array.isArray(normalized.materialRows) && normalized.materialRows.length > 0
      ? normalized.materialRows
      : items.map((item) => ({
          material: item?.description || item?.name || item?.item_code || "",
          size: item?.hsn || "",
          quantity: item?.qty || item?.quantity || "",
          unit: item?.UOM || item?.uom || item?.unit || "",
          name: item?.name || "",
        })),
    notes: {
      ...normalized.notes,
      purchaseOrderNo: normalized.notes.purchaseOrderNo || form.po_id,
      challanInvoiceNo: normalized.notes.challanInvoiceNo || form.challan_no,
    },
  };
};
