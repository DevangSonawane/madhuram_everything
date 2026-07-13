import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, FileText, Loader2, Save } from "lucide-react";
import ProjectSpreadsheet from "@/components/ProjectSpreadsheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProject } from "@/contexts/useProject";
import { api } from "@/lib/api";
import { lodhaApiToFormData, lodhaFormToApiPayload } from "@/lib/invoiceTransforms";
import { useToast } from "@/hooks/use-toast";
import { downloadInvoicePdf } from "@/pages/createHtmlInvoice";
import { withCommonCompanyHeader } from "@/lib/companyDefaults";
import { getMirTemplatePayload, getMirTemplateType } from "@/pages/mirShared";

const toRows = (value, labelKey = "field", valueKey = "value") => {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([key, rowValue]) => ({
    [labelKey]: key,
    [valueKey]:
      rowValue && typeof rowValue === "object"
        ? JSON.stringify(rowValue)
        : rowValue ?? "",
  }));
};

const blankChecklistRow = () => Array(18).fill("");

const buildChecklistSheetMatrix = ({ header, billingShipping, projectWork, billId }) => {
  const projectName =
    billingShipping?.receiver_name ||
    projectWork?.plant_name ||
    billingShipping?.buyer_name ||
    "";
  const workOrderNo = projectWork?.work_order_number || "";
  const raBillNo = projectWork?.bill_no || (billId ? `RA ${billId}` : "");
  const contractorName = header?.company_name || "MADHURAM ENTERPRISES";
  const workType = header?.work_description || "PLUMBING WORKS";

  return [
    ["Invoice Processing Check-List -Construction Services", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    [`Name of Project : ${projectName}`, "", "Tracker No", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Vendor Code :", "", "Work Order No", "", "", "", "", workOrderNo, "", "", "", "", "", "", "", "", "", ""],
    [`Name of Contractor : ${contractorName}`, "", "RA Bill No", "", "", "", "", raBillNo, "", "", "", "", "", "", "", "", "", ""],
    [`Package  of work order  : Infra    / Civil   / Façade   /Finishing  / Services     / Others - ${workType}`, "", "Type of Wo ", "", "", "", "", "", "", "FML      /     FLO", "", "", "", "", "", "", "", ""],
    ["", "", "Site", "", "", "", "", "", "", "", "Account", "", "", "", "", "", "", ""],
    ["Sr .No", "Checklist", "", "Yes", "", "No", "", "N/A", "", "Remark", "", "Yes", "", "No", "", "N/A", "", "Remark"],
    blankChecklistRow(),
    ["A", "Documents to be submitted", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["1", "Mandatory documents for other than Final RA Bill", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["a", "SES copy duly signed by commercial manager & project in charge.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["b", "Tax invoice in case of gst register vendor/bill of supply for other vendors", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["c", "Cumulative abstract sheet approved by commercial manager", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["d", "Measurement sheet approved by both vendor and site in-charge", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["e", "PF challan  for last month approved by HRMS/PF consultant in every RA invoice", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["f", "ESIC challan/WCP  for Last month  approved by HRMS/PF consultant.in every RA invoice", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["g", "Approved material reconciliation statement in every 3rd Ra invoice (i.e. RA-3, RA-6 and Subsequent) for Lodha supplied material", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["i", "Non confirmation report ( NCR) Log in every 3rd RA Invoice (i.e. RA-03, RA-06 and Subsequent RA Bills)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["j", "Statement of basic rate variation attached in every 3rd Ra Invoice (i.e. RA-03, RA-06 and subsequent for vendor supplied material ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["k", "BG Expired Date", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["2", "Additional manadatory document required for site work order", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["a", "Supply of water and hiring of machinery work-original challan (having in and out time) stamped by security and site approval available. In case of site wo.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["b", " Attendance sheet/labour supply challan in case of manpower supply.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["3", "Additional mandatory document for Final RA bill", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["a", "No due certificate  (other than site work orders)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["b", "Work completion certificate (other than site work orders)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["c", "Statement of hold against particular WO and action to be taken there of .", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["4", "Optional documents", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["a", "Material inspection test report (MITR) supported by Delivery Challan", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["b", "Installation test report (ITR) certified by engineer", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["B", "Points to be checked while certifying Invoice", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["1", "Check vendor GST No in invoice match with  GST No on SES ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["2", "Check our company GSTN in invoice match with GST No on SES ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["3", "First 4 digit of HSN/ SAC as per Invoice match with WO", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["4", "Check Invoice rate, BOQ description and tax rate match with SES ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["5", " Check GL code maintained in work order as per nature of work", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["6", " Check  Tax % maintained in  work order with invoice  ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["7", "Check retention %  assigned in the work order as per terms and conditions and in case of exemption submitted BG against cash Retention", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["8", "Check whether debit note and credit note against the bill is posted in sap", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["9", " Work order closure tick done by site team in case of final RA bill", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["10", "Adjust the open advances (In case of material advance, it should not be open for  > 6 Months for façade contract &  > 3 months for others)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["11", "Debit note to be adjusted against same project / if adjusted against other project after  intimating  to site ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["12", "DCO approval received in case contract value > Rs 1 cr in case of final RA bill", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    ["", "Signature:-", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "                 Billing Eng.                                                                   Commercial Manager                                                     ", "", "Bill Processor", "", "", "", "", "", "", "Bill Approved", "", "", "", "", "", "", ""],
    blankChecklistRow(),
    blankChecklistRow(),
    blankChecklistRow(),
    ["Name", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Date", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ];
};

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

const toSpreadsheetColumn = (index) => {
  let n = Number(index) + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

const hasOwnFilledValue = (obj, key) => {
  if (!obj || typeof obj !== "object" || !(key in obj)) return false;
  const value = obj[key];
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const resolveCummBoqPhaseValues = (item, phaseKey, woQty) => {
  const prevKey = `prev_${phaseKey}_qty`;
  const currKey = `curr_${phaseKey}_qty`;
  const hasPrev = hasOwnFilledValue(item, prevKey);
  const hasCurr = hasOwnFilledValue(item, currKey);

  const prevDone = hasPrev ? toNumber(item?.[prevKey]) : woQty;
  const currDone = hasCurr ? toNumber(item?.[currKey]) : 0;

  return {
    prevDone,
    currDone,
    cummDone: prevDone + currDone,
  };
};

const buildCummBoqSheetMatrix = ({ header, billingShipping, projectWork, raw }) => {
  const boqItems = Array.isArray(raw?.boq_items)
    ? raw.boq_items
    : Array.isArray(raw?.invoice?.boq_items)
      ? raw.invoice.boq_items
      : Array.isArray(raw?.data?.boq_items)
        ? raw.data.boq_items
        : [];

  const phaseRows = [];
  const sectionNamesSeen = new Set();
  let sheetRowNumber = 9;

  boqItems.forEach((item, index) => {
    const itemNo = item?.item_no || item?.itemNo || item?.sr_no || item?.srNo || index + 1;
    const description = item?.description || "-";
    const section = String(item?.section || "").trim();
    const woQty = toNumber(item?.wo_qty);
    const uom = item?.uom || "";
    const rate = toNumber(item?.rate);

    if (section && !sectionNamesSeen.has(section)) {
      sectionNamesSeen.add(section);
      phaseRows.push(["", section, "", "", "", "", "", "", "", "", "", "", "", ""]);
      sheetRowNumber += 1;
    }

    phaseRows.push([String(itemNo), description, woQty || "", "", "", "", "", "", "", uom, rate || "", "", "", ""]);
    sheetRowNumber += 1;

    const phases = [
      ["Supply @ 60 %", "supply", 0.6],
      ["Installation @ 25 %", "install", 0.25],
      ["Testing & Commissioning  @ 10 %", "tc", 0.1],
      ["Handover @ 5  % ", "handover", 0.05],
    ];

    phases.forEach(([label, key, weight]) => {
      const { prevDone, currDone, cummDone } = resolveCummBoqPhaseValues(item, key, woQty);
      const prevBoq = prevDone * weight;
      const currBoq = currDone * weight;
      const cummBoq = cummDone * weight;
      const prevAmt = prevBoq * rate;
      const currAmt = currBoq * rate;
      const cummAmt = cummBoq * rate;
      const previousQtyRef = `${toSpreadsheetColumn(3)}${sheetRowNumber}`;
      const currentQtyRef = `${toSpreadsheetColumn(4)}${sheetRowNumber}`;

      phaseRows.push([
        "",
        label,
        "",
        prevDone || "",
        currDone || "",
        { __formula: `SUM(${previousQtyRef},${currentQtyRef})`, __value: cummDone },
        prevBoq || 0,
        currBoq || 0,
        cummBoq || 0,
        "",
        "",
        prevAmt || 0,
        currAmt || 0,
        cummAmt || 0,
      ]);
      sheetRowNumber += 1;
    });

    phaseRows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    sheetRowNumber += 1;
  });

  return [
    ["Annexure: Cumulative Work Performed", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Company Name & Address", "", header?.invoice_number || "", "", "", "", "", "", "Site Address:", "", "", "", "", ""],
    [header?.company_name || "MADHURAM ENTERPRISES", "", "", "", "", "", "", "", projectWork?.plant_name || billingShipping?.place_of_supply || "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    [`Work Order No. ${projectWork?.work_order_number || ""}`, "", "", "", "", "", "", "", "Work Order Value (Rs.)", "", "", raw?.work_order_value || raw?.invoice?.work_order_value || "", "", ""],
    [`Project & Building Name ${billingShipping?.place_of_supply || projectWork?.plant_name || ""}`, "", "", "", "", "", "", "", "Work Order Date", "", "", projectWork?.work_order_date || "", "", ""],
    ["Sr. No.", "Description of Work", "Current WO Qty", "WORK DONE  QTY.", "", "", "Bill of Quantity (BOQ)", "", "", "U.O.M.", "Rate / U.O.M.", "Amount in Rs.", "", ""],
    ["", "", "", "Previous", "Current", "Cumulative", "Previous", "Current", "Cumulative", "", "", "Previous", "Current", "Cumulative"],
    ...phaseRows,
  ];
};

const buildChallanSummarySheetMatrix = ({ header, billingShipping, projectWork, raw, billId, projectMirRows = [] }) => {
  const boqItems = Array.isArray(raw?.boq_items) ? raw.boq_items : [];
  const lodhaMirs = (Array.isArray(projectMirRows) ? projectMirRows : [])
    .filter((row) => getMirTemplateType(row) === "lodha")
    .map((row) => ({
      raw: row,
      payload: getMirTemplatePayload(row),
    }))
    .slice(0, 4);
  const rows = [];
  const sectionNamesSeen = new Set();
  const raBillLabel = projectWork?.bill_no || (billId ? `RA ${billId}` : "");
  const projectName = projectWork?.plant_name || billingShipping?.place_of_supply || "";
  const workTitle = String(header?.work_description || "PLUMBING WORKS").trim();
  const summaryRaLabel = raBillLabel || "RA 1";
  const raSequenceMatch = String(summaryRaLabel).match(/(\d+)/);
  const raSequence = raSequenceMatch ? raSequenceMatch[1] : "1";
  const mirNoValues = Array.from({ length: 4 }, (_, index) => {
    const entry = lodhaMirs[index];
    return entry?.payload?.mirRefNo || entry?.raw?.mir_refrence_no || "";
  });
  const challanValues = Array.from({ length: 4 }, (_, index) => {
    const entry = lodhaMirs[index];
    return (
      entry?.payload?.contractorPart?.deliveryNoteNumber ||
      entry?.raw?.challan_no ||
      entry?.raw?.delivery_note_no ||
      ""
    );
  });

  const matchMirQtyForBoqItem = (mirEntry, boqItem) => {
    if (!mirEntry || !boqItem) return "";
    const contractorPart = mirEntry.payload?.contractorPart || {};
    const boqRef = normalizeBoqIdentity(contractorPart?.boqReference);
    const mirDesc = normalizeBoqIdentity(contractorPart?.description);
    const itemNo = normalizeBoqIdentity(boqItem?.item_no || boqItem?.itemNo || boqItem?.sr_no || boqItem?.srNo);
    const itemDesc = normalizeBoqIdentity(boqItem?.description);

    const boqMatched =
      (boqRef && itemNo && boqRef.includes(itemNo)) ||
      (boqRef && itemDesc && boqRef.includes(itemDesc)) ||
      (mirDesc && itemDesc && (mirDesc.includes(itemDesc) || itemDesc.includes(mirDesc)));

    if (!boqMatched) return "";
    return toNumber(contractorPart?.currentQty);
  };

  rows.push([
    "",
    `SITC OF ${workTitle}`.trim(),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    raSequence,
    "",
    raSequence,
    raSequence,
    "WO - CUMM",
  ]);

  let sheetRowNumber = 10;

  boqItems.forEach((item, index) => {
    const section = String(item?.section || "").trim();
    const itemNo = item?.item_no || item?.itemNo || item?.sr_no || item?.srNo || index + 1;
    const description = item?.description || "-";
    const woQty = toNumber(item?.wo_qty);
    const uom = item?.uom || "";

    if (section && !sectionNamesSeen.has(section)) {
      sectionNamesSeen.add(section);
      rows.push(["", section, "", "", "", "", "", "", "", "", "", "", "", ""]);
      sheetRowNumber += 1;
    }

    const mirQuantities = lodhaMirs.map((entry) => matchMirQtyForBoqItem(entry, item));
    while (mirQuantities.length < 4) mirQuantities.push("");
    const eRef = `${toSpreadsheetColumn(4)}${sheetRowNumber}`;
    const fRef = `${toSpreadsheetColumn(5)}${sheetRowNumber}`;
    const gRef = `${toSpreadsheetColumn(6)}${sheetRowNumber}`;
    const hRef = `${toSpreadsheetColumn(7)}${sheetRowNumber}`;
    const iRef = `${toSpreadsheetColumn(8)}${sheetRowNumber}`;
    const cRef = `${toSpreadsheetColumn(2)}${sheetRowNumber}`;
    const jRef = `${toSpreadsheetColumn(9)}${sheetRowNumber}`;
    const mRef = `${toSpreadsheetColumn(12)}${sheetRowNumber}`;
    const totalQty = mirQuantities.slice(0, 4).reduce((sum, value) => sum + toNumber(value), 0);

    rows.push([
      String(itemNo),
      description,
      woQty || "",
      uom,
      mirQuantities[0] || "",
      mirQuantities[1] || "",
      mirQuantities[2] || "",
      mirQuantities[3] || "",
      "",
      { __formula: `${eRef}+${fRef}+${gRef}+${hRef}`, __value: totalQty },
      "",
      { __formula: `${jRef}`, __value: totalQty },
      { __formula: `${eRef}+${fRef}+${gRef}+${hRef}+${iRef}`, __value: totalQty },
      { __formula: `${cRef}-${mRef}`, __value: woQty - totalQty },
    ]);
    sheetRowNumber += 1;
  });

  return [
    [header?.company_name || "MADHURAM ENTERPRISES", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    [`WORK ORDER NO. ${projectWork?.work_order_number || ""}`, "", "", "", "", "", "", "", "", "", "", "", "", ""],
    [`Site : ${projectName}`, "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["MIR SUMMARY SHEET", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "RA Bill Number", "", "", raBillLabel, "", "", "", "", "", "SUMMARY", "", "", ""],
    ["SR .NO", "Description of Work", "W.O. QTY", "MIR NO.", mirNoValues[0], mirNoValues[1], mirNoValues[2], mirNoValues[3], "", "TOTAL", "", "", "", ""],
    ["", "", "", "CHALLAN NO.", challanValues[0], challanValues[1], challanValues[2], challanValues[3], "AMEND", "RA 1", "PREVIOUS CLAIMED", "THIS BILL QTY.", "CUMM QTY", "Balance Qty"],
    ...rows,
  ];
};

const buildItrSummarySheetMatrix = ({ header, billingShipping, projectWork, raw, billId, projectItrRows = [] }) => {
  const boqItems = Array.isArray(raw?.boq_items) ? raw.boq_items : [];
  const rows = [];
  const sectionNamesSeen = new Set();
  const raBillLabel = projectWork?.bill_no || (billId ? `RA ${billId}` : "");
  const projectName = projectWork?.plant_name || billingShipping?.place_of_supply || "";
  const workTitle = String(header?.work_description || "PLUMBING WORKS").trim();

  const linkedIds = new Set(
    (Array.isArray(raw?.linked_itr_ids) ? raw.linked_itr_ids : []).map((id) => String(id))
  );
  const safeItrRows = Array.isArray(projectItrRows) ? projectItrRows : [];
  const preferredItr =
    safeItrRows.find((itr) => linkedIds.has(String(itr?.itr_id ?? itr?.id ?? itr?._id ?? itr?.itrId))) ||
    safeItrRows[0] ||
    null;
  const itrLabel =
    preferredItr?.itr_ref_no ||
    preferredItr?.itrRefNo ||
    preferredItr?.itr_refrence_no ||
    preferredItr?.reference_no ||
    "";

  rows.push(["", `SITC OF ${workTitle}`.trim(), "", "", "", "", "", "", "", ""]);

  boqItems.forEach((item, index) => {
    const section = String(item?.section || "").trim();
    const itemNo = item?.item_no || item?.itemNo || item?.sr_no || item?.srNo || index + 1;
    const description = item?.description || "-";
    const woQty = toNumber(item?.wo_qty);
    const uom = item?.uom || "";

    if (section && !sectionNamesSeen.has(section)) {
      sectionNamesSeen.add(section);
      rows.push(["", section, "", "", "", "", "", "", "", ""]);
    }

    rows.push([
      String(itemNo),
      description,
      woQty || "",
      uom,
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  return [
    [header?.company_name || "MADHURAM ENTERPRISES", "", "", "", "", "", "", "", "", ""],
    [`WORK ORDER NO. ${projectWork?.work_order_number || ""}`, "", "", "", "", "", "", "", "", ""],
    [`Site : ${projectName}`, "", "", "", "", "", "", "", "", ""],
    ["ITR SUMMARY SHEET", "", "", "", "", "", "", "", "", ""],
    ["", "RA Bill Number", "", "", "", "", "", "SUMMARY", "", ""],
    ["SR .NO", "Description of Work", "W.O. QTY", "ITR NO.", itrLabel, "AMEND", "TOTAL", "", "", ""],
    ["", "", "", "", "", "", "", "PREVIOUS CLAIMED", "THIS BILL QTY.", "Balance Qty"],
    ...rows,
  ];
};

const buildAmendSheetMatrix = ({ header, billingShipping, projectWork, raw }) => {
  const boqItems = Array.isArray(raw?.boq_items) ? raw.boq_items : [];
  const rows = [];
  const sectionNamesSeen = new Set();
  const projectName = projectWork?.plant_name || billingShipping?.place_of_supply || "";
  let sheetRowNumber = 6;

  boqItems.forEach((item, index) => {
    const section = String(item?.section || "").trim();
    const itemNo = item?.item_no || item?.itemNo || item?.sr_no || item?.srNo || index + 1;
    const description = item?.description || "-";
    const woQty = toNumber(item?.wo_qty);
    const uom = item?.uom || "";
    const rate = toNumber(item?.rate);
    const amount = toNumber(item?.amount) || woQty * rate;

    if (section && !sectionNamesSeen.has(section)) {
      sectionNamesSeen.add(section);
      rows.push(["", section, "", "", "", ""]);
      sheetRowNumber += 1;
    }

    const woQtyRef = `${toSpreadsheetColumn(2)}${sheetRowNumber}`;
    const rateRef = `${toSpreadsheetColumn(4)}${sheetRowNumber}`;

    rows.push([
      String(itemNo),
      description,
      woQty || "",
      uom,
      rate || "",
      { __formula: `${woQtyRef}*${rateRef}`, __value: amount || 0 },
    ]);
    sheetRowNumber += 1;
  });

  return [
    [header?.company_name || "MADHURAM ENTERPRISES", "", "", "", "", ""],
    [`WORK ORDER NO. ${projectWork?.work_order_number || ""}`, "", "", "", "", ""],
    [`Site : ${projectName}`, "", "", "", "", ""],
    ["AMEND SHEET", "", "", "", "", ""],
    ["Sr. No.", "Description of Work", "Current WO Qty", "U.O.M.", "Rate / U.O.M.", "AMOUNT"],
    ...rows,
  ];
};

const buildIllegalImmigrantSheetMatrix = ({ header, billingShipping, projectWork }) => {
  const companyName = header?.company_name || "Madhuram Enterprises ";
  const companyAddress =
    header?.company_address ||
    "SHOP NO - S/2, FLOOR NO 2,X TH CENTRAL MAL, MAHAVIR NAGAR, KANDIVALIWEST. MUMBAI -400 067.";
  const companyContact =
    (header?.company_phone || header?.company_email)
      ? `${header?.company_phone ? `Cell no. ${header.company_phone}` : ""}${header?.company_phone && header?.company_email ? ", " : ""}${header?.company_email ? `Email Id ${header.company_email}` : ""}`
      : "Cell no. +919819408257, Email Id manish.plumbing@gmail.com";
  const companyWebsite = header?.company_website ? `Website: ${header.company_website}` : "Website: www.madhuramrealtors.com";
  const projectName = billingShipping?.place_of_supply || projectWork?.plant_name || "the Project";
  const workOrderNo = projectWork?.work_order_number || "";
  const workOrderDate = projectWork?.work_order_date || "";

  return [
    ["", "", "", "", "", "", "", "", ""],
    [companyName, "", "", "", "", "", "", "", ""],
    [companyAddress, "", "", "", "", "", "", "", ""],
    [companyContact, "", "", "", "", "", "", "", ""],
    [companyWebsite, "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "TO WHOM IT MAY CONCERN", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    [
      "",
      `“We hereby certify that since ${workOrderDate || "the work order date"} none of the Workers/Staff/Personal engaged or employed by us in respect of ${projectName} under work order No. ${workOrderNo || "-"}${workOrderDate ? ` Dated ${workOrderDate}` : ""} is an illegal immigrant.”`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "Signature", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
  ];
};

const normalizeProjectBoqItems = (boqItems) => {
  return (Array.isArray(boqItems) ? boqItems : []).map((row, index) => ({
    item_no: row?.item_no ?? row?.item_code ?? String(index + 1),
    section: row?.section ?? row?.category ?? "",
    description: row?.description ?? "",
    uom: row?.unit ?? row?.uom ?? "",
    wo_qty: toNumber(row?.qty ?? row?.quantity ?? row?.order_qty ?? 0),
    rate: toNumber(row?.rate ?? row?.unit_rate ?? row?.unit_price ?? row?.unitPrice ?? row?.price ?? 0),
  }));
};

const normalizeSavedBoqItems = (boqItems) => {
  return (Array.isArray(boqItems) ? boqItems : []).map((row, index) => ({
    item_no: row?.item_no ?? row?.itemNo ?? row?.item_code ?? String(index + 1),
    section: row?.section ?? row?.category ?? "",
    description: row?.description ?? "",
    uom: row?.unit ?? row?.uom ?? "",
    wo_qty: toNumber(row?.wo_qty ?? row?.qty ?? row?.quantity ?? row?.order_qty ?? 0),
    rate: toNumber(row?.rate ?? row?.unit_rate ?? row?.unit_price ?? row?.unitPrice ?? row?.price ?? 0),
    prev_supply_qty: row?.prev_supply_qty,
    curr_supply_qty: row?.curr_supply_qty,
    prev_install_qty: row?.prev_install_qty,
    curr_install_qty: row?.curr_install_qty,
    prev_tc_qty: row?.prev_tc_qty,
    curr_tc_qty: row?.curr_tc_qty,
    prev_handover_qty: row?.prev_handover_qty,
    curr_handover_qty: row?.curr_handover_qty,
  }));
};

const normalizeBoqIdentity = (value) => String(value ?? "").trim().toLowerCase();

const PHASE_WEIGHTS = { supply: 0.6, install: 0.25, tc: 0.1, handover: 0.05 };
const CGST_RATE = 0.09;
const SGST_RATE = 0.09;

const buildPreferredBoqItems = (raw, projectBoqItems) => {
  const projectItems = Array.isArray(projectBoqItems) ? projectBoqItems : [];
  const savedItems = normalizeSavedBoqItems(
    Array.isArray(raw?.boq_items)
      ? raw.boq_items
      : Array.isArray(raw?.invoice?.boq_items)
        ? raw.invoice.boq_items
        : Array.isArray(raw?.data?.boq_items)
          ? raw.data.boq_items
          : []
  );

  if (projectItems.length === 0) return savedItems;
  if (savedItems.length === 0) return projectItems;

  const savedByIdentity = new Map();
  savedItems.forEach((item, index) => {
    const itemNoKey = normalizeBoqIdentity(item?.item_no);
    const descKey = normalizeBoqIdentity(item?.description);
    if (itemNoKey) savedByIdentity.set(`item:${itemNoKey}`, item);
    if (descKey) savedByIdentity.set(`desc:${descKey}`, item);
    savedByIdentity.set(`index:${index}`, item);
  });

  return projectItems.map((item, index) => {
    const itemNoKey = normalizeBoqIdentity(item?.item_no);
    const descKey = normalizeBoqIdentity(item?.description);
    const saved =
      (itemNoKey ? savedByIdentity.get(`item:${itemNoKey}`) : null) ||
      (descKey ? savedByIdentity.get(`desc:${descKey}`) : null) ||
      savedByIdentity.get(`index:${index}`) ||
      null;

    if (!saved) return item;

    return {
      ...item,
      prev_supply_qty: saved?.prev_supply_qty,
      curr_supply_qty: saved?.curr_supply_qty,
      prev_install_qty: saved?.prev_install_qty,
      curr_install_qty: saved?.curr_install_qty,
      prev_tc_qty: saved?.prev_tc_qty,
      curr_tc_qty: saved?.curr_tc_qty,
      prev_handover_qty: saved?.prev_handover_qty,
      curr_handover_qty: saved?.curr_handover_qty,
    };
  });
};

const readSheetCellValue = (cell) => {
  if (cell == null) return "";
  if (typeof cell === "object") {
    if ("v" in cell && cell.v != null) return cell.v;
    if ("m" in cell && cell.m != null) return cell.m;
  }
  return cell;
};

const toNumericValue = (value) => {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

const parseCummBoqItemsFromLuckysheet = (luckysheetFile, baseItems) => {
  const safeBase = Array.isArray(baseItems) ? baseItems : [];
  const sheet = (Array.isArray(luckysheetFile) ? luckysheetFile : []).find(
    (entry) => String(entry?.name || "").trim().toLowerCase() === "cumm boq"
  );
  if (!sheet || !Array.isArray(sheet.data)) return safeBase;

  const baseByItemNo = new Map();
  const baseByDesc = new Map();
  safeBase.forEach((item) => {
    const itemNoKey = normalizeBoqIdentity(item?.item_no);
    const descKey = normalizeBoqIdentity(item?.description);
    if (itemNoKey) baseByItemNo.set(itemNoKey, item);
    if (descKey) baseByDesc.set(descKey, item);
  });

  const nextItems = [];
  let currentItem = null;

  for (let rowIndex = 0; rowIndex < sheet.data.length; rowIndex += 1) {
    const row = Array.isArray(sheet.data[rowIndex]) ? sheet.data[rowIndex] : [];
    const colA = String(readSheetCellValue(row[0]) || "").trim();
    const colB = String(readSheetCellValue(row[1]) || "").trim();

    const matchedBase =
      (colA ? baseByItemNo.get(normalizeBoqIdentity(colA)) : null) ||
      (colB ? baseByDesc.get(normalizeBoqIdentity(colB)) : null) ||
      null;

    if (matchedBase && colB && !/^supply|installation|testing|handover/i.test(colB)) {
      currentItem = { ...matchedBase };
      nextItems.push(currentItem);
      continue;
    }

    if (!currentItem || !colB) continue;

    const prevValue = readSheetCellValue(row[3]);
    const currValue = readSheetCellValue(row[4]);
    if (/^supply/i.test(colB)) {
      currentItem.prev_supply_qty = prevValue;
      currentItem.curr_supply_qty = currValue;
    } else if (/^installation/i.test(colB)) {
      currentItem.prev_install_qty = prevValue;
      currentItem.curr_install_qty = currValue;
    } else if (/^testing/i.test(colB)) {
      currentItem.prev_tc_qty = prevValue;
      currentItem.curr_tc_qty = currValue;
    } else if (/^handover/i.test(colB)) {
      currentItem.prev_handover_qty = prevValue;
      currentItem.curr_handover_qty = currValue;
    }
  }

  return nextItems.length > 0 ? nextItems : safeBase;
};

const computeCurrentBillAmount = (boqItems) => {
  const items = Array.isArray(boqItems) ? boqItems : [];
  return items.reduce((sum, item) => {
    const rate = toNumericValue(item?.rate);
    return (
      sum +
      toNumericValue(item?.curr_supply_qty) * PHASE_WEIGHTS.supply * rate +
      toNumericValue(item?.curr_install_qty) * PHASE_WEIGHTS.install * rate +
      toNumericValue(item?.curr_tc_qty) * PHASE_WEIGHTS.tc * rate +
      toNumericValue(item?.curr_handover_qty) * PHASE_WEIGHTS.handover * rate
    );
  }, 0);
};

const formatCurrencyINR = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(
    Number.isFinite(Number(value)) ? Number(value) : 0
  );

const statusBadgeVariant = (status) => {
  if (/approved/i.test(String(status))) return "default";
  if (/submitted/i.test(String(status))) return "secondary";
  return "outline";
};

const buildLodhaWorkbookData = (legacy, billId, raw, projectBoqItems = [], projectMirRows = [], projectItrRows = []) => {
  const header = legacy?.header || {};
  const billingShipping = legacy?.billingShipping || {};
  const projectWork = legacy?.projectWork || {};
  const totals = legacy?.totals || {};
  const items = Array.isArray(legacy?.items) ? legacy.items : [];
  const bankDeclaration = legacy?.bankDeclaration || {};
  const preferredBoqItems = buildPreferredBoqItems(raw, projectBoqItems);
  const mergedRaw = {
    ...(raw && typeof raw === "object" ? raw : {}),
    boq_items: preferredBoqItems,
  };

  return {
    ItemTabs: [
      {
        name: "Checklist Sheet",
        matrix: buildChecklistSheetMatrix({ header, billingShipping, projectWork, billId }),
      },
      {
        name: "Cumm BOQ",
        matrix: buildCummBoqSheetMatrix({ header, billingShipping, projectWork, raw: mergedRaw }),
      },
      {
        name: "Challan Summary",
        matrix: buildChallanSummarySheetMatrix({
          header,
          billingShipping,
          projectWork,
          raw: mergedRaw,
          billId,
          projectMirRows,
        }),
      },
      {
        name: "ITR Summary",
        matrix: buildItrSummarySheetMatrix({
          header,
          billingShipping,
          projectWork,
          raw: mergedRaw,
          billId,
          projectItrRows,
        }),
      },
      {
        name: "Illegal Immigration",
        matrix: buildIllegalImmigrantSheetMatrix({ header, billingShipping, projectWork }),
      },
      {
        name: "Amend",
        matrix: buildAmendSheetMatrix({
          header,
          billingShipping,
          projectWork,
          raw: mergedRaw,
        }),
      },
    ],
  };
};

const buildBlankLodhaLegacy = (projectName = "") => ({
  header: withCommonCompanyHeader({
    company_name: "Madhuram Enterprises",
    work_description: "PLUMBING WORKS",
  }),
  billingShipping: {
    buyer_name: projectName,
    place_of_supply: projectName,
    receiver_name: projectName,
  },
  projectWork: {
    plant_name: projectName,
  },
  totals: {},
  items: [],
  bankDeclaration: {},
});

const buildHiranandaniAbstractSheetMatrix = (projectName = "", firstMirPayload = {}, boqItems = []) => {
  const rows = [
    ["REF - EHC/FF/1", "", "", "", "", "", "", "", "", "", "", ""],
    [
      `Name of building: ${projectName || ""}`,
      "",
      "",
      `Work Order Number : ${firstMirPayload?.notes?.purchaseOrderNo || ""}`,
      "",
      "",
      "",
      "",
      "R.A. Bill No :- ",
      "",
      "",
      "",
    ],
    [
      "From M/s: MADHURAM Enterprises",
      "",
      "",
      "Job :- FIRE FIGHTING WORKS",
      "",
      "",
      "",
      "",
      "To, M/s. HGP COMMUNITY PVT. LTD.",
      "",
      "",
      "",
    ],
    ["", "", "", "", "", "", "", "", "", "", "", ""],
    ["WO SR NO", "SERVICE DESCRIPTION", "QTY", "THIS BILL", "PREV BILL", "TOT BILL", "UNIT", "RATE", "THIS BILL AMT", "PREV AMT", "TOT AMT", ""],
  ];

  const safeBoqItems = Array.isArray(boqItems) ? boqItems : [];
  const sectionNamesSeen = new Set();
  let sectionIndex = 0;

  safeBoqItems.forEach((item, index) => {
    const section = String(item?.section || "").trim();
    const itemNo = item?.item_no || item?.itemNo || item?.sr_no || item?.srNo || String(index + 1);
    const description = item?.description || "";
    const qty = toNumber(item?.wo_qty);

    if (section && !sectionNamesSeen.has(section)) {
      sectionNamesSeen.add(section);
      rows.push([String.fromCharCode(65 + (sectionIndex % 26)), section, "", "", "", "", "", "", "", "", "", ""]);
      sectionIndex += 1;
    }

    rows.push([
      String(itemNo),
      description,
      qty || "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  while (rows.length < 165) {
    rows.push(["", "", "", "", "", "", "", "", "", "", "", ""]);
  }

  return rows;
};

const buildHiranandaniSignSheetMatrix = (abstractRows = []) => {
  const rows = Array.isArray(abstractRows) ? abstractRows : [];
  const maxColumns = Math.max(12, ...rows.map((row) => (Array.isArray(row) ? row.length : 0)));

  return rows.map((row, rowIndex) =>
    Array.from({ length: maxColumns }, (_, columnIndex) => {
      const sourceRow = Array.isArray(row) ? row : [];
      const sourceValue = sourceRow[columnIndex] ?? "";
      return {
        __formula: `Abstract!${toSpreadsheetColumn(columnIndex)}${rowIndex + 1}`,
        __value: sourceValue,
      };
    }),
  );
};

const buildHiranandaniWorkbookData = (projectName = "", projectBoqItems = [], mirRows = []) => {
  const boqItems = Array.isArray(projectBoqItems) ? projectBoqItems : [];
  const hiranandaniMirs = (Array.isArray(mirRows) ? mirRows : [])
    .filter((row) => getMirTemplateType(row) === "hiranandani")
    .map((row) => ({
      raw: row,
      payload: getMirTemplatePayload(row),
    }));
  const woRows = [
    [projectName || "HIRANANDANI WORK ORDER", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["WO SR NO", "SERVICE DESCRIPTION", "QTY", "UNIT", "RATE", "AMOUNT"],
  ];
  const sectionNamesSeen = new Set();
  let sectionIndex = 0;

  boqItems.forEach((item, index) => {
    const section = String(item?.section || "").trim();
    const sectionLabel = section ? String.fromCharCode(65 + (sectionIndex % 26)) : "";
    const itemNo = item?.item_no || item?.itemNo || item?.sr_no || item?.srNo || index + 1;
    const description = item?.description || "";
    const qty = toNumber(item?.wo_qty);
    const unit = item?.uom || item?.unit || "";
    const rate = toNumber(item?.rate);
    const amount = toNumber(item?.amount) || qty * rate;

    if (section && !sectionNamesSeen.has(section)) {
      sectionNamesSeen.add(section);
      woRows.push([sectionLabel, section, "", "", "", ""]);
      sectionIndex += 1;
    }

    woRows.push([
      String(itemNo),
      description,
      qty || "",
      unit,
      rate || "",
      amount || "",
    ]);
  });

  const mirOne = hiranandaniMirs[0]?.payload || {};
  const mirTwo = hiranandaniMirs[1]?.payload || {};
  const mirThree = hiranandaniMirs[2]?.payload || {};
  const poNo = mirOne?.notes?.purchaseOrderNo || mirOne?.notes?.challanInvoiceNo || "";
  const deliveryNoValues = [
    mirOne?.notes?.challanInvoiceNo || "",
    mirTwo?.notes?.challanInvoiceNo || "",
    mirThree?.notes?.challanInvoiceNo || "",
  ];
  const dateValues = [
    mirOne?.notes?.deliveryDate || mirOne?.inspectionDate || "",
    mirTwo?.notes?.deliveryDate || mirTwo?.inspectionDate || "",
    mirThree?.notes?.deliveryDate || mirThree?.inspectionDate || "",
  ];
  const partyValues = [
    mirOne?.supplierName || "",
    mirTwo?.supplierName || "",
    mirThree?.supplierName || "",
  ];
  const mirNoValues = [
    mirOne?.mirNo || "",
    mirTwo?.mirNo || "",
    mirThree?.mirNo || "PENDING",
  ];

  const summRows = [
    ["MADHURAM ENTERPRISES", "", "PO NO", "", poNo, "", "", "", "", "", "", "", "", "", ""],
    [`Name of building: ${projectName || ""}`, "", "D.NO ", "", deliveryNoValues[0], deliveryNoValues[1], deliveryNoValues[2], "", "", "", "", "", "", "", ""],
    ["Work Order Number :", "", "DATE", "", dateValues[0], dateValues[1], dateValues[2], "", "", "", "", "", "", "", ""],
    ["Job :- FIRE FIGHTING WORKS", "", "PARTY", "", partyValues[0], partyValues[1], partyValues[2], "", "", "", "", "", "", "", ""],
    ["", "", "MIR NO", "", mirNoValues[0], mirNoValues[1], mirNoValues[2], "", "", "", "", "", "", "", ""],
    ["QTY SR NO", "ITEM ", "WO QTY", "", "RA 1", "", "", "", "AMEND", "TOT QTY", "", "INST SR NO", "QTY", "REMARKS", ""],
  ];

  for (let i = 0; i < boqItems.length; i += 3) {
    const supply = boqItems[i];
    if (!supply) continue;
    const installation = boqItems[i + 1];
    const normalizedDescription = String(supply?.description || "").trim().toLowerCase();
    const matchingMirRow =
      hiranandaniMirs
        .flatMap((entry) => Array.isArray(entry?.payload?.materialRows) ? entry.payload.materialRows : [])
        .find((row) => String(row?.material || "").trim().toLowerCase() && normalizedDescription.includes(String(row?.material || "").trim().toLowerCase())) || null;
    summRows.push([
      String(supply?.item_no || i + 1),
      supply?.description || "",
      toNumber(supply?.wo_qty) || "",
      "",
      "",
      "",
      "",
      "",
      "",
      0,
      "",
      installation?.item_no ? String(installation.item_no) : "",
      matchingMirRow?.quantity || "",
      "",
      "",
    ]);
  }

  const firstMirPayload = hiranandaniMirs[0]?.payload || {};
  const abstractRows = buildHiranandaniAbstractSheetMatrix(projectName, firstMirPayload, boqItems);
  const signRows = buildHiranandaniSignSheetMatrix(abstractRows);

  return {
    ItemTabs: [
      {
        name: "WO",
        matrix: woRows,
      },
      {
        name: "Abstract",
        matrix: abstractRows,
      },
      {
        name: "Summ",
        matrix: summRows,
      },
      {
        name: "sign",
        matrix: signRows,
      },
    ],
  };
};

export default function BillingInvoiceEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backHref = projectId ? `/${projectId}/billing` : "/billing";
  const { selectedProject, projects } = useProject();
  const { toast } = useToast();
  const billId = React.useMemo(() => String(searchParams.get("billId") || "").trim(), [searchParams]);
  const template = React.useMemo(() => String(searchParams.get("template") || "lodha").trim().toLowerCase(), [searchParams]);
  const [workbookData, setWorkbookData] = React.useState(null);
  const [loadingWorkbook, setLoadingWorkbook] = React.useState(Boolean(billId || template));
  const [rawBill, setRawBill] = React.useState(null);
  const [billLegacy, setBillLegacy] = React.useState(null);
  const [projectBoqItems, setProjectBoqItems] = React.useState([]);
  const [projectMirRows, setProjectMirRows] = React.useState([]);
  const [projectItrRows, setProjectItrRows] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const spreadsheetApiRef = React.useRef(null);

  const resolvedProjectId = React.useMemo(() => {
    const toIntOrNull = (value) => {
      if (value == null) return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      if (!Number.isInteger(n)) return null;
      if (n <= 0) return null;
      return n;
    };

    const routeKey = projectId != null ? String(projectId).trim() : "";
    const fromRoute = toIntOrNull(routeKey);
    if (fromRoute) return fromRoute;

    const fromSelected = toIntOrNull(selectedProject?.project_id ?? selectedProject?.id);
    if (fromSelected) return fromSelected;

    if (routeKey && Array.isArray(projects) && projects.length > 0) {
      const match = projects.find((p) => {
        const keys = [
          p?.slug,
          p?.project_id,
          p?.id,
          p?.project_name,
          p?.name,
        ]
          .map((x) => String(x ?? "").trim().toLowerCase())
          .filter(Boolean);
        return keys.includes(routeKey.toLowerCase());
      });
      return toIntOrNull(match?.project_id ?? match?.id);
    }

    return null;
  }, [projectId, projects, selectedProject?.id, selectedProject?.project_id]);

  React.useEffect(() => {
    let active = true;

    const loadWorkbook = async () => {
      setLoadingWorkbook(true);
      try {
        let projectBoqItems = [];
        let projectMirRows = [];
        let projectItrRows = [];
        if (resolvedProjectId) {
          const [boqRes, mirRes, itrRes] = await Promise.all([
            api.getBoqItemsForProject(resolvedProjectId),
            api.getMirsByProject(resolvedProjectId),
            api.getItrsByProject(resolvedProjectId),
          ]);
          if (boqRes?.success) {
            const boqRows = boqRes?.data?.items || boqRes?.data?.data?.items || [];
            projectBoqItems = normalizeProjectBoqItems(boqRows);
          }
          if (mirRes?.success) {
            projectMirRows = Array.isArray(mirRes?.data) ? mirRes.data : [];
          }
          if (itrRes?.success) {
            projectItrRows = Array.isArray(itrRes?.data)
              ? itrRes.data
              : Array.isArray(itrRes?.data?.itrs)
                ? itrRes.data.itrs
                : [];
          }
        }

        const projectName =
          String(selectedProject?.project_name || selectedProject?.name || "").trim();

        if (!billId) {
          if (!active) return;
          setProjectBoqItems(projectBoqItems);
          setProjectMirRows(projectMirRows);
          setProjectItrRows(projectItrRows);
          if (template === "hiranandani") {
            setRawBill({ status: "Draft" });
            setBillLegacy(null);
            setWorkbookData(buildHiranandaniWorkbookData(projectName, projectBoqItems, projectMirRows));
          } else {
            const legacy = buildBlankLodhaLegacy(projectName);
            const raw = { boq_items: projectBoqItems, status: "Draft" };
            setRawBill(raw);
            setBillLegacy(legacy);
            setWorkbookData(buildLodhaWorkbookData(legacy, "", raw, projectBoqItems, projectMirRows, projectItrRows));
          }
          return;
        }

        const res = await api.getLodhaInvoice(billId);
        if (!res?.success) throw new Error(res?.error || "Failed to load Lodha bill");
        const raw = res?.data ?? res;
        const legacy = lodhaApiToFormData(raw);
        if (!active) return;
        setRawBill(raw);
        setBillLegacy(legacy);
        setProjectBoqItems(projectBoqItems);
        setProjectMirRows(projectMirRows);
        setProjectItrRows(projectItrRows);
        setWorkbookData(buildLodhaWorkbookData(legacy, billId, raw, projectBoqItems, projectMirRows, projectItrRows));
      } catch (error) {
        if (!active) return;
        setWorkbookData(null);
        setRawBill(null);
        setBillLegacy(null);
        setProjectBoqItems([]);
        setProjectMirRows([]);
        toast({
          title: "Lucky Sheet load failed",
          description: String(error?.message || error),
          variant: "destructive",
        });
      } finally {
        if (active) setLoadingWorkbook(false);
      }
    };

    loadWorkbook();
    return () => {
      active = false;
    };
  }, [billId, resolvedProjectId, selectedProject?.name, selectedProject?.project_name, template, toast]);

  const handleSave = React.useCallback(
    async (nextStatus = "Draft") => {
      if (!resolvedProjectId || !billLegacy) return;
      const luckysheetFile = spreadsheetApiRef.current?.getLuckysheetFile?.() || [];
      const preferredBoqItems = buildPreferredBoqItems(rawBill, projectBoqItems);
      const parsedBoqItems = parseCummBoqItemsFromLuckysheet(luckysheetFile, preferredBoqItems);
      const currentBillAmount = computeCurrentBillAmount(parsedBoqItems);
      const payload = {
        ...lodhaFormToApiPayload(billLegacy, resolvedProjectId),
        boq_items: parsedBoqItems,
        status: nextStatus,
        taxable_amount: currentBillAmount,
        total_invoice_value: currentBillAmount * (1 + CGST_RATE + SGST_RATE),
      };

      const setBusy = nextStatus === "Submitted" ? setSubmitting : setSaving;
      setBusy(true);
      try {
        const res = billId
          ? await api.updateLodhaInvoice(billId, payload)
          : await api.createLodhaInvoice(payload);
        if (!res?.success) throw new Error(res?.error || "Save failed");
        if (!billId) {
          const createdId =
            res?.data?.id ??
            res?.data?.invoice_id ??
            res?.data?.lodha_invoice_id ??
            res?.data?._id;
          toast({
            title: nextStatus === "Submitted" ? "Submitted" : "Saved",
            description: nextStatus === "Submitted" ? "Lucky Sheet submitted successfully." : "Lucky Sheet draft saved successfully.",
          });
          if (createdId) {
            navigate(`/${projectId}/billing/invoice-editor?billId=${encodeURIComponent(String(createdId))}`, { replace: true });
          }
          return;
        }
        const nextRaw = {
          ...(rawBill && typeof rawBill === "object" ? rawBill : {}),
          boq_items: parsedBoqItems,
          status: nextStatus,
        };
        setRawBill(nextRaw);
        toast({
          title: nextStatus === "Submitted" ? "Submitted" : "Saved",
          description: nextStatus === "Submitted" ? "Lucky Sheet submitted successfully." : "Lucky Sheet draft saved successfully.",
        });
      } catch (error) {
        toast({
          title: nextStatus === "Submitted" ? "Submit failed" : "Save failed",
          description: String(error?.message || error),
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [billId, billLegacy, navigate, projectBoqItems, projectId, rawBill, resolvedProjectId, toast]
  );

  const handleDownloadPdf = React.useCallback(async () => {
    if (!rawBill) return;
    const legacy = lodhaApiToFormData(rawBill);
    await downloadInvoicePdf("lodha", legacy);
  }, [rawBill]);

  const currentStatus = rawBill?.status || "Draft";
  const currentBillAmount = React.useMemo(() => {
    const preferredBoqItems = buildPreferredBoqItems(rawBill, projectBoqItems);
    return computeCurrentBillAmount(preferredBoqItems);
  }, [projectBoqItems, rawBill]);
  const isHiranandani = template === "hiranandani";
  const luckySheetTitle = isHiranandani ? "Hiranandani Lucky Sheet" : "Lodha Lucky Sheet";
  const loadingLabel = isHiranandani ? "Loading Hiranandani Lucky Sheet..." : "Loading Lodha Lucky Sheet...";
  const unavailableLabel = isHiranandani
    ? "The Hiranandani bill workbook could not be loaded for this billing item."
    : "The Lodha bill workbook could not be loaded for this billing item.";

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute inset-x-0 top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate(backHref)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <div className="text-base font-semibold">{luckySheetTitle}</div>
              <div className="text-sm text-muted-foreground">
                Bill #{billId || "-"} · Current bill amount {formatCurrencyINR(currentBillAmount)}
              </div>
            </div>
            <Badge variant={statusBadgeVariant(currentStatus)}>{currentStatus}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => handleSave("Draft")} disabled={loadingWorkbook || saving || submitting || !billLegacy || isHiranandani}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Draft
            </Button>
            <Button variant="secondary" onClick={() => handleSave("Submitted")} disabled={loadingWorkbook || saving || submitting || !billLegacy || isHiranandani || /submitted|approved/i.test(String(currentStatus))}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={loadingWorkbook}>
                  Download <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => spreadsheetApiRef.current?.downloadExcel?.()}>
                  Download Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPdf} disabled={isHiranandani || !billId}>
                  <FileText className="mr-2 h-4 w-4" /> Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="h-full w-full pt-20">
        {loadingWorkbook ? (
          <div className="flex h-full items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingLabel}
            </div>
          </div>
        ) : billId && !workbookData ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
              <div className="text-base font-semibold text-foreground">Lucky Sheet unavailable</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {unavailableLabel}
              </div>
            </div>
          </div>
        ) : (
          <ProjectSpreadsheet
            apiRef={spreadsheetApiRef}
            key={billId ? `${template}-lucky-${billId}` : `${template}-project-${resolvedProjectId ?? "default"}`}
            projectId={resolvedProjectId}
            title={billId ? `${luckySheetTitle} - ${billId}` : luckySheetTitle}
            workbookTitle={billId ? `Madhuram Sheet - ${billId}` : "Madhuram Sheet"}
            workbookData={workbookData}
            downloadFilename={billId ? `${template}-bill-${billId}-lucky-sheet.xlsx` : `${template}-billing-lucky-sheet.xlsx`}
            showHeader={false}
            showDownload={false}
            wrapperClassName="h-full w-full"
            bodyClassName="relative h-full w-full"
          />
        )}
      </div>
    </div>
  );
}
