const toTrimmed = (value) => String(value ?? "").replace(/\u00A0/g, " ").trim();

const stripLeadingListMarker = (value) =>
  toTrimmed(value).replace(/^(?:\(?\s*[a-z]\s*\)?[\.\)\-:]|\(\s*\d+\s*\)|\d+[\.\)\-:])\s+/i, "");

const normalizeForPrMatch = (value) =>
  stripLeadingListMarker(value)
    .toLowerCase()
    .replace(/['"()]/g, "")
    .replace(/\s+/g, " ")
    .replace(/(\d+)\s*mm/g, "$1mm")
    .replace(/(\d+)\s*x\s*(\d+)/gi, "$1x$2")
    .replace(/\bdeg\.?/gi, "deg")
    .trim();

const normalizeForCodeMatch = (value) =>
  stripLeadingListMarker(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const getPrItemDescription = (item) =>
  stripLeadingListMarker(
    item?.material_description ??
      item?.item_description ??
      item?.description ??
      item?.item_name ??
      item?.itemName ??
      item?.name ??
      item?.make ??
      ""
  );

const getPrCodeCandidates = (item) => {
  const values = [
    item?.hsn_code,
    item?.hsnCode,
    item?.hsn,
    item?.boq_item_code,
    item?.boqItemCode,
    item?.item_code,
    item?.itemCode,
    item?.code,
  ];
  return values.map(normalizeForCodeMatch).filter(Boolean);
};

const matchAgainstPrItems = (parsedItem, prItems) => {
  const parsedDescription = String(
    parsedItem?.item_description ??
      parsedItem?.itemDescription ??
      parsedItem?.description ??
      parsedItem?.material_description ??
      parsedItem?.item_name ??
      parsedItem?.itemName ??
      parsedItem?.name ??
      ""
  ).trim();
  const parsedHsn = normalizeForCodeMatch(
    parsedItem?.hsn_code ??
      parsedItem?.hsnCode ??
      parsedItem?.hsn ??
      parsedItem?.boq_item_code ??
      parsedItem?.boqItemCode ??
      ""
  );
  const parsedItemCode = normalizeForCodeMatch(
    parsedItem?.item_code ??
      parsedItem?.itemCode ??
      parsedItem?.code ??
      parsedItem?.boq_item_code ??
      parsedItem?.boqItemCode ??
      ""
  );
  const parsedLower = parsedDescription.toLowerCase();
  const parsedNorm = normalizeForPrMatch(parsedDescription);
  if (!parsedNorm) {
    return { matchStatus: "unmatched", matchedPrItem: null, matchScore: 0, matchType: null };
  }
  const candidates = Array.isArray(prItems) ? prItems : [];

  const exact = candidates.find((pr) => getPrItemDescription(pr).toLowerCase() === parsedLower) || null;
  if (exact) {
    return { matchStatus: "matched", matchedPrItem: exact, matchScore: 1, matchType: "exact" };
  }

  const normalized = candidates.find((pr) => normalizeForPrMatch(getPrItemDescription(pr)) === parsedNorm) || null;
  if (normalized) {
    return { matchStatus: "matched", matchedPrItem: normalized, matchScore: 1, matchType: "normalized" };
  }

  if (parsedHsn) {
    const hsnMatch = candidates.find((pr) => getPrCodeCandidates(pr).includes(parsedHsn)) || null;
    if (hsnMatch) {
      return { matchStatus: "matched", matchedPrItem: hsnMatch, matchScore: 1, matchType: "hsn" };
    }
  }

  if (parsedItemCode) {
    const itemCodeMatch = candidates.find((pr) => getPrCodeCandidates(pr).includes(parsedItemCode)) || null;
    if (itemCodeMatch) {
      return { matchStatus: "matched", matchedPrItem: itemCodeMatch, matchScore: 1, matchType: "item_code" };
    }
  }

  return { matchStatus: "unmatched", matchedPrItem: null, matchScore: 0, matchType: null };
};

export { getPrItemDescription, matchAgainstPrItems, normalizeForPrMatch, normalizeForCodeMatch };
