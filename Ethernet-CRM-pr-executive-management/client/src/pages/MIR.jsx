import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BellRing, CheckCircle2, Download, Eye, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/useProject";
import { useAuth } from "@/contexts/useAuth";
import { api } from "@/lib/api";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { MIR_TEMPLATE_OPTIONS } from "@/pages/mirShared";
import { downloadMirPdf } from "@/lib/mirPdf";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export default function MIR() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();
  const { toast } = useToast();
  const { selectedProject, projects } = useProject();
  const { user } = useAuth();

  const resolveNumericProjectId = () => {
    const toIntOrNull = (value) => {
      if (value == null) return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      if (!Number.isInteger(n)) return null;
      if (n <= 0) return null;
      return n;
    };

    const routeKey = routeProjectId != null ? String(routeProjectId).trim() : '';
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
          .map((x) => String(x ?? '').trim().toLowerCase())
          .filter(Boolean);
        return keys.includes(routeKey.toLowerCase());
      });
      const fromMatch = toIntOrNull(match?.project_id ?? match?.id);
      if (fromMatch) return fromMatch;
    }

    return null;
  };

  const effectiveProjectId = resolveNumericProjectId();
  const [mirs, setMirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingMirId, setDeletingMirId] = useState(null);
  const [downloadingMirId, setDownloadingMirId] = useState(null);
  const [query, setQuery] = useState("");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [togglingMirId, setTogglingMirId] = useState(null);
  const [pendingMirChallans, setPendingMirChallans] = useState([]);

  const fetchMirs = async () => {
    try {
      setLoading(true);
      if (!effectiveProjectId) {
        setMirs([]);
        if (routeProjectId) {
          toast({
            title: "Select a project",
            description: "Could not resolve a numeric project id for MIRs.",
            variant: "destructive",
          });
        }
        return;
      }

      const result = await api.getMirsByProject(effectiveProjectId);
      if (!result.success) {
        setMirs([]);
        toast({
          title: "Failed to load MIRs",
          description: result.error || "Could not fetch MIR list.",
          variant: "destructive",
        });
        return;
      }
      setMirs(Array.isArray(result.data) ? result.data : []);
    } catch {
      setMirs([]);
      toast({
        title: "Failed to load MIRs",
        description: "Could not fetch MIR list.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingMirChallans = async () => {
    try {
      if (!effectiveProjectId) {
        setPendingMirChallans([]);
        return;
      }
      const [dcsRes, mirRes] = await Promise.all([
        api.getDcsByProject(effectiveProjectId),
        api.getMirsByProject(effectiveProjectId),
      ]);
      const dcsRows = dcsRes.success && Array.isArray(dcsRes.data) ? dcsRes.data : [];
      const mirRows = mirRes.success && Array.isArray(mirRes.data) ? mirRes.data : [];
      const used = new Set();
      mirRows.forEach((row) => {
        const challanNo = row?.challan_no || "";
        if (challanNo) used.add(String(challanNo).trim());
      });
      setPendingMirChallans(dcsRows.filter((dc) => dc?.challan_number && !used.has(String(dc.challan_number).trim())));
    } catch {
      setPendingMirChallans([]);
    }
  };

  useEffect(() => {
    fetchMirs();
    fetchPendingMirChallans();
  }, [effectiveProjectId, routeProjectId, toast]);

  const filteredMirs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mirs;
    return mirs.filter((item) => {
      const mirNo = (item.mir_refrence_no || "").toLowerCase();
      const projectName = (item.project_name || "").toLowerCase();
      const materialCode = (item.material_code || "").toLowerCase();
      const contractor = (item.contractor || "").toLowerCase();
      return (
        mirNo.includes(normalized) ||
        projectName.includes(normalized) ||
        materialCode.includes(normalized) ||
        contractor.includes(normalized)
      );
    });
  }, [mirs, query]);

  const handleEdit = (mirId) => {
    if (!mirId) return;
    navigate(`${mirId}/edit`);
  };

  const handlePreview = (mirId) => {
    if (!mirId) return;
    navigate(`${mirId}/preview`);
  };

  const handleCreateTemplate = (templateType) => {
    if (!templateType) return;
    setIsTemplateDialogOpen(false);
    navigate(`create?template=${encodeURIComponent(templateType)}`);
  };

  const requestDelete = (mirRow) => {
    const mirId = mirRow?.mir_id ?? mirRow?.id;
    if (!mirId) return;
    setDeleteTarget({
      mirId,
      mirNo: mirRow?.mir_refrence_no ?? "",
      challanNo: mirRow?.challan_no ?? "",
    });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    const mirId = deleteTarget?.mirId;
    if (!mirId) return;
    try {
      setDeletingMirId(mirId);
      const result = await api.deleteMir(mirId);
      if (!result.success) {
        toast({
          title: "Failed to delete MIR",
          description: result.error || "Could not delete MIR.",
          variant: "destructive",
        });
        return;
      }
      await fetchMirs();
    } catch {
      toast({
        title: "Failed to delete MIR",
        description: "Could not delete MIR.",
        variant: "destructive",
      });
    } finally {
      setDeletingMirId(null);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleDownload = async (mirRow) => {
    const id = mirRow?.mir_id;
    if (!id) return;
    try {
      setDownloadingMirId(id);
      const hasDynamicField = Object.prototype.hasOwnProperty.call(mirRow || {}, "dynamic_field");
      const rowToUse = hasDynamicField ? mirRow : (await api.getMirById(id))?.data;
      if (!rowToUse) {
        toast({
          title: "Download failed",
          description: "Could not load MIR details.",
          variant: "destructive",
        });
        return;
      }
      await downloadMirPdf(rowToUse, { fileName: `mir-${rowToUse.mir_refrence_no || id}.pdf` });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not generate MIR PDF.",
        variant: "destructive",
      });
    } finally {
      setDownloadingMirId(null);
    }
  };

  const handleToggleSubmitted = async (mirRow) => {
    const id = mirRow?.mir_id;
    if (!id) return;
    try {
      setTogglingMirId(id);
      const result = await api.toggleMirSubmitted(id, {
        user_id: user?.user_id ?? user?.id ?? user?.uid ?? "",
        user_name: user?.name ?? user?.username ?? user?.full_name ?? user?.fullName ?? user?.email ?? "",
      });
      if (!result.success) {
        toast({
          title: "Failed to update MIR",
          description: result.error || "Could not toggle MIR submitted status.",
          variant: "destructive",
        });
        return;
      }
      await fetchMirs();
      toast({
        title: "MIR updated",
        description: `MIR marked as ${result.data?.mir_submited ? "submitted" : "draft"}.`,
      });
    } catch {
      toast({
        title: "Failed to update MIR",
        description: "Could not toggle MIR submitted status.",
        variant: "destructive",
      });
    } finally {
      setTogglingMirId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create MIR</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create and manage material inspection reports.
            </p>
          </div>
          <Button onClick={() => setIsTemplateDialogOpen(true)} className="w-full lg:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Create MIR
          </Button>
        </div>
      </section>

      <Card className="border-amber-200 bg-amber-50/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-600" />
              MIR Pending Notification
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              These delivery challans are still waiting for an MIR.
            </p>
          </div>
          <Badge variant="secondary">{pendingMirChallans.length} pending</Badge>
        </CardHeader>
        <CardContent>
          {pendingMirChallans.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pendingMirChallans.slice(0, 8).map((dc) => (
                <Badge
                  key={dc.dc_id || dc.challan_number}
                  variant="outline"
                  className="cursor-pointer border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                  onClick={() => navigate(`/${effectiveProjectId}/mir/create?challan=${encodeURIComponent(dc.challan_number || "")}`)}
                >
                  {dc.challan_number || `DC ${dc.dc_id}`}
                </Badge>
              ))}
              {pendingMirChallans.length > 8 ? (
                <Badge variant="outline" className="border-amber-300 bg-white text-amber-800">
                  +{pendingMirChallans.length - 8} more
                </Badge>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">All challans have MIRs created.</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <CardTitle className="text-lg">MIR List</CardTitle>
          <CardDescription>All MIR entries for the selected scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Search by MIR no, project, material, contractor..."
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>MIR No</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Inspection Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading MIRs...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredMirs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    No MIR records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMirs.map((item) => (
                  <TableRow key={item.mir_id}>
                    <TableCell className="font-medium">{item.mir_refrence_no || `MIR-${item.mir_id}`}</TableCell>
                    <TableCell>{item.project_name || "-"}</TableCell>
                    <TableCell>{item.material_code || "-"}</TableCell>
                    <TableCell>{formatDate(item.inspection_date_time || item.client_submission_date || item.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={item.mir_submited ? "default" : "secondary"}>
                        {item.mir_submited ? "Submitted" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex justify-end">
                        <RowActionsMenu
                          items={[
                            { key: "preview", label: "Preview", icon: Eye, onSelect: () => handlePreview(item.mir_id) },
                            { key: "edit", label: "Edit", icon: Pencil, onSelect: () => handleEdit(item.mir_id) },
                            { type: "separator" },
                            {
                              key: "toggle-submitted",
                              label: togglingMirId === item.mir_id
                                ? "Updating..."
                                : item.mir_submited
                                  ? "Mark as Draft"
                                  : "Mark as Submitted",
                              icon: CheckCircle2,
                              disabled: togglingMirId === item.mir_id,
                              onSelect: () => handleToggleSubmitted(item),
                            },
                            {
                              key: "download",
                              label: downloadingMirId === item.mir_id ? "Downloading..." : "Download",
                              icon: Download,
                              disabled: downloadingMirId === item.mir_id,
                              onSelect: () => handleDownload(item),
                            },
                            { type: "separator" },
                            {
                              key: "delete",
                              label: deletingMirId === item.mir_id ? "Deleting..." : "Delete",
                              icon: Trash2,
                              destructive: true,
                              disabled: deletingMirId === item.mir_id,
                              onSelect: () => requestDelete(item),
                            },
                          ]}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Select MIR Format</DialogTitle>
            <DialogDescription>
              Choose the client format before creating the MIR.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {MIR_TEMPLATE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleCreateTemplate(option.value)}
                className="rounded-lg border border-border p-4 text-left transition hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="text-base font-semibold">{option.label}</div>
                <div className="mt-2 text-sm text-muted-foreground">{option.description}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete MIR?</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
              {deleteTarget?.mirNo ? ` MIR No: ${deleteTarget.mirNo}.` : ""}
              {deleteTarget?.challanNo ? ` Challan: ${deleteTarget.challanNo}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingMirId === deleteTarget?.mirId}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirmed}
              disabled={deletingMirId === deleteTarget?.mirId}
            >
              {deletingMirId === deleteTarget?.mirId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
