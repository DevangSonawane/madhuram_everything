import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useProject } from "@/contexts/useProject";

export default function BOQList() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id ?? selectedProject?.project_id ?? routeProjectId ?? null;

  // BOQ list has been superseded by the BOQ manage/items view.
  // Keep this route as a redirect so existing links still work.
  useEffect(() => {
    if (!projectId) return;
    navigate(`/${projectId}/boq/manage`, { replace: true });
  }, [projectId, navigate]);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Opening BOQ items…
    </div>
  );
}

