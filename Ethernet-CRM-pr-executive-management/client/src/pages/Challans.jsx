import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Loader2, Trash2, Truck, Search, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { useProject } from "@/contexts/useProject";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/useAuth";
import { api } from "@/lib/api";

const formatDisplayDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
};

export default function Challans() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dcs, setDcs] = useState([]);
  const [usedChallanNos, setUsedChallanNos] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingDcId, setDeletingDcId] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const { user } = useAuth();
  const projectId = selectedProject?.project_id ?? selectedProject?.id ?? null;

  const parseDynamicField = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const getDynamicValue = (dynamicField, key) => {
    if (!Array.isArray(dynamicField)) return null;
    const entry = dynamicField.find((item) => item?.key === key);
    if (!entry) return null;
    const raw = entry.value;
    if (typeof raw !== "string") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const loadChallans = useCallback(async () => {
    if (!projectId) {
      setDcs([]);
      setUsedChallanNos(new Set());
      return;
    }

    setLoading(true);
    try {
      const [dcsRes, mirRes] = await Promise.all([
        api.getDcsByProject(projectId),
        api.getMirsByProject(projectId),
      ]);
      const dcsRows = dcsRes.success && Array.isArray(dcsRes.data) ? dcsRes.data : [];
      const mirRows = mirRes.success && Array.isArray(mirRes.data) ? mirRes.data : [];
      const used = new Set();
      mirRows.forEach((row) => {
        const dynamicField = parseDynamicField(row?.dynamic_field);
        const dynamicChallanNo = getDynamicValue(dynamicField, "challan_no");
        const challanNo = row?.challan_no || dynamicChallanNo;
        if (challanNo) used.add(String(challanNo).trim());
      });
      setDcs(dcsRows);
      setUsedChallanNos(used);
    } catch {
      setDcs([]);
      setUsedChallanNos(new Set());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadChallans();
  }, [loadChallans]);

  const pendingCount = useMemo(() => dcs.filter((x) => x.status === "incomplete").length, [dcs]);
  const verifiedCount = useMemo(() => dcs.filter((x) => x.status === "completed").length, [dcs]);
  const totalCount = useMemo(() => dcs.length, [dcs]);

  const isChallanUsed = (challanNo) => {
    if (!challanNo) return false;
    return usedChallanNos.has(String(challanNo).trim());
  };

  const getUserAuditPayload = () => ({
    user_id: user?.user_id ?? user?.id ?? user?.uid ?? "",
    user_name: user?.name ?? user?.username ?? user?.full_name ?? user?.fullName ?? user?.email ?? "",
  });

  const openDeleteDialog = (dc) => {
    if (!dc?.dc_id) return;
    setDeleteTarget(dc);
  };

  const handleDeleteConfirmed = async () => {
    const dcId = deleteTarget?.dc_id;
    if (!dcId) return;
    try {
      setDeletingDcId(dcId);
      const result = await api.deleteDc(dcId, getUserAuditPayload());
      if (!result.success) {
        toast({
          title: "Failed to delete delivery challan",
          description: result.error || "Could not delete delivery challan.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Delivery challan deleted",
        description: `Challan ${deleteTarget?.challan_number || dcId} was deleted successfully.`,
      });
      setDeleteTarget(null);
      await loadChallans();
    } catch {
      toast({
        title: "Failed to delete delivery challan",
        description: "Could not delete delivery challan.",
        variant: "destructive",
      });
    } finally {
      setDeletingDcId(null);
    }
  };

  const filteredDcs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return dcs;
    return dcs.filter((x) => {
      const challanNumber = x.challan_number || '';
      const poNumber = x.po_number || '';
      return challanNumber.toLowerCase().includes(term) || poNumber.toLowerCase().includes(term);
    });
  }, [dcs, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Delivery Challans</h1>
          <p className="text-muted-foreground mt-2">Create and track delivery challans.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => navigate('new')}>
          <Truck className="mr-2 h-4 w-4" /> Record New Delivery
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verifiedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 space-y-0">
          <CardTitle>Challan History</CardTitle>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search challan no, PO no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm w-full"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Challan No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>PO No</TableHead>
                  <TableHead className="text-right">Counts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MIR</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDcs.map((dc) => (
                  <TableRow key={dc.dc_id}>
                    <TableCell className="font-medium">{dc.challan_number}</TableCell>
                    <TableCell>{formatDisplayDate(dc.challan_date || dc.order_date || dc.created_at)}</TableCell>
                    <TableCell className="text-xs font-mono">{dc.po_number || dc.po_id || ''}</TableCell>
                    <TableCell className="text-right">
                      {(dc.total_po_items ?? '—')} / {dc.total_challan_items ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dc.status === "completed" ? "default" : "secondary"}>
                        {dc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isChallanUsed(dc.challan_number) ? (
                        <Badge variant="secondary">MIR Created</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(`/${projectId}/mir/create?challan=${encodeURIComponent(dc.challan_number || "")}`)
                          }
                          disabled={!dc.challan_number}
                        >
                          Create MIR
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex justify-end">
                        <RowActionsMenu
                          items={[
                            {
                              key: `view-${dc.dc_id}`,
                              label: "View",
                              icon: Eye,
                              onSelect: () =>
                                navigate(`/${projectId}/challans/detail?dc_id=${encodeURIComponent(String(dc.dc_id || ""))}`, {
                                  state: { dc_id: dc.dc_id, returnPath: `/${projectId}/challans`, readOnly: true },
                                }),
                            },
                            {
                              key: `delete-${dc.dc_id}`,
                              label: "Delete",
                              icon: Trash2,
                              destructive: true,
                              onSelect: () => openDeleteDialog(dc),
                            },
                          ]}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredDcs.map((dc) => (
              <Card key={dc.dc_id} className="border shadow-none">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{dc.challan_number}</div>
                      <div className="text-xs text-muted-foreground">{formatDisplayDate(dc.challan_date || dc.order_date || dc.created_at)}</div>
                    </div>
                    <Badge variant={dc.status === "completed" ? "default" : "secondary"}>
                      {dc.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">PO Ref</div>
                      <div className="font-mono text-xs">{dc.po_number || dc.po_id || ''}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Items</div>
                      <div className="truncate">{Array.isArray(dc.items) ? dc.items.map((it) => it.name).filter(Boolean).join(', ') : ''}</div>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <RowActionsMenu
                      items={[
                        {
                          key: `view-${dc.dc_id}`,
                          label: "View",
                          icon: Eye,
                          onSelect: () =>
                            navigate(`/${projectId}/challans/detail?dc_id=${encodeURIComponent(String(dc.dc_id || ""))}`, {
                              state: { dc_id: dc.dc_id, returnPath: `/${projectId}/challans`, readOnly: true },
                            }),
                        },
                        {
                          key: `delete-${dc.dc_id}`,
                          label: "Delete",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => openDeleteDialog(dc),
                        },
                      ]}
                    />
                    {isChallanUsed(dc.challan_number) ? (
                      <Badge variant="secondary">MIR Created</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`/${projectId}/mir/create?challan=${encodeURIComponent(dc.challan_number || "")}`)
                        }
                        disabled={!dc.challan_number}
                      >
                        Create MIR
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!loading && filteredDcs.length === 0 ? (
            <div className="text-sm text-muted-foreground mt-4">No delivery challans found.</div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Delivery Challan</DialogTitle>
            <DialogDescription>
              This will permanently delete {deleteTarget?.challan_number ? `challan ${deleteTarget.challan_number}` : "this challan"}.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingDcId)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed} disabled={Boolean(deletingDcId) || !deleteTarget?.dc_id}>
              {deletingDcId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
