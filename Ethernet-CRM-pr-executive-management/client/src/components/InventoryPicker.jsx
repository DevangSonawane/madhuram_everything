import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Search, X } from "lucide-react";

const buildSourceChainLabel = (chain) => {
  if (!chain) return "";
  const pickLabel = (node, prefix) => {
    if (!node) return null;
    const label = node.label || node.challan_number || node.order_no || node.project || node.building_name;
    return label ? `${prefix}: ${label}` : null;
  };
  const parts = [
    pickLabel(chain.dc, "DC"),
    pickLabel(chain.po, "PO"),
    pickLabel(chain.pr, "PR"),
    pickLabel(chain.sample, "Sample"),
  ].filter(Boolean);
  return parts.join(" \u2190 ");
};

const toNumberOrZero = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizePickerItem = (raw, { preferTraceFields = false } = {}) => {
  if (!raw) return null;
  const inventory_id = raw.inventory_id ?? raw.id ?? raw.inventoryId ?? null;
  if (inventory_id == null || inventory_id === "") return null;

  const units = raw.units || raw.unit || "";
  const available_qty = preferTraceFields
    ? toNumberOrZero(raw.available_qty ?? raw.current_balance ?? raw.current_quantity ?? raw.quantity ?? raw.qty)
    : toNumberOrZero(raw.current_balance ?? raw.current_quantity ?? raw.quantity ?? raw.available_qty ?? raw.qty);

  const source_chain_label =
    raw.source_chain_label ||
    raw.sourceChainLabel ||
    (raw.upstream_chain ? buildSourceChainLabel(raw.upstream_chain) : "");

  return {
    inventory_id,
    name: raw.name || raw.material_description || raw.description || "",
    brand: raw.brand || "",
    units,
    available_qty,
    source_chain_label,
  };
};

export default function InventoryPicker({
  project_id,
  initialValue = "",
  selectedId,
  onSelect,
  onClear,
  disabled,
  minQty = 0,
  onValidityChange,
}) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const timerRef = useRef(null);
  const requestSeqRef = useRef(0);
  const lastValidityRef = useRef(null);

  const requestedQty = toNumberOrZero(minQty);
  const availableQty = toNumberOrZero(selected?.available_qty);
  const isQtyValid = !selected || requestedQty <= availableQty || requestedQty <= 0;

  useEffect(() => {
    if (!onValidityChange) return;
    const next = {
      valid: isQtyValid,
      requestedQty,
      availableQty,
      inventory_id: selected?.inventory_id ?? null,
    };

    const prev = lastValidityRef.current;
    if (
      prev &&
      prev.valid === next.valid &&
      prev.requestedQty === next.requestedQty &&
      prev.availableQty === next.availableQty &&
      prev.inventory_id === next.inventory_id
    ) {
      return;
    }

    lastValidityRef.current = next;
    onValidityChange(next);
  }, [isQtyValid, requestedQty, availableQty, selected?.inventory_id]);

  const search = useCallback(
    async (q) => {
      if (!q || q.length < 2) {
        setResults([]);
        setOpen(false);
        setError("");
        return;
      }
      const requestSeq = ++requestSeqRef.current;
      setLoading(true);
      setError("");

      const trimmed = String(q).trim();
      const minQtyNumber = toNumberOrZero(minQty);

      const traceRes = await api.searchInventoryTrace({ q: trimmed, project_id, min_qty: minQtyNumber });
      if (requestSeqRef.current !== requestSeq) return;

      const traceList = Array.isArray(traceRes.data) ? traceRes.data : [];
      const normalizedTrace = traceList.map((it) => normalizePickerItem(it, { preferTraceFields: true })).filter(Boolean);
      if (traceRes.success && normalizedTrace.length > 0) {
        setResults(normalizedTrace);
        setOpen(true);
        setLoading(false);
        return;
      }

      // Fallback: some deployments don't return inventory-trace search results for all items.
      const invRes = await api.searchInventories({ q: trimmed, project_id });
      if (requestSeqRef.current !== requestSeq) return;

      const invList = Array.isArray(invRes.data) ? invRes.data : [];
      let normalizedInv = invList.map((it) => normalizePickerItem(it)).filter(Boolean);
      if (minQtyNumber > 0) {
        normalizedInv = normalizedInv.filter((it) => toNumberOrZero(it.available_qty) >= minQtyNumber);
      }

      if (invRes.success && normalizedInv.length > 0) {
        setResults(normalizedInv);
        setOpen(true);
        setLoading(false);
        return;
      }

      const message = traceRes.success
        ? ""
        : traceRes.error || invRes.error || "Search failed. Please try again.";
      setError(message);
      setResults([]);
      setOpen(true);
      setLoading(false);
    },
    [project_id, minQty]
  );

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      requestSeqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadSelected = async () => {
      if (!selectedId) {
        if (mounted) setSelected(null);
        return;
      }
      const res = await api.getInventoryChain(selectedId);
      if (!mounted) return;
      if (!res.success || !res.data) return;
      const item = res.data.item || {};
      const summary = res.data.summary || {};
      const source_chain_label = buildSourceChainLabel(res.data.upstream_chain);
      setSelected({
        inventory_id: item.inventory_id || selectedId,
        name: item.name || "",
        brand: item.brand || "",
        units: item.units || "",
        available_qty: summary.current_balance ?? item.current_balance ?? 0,
        source_chain_label,
      });
    };
    loadSelected();
    return () => {
      mounted = false;
    };
  }, [selectedId]);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setError("");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 300);
  };

  const handlePick = (item) => {
    setSelected(item);
    setOpen(false);
    setQuery("");
    onSelect?.(item);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    onClear?.();
  };

  if (selected) {
    return (
      <div className="flex flex-col gap-1">
        <div
          className={[
            "flex items-center gap-2 p-2 border rounded-md",
            isQtyValid ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300",
          ].join(" ")}
        >
          <CheckCircle2 className={["h-4 w-4 shrink-0", isQtyValid ? "text-green-600" : "text-red-600"].join(" ")} />
          <span className="text-sm font-medium flex-1">
            {selected.name} - {selected.available_qty} {selected.units} available
          </span>
          {!disabled ? (
            <button type="button" onClick={handleClear}>
              <X className="h-4 w-4 text-gray-400" />
            </button>
          ) : null}
        </div>
        {!isQtyValid ? (
          <span className="text-xs text-destructive pl-2">
            Requested qty {requestedQty} exceeds available {availableQty}.
          </span>
        ) : null}
        {selected.source_chain_label ? (
          <span className="text-xs text-muted-foreground pl-2">{selected.source_chain_label}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search inventory..."
          value={query}
          onChange={handleChange}
          disabled={disabled}
        />
        {loading ? <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>
      {open && results.length > 0 ? (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.inventory_id}
              type="button"
              className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-0"
              onClick={() => handlePick(item)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{item.name}</span>
                <Badge variant="outline">{item.available_qty} {item.units}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.brand}</div>
              {item.source_chain_label ? (
                <div className="text-xs text-blue-600 mt-0.5">{item.source_chain_label}</div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {open && error && !loading ? (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-sm p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {open && results.length === 0 && !loading && !error ? (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-sm p-3 text-sm text-muted-foreground">
          No inventory items found for this search.
        </div>
      ) : null}
    </div>
  );
}
