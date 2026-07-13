import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const toText = (value) => (value == null ? "" : String(value).trim());

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const toId = (row) => row?.mir_id ?? row?.id ?? row?._id ?? row?.mirId;

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeKey = (value) => toText(value).toLowerCase();

const extractMirItems = (mir) => {
  const candidates = [
    mir?.items,
    mir?.material_rows,
    mir?.materialRows,
    mir?.item_description,
    mir?.itemDescriptions,
    mir?.line_items,
    mir?.lineItems,
  ];

  for (const candidate of candidates) {
    const list = parseList(candidate);
    if (list.length > 0) return list;
  }

  return [];
};

const resolveMirQuantity = (item) => {
  const candidates = [
    item?.boq_qty,
    item?.boqQty,
    item?.qty,
    item?.quantity,
    item?.issued_qty,
    item?.issuedQty,
    item?.total_qty,
    item?.totalQty,
  ];

  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (Number.isFinite(value) && value !== 0) return value;
  }

  return 0;
};

const resolveMirBoqId = (item) => {
  const candidates = [
    item?.boq_id,
    item?.boqId,
    item?.boq_code,
    item?.boqCode,
    item?.item_code,
    item?.itemCode,
    item?.hsn,
    item?.hsn_code,
    item?.hsnCode,
  ];

  for (const candidate of candidates) {
    const text = toText(candidate);
    if (text) return text;
  }

  return "";
};

const resolveMirRef = (mir) => toText(mir?.mir_refrence_no || mir?.mir_reference_no || mir?.reference_no || `MIR-${toId(mir) || "-"}`);

const resolveBoiqIdentity = (row) => {
  const itemNo = normalizeKey(row?.item_no ?? row?.itemNo ?? row?.boq_id ?? row?.boqId ?? row?.item_code ?? row?.itemCode);
  const description = normalizeKey(row?.description);
  return { itemNo, description };
};

export default function LodhaMirSummarySheet({ formData, mirs, boqMaster }) {
  const linkedIds = useMemo(() => new Set((formData?.linked_mir_ids || []).map(String)), [formData?.linked_mir_ids]);
  const mirList = useMemo(() => (Array.isArray(mirs) ? mirs : []), [mirs]);
  const boqList = useMemo(() => (Array.isArray(boqMaster) ? boqMaster : []), [boqMaster]);

  const summaryMirs = useMemo(() => {
    if (linkedIds.size === 0) return mirList;
    return mirList.filter((mir) => linkedIds.has(String(toId(mir))));
  }, [linkedIds, mirList]);

  const mirStats = useMemo(() => {
    return summaryMirs.map((mir) => {
      const items = extractMirItems(mir);
      const totalQty = items.reduce((sum, item) => sum + resolveMirQuantity(item), 0);
      return {
        id: toId(mir),
        ref: resolveMirRef(mir),
        challan: toText(mir?.challan_no || mir?.challanNo || "-"),
        date: toText(mir?.inspection_date_time || mir?.client_submission_date || mir?.created_at || "-"),
        qty: totalQty,
        itemCount: items.length,
        status: toText(mir?.mir_submited ? "Submitted" : "Draft"),
      };
    });
  }, [summaryMirs]);

  const boqSummaries = useMemo(() => {
    const lookupMap = new Map();
    const baseRows = [];

    boqList.forEach((row, index) => {
      const itemNo = toText(row?.item_no ?? row?.itemNo ?? row?.boq_id ?? row?.boqId ?? `BOQ-${index + 1}`);
      const description = toText(row?.description ?? row?.item_description ?? row?.itemDescription ?? "");
      const key = itemNo || normalizeKey(description) || `row-${index}`;
      const stats = {
        key,
        srNo: row?.sr_no ?? row?.srNo ?? index + 1,
        itemNo,
        description: description || "-",
        woQty: toNumber(row?.wo_qty ?? row?.qty ?? row?.quantity ?? row?.order_qty ?? 0),
        uom: toText(row?.uom ?? row?.unit ?? ""),
        mirQty: 0,
        linkedMirs: new Set(),
        matchCount: 0,
        unresolvedQty: 0,
      };
      baseRows.push(stats);
      lookupMap.set(key, stats);
      if (normalizeKey(itemNo)) lookupMap.set(`item:${normalizeKey(itemNo)}`, stats);
      if (normalizeKey(description)) lookupMap.set(`desc:${normalizeKey(description)}`, stats);
    });

    const rowByIdentity = new Map();
    boqList.forEach((row, index) => {
      const { itemNo, description } = resolveBoiqIdentity(row);
      const key = itemNo || normalizeKey(description) || `row-${index}`;
      const stats = lookupMap.get(key) || null;
      if (itemNo) rowByIdentity.set(`item:${itemNo}`, stats);
      if (description) rowByIdentity.set(`desc:${description}`, stats);
      const descriptionFallback = normalizeKey(row?.description ?? "");
      if (descriptionFallback) rowByIdentity.set(`fallback:${descriptionFallback}`, stats);
    });

    const unmatched = [];

    summaryMirs.forEach((mir) => {
      const mirRef = resolveMirRef(mir);
      extractMirItems(mir).forEach((item) => {
        const mirQty = resolveMirQuantity(item);
        if (!mirQty) return;

        const boqId = resolveMirBoqId(item);
        const itemDescription = normalizeKey(item?.description ?? item?.material_description ?? item?.name ?? item?.item_name ?? "");
        const resolvedRow =
          (boqId ? rowByIdentity.get(`item:${normalizeKey(boqId)}`) : null) ||
          (itemDescription ? rowByIdentity.get(`desc:${itemDescription}`) || rowByIdentity.get(`fallback:${itemDescription}`) : null);

        if (!resolvedRow) {
          unmatched.push({
            mirRef,
            qty: mirQty,
            boqId: boqId || "-",
            description: toText(item?.description ?? item?.name ?? item?.item_name ?? "-"),
          });
          return;
        }

        resolvedRow.mirQty += mirQty;
        resolvedRow.matchCount += 1;
        resolvedRow.linkedMirs.add(mirRef);
      });
    });

    const rows = baseRows.map((row) => ({
      ...row,
      linkedMirs: Array.from(row.linkedMirs),
      balanceQty: row.woQty - row.mirQty,
    }));

    const totals = rows.reduce(
      (acc, row) => ({
        woQty: acc.woQty + row.woQty,
        mirQty: acc.mirQty + row.mirQty,
        balanceQty: acc.balanceQty + row.balanceQty,
      }),
      { woQty: 0, mirQty: 0, balanceQty: 0 }
    );

    return { rows, totals, unmatched };
  }, [boqList, summaryMirs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>MIR Summary</CardTitle>
              <CardDescription>
                BOQ-level MIR quantities derived from boq_id and boq_qty on each MIR item. If no MIR is linked yet, this shows the project MIR list.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{summaryMirs.length} MIR(s)</Badge>
              <Badge variant="outline">{boqSummaries.rows.length} BOQ row(s)</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">WO Qty</div>
              <div className="mt-1 text-lg font-semibold">{boqSummaries.totals.woQty.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">MIR Qty</div>
              <div className="mt-1 text-lg font-semibold">{boqSummaries.totals.mirQty.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Balance Qty</div>
              <div className="mt-1 text-lg font-semibold">{boqSummaries.totals.balanceQty.toFixed(2)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Linked MIRs</div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">MIR No</TableHead>
                    <TableHead className="w-[160px]">Challan No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[120px] text-right">Item Count</TableHead>
                    <TableHead className="w-[120px] text-right">Total Qty</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mirStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                        No MIRs available for this project.
                      </TableCell>
                    </TableRow>
                  ) : (
                    mirStats.map((mir) => (
                      <TableRow key={String(mir.id ?? mir.ref)}>
                        <TableCell className="font-medium">{mir.ref}</TableCell>
                        <TableCell>{mir.challan || "-"}</TableCell>
                        <TableCell>{mir.date || "-"}</TableCell>
                        <TableCell className="text-right">{mir.itemCount}</TableCell>
                        <TableCell className="text-right font-medium">{mir.qty.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={mir.status === "Submitted" ? "default" : "secondary"}>{mir.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Sr No</TableHead>
                  <TableHead className="w-[160px]">BOQ No</TableHead>
                  <TableHead className="min-w-[260px]">Description</TableHead>
                  <TableHead className="w-[120px] text-right">WO Qty</TableHead>
                  <TableHead className="w-[120px] text-right">MIR Qty</TableHead>
                  <TableHead className="w-[120px] text-right">Balance</TableHead>
                  <TableHead className="min-w-[220px]">Linked MIRs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boqSummaries.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No BOQ rows available for MIR summary.
                    </TableCell>
                  </TableRow>
                ) : (
                  boqSummaries.rows.map((row) => {
                    const isNegative = row.balanceQty < 0;
                    return (
                      <TableRow key={row.key}>
                        <TableCell>{row.srNo}</TableCell>
                        <TableCell className="font-medium text-primary">{row.itemNo || "-"}</TableCell>
                        <TableCell>
                          <div className="font-medium">{row.description}</div>
                          <div className="text-xs text-muted-foreground">{row.uom || ""}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{row.woQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">{row.mirQty.toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-medium ${isNegative ? "text-red-600" : ""}`}>
                          {row.balanceQty.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {row.linkedMirs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.linkedMirs.slice(0, 4).map((mirRef) => (
                                <Badge key={mirRef} variant="secondary" className="max-w-full truncate">
                                  {mirRef}
                                </Badge>
                              ))}
                              {row.linkedMirs.length > 4 ? (
                                <Badge variant="outline">+{row.linkedMirs.length - 4} more</Badge>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No linked MIRs</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {boqSummaries.unmatched.length > 0 ? (
            <div className="rounded-lg border border-dashed p-4">
              <div className="mb-2 text-sm font-medium">Unmatched MIR items</div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {boqSummaries.unmatched.slice(0, 6).map((item, index) => (
                  <div key={`${item.mirRef}-${index}`} className="flex flex-wrap gap-2">
                    <span className="font-medium text-foreground">{item.mirRef}</span>
                    <span>{item.description}</span>
                    <span>Qty: {item.qty.toFixed(2)}</span>
                    <span>BOQ: {item.boqId}</span>
                  </div>
                ))}
                {boqSummaries.unmatched.length > 6 ? (
                  <div>And {boqSummaries.unmatched.length - 6} more unmatched item(s).</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
