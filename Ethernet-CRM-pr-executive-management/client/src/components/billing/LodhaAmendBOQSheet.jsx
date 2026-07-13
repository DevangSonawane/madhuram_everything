import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrencyINR } from "@/lib/numberFormat";
import { useToast } from "@/hooks/use-toast";

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

export default function LodhaAmendBOQSheet({ projectId, boqMaster, onImported, readonly }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const rows = Array.isArray(boqMaster) ? boqMaster : [];
  const computedAmount = (row) => toNumber(row?.wo_qty) * toNumber(row?.rate);
  const total = rows.reduce((sum, r) => sum + computedAmount(r), 0);

  const handlePick = () => inputRef.current?.click?.();

  const handleFile = async (file) => {
    if (!projectId) {
      toast({ title: "Missing project", description: "Open a project first.", variant: "destructive" });
      return;
    }
    if (!(file instanceof File)) return;
    setImporting(true);
    try {
      // Prefer dedicated Lodha parser endpoint; fall back to generic parser if needed.
      const res = await api.parseBoqPdfLodha({ boq_file: file, project_id: projectId, save: true });
      if (!res?.success) {
        const fallback = await api.parseBoqPdf({ boq_file: file, project_id: projectId, save: true, client: "lodha" });
        if (!fallback?.success) throw new Error(fallback?.error || res?.error || "Import failed");
      }
      const fetchRes = await api.getBoqItemsForProject(projectId);
      if (!fetchRes?.success) throw new Error(fetchRes?.error || "Failed to refresh BOQ items");
      const items = Array.isArray(fetchRes?.data?.items) ? fetchRes.data.items : [];
      const normalized = items.map((row, index) => ({
        item_no: row?.item_no ?? row?.item_code ?? String(index + 1),
        section: row?.section ?? row?.category ?? "",
        description: row?.description ?? "",
        uom: row?.unit ?? row?.uom ?? "",
        wo_qty: toNumber(row?.qty ?? row?.quantity ?? row?.order_qty ?? 0),
        rate: toNumber(row?.rate ?? row?.unit_rate ?? row?.unit_price ?? row?.unitPrice ?? row?.price ?? 0),
        amount: toNumber(row?.amount ?? row?.value ?? 0),
      }));
      onImported(normalized);
      toast({ title: "Imported", description: `BOQ imported (${normalized.length} items).` });
    } catch (e) {
      toast({ title: "Import failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          This is the amended BOQ rate master (read-only).
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button variant="outline" onClick={handlePick} disabled={readonly || importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import BOQ (PDF)
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[900px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] whitespace-nowrap">Sr.No</TableHead>
              <TableHead className="w-[520px]">Description</TableHead>
              <TableHead className="w-[140px] whitespace-nowrap text-right">Current WO Qty</TableHead>
              <TableHead className="w-[90px] whitespace-nowrap text-center">UOM</TableHead>
              <TableHead className="w-[140px] whitespace-nowrap text-right">Rate/UOM</TableHead>
              <TableHead className="w-[160px] whitespace-nowrap text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No BOQ items found for this project. Import the work order BOQ PDF.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow key={`${row.item_no}-${idx}`}>
                  <TableCell className="font-medium whitespace-nowrap">{row.item_no || idx + 1}</TableCell>
                  <TableCell className="truncate">{row.description || "-"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{toNumber(row.wo_qty).toFixed(2)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap">{row.uom || "-"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrencyINR(toNumber(row.rate))}</TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrencyINR(computedAmount(row))}</TableCell>
                </TableRow>
              ))
            )}
            {rows.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-right font-semibold">Total WO Value (ex-GST)</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrencyINR(total)}</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
