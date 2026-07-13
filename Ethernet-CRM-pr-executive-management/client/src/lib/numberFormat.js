const LOCALE = "en-IN";

const toFiniteNumber = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const formatNumberIN = (value, options = {}) => {
  const n = toFiniteNumber(value);
  if (n == null) return value == null ? "" : String(value);
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
  } = options;
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits, maximumFractionDigits }).format(n);
};

export const formatCurrencyINR = (value, options = {}) => {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;
  const formatted = formatNumberIN(value, { minimumFractionDigits, maximumFractionDigits });
  return formatted ? `₹${formatted}` : "₹0";
};
