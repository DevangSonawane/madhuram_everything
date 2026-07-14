export const syncSampleBoqQuantities = async (api, projectId) => {
  const pid = String(projectId || "").trim();
  if (!pid) return { success: false, error: "Missing project id" };
  // BOQ quantity should stay fixed at upload time. We keep the sample/BOQ link
  // in sync elsewhere and derive used/remaining from the linked sample rows.
  return { success: true, data: { updated: 0, failed: 0, unmatched: 0, skipped: true } };
};
