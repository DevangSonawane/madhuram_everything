import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useProject } from "@/contexts/useProject";
import { slugify } from "@/lib/utils";

export function useResolvedProject() {
  const { projectId: projectSlug } = useParams();
  const { projects, selectedProject } = useProject();

  return useMemo(() => {
    const key = String(projectSlug || "").trim();
    if (!key) return { projectSlug: "", projectId: "", project: null };

    const pool = Array.isArray(projects) ? projects : [];
    const selected = selectedProject || null;
    if (selected?.slug && selected.slug === key) {
      return { projectSlug: key, projectId: String(selected.id || selected.project_id || ""), project: selected };
    }

    const isNumeric = /^\d+$/.test(key);
    const match = pool.find((p) => {
      const id = String(p?.id || p?.project_id || "").trim();
      if (isNumeric && id === key) return true;
      const slug = String(p?.slug || slugify(p?.name || p?.project_name || "")).trim();
      return slug === key;
    }) || null;

    const resolved = match || selected;
    return {
      projectSlug: key,
      projectId: resolved ? String(resolved.id || resolved.project_id || "") : "",
      project: resolved || null,
    };
  }, [projectSlug, projects, selectedProject]);
}
