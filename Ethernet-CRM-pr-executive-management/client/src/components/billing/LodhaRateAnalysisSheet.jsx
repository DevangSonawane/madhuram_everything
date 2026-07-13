import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyINR } from "@/lib/numberFormat";

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

export default function LodhaRateAnalysisSheet({ formData, boqMaster, onChange, readonly }) {
  const rows = Array.isArray(boqMaster) ? boqMaster : [];
  const overrides = formData?.rate_analysis?.overrides || {};
  const fpPercent = toNumber(formData?.rate_analysis?.fp_percent ?? 0);

  const computed = useMemo(() => {
    let totalVariation = 0;
    const out = rows.map((row) => {
      const key = String(row?.item_no ?? "");
      const basicRate = toNumber(row?.rate);
      const defaultCpt = basicRate * (1 - fpPercent / 100);
      const cpt = overrides?.[key]?.cpt_rate != null ? toNumber(overrides[key].cpt_rate) : defaultCpt;
      const deliveredQty = overrides?.[key]?.delivered_qty != null ? toNumber(overrides[key].delivered_qty) : 0;
      const variation = (cpt - defaultCpt) * deliveredQty;
      totalVariation += variation;
      return { key, ...row, basicRate, defaultCpt, cpt, deliveredQty, variation };
    });
    return { rows: out, totalVariation };
  }, [fpPercent, overrides, rows]);

  const setOverride = (key, patch) => {
    onChange({
      rate_analysis: {
        ...(formData?.rate_analysis || {}),
        fp_percent: fpPercent,
        overrides: {
          ...(overrides || {}),
          [key]: {
            ...(overrides?.[key] || {}),
            ...patch,
          },
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          Variation is computed as <span className="font-medium text-foreground">(CPT - (Basic × (1 - FP%))) × Delivered Qty</span>.
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">FP%</div>
          <Input
            className="h-8 w-24 text-right"
            value={String(formData?.rate_analysis?.fp_percent ?? "")}
            disabled={readonly}
            onChange={(e) =>
              onChange({
                rate_analysis: {
                  ...(formData?.rate_analysis || {}),
                  fp_percent: e.target.value,
                  overrides: overrides || {},
                },
              })
            }
            placeholder="0"
          />
          <Button
            variant="outline"
            disabled={readonly}
            onClick={() => onChange({ rate_analysis: { fp_percent: fpPercent, overrides: {} } })}
          >
            Reset CPT
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead>BOQ No</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">WO Qty</TableHead>
              <TableHead className="text-right">Basic Rate</TableHead>
              <TableHead className="text-right min-w-[160px]">CPT Rate</TableHead>
              <TableHead className="text-right min-w-[160px]">Delivered Qty</TableHead>
              <TableHead className="text-right">Variation (Vm)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {computed.rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.item_no}</TableCell>
                <TableCell className="min-w-[420px]">{r.description || "-"}</TableCell>
                <TableCell className="text-right">{toNumber(r.wo_qty).toFixed(2)}</TableCell>
                <TableCell className="text-right">{formatCurrencyINR(r.basicRate)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <Input
                      className="h-8 w-[140px] min-w-[140px] text-right"
                      value={String(overrides?.[r.key]?.cpt_rate ?? "")}
                      disabled={readonly}
                      onChange={(e) => setOverride(r.key, { cpt_rate: e.target.value })}
                      placeholder={String(r.defaultCpt.toFixed(2))}
                      inputMode="decimal"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <Input
                      className="h-8 w-[140px] min-w-[140px] text-right"
                      value={String(overrides?.[r.key]?.delivered_qty ?? "")}
                      disabled={readonly}
                      onChange={(e) => setOverride(r.key, { delivered_qty: e.target.value })}
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">{formatCurrencyINR(r.variation)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={6} className="text-right font-semibold">Total variation</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrencyINR(computed.totalVariation)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
