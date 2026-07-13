import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumberIN } from "@/lib/numberFormat";

const normalizeKey = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const toNumber = (value) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const num = toNumber(value);
  if (!Number.isFinite(num)) return "";
  if (num % 1 === 0) return formatNumberIN(num, { maximumFractionDigits: 0 });
  return formatNumberIN(num, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const parseFormattedNumber = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replace(/,/g, "");
};

const prettyLabel = (value) =>
  String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getColumnKey = (columns, target) =>
  columns.find((col) => normalizeKey(col) === normalizeKey(target));

const buildOrderedColumns = (columns) => {
  const order = [
    "item_no",
    "item_no.",
    "itemnos",
    "item_code",
    "description",
    "unit",
    "quantity",
    "rate",
    "amount",
    "basic_rate",
    "discount",
    "final_rate_after_discount",
    "fittings",
    "transportation",
    "support",
    "miscellaneous",
    "total_material_price",
    "labour",
    "material_plus_labour",
    "profit",
    "total_rate",
  ];

  const picked = [];
  order.forEach((key) => {
    const col = columns.find((c) => normalizeKey(c) === normalizeKey(key));
    if (col && !picked.includes(col)) picked.push(col);
  });

  columns.forEach((c) => {
    if (!picked.includes(c)) picked.push(c);
  });
  return picked;
};

const metricCatalog = [
  { key: "amount", label: "Amount" },
  { key: "total_rate", label: "Total Rate" },
  { key: "basic_rate", label: "Basic Rate" },
  { key: "rate", label: "Rate" },
  { key: "quantity", label: "Quantity" },
  { key: "profit", label: "Profit" },
  { key: "material_plus_labour", label: "Material + Labour" },
  { key: "labour", label: "Labour" },
  { key: "total_material_price", label: "Total Material Price" },
  { key: "discount", label: "Discount (%)" },
  { key: "fittings", label: "Fittings (%)" },
  { key: "transportation", label: "Transportation (%)" },
  { key: "support", label: "Support (%)" },
  { key: "miscellaneous", label: "Miscellaneous (%)" },
  { key: "final_rate_after_discount", label: "Final Rate After Discount" },
];

const isNumericColumn = (columnName) => {
  const k = normalizeKey(columnName);
  const numericKeys = new Set([
    "quantity",
    "rate",
    "amount",
    "basicrate",
    "discount",
    "finalrateafterdiscount",
    "fittings",
    "transportation",
    "support",
    "miscellaneous",
    "totalmaterialprice",
    "labour",
    "materialpluslabour",
    "profit",
    "totalrate",
  ]);
  if (numericKeys.has(k)) return true;
  if (k.includes("qty") || k.includes("quantity")) return true;
  if (k.includes("rate") || k.includes("amount") || k.includes("price") || k.includes("total")) return true;
  if (k.includes("discount") || k.includes("profit")) return true;
  return false;
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="min-w-[260px] rounded-lg border bg-popover p-3 text-sm shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{row.__unit || ""}</div>
      </div>
      {row.__description ? (
        <div className="mt-1 line-clamp-3 text-xs text-muted-foreground">{row.__description}</div>
      ) : null}
      <div className="mt-3 space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              <span className="text-xs text-muted-foreground">{prettyLabel(p.name || p.dataKey)}</span>
            </div>
            <span className="font-semibold text-foreground">
              {formatNumberIN(p.value, { maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuoteLineItemsChart({
  items,
  columns,
  mode = "view", // "view" | "edit"
  selectedIndex: controlledSelectedIndex,
  onSelectedIndexChange,
  onCellChange,
  onAddRow,
  onRemoveRow,
  className = "",
}) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const safeColumns = useMemo(() => (Array.isArray(columns) ? columns : []), [columns]);

  const [metric, setMetric] = useState(() => "amount");
  const [search, setSearch] = useState("");
  const [localSelectedIndex, setLocalSelectedIndex] = useState(0);

  const selectedIndexRaw =
    typeof controlledSelectedIndex === "number" ? controlledSelectedIndex : localSelectedIndex;
  const setSelectedIndex = (next) => {
    const bounded = Math.max(0, Math.min(safeItems.length - 1, next));
    if (onSelectedIndexChange) onSelectedIndexChange(bounded);
    if (controlledSelectedIndex == null) setLocalSelectedIndex(bounded);
  };
  const selectedIndex = Math.max(0, Math.min(safeItems.length - 1, selectedIndexRaw));

  const metricOptions = useMemo(() => {
    const available = metricCatalog.filter((m) => getColumnKey(safeColumns, m.key));
    if (available.length === 0) {
      const fallback = safeColumns.filter((c) => {
        const k = normalizeKey(c);
        return k.includes("amount") || k.includes("rate") || k.includes("qty") || k.includes("quantity");
      });
      return fallback.map((c) => ({ key: c, label: prettyLabel(c), _direct: true }));
    }
    return available;
  }, [safeColumns]);

  const effectiveMetric = metricOptions.some((m) => m.key === metric)
    ? metric
    : metricOptions[0]?.key;

  const resolvedMetricKey = useMemo(() => {
    const entry = metricOptions.find((m) => m.key === effectiveMetric) || metricOptions[0];
    if (!entry) return null;
    if (entry._direct) return entry.key;
    return getColumnKey(safeColumns, entry.key);
  }, [effectiveMetric, metricOptions, safeColumns]);

  const labelColumn =
    getColumnKey(safeColumns, "item_no") ||
    getColumnKey(safeColumns, "item_code") ||
    getColumnKey(safeColumns, "item") ||
    safeColumns[0];
  const descriptionColumn =
    safeColumns.find((c) => normalizeKey(c).includes("description")) ||
    getColumnKey(safeColumns, "description");
  const unitColumn = getColumnKey(safeColumns, "unit");

  const filteredIndexes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return safeItems.map((_, idx) => idx);
    return safeItems
      .map((row, idx) => {
        const label = String(labelColumn ? row?.[labelColumn] : idx + 1);
        const desc = String(descriptionColumn ? row?.[descriptionColumn] : "");
        const unit = String(unitColumn ? row?.[unitColumn] : "");
        const hay = `${label} ${desc} ${unit}`.toLowerCase();
        return hay.includes(q) ? idx : -1;
      })
      .filter((idx) => idx >= 0);
  }, [descriptionColumn, labelColumn, safeItems, search, unitColumn]);

  const chartData = useMemo(() => {
    const mk = resolvedMetricKey;
    if (!mk) return [];
    return filteredIndexes.map((idx) => {
      const row = safeItems[idx] || {};
      const labelRaw = labelColumn ? row?.[labelColumn] : idx + 1;
      const label = String(labelRaw ?? idx + 1).trim() || String(idx + 1);
      return {
        __idx: idx,
        __label: label,
        __description: descriptionColumn ? String(row?.[descriptionColumn] ?? "") : "",
        __unit: unitColumn ? String(row?.[unitColumn] ?? "") : "",
        value: toNumber(row?.[mk]),
      };
    });
  }, [descriptionColumn, filteredIndexes, labelColumn, resolvedMetricKey, safeItems, unitColumn]);

  const selectedRow = safeItems[selectedIndex] || null;
  const orderedColumns = useMemo(() => buildOrderedColumns(safeColumns), [safeColumns]);

  const metricLabel = useMemo(() => {
    const entry = metricOptions.find((m) => m.key === effectiveMetric) || metricOptions[0];
    return entry?.label || "Value";
  }, [effectiveMetric, metricOptions]);

  const chartHeight = Math.min(1200, Math.max(360, chartData.length * 32 + 120));

  return (
    <Card className={`overflow-hidden border-border/60 bg-gradient-to-b from-background to-muted/30 ${className}`}>
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Line Items</div>
          <div className="text-xs text-muted-foreground">
            Chart updates live on upload and edit.
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="w-full sm:w-[220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
            />
          </div>
          <div className="w-full sm:w-[220px]">
            <Select value={effectiveMetric ?? ""} onValueChange={setMetric}>
              <SelectTrigger>
                <SelectValue placeholder="Metric" />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === "edit" ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onAddRow} disabled={!onAddRow}>
                Add
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => onRemoveRow?.(selectedIndex)}
                disabled={!onRemoveRow || safeItems.length === 0}
              >
                Remove
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              {metricLabel} by item
            </div>
            <div className="text-xs text-muted-foreground">
              Showing {chartData.length} of {safeItems.length}
            </div>
          </div>
          <ScrollArea className="max-h-[70vh]">
            <div style={{ height: chartHeight, minHeight: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                  barCategoryGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => formatNumberIN(v, { maximumFractionDigits: 0 })}
                  />
                  <YAxis
                    type="category"
                    dataKey="__label"
                    width={84}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="value"
                    name={metricLabel}
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 6, 6]}
                    onClick={(data) => {
                      const idx = data?.payload?.__idx ?? data?.__idx;
                      if (idx != null) setSelectedIndex(Number(idx));
                    }}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.__idx}
                        fill={
                          entry.__idx === selectedIndex
                            ? "hsl(var(--primary))"
                            : "hsl(var(--primary) / 0.35)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ScrollArea>
      </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Item Details</div>
              <div className="text-xs text-muted-foreground">
                {safeItems.length === 0 ? "No items." : `Item ${selectedIndex + 1} of ${safeItems.length}`}
              </div>
            </div>
            {safeItems.length > 0 ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIndex(selectedIndex - 1)}
                  disabled={selectedIndex <= 0}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIndex(selectedIndex + 1)}
                  disabled={selectedIndex >= safeItems.length - 1}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>

          {selectedRow ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">Quick Jump</div>
                </div>
                <Select
                  value={String(selectedIndex)}
                  onValueChange={(v) => setSelectedIndex(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredIndexes.map((idx) => {
                      const row = safeItems[idx] || {};
                      const labelRaw = labelColumn ? row?.[labelColumn] : idx + 1;
                      const label = String(labelRaw ?? idx + 1).trim() || String(idx + 1);
                      const desc = descriptionColumn ? String(row?.[descriptionColumn] ?? "") : "";
                      return (
                        <SelectItem key={idx} value={String(idx)}>
                          {label}{desc ? ` — ${desc.slice(0, 36)}${desc.length > 36 ? "…" : ""}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3">
                {orderedColumns.map((col) => {
                  const isDescription = normalizeKey(col).includes("description");
                  const value = selectedRow?.[col] ?? "";
                  const numeric = isNumericColumn(col);
                  const disabled =
                    mode !== "edit" ||
                    normalizeKey(col) === normalizeKey("final_rate_after_discount");
                  const onChangeValue = (next) => onCellChange?.(selectedIndex, col, next);
                  return (
                    <div key={col} className="rounded-lg border border-border/60 bg-background/60 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-muted-foreground">{prettyLabel(col)}</div>
                        {disabled && mode === "edit" && normalizeKey(col) === normalizeKey("final_rate_after_discount") ? (
                          <div className="text-[11px] text-muted-foreground">Auto</div>
                        ) : null}
                      </div>
                      {isDescription ? (
                        <Textarea
                          value={String(value)}
                          onChange={(e) => onChangeValue(e.target.value)}
                          disabled={disabled}
                          className="min-h-[88px]"
                        />
                      ) : (
                        <Input
                          value={numeric ? formatNumber(value) : String(value)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (!numeric) {
                              onChangeValue(raw);
                              return;
                            }
                            onChangeValue(parseFormattedNumber(raw));
                          }}
                          disabled={disabled}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-6 text-sm text-muted-foreground">Select an item to see details.</div>
          )}
        </div>
      </div>
    </Card>
  );
}
