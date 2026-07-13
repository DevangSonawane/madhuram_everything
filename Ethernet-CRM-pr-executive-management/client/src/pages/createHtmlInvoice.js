import hiraTemplateRaw from "@/assets/invoices/hira_inv.md?raw";
import lodhaTemplateRaw from "@/assets/invoices/lodha_inv.md?raw";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { withCommonCompanyHeader } from "@/lib/companyDefaults";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const coerceText = (value) => String(value ?? "").trim();

const toMultilineHtml = (value) =>
  escapeHtml(coerceText(value)).replace(/\r\n|\r|\n/g, "<br>");

const sliceFromDoctype = (raw) => {
  const idx = String(raw || "").indexOf("<!DOCTYPE html>");
  return idx >= 0 ? String(raw).slice(idx) : String(raw || "");
};

const stripNoPrintBanner = (html) =>
  String(html || "").replace(/<div class="no-print">[\s\S]*?<\/div>\s*/i, "");

const normalizeDateForDisplay = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString().slice(0, 10);
};

function extractBankFields(bankDetailsText) {
  const raw = String(bankDetailsText ?? "").trim();
  if (!raw) {
    return { bankName: "", accountNo: "", ifsc: "", branch: "" };
  }

  const pick = (label) => {
    const re = new RegExp(`${escapeRegex(label)}\\s*[:\\-]?\\s*([^\\n\\r]+)`, "i");
    const m = raw.match(re);
    return m ? String(m[1] ?? "").trim() : "";
  };

  const bankName = pick("Bank Name") || pick("Bank") || "";
  const accountNo = pick("Account No") || pick("A/c No") || pick("Account Number") || "";
  const ifsc = pick("IFSC Code") || pick("IFSC") || "";
  const branch = pick("Branch") || "";

  // If it doesn't look structured, keep the whole text in Bank Name.
  const looksStructured = [bankName, accountNo, ifsc, branch].some(Boolean);
  if (!looksStructured) {
    return { bankName: raw, accountNo: "", ifsc: "", branch: "" };
  }

  return { bankName, accountNo, ifsc, branch };
}

function replaceFirst(html, pattern, replacement) {
  const next = String(html).replace(pattern, replacement);
  return next;
}

function replaceLabelValue(html, label, value) {
  const safeLabel = escapeRegex(label);
  const re = new RegExp(
    `(<span\\s+class="ml"\\s*>\\s*${safeLabel}\\s*<\\/span>[\\s\\S]*?<span[^>]*>\\s*:??\\s*)([\\s\\S]*?)(<\\/span>)`,
    "i",
  );
  return replaceFirst(html, re, `$1${toMultilineHtml(value)}$3`);
}

function replaceLabelValueAfter(html, anchorText, label, value) {
  const safeAnchor = escapeRegex(anchorText);
  const safeLabel = escapeRegex(label);
  const re = new RegExp(
    `(${safeAnchor}[\\s\\S]*?<span\\s+class="ml"\\s*>\\s*${safeLabel}\\s*<\\/span>[\\s\\S]*?<span[^>]*>\\s*:??\\s*)([\\s\\S]*?)(<\\/span>)`,
    "i",
  );
  return replaceFirst(html, re, `$1${toMultilineHtml(value)}$3`);
}

function replaceCompanyHeader(html, header) {
  const resolvedHeader = withCommonCompanyHeader(header || {});
  const companyName = coerceText(resolvedHeader?.company_name);
  const companyAddress = coerceText(resolvedHeader?.company_address);
  const companyContact = coerceText(resolvedHeader?.company_phone ?? resolvedHeader?.company_contact_number);
  const companyEmail = coerceText(resolvedHeader?.company_email);
  const companyWebsite = coerceText(resolvedHeader?.company_website);

  const companySub = [
    companyAddress,
    `Cell no. <a href="tel:${escapeHtml(companyContact)}">${escapeHtml(companyContact)}</a>, &nbsp;Email Id <a href="mailto:${escapeHtml(companyEmail)}">${escapeHtml(companyEmail)}</a>`,
    `Website: <a href="#">${escapeHtml(companyWebsite)}</a>`,
  ]
    .filter(Boolean)
    .join("<br>\n        ");

  let next = html;
  if (companyName) {
    next = replaceFirst(
      next,
      /<div class="company-name">[\s\S]*?<\/div>/,
      `<div class="company-name">${escapeHtml(companyName)}</div>`,
    );
  }
  if (companySub) {
    next = replaceFirst(
      next,
      /<div class="company-sub">[\s\S]*?<\/div>/,
      `<div class="company-sub">\n        ${companySub}\n      </div>`,
    );
  }
  return next;
}

function blankCompanyHeader(html) {
  let next = html;
  next = replaceFirst(next, /<div class="company-name">[\s\S]*?<\/div>/, `<div class="company-name"></div>`);
  next = replaceFirst(next, /<div class="company-sub">[\s\S]*?<\/div>/, `<div class="company-sub"></div>`);
  return next;
}

function blankAllLabelValues(html) {
  return String(html || "").replace(
    /(<span\s+class="ml"\s*>[\s\S]*?<\/span>[\s\S]*?<span[^>]*>\s*:??\s*)([\s\S]*?)(<\/span>)/gi,
    "$1$3",
  );
}

function blankAllStrongColonValues(html) {
  return String(html || "").replace(/(<strong>[^<]*?:<\/strong>)\s*[^<]*/gi, "$1 ");
}

function blankTfootNumbers(html) {
  return String(html || "").replace(/(<tfoot>[\s\S]*?<\/tfoot>)/i, (block) =>
    block.replace(/(<td[^>]*>)([^<]*)(<\/td>)/gi, (m, p1, _p2, p3) => `${p1}${p3}`),
  );
}

function blankSummaryNumbers(html) {
  let next = String(html || "");
  next = next.replace(/(<div class="arow[^"]*"><span>[\s\S]*?<\/span><span>)([^<]*)(<\/span><\/div>)/gi, "$1$3");
  next = next.replace(/(<div style="font-size:14px; font-weight:bold;">₹\s*)([^<]*)(<\/div>)/gi, "$1$3");
  return next;
}

function replaceStrongInlineValue(html, strongLabelWithColon, value) {
  const safeLabel = escapeRegex(strongLabelWithColon);
  const re = new RegExp(`(<strong>\\s*${safeLabel}\\s*<\\/strong>\\s*)([^<]*)`, "i");
  return replaceFirst(html, re, `$1${escapeHtml(coerceText(value))}`);
}

function replaceStrongPrefixValue(html, strongPrefix, value) {
  const safePrefix = escapeRegex(strongPrefix);
  const re = new RegExp(`(<strong>\\s*${safePrefix}\\s*)([^<]*)(<\\/strong>)`, "i");
  return replaceFirst(html, re, `$1${escapeHtml(coerceText(value))}$3`);
}

function buildLodhaItemRows(items) {
  const rows = Array.isArray(items) ? items : [];
  const safeItems = rows.length ? rows : [{}];
  return safeItems
    .map((item, idx) => {
      const description = escapeHtml(coerceText(item?.description));
      const sacCode = escapeHtml(coerceText(item?.sac_code));
      const valueOfSupply = escapeHtml(coerceText(item?.value_of_supply));
      const discount = escapeHtml(coerceText(item?.discount));
      const taxableValue = escapeHtml(coerceText(item?.taxable_value));
      const cgstRate = escapeHtml(coerceText(item?.cgst_rate));
      const cgstAmount = escapeHtml(coerceText(item?.cgst_amount));
      const sgstRate = escapeHtml(coerceText(item?.sgst_rate));
      const sgstAmount = escapeHtml(coerceText(item?.sgst_amount));
      const total = escapeHtml(coerceText(item?.line_total ?? item?.total));

      return `
      <tr>
        <td class="c">${idx + 1}</td>
        <td>${description}</td>
        <td class="c">${sacCode}</td>
        <td class="r">${valueOfSupply}</td>
        <td class="c">${discount}</td>
        <td class="r">${taxableValue}</td>
        <td class="c">${cgstRate}</td>
        <td class="r">${cgstAmount}</td>
        <td class="c">${sgstRate}</td>
        <td class="r">${sgstAmount}</td>
        <td class="r">${total}</td>
      </tr>`.trimEnd();
    })
    .join("\n");
}

function buildHiraItemRows(items) {
  const rows = Array.isArray(items) ? items : [];
  const safeItems = rows.length ? rows : [{}];
  return safeItems
    .map((item, idx) => {
      const description = escapeHtml(coerceText(item?.description));
      const sacCode = escapeHtml(coerceText(item?.sac_code));
      const valueOfSupply = escapeHtml(coerceText(item?.value_of_supply));
      const discount = escapeHtml(coerceText(item?.discount));
      const taxableValue = escapeHtml(coerceText(item?.taxable_value));
      const cgstRate = escapeHtml(coerceText(item?.cgst_rate));
      const cgstAmount = escapeHtml(coerceText(item?.cgst_amount));
      const sgstRate = escapeHtml(coerceText(item?.sgst_rate));
      const sgstAmount = escapeHtml(coerceText(item?.sgst_amount));
      // API does not provide IGST/cess rate fields for this template; keep blank placeholders.
      const igstRate = "";
      const igstAmount = "";
      const cessRate = "";
      const cessAmount = "";

      return `
      <tr>
        <td class="c">${idx + 1}</td>
        <td>${description}</td>
        <td class="c">${sacCode}</td>
        <td class="c">—</td>
        <td class="c">—</td>
        <td class="c">—</td>
        <td class="r">${valueOfSupply}</td>
        <td class="c">${discount}</td>
        <td class="r">${taxableValue}</td>
        <td class="c">${cgstRate}</td>
        <td class="r">${cgstAmount}</td>
        <td class="c">${sgstRate}</td>
        <td class="r">${sgstAmount}</td>
        <td class="c">${igstRate}</td>
        <td class="r">${igstAmount}</td>
        <td class="c">${cessRate}</td>
        <td class="r">${cessAmount}</td>
      </tr>`.trimEnd();
    })
    .join("\n");
}

function applyTableBody(html, rowsHtml) {
  return replaceFirst(
    html,
    /<tbody>[\s\S]*?<\/tbody>/i,
    `<tbody>\n${rowsHtml}\n    </tbody>`,
  );
}

function renderLodhaInvoiceHtml({ header, items, totals, declaration }) {
  // PF/ESIC/PTR/MLWF (HGP Community) template.
  let html = sliceFromDoctype(hiraTemplateRaw);
  html = stripNoPrintBanner(html);
  html = blankCompanyHeader(html);
  html = blankAllLabelValues(html);
  html = blankAllStrongColonValues(html);
  html = blankTfootNumbers(html);
  html = blankSummaryNumbers(html);

  html = replaceCompanyHeader(html, header);

  html = replaceStrongPrefixValue(html, "GSTIN:", header?.supplier_gstin);
  html = replaceStrongPrefixValue(html, "PAN NO.:", header?.pan_number);

  html = replaceLabelValue(html, "Invoice No", header?.invoice_number);
  html = replaceLabelValue(html, "Invoice date", normalizeDateForDisplay(header?.invoice_date));
  html = replaceLabelValue(html, "Reverse Charge (Y/N)", header?.reverse_charge);
  html = replaceLabelValue(
    html,
    "State",
    [
      coerceText(header?.supplier_state_name),
      coerceText(header?.supplier_state_code) ? `Code: ${coerceText(header?.supplier_state_code)}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  html = replaceLabelValue(html, "PF NO", header?.pf_number);
  html = replaceLabelValue(html, "ESIC NO", header?.esic_number);
  html = replaceLabelValue(html, "PTR NO", header?.ptr_number);
  html = replaceLabelValue(html, "MLWF NO", header?.mlwf_number);

  html = replaceStrongInlineValue(html, "Co A/C Name:", header?.bill_to_name);
  html = replaceStrongInlineValue(html, "Address:", header?.bill_to_address);
  html = replaceStrongInlineValue(html, "GSTIN:", header?.bill_to_gstin);

  // Ship-to section.
  html = replaceFirst(
    html,
    /(<div class="ph">Ship to Party \/ Site<\/div>\s*<div><strong>Co A\/C Name:<\/strong>\s*)([^<]*)(<\/div>\s*<div style="margin-top:3px;"><strong>Address:<\/strong>\s*)([^<]*)(<\/div>\s*<div style="margin-top:3px;"><strong>GSTIN:<\/strong>\s*)([^<]*)(<\/div>)/i,
    `$1${escapeHtml(coerceText(header?.ship_to_name))}$3${escapeHtml(coerceText(header?.ship_to_address))}$5${escapeHtml(coerceText(header?.ship_to_gstin))}$7`,
  );
  // Bill-to State/Code row.
  html = replaceFirst(
    html,
    /(<div><strong>State:<\/strong>\s*)([^<]*?)(\s*&nbsp;&nbsp;<strong>Code:<\/strong>\s*)([^<]*?)(\s*<\/div>)/i,
    `$1${escapeHtml(coerceText(header?.bill_to_state))}$3${escapeHtml(coerceText(header?.bill_to_state_code))}$5`,
  );
  // Ship-to State/Code row (second occurrence).
  html = replaceFirst(
    html,
    /(<div class="ph">Ship to Party \/ Site<\/div>[\s\S]*?<div><strong>State:<\/strong>\s*)([^<]*?)(\s*&nbsp;&nbsp;<strong>Code:<\/strong>\s*)([^<]*?)(\s*<\/div>)/i,
    (m, p1, _s, p3, _c, p5) =>
      `${p1}${escapeHtml(coerceText(header?.ship_to_state))}${p3}${escapeHtml(coerceText(header?.ship_to_state_code))}${p5}`,
  );

  // Reference bar + service dates.
  html = replaceFirst(
    html,
    /(<div class="ref-hd">BUILDING NAME<\/div>\s*<div><strong>)([^<]*)(<\/strong><\/div>)/i,
    `$1${escapeHtml(coerceText(header?.building_name))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="ref-hd">Reference<\/div>\s*<div><strong>)([^<]*)(<\/strong>)/i,
    `$1${escapeHtml(coerceText(header?.ra_number))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="ref-hd">WO NO<\/div>\s*<div>)([^<]*)(<\/div>)/i,
    `$1${escapeHtml(coerceText(header?.work_order_number))}${
      header?.work_order_date ? ` DT ${escapeHtml(normalizeDateForDisplay(header?.work_order_date))}` : ""
    }${header?.work_description ? ` &nbsp;|&nbsp; ${escapeHtml(coerceText(header?.work_description))}` : ""}$3`,
  );
  html = replaceFirst(
    html,
    /<div class="svc-bar">[\s\S]*?<\/div>/i,
    `<div class="svc-bar">SERVICE DATE FROM - ${escapeHtml(normalizeDateForDisplay(header?.service_date_from))} TO ${escapeHtml(normalizeDateForDisplay(header?.service_date_to))}</div>`,
  );

  html = applyTableBody(html, buildLodhaItemRows(items));

  // Table footer totals (best-effort: fill a few key numeric cells).
  html = replaceFirst(
    html,
    /(<tfoot>[\s\S]*?<tr class="foot-row">[\s\S]*?<td colspan="2">Total<\/td>[\s\S]*?<td>\s*<\/td>\s*<td class="r">)([^<]*)(<\/td>)/i,
    `$1${escapeHtml(coerceText(totals?.total_taxable_value ?? totals?.totalTaxableValue))}$3`,
  );
  html = replaceFirst(
    html,
    /(<td class="r">)([^<]*)(<\/td>\s*<\/tr>\s*<\/tfoot>)/i,
    `$1${escapeHtml(coerceText(totals?.total_amount_after_tax ?? totals?.totalAmountAfterTax ?? totals?.total_amount ?? totals?.total_invoice_value))}$3`,
  );

  // Totals: summary right side.
  html = replaceFirst(
    html,
    /(<div class="arow b"><span>Total Amount before Tax<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_amount_before_tax ?? totals?.total_before_tax ?? totals?.total_taxable_value))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>Add: CGST<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.add_cgst ?? totals?.total_cgst_amount ?? totals?.total_cgst))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>Add: SGST<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.add_sgst ?? totals?.total_sgst_amount ?? totals?.total_sgst))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>ROUND OFF<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.round_off))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow big"><span>Total Amount after Tax:<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_amount_after_tax ?? totals?.totalAmountAfterTax ?? totals?.total_amount ?? totals?.total_invoice_value))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>GST on Reverse Charge<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.gst_on_reverse_charge ?? totals?.gstOnReverseCharge))}$3`,
  );

  // Totals: words.
  html = replaceFirst(
    html,
    /(<div style="font-weight:bold; margin-bottom:4px;">Total Invoice amount in words<\/div>\s*<div>)([^<]*)(<\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_invoice_amount_in_words || totals?.invoice_amount_words || totals?.invoice_amount_in_words || totals?.total_invoice_value_in_words))}$3`,
  );

  // Bank details table (Bank Name / Account / IFSC / Branch).
  const bankFields = extractBankFields(declaration?.bank_details ?? declaration?.bankDetails);
  html = replaceFirst(
    html,
    /(<strong>Bank Name:<\/strong><\/td><td[^>]*>)([\s\S]*?)(<\/td><\/tr>)/i,
    `$1${escapeHtml(coerceText(bankFields.bankName))}$3`,
  );
  html = replaceFirst(
    html,
    /(<strong>Account No:<\/strong><\/td><td[^>]*>)([\s\S]*?)(<\/td><\/tr>)/i,
    `$1${escapeHtml(coerceText(bankFields.accountNo))}$3`,
  );
  html = replaceFirst(
    html,
    /(<strong>IFSC Code:<\/strong><\/td><td[^>]*>)([\s\S]*?)(<\/td><\/tr>)/i,
    `$1${escapeHtml(coerceText(bankFields.ifsc))}$3`,
  );
  html = replaceFirst(
    html,
    /(<strong>Branch:<\/strong><\/td><td[^>]*>)([\s\S]*?)(<\/td><\/tr>)/i,
    `$1${escapeHtml(coerceText(bankFields.branch))}$3`,
  );

  // E & O.E (best-effort: normalize to Yes/No if boolean).
  const eAndOeRaw = totals?.e_and_oe ?? totals?.eAndOE ?? totals?.e_and_oe_value ?? "";
  const eAndOeValue =
    typeof eAndOeRaw === "boolean"
      ? eAndOeRaw
        ? "Yes"
        : "No"
      : coerceText(eAndOeRaw);
  html = replaceFirst(
    html,
    /(<div class="arow"><span>E\s*&amp;\s*O\.E<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(eAndOeValue)}$3`,
  );

  // Declaration fields (optional).
  html = replaceFirst(
    html,
    /(For Madhuram Enterprises<\/strong><br>\s*)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/div>\s*<\/body>)/i,
    (match, p1, _p2, p3) => {
      const bankDetails = coerceText(declaration?.bank_details);
      const terms = coerceText(declaration?.terms_and_conditions || declaration?.terms);
      const signatory = coerceText(declaration?.authorised_signatory);
      const injected = [
        bankDetails ? `<div style="margin-top:10px; font-size:10px;"><strong>Bank Details:</strong> ${escapeHtml(bankDetails)}</div>` : "",
        terms ? `<div style="margin-top:10px; font-size:10px;"><strong>Terms:</strong> ${escapeHtml(terms)}</div>` : "",
        signatory ? `<div style="margin-top:10px;"><strong>Authorised Signatory:</strong> ${escapeHtml(signatory)}</div>` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return `${p1}${injected}${p3}`;
    },
  );

  return html;
}

function renderHiranandaniInvoiceHtml({ header, billingShipping, projectWork, items, totals, bankDeclaration }) {
  // Buyers-details (Cowtown / Eden C) template.
  let html = sliceFromDoctype(lodhaTemplateRaw);
  html = stripNoPrintBanner(html);
  html = blankCompanyHeader(html);
  html = blankAllLabelValues(html);
  html = blankAllStrongColonValues(html);
  html = blankTfootNumbers(html);
  html = blankSummaryNumbers(html);

  html = replaceCompanyHeader(html, header);

  html = replaceLabelValue(html, "Invoice No", header?.invoice_number);
  html = replaceLabelValue(html, "Invoice Date", normalizeDateForDisplay(header?.invoice_date));
  html = replaceLabelValue(html, "GSTIN", header?.supplier_gstin);
  html = replaceLabelValue(html, "Address", header?.company_address);
  html = replaceLabelValue(html, "Place of Supply", billingShipping?.place_of_supply);

  // Receiver details block (in meta-col 2).
  html = replaceLabelValueAfter(
    html,
    "Receiver Details",
    "Name",
    billingShipping?.receiver_name,
  );
  html = replaceLabelValueAfter(
    html,
    "Receiver Details",
    "Address",
    billingShipping?.receiver_address || projectWork?.plant_name,
  );

  html = replaceLabelValueAfter(html, "Buyer's Details", "Name", billingShipping?.buyer_name);
  html = replaceLabelValueAfter(html, "Buyer's Details", "Address", billingShipping?.buyer_address);
  html = replaceLabelValueAfter(
    html,
    "Buyer's Details",
    "State Name",
    [
      coerceText(billingShipping?.buyer_state_name),
      coerceText(billingShipping?.buyer_state_code) ? `State Code: ${coerceText(billingShipping?.buyer_state_code)}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
  html = replaceLabelValueAfter(html, "Buyer's Details", "GSTIN", billingShipping?.buyer_gstin);

  html = replaceFirst(html, /(class="ref-hd">WO No<\/div>\s*<div>)([^<]*)(<\/div>)/i, `$1${escapeHtml(coerceText(projectWork?.work_order_number))}$3`);
  html = replaceFirst(html, /(class="ref-hd">BILL NO<\/div>\s*<div>)([^<]*)(<\/div>)/i, `$1${escapeHtml(coerceText(projectWork?.bill_no))}$3`);
  html = replaceFirst(html, /(class="ref-hd">PLANT NAME<\/div>\s*<div>)([^<]*)(<\/div>)/i, `$1${escapeHtml(coerceText(projectWork?.plant_name))}$3`);

  html = applyTableBody(html, buildHiraItemRows(items));

  // Summary: invoice value in words/figure.
  html = replaceFirst(
    html,
    /(<div[^>]*>\s*Total Invoice Value\s*\(In figure\)\s*<\/div>\s*<div[^>]*>)([^<]*)(<\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_invoice_value ?? totals?.total_amount_after_tax ?? totals?.total_amount))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div[^>]*>\s*Total Invoice Value\s*\(In Words\)\s*<\/div>\s*<div[^>]*>)([^<]*)(<\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_invoice_value_words || totals?.total_invoice_value_in_words || totals?.invoice_amount_in_words))}$3`,
  );

  html = replaceFirst(
    html,
    /(<div style="font-weight:bold; margin-bottom:3px;">Total Invoice Value \(In Words\)<\/div>\s*<div>)([^<]*)(<\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_invoice_value_words || totals?.total_invoice_value_in_words || totals?.invoice_amount_in_words))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div style="font-size:14px; font-weight:bold;">₹\s*)([^<]*)(<\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_invoice_value || totals?.total_amount_after_tax))}$3`,
  );

  // Summary: right-side breakdown (labels include rate suffixes in the template).
  html = replaceFirst(
    html,
    /(<div class="arow b"><span>\s*Taxable Value\s*<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_taxable_value || totals?.total_value))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>\s*Add:\s*CGST[\s\S]*?<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_cgst || totals?.total_cgst_amount || totals?.add_cgst))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>\s*Add:\s*SGST[\s\S]*?<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_sgst || totals?.total_sgst_amount || totals?.add_sgst))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>\s*Add:\s*IGST\s*<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_igst || totals?.total_igst_amount || ""))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>\s*Add:\s*Cess\s*<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_cess || totals?.total_cess_amount || ""))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow big"><span>\s*Total Invoice Value\s*<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_invoice_value || totals?.total_amount_after_tax || totals?.total_amount))}$3`,
  );

  html = replaceFirst(
    html,
    /(<div class="arow b"><span>Total Amount before Tax<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_taxable_value || totals?.total_value))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>Add: CGST<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_cgst))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>Add: SGST<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_sgst))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>ROUND OFF<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.round_off))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow big"><span>Total Amount after Tax:<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.total_invoice_value || totals?.total_amount_after_tax))}$3`,
  );
  html = replaceFirst(
    html,
    /(<div class="arow"><span>GST on Reverse Charge<\/span><span>)([^<]*)(<\/span><\/div>)/i,
    `$1${escapeHtml(coerceText(totals?.gst_on_reverse_charge))}$3`,
  );

  // Bank/terms (best-effort: append near the bottom).
  const bankDetails = coerceText(bankDeclaration?.bank_details);
  const terms = coerceText(bankDeclaration?.terms || bankDeclaration?.terms_and_conditions);
  if (bankDetails || terms) {
    html = replaceFirst(
      html,
      /(<div class="footer">)/i,
      `${bankDetails ? `<div style="border:1.5px solid #000; border-top:none; padding:6px 8px; font-size:10px;"><strong>Bank Details:</strong> ${escapeHtml(bankDetails)}</div>\n` : ""}${terms ? `<div style="border:1.5px solid #000; border-top:none; padding:6px 8px; font-size:10px;"><strong>Terms:</strong> ${escapeHtml(terms)}</div>\n` : ""}$1`,
    );
  }

  return html;
}

export function createHtmlInvoice(template, data) {
  const t = String(template || "").toLowerCase();
  // Current field expectations:
  // - Lodha = "Buyer's Details" format (Cowtown / Eden C)
  // - Hira  = PF/ESIC/PTR/MLWF format (HGP Community)
  // Until backend naming is updated, keep template-key mapping like this:
  if (t === "lodha") return renderHiranandaniInvoiceHtml(data || {});
  if (t === "hiranandani") return renderLodhaInvoiceHtml(data || {});
  throw new Error(`Unsupported invoice template: ${template}`);
}

export function downloadInvoiceHtml(template, data, filename) {
  const html = createHtmlInvoice(template, data);
  const t = String(template || "").toLowerCase();
  const invoiceNo =
    t === "lodha" ? coerceText(data?.header?.invoice_number) : coerceText(data?.header?.invoice_number);
  const suggested = filename || `${t}-invoice${invoiceNo ? `-${invoiceNo}` : ""}.html`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggested;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function extractPrintableNodeFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  const page = doc.querySelector(".page");
  if (page) return page;
  return doc.body;
}

export async function downloadInvoicePdf(template, data, filename) {
  const html = createHtmlInvoice(template, data);
  const t = String(template || "").toLowerCase();
  const invoiceNo = coerceText(data?.header?.invoice_number);
  const suggested = filename || `${t}-invoice${invoiceNo ? `-${invoiceNo}` : ""}.pdf`;

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  const node = extractPrintableNodeFromHtml(html);
  const styleText = doc.querySelector("style")?.textContent || "";

  // Render inside an offscreen container so styles/layout apply consistently.
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.background = "#fff";
  container.style.zIndex = "-1";
  container.innerHTML = `<style>${styleText}</style>${node.outerHTML}`;
  document.body.appendChild(container);

  try {
    const target = container.querySelector(".page") || container;
    const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
    const canvas = await html2canvas(target, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      removeContainer: true,
      logging: false,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(suggested);
  } finally {
    container.remove();
  }
}
