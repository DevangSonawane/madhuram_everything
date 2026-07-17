const EMPTY_CONTACT = {
  name: "",
  phone: "",
};

const todayDateOnly = () => new Date().toISOString().slice(0, 10);

export const sanitizeTextInput = (value) => String(value ?? "");

export const sanitizePhoneInput = (value, maxLength = 15) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, maxLength);

export const sanitizeNumberInput = (value, { allowDecimal = true } = {}) => {
  const raw = String(value ?? "");
  if (!raw) return "";

  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!allowDecimal) {
    return cleaned.replace(/\./g, "");
  }

  const [integerPart = "", ...decimalParts] = cleaned.split(".");
  if (decimalParts.length === 0) return integerPart;
  return `${integerPart}.${decimalParts.join("")}`;
};

export const EMPTY_PO = {
  title: "Purchase Order",
  sampleId: "",
  companyName: "",
  companySubtitle: "",
  site_address: "",
  companyAddress: "",
  companyEmail: "",
  companyGstNo: "",
  source: "Manual",
  sourceFileName: "",
  indentNo: "",
  indentDate: todayDateOnly(),
  orderNo: "",
  poDate: todayDateOnly(),
  vendor: {
    name: "",
    site: "",
    siteAddress: "",
    contacts: {
      primary: { ...EMPTY_CONTACT },
      secondary: { ...EMPTY_CONTACT },
    },
  },
  itemsGroup: {
    title: "",
    description: "",
  },
  items: [],
  subtotalAmount: "",
  discount: {
    percent: "",
    amount: "",
  },
  afterDiscountAmount: "",
  taxes: {
    cgst: {
      percent: "",
      amount: "",
    },
    sgst: {
      percent: "",
      amount: "",
    },
  },
  totalAmount: "",
  summary: {
    discountPercent: "",
    tax: "",
    delivery: "",
    payment: "",
  },
  notes: [],
  termsAndConditions: [],
  authorisedSignatory: "",
  status: "created",
};

const parseStringList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeDateString = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY or DD-MM-YYYY
  const dayFirstMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return raw;
};

const buildVendorSection = (overrides = {}) => {
  const contactsOverrides = overrides.contacts || {};
  return {
    ...EMPTY_PO.vendor,
    ...overrides,
    contacts: {
      ...EMPTY_PO.vendor.contacts,
      ...contactsOverrides,
      primary: { ...EMPTY_PO.vendor.contacts.primary, ...contactsOverrides.primary },
      secondary: { ...EMPTY_PO.vendor.contacts.secondary, ...contactsOverrides.secondary },
    },
  };
};

const mapClientToPoData = (raw) => ({
  ...EMPTY_PO,
  ...raw,
  sampleId: raw.sampleId != null ? String(raw.sampleId) : (raw.sample_id != null ? String(raw.sample_id) : EMPTY_PO.sampleId),
  site_address: raw.site_address || raw.siteAddress || raw.vendor?.siteAddress || EMPTY_PO.site_address,
  vendor: buildVendorSection(raw.vendor),
  itemsGroup: { ...EMPTY_PO.itemsGroup, ...raw.itemsGroup },
  items: Array.isArray(raw.items) ? raw.items : [],
  discount: { ...EMPTY_PO.discount, ...raw.discount },
  afterDiscountAmount: raw.afterDiscountAmount ?? raw.after_discount ?? EMPTY_PO.afterDiscountAmount,
  taxes: {
    cgst: { ...EMPTY_PO.taxes.cgst, ...raw.taxes?.cgst },
    sgst: { ...EMPTY_PO.taxes.sgst, ...raw.taxes?.sgst },
  },
  summary: { ...EMPTY_PO.summary, ...raw.summary },
  notes: Array.isArray(raw.notes) ? raw.notes : [],
  termsAndConditions: Array.isArray(raw.termsAndConditions) ? raw.termsAndConditions : [],
  source: raw.source || EMPTY_PO.source,
  status: raw.status || EMPTY_PO.status,
  sourceFileName: raw.sourceFileName || raw.source_file_name || EMPTY_PO.sourceFileName,
  indentDate: normalizeDateString(raw.indentDate ?? raw.indent_date ?? EMPTY_PO.indentDate),
  poDate: normalizeDateString(raw.poDate ?? raw.po_date ?? EMPTY_PO.poDate),
});

const mapServerItemsToUi = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    srNo: item.srno != null ? String(item.srno) : item.srNo || String(index + 1),
    hsnCode: item.hsn || item.hsnCode || "",
    item_name: item.item_name || item.itemName || item.material_description || item.item_description || item.description || "",
    description: item.description || item.material_description || item.item_description || item.item_name || item.itemName || "",
    qty: item.qty != null ? String(item.qty) : item.qty || "",
    uom: item.UOM || item.uom || "",
    rate: item.Rate != null ? String(item.Rate) : item.rate || "",
    amount: item.Amount != null ? String(item.Amount) : item.amount || "",
    remarks: item.remark || item.remarks || "",
    boq_id: item.boq_id ?? item.boqId ?? "",
    boq_qty: item.boq_qty ?? item.boqQty ?? item.qty ?? item.quantity ?? "",
    boq_item_code: item.boq_item_code ?? item.boqItemCode ?? item.item_code ?? item.itemCode ?? item.code ?? item.item_name ?? item.itemName ?? "",
  }));
};

const mapServerToPoData = (raw) => {
  const notes = parseStringList(raw.notes);
  return {
    ...EMPTY_PO,
    ...raw,
    po_id: raw.po_id,
    project_id: raw.project_id,
    sampleId: raw.sample_id != null ? String(raw.sample_id) : (raw.sampleId ?? EMPTY_PO.sampleId),
    companyName: raw.company_name || raw.companyName || EMPTY_PO.companyName,
    companySubtitle: raw.company_subtitle || raw.companySubtitle || EMPTY_PO.companySubtitle,
    companyEmail: raw.company_email || raw.companyEmail || EMPTY_PO.companyEmail,
    companyGstNo: raw.company_gst || raw.companyGstNo || EMPTY_PO.companyGstNo,
    indentNo: raw.indent_no || raw.indentNo || EMPTY_PO.indentNo,
    indentDate: normalizeDateString(raw.indent_date || raw.indentDate || EMPTY_PO.indentDate),
    orderNo: raw.order_no || raw.orderNo || EMPTY_PO.orderNo,
    poDate: normalizeDateString(raw.po_date || raw.poDate || EMPTY_PO.poDate),
    site_address: raw.site_address || raw.siteAddress || raw.vendor_address || EMPTY_PO.site_address,
    source: raw.source || "Imported",
    sourceFileName: raw.sourceFileName || raw.source_file_name || EMPTY_PO.sourceFileName,
    itemsGroup: { ...EMPTY_PO.itemsGroup, ...raw.itemsGroup },
    vendor: buildVendorSection({
      name: raw.vendor_name,
      site: raw.site,
      siteAddress: raw.site_address ?? raw.siteAddress ?? raw.vendor_address,
      contacts: {
        primary: {
          name: raw.primary_contact_name,
          phone: raw.primary_contact_number,
        },
        secondary: {
          name: raw.secondary_contact_name,
          phone: raw.secondary_contact_number,
        },
      },
    }),
    items: mapServerItemsToUi(raw.items),
    subtotalAmount: raw.subtotal_amount || raw.subtotalAmount || EMPTY_PO.subtotalAmount,
    discount: {
      percent: raw.discount != null ? String(raw.discount) : EMPTY_PO.discount.percent,
      amount: raw.discount_amount != null ? String(raw.discount_amount) : EMPTY_PO.discount.amount,
    },
    afterDiscountAmount: raw.after_discount != null ? String(raw.after_discount) : EMPTY_PO.afterDiscountAmount,
    taxes: {
      cgst: {
        percent: raw.cgst != null ? String(raw.cgst) : EMPTY_PO.taxes.cgst.percent,
        amount: raw.cgst_amount != null ? String(raw.cgst_amount) : EMPTY_PO.taxes.cgst.amount,
      },
      sgst: {
        percent: raw.sgst != null ? String(raw.sgst) : EMPTY_PO.taxes.sgst.percent,
        amount: raw.sgst_amount != null ? String(raw.sgst_amount) : EMPTY_PO.taxes.sgst.amount,
      },
    },
    totalAmount: raw.total_amount != null ? String(raw.total_amount) : EMPTY_PO.totalAmount,
    summary: {
      ...EMPTY_PO.summary,
      delivery: raw.delivery || EMPTY_PO.summary.delivery,
      payment: raw.payment || EMPTY_PO.summary.payment,
      discountPercent: raw.discount != null ? String(raw.discount) : EMPTY_PO.summary.discountPercent,
      tax: raw.summary?.tax || EMPTY_PO.summary.tax,
    },
    notes,
    termsAndConditions: Array.isArray(raw.termsAndConditions) ? raw.termsAndConditions : [],
    authorisedSignatory: raw.authorisedSignatory || raw.authorised_signatory || EMPTY_PO.authorisedSignatory,
    status: raw.status || "created",
  };
};

export const normalizePoData = (raw) => {
  if (!raw) return EMPTY_PO;
  const hasServerFields = Boolean(raw.company_name || raw.po_id || raw.vendor_name);
  return hasServerFields ? mapServerToPoData(raw) : mapClientToPoData(raw);
};
