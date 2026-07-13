import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberIN } from "@/lib/numberFormat";

export default function InventoryDetail() {
  const { id, projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [chain, setChain] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await api.getInventoryChain(id);
        if (!res.success) {
          toast({ title: "Error", description: res.error || "Failed to load inventory details.", variant: "destructive" });
          return;
        }
        setChain(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, toast]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!id) return;
      setHistoryLoading(true);
      try {
        const res = await api.getInventoryItemHistory(id);
        if (res.success && Array.isArray(res.data)) {
          setHistoryRows(res.data);
        } else {
          setHistoryRows([]);
        }
      } catch {
        setHistoryRows([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [id]);

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  };

  const formatSource = (entry = {}) => {
    const type = entry.source_type || entry.sourceType || entry.type || "";
    const ref = entry.source_ref || entry.sourceRef || "";
    const idValue = entry.source_id || entry.sourceId || entry.ref_id || "";
    if (!type && !ref && !idValue) return "-";
    return [type, ref || idValue].filter(Boolean).join(" · ");
  };

  const item = chain?.item || {};
  const summary = chain?.summary || {};
  const upstream = chain?.upstream_chain || {};
  const timeline = Array.isArray(chain?.timeline) ? chain.timeline : [];

  const breadcrumb = useMemo(() => {
    return [
      {
        label: upstream.sample?.label || "No Sample",
        path: upstream.sample?.sample_id ? `/${projectId}/samples/preview/${upstream.sample.sample_id}` : null,
        empty: !upstream.sample,
      },
      {
        label: upstream.pr?.label || "No PR",
        path: `/${projectId}/purchase-requests`,
        empty: !upstream.pr,
      },
      {
        label: upstream.po?.label || "No PO",
        path: `/${projectId}/purchase-orders`,
        empty: !upstream.po,
      },
      {
        label: upstream.dc?.label || "No DC",
        path: `/${projectId}/challans`,
        empty: !upstream.dc,
      },
    ];
  }, [upstream, projectId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{item.name || "Inventory Item"}</h1>
          <div className="text-sm text-muted-foreground">{item.brand || "-"}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">Stocked In: {summary.total_stocked_in ?? 0}</Badge>
            <Badge variant="outline">Consumed: {summary.total_consumed ?? 0}</Badge>
            <Badge variant="outline">Current Balance: {summary.current_balance ?? item.current_balance ?? 0} {item.units || ""}</Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {breadcrumb.map((step, idx) => (
              <div key={`crumb-${idx}`} className="flex items-center gap-2">
                {step.path && !step.empty ? (
                  <Link to={step.path} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                    {step.label}
                  </Link>
                ) : (
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">{step.label}</div>
                )}
                {idx < breadcrumb.length - 1 ? <span className="text-muted-foreground">→</span> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : timeline.length === 0 ? (
            <div className="text-sm text-muted-foreground">No movement history found.</div>
          ) : (
            <div className="space-y-3">
              {timeline.map((entry, idx) => (
                <div key={`timeline-${idx}`} className="flex items-start gap-3 rounded-md border p-3">
                  {entry.type === "in" ? (
                    <ArrowDownCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <ArrowUpCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{entry.label}</div>
                    <div className="text-sm">
                      Quantity: <span className="font-semibold">{formatNumberIN(entry.quantity, { maximumFractionDigits: 3 })}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Balance: {formatNumberIN(entry.balance_after, { maximumFractionDigits: 3 })} {item.units || ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-sm text-muted-foreground">Loading history...</div>
          ) : historyRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No update history found.</div>
          ) : (
            <div className="space-y-2">
              {historyRows.map((entry, idx) => (
                <div key={`history-${idx}`} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{entry.movement_type || entry.type || "-"}</Badge>
                    <span className="text-muted-foreground">{formatDateTime(entry.created_at || entry.date)}</span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">Qty:</span>{" "}
                      {formatNumberIN(entry.quantity ?? entry.qty, { maximumFractionDigits: 3 }) || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Balance:</span>{" "}
                      {formatNumberIN(entry.balance_after ?? entry.balance, { maximumFractionDigits: 3 }) || "-"}
                    </div>
                    <div><span className="text-muted-foreground">Source:</span> {formatSource(entry)}</div>
                  </div>
                  {entry.notes ? (
                    <div className="mt-2 text-muted-foreground">Notes: {entry.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
