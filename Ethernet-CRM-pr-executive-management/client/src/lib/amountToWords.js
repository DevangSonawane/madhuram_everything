// Convert a number to Indian rupee words (Indian numbering system)
// e.g. 811862.73 → "EIGHT LAKH ELEVEN THOUSAND EIGHT HUNDRED AND SIXTY THREE AND SEVENTY THREE PAISE ONLY"
export function amountToWords(amount) {
  const toNumber = (value) => {
    if (value == null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const n = toNumber(amount);
  if (n === 0) return "ZERO ONLY";

  const isNegative = n < 0;
  const abs = Math.abs(n);

  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const ONES = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const TENS = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  const twoDigits = (num) => {
    if (num <= 0) return "";
    if (num < 20) return ONES[num];
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return [TENS[tens], ONES[ones]].filter(Boolean).join(" ");
  };

  const threeDigits = (num) => {
    if (num <= 0) return "";
    const hundreds = Math.floor(num / 100);
    const rest = num % 100;
    const parts = [];
    if (hundreds) parts.push(`${ONES[hundreds]} HUNDRED`);
    if (rest) parts.push(twoDigits(rest));
    return parts.join(" AND ");
  };

  const indianNumber = (num) => {
    if (num <= 0) return "";
    const parts = [];

    const crore = Math.floor(num / 10000000);
    const afterCrore = num % 10000000;
    const lakh = Math.floor(afterCrore / 100000);
    const afterLakh = afterCrore % 100000;
    const thousand = Math.floor(afterLakh / 1000);
    const afterThousand = afterLakh % 1000;
    const hundreds = afterThousand; // 0..999

    if (crore) parts.push(`${twoDigits(crore)} CRORE`);
    if (lakh) parts.push(`${twoDigits(lakh)} LAKH`);
    if (thousand) parts.push(`${twoDigits(thousand)} THOUSAND`);
    if (hundreds) parts.push(threeDigits(hundreds));

    return parts.filter(Boolean).join(" ");
  };

  const rupeeWords = indianNumber(rupees);
  const paiseWords = paise ? indianNumber(paise) : "";

  const chunks = [];
  if (isNegative) chunks.push("MINUS");
  if (rupeeWords) chunks.push(rupeeWords);
  if (paiseWords) chunks.push("AND", paiseWords, "PAISE");
  chunks.push("ONLY");

  return chunks.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

