import { api } from "@/lib/api";

export const isNumericId = (value) => /^\d+$/.test(String(value || "").trim());

const normalizeProjectRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) return payload.data;
    if (payload.data && typeof payload.data === "object") {
      if (Array.isArray(payload.data.data)) return payload.data.data;
      if (Array.isArray(payload.data.rows)) return payload.data.rows;
    }
  }
  return [];
};

export async function resolveProjectNumericId(projectIdParam) {
  const raw = String(projectIdParam || "").trim();
  if (!raw) return null;
  if (isNumericId(raw)) return Number(raw);

  const res = await api.getProjects();
  if (!res?.success) return null;

  const projects = normalizeProjectRows(res.data);
  const wanted = raw.toLowerCase();

  const match = projects.find((project) => {
    const candidates = [
      project?.project_id,
      project?.id,
      project?.project_name,
      project?.name,
    ]
      .map((v) => String(v ?? "").trim().toLowerCase())
      .filter(Boolean);
    return candidates.includes(wanted);
  });

  const id = match?.project_id ?? match?.id;
  if (isNumericId(id)) return Number(id);
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

