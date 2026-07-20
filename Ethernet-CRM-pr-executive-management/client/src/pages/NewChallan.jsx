import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/useProject";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NONE_VALUE = "__none__";
const EMPTY_ITEM = { item_no: "", name: "", description: "", width: "", length: "", quantity: "", price: "" };
const todayDateOnly = () => new Date().toISOString().slice(0, 10);
const getEmptyForm = () => ({
  challan_number: "",
  po_id: "",
  po_number: "",
  po_selection: "",
  challan_date: todayDateOnly(),
  work_order_number: "",
  order_date: todayDateOnly(),
  items: [{ ...EMPTY_ITEM }],
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeItemIdentity = (item) => {
  if (!item) return "";
  // Use description as the primary identity because `name` is used as "Make" in our UI.
  // Challan/DC items and PO items both reliably share description, while `name` can differ.
  const desc = String(item.description || "").trim().toLowerCase();
  const width = String(item.width || "").trim().toLowerCase();
  const length = String(item.length || "").trim().toLowerCase();
  return [desc, width, length].filter(Boolean).join("|");
};

const normalizeMatchText = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

const extractMakeFromRemark = (value) => {
  const t = String(value || "").trim();
  if (!t) return "";
  const m = t.match(/\bmake\s*:\s*(.+)$/i);
  return m ? String(m[1] || "").trim() : "";
};

const tokenize = (value) =>
  normalizeMatchText(value)
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter(Boolean);

const tokenOverlapScore = (a, b) => {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  let hit = 0;
  ta.forEach((t) => {
    if (setB.has(t)) hit += 1;
  });
  return hit / Math.max(ta.length, tb.length);
};

const resolveMakeFromPrItems = (prItems, poDescription) => {
  const poNorm = normalizeMatchText(poDescription);
  if (!poNorm) return "";

  const candidates = (Array.isArray(prItems) ? prItems : [])
    .map((it) => ({
      make: String(it?.make || "").trim(),
      desc: String(it?.material_description || it?.description || "").trim(),
      descNorm: normalizeMatchText(it?.material_description || it?.description || ""),
    }))
    .filter((c) => c.make && c.descNorm);

  if (candidates.length === 0) return "";

  // 1) Exact normalized match
  const exact = candidates.find((c) => c.descNorm === poNorm);
  if (exact) return exact.make;

  // 2) Substring match (common when one side has extra specs/notes)
  const longEnough = (s) => String(s || "").length >= 18;
  const byContains = candidates.find((c) => longEnough(c.descNorm) && poNorm.includes(c.descNorm));
  if (byContains) return byContains.make;
  const reverseContains = candidates.find((c) => longEnough(poNorm) && c.descNorm.includes(poNorm));
  if (reverseContains) return reverseContains.make;

  // 3) Token overlap match (fallback)
  let best = { make: "", score: 0 };
  for (const c of candidates) {
    const score = tokenOverlapScore(c.descNorm, poNorm);
    if (score > best.score) best = { make: c.make, score };
  }
  return best.score >= 0.55 ? best.make : "";
};

const getPoSelectionValue = (po) => {
  if (!po) return "";
  return po.order_no ? String(po.order_no) : `__poid__:${String(po.po_id ?? "").trim()}`;
};

const mapPoItemsForPreview = (po, { prItems = [] } = {}) => {
  if (!Array.isArray(po?.items) || po.items.length === 0) {
    return [];
  }

  return po.items.map((item) => ({
    item_no:
      String(item?.item_no || item?.itemNo || item?.boq_item_code || item?.boqItemCode || item?.item_code || item?.itemCode || "").trim() ||
      "-",
    // For PO items, show PR item's `make` in the first column.
    // If we can't resolve, fall back to PO item's make (but never fall back to description).
    name:
      resolveMakeFromPrItems(prItems, item?.description || item?.material_description || "") ||
      extractMakeFromRemark(item?.remark) ||
      String(item?.make || "").trim() ||
      "-",
    description: item?.description || item?.remarks || "",
    width: item?.width != null ? String(item.width) : "",
    length: item?.length != null ? String(item.length) : "",
    quantity: item?.quantity != null ? String(item.quantity) : (item?.qty != null ? String(item.qty) : ""),
    price: item?.price != null ? String(item.price) : (item?.rate != null ? String(item.rate) : ""),
    boq_id: item?.boq_id ?? item?.boqId ?? "",
    boq_qty: item?.boq_qty ?? item?.boqQty ?? item?.quantity ?? item?.qty ?? "",
  }));
};

const hasItemValue = (item) => {
  if (!item) return false;
  return ["item_no", "name", "description", "width", "length", "quantity", "price"].some((key) => {
    const value = item[key];
    return value != null && String(value).trim() !== "";
  });
};

export default function NewChallan() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: routeProjectId } = useParams();
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.project_id ?? selectedProject?.id ?? routeProjectId ?? null;
  const targetProjectId = projectId != null ? String(projectId) : String(routeProjectId || "");

  const [projectPos, setProjectPos] = useState([]);
  const [selectedPoItems, setSelectedPoItems] = useState([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [form, setForm] = useState(() => getEmptyForm());
  const [poItemSearch, setPoItemSearch] = useState("");

  const poItemAutocomplete = useMemo(() => {
    const names = new Set();
    const descriptions = new Set();
    (Array.isArray(selectedPoItems) ? selectedPoItems : []).forEach((it) => {
      const name = String(it?.name || "").trim();
      const desc = String(it?.description || "").trim();
      if (name && name !== "-") names.add(name);
      if (desc && desc !== "-") descriptions.add(desc);
    });
    return {
      names: Array.from(names),
      descriptions: Array.from(descriptions),
    };
  }, [selectedPoItems]);

  const resolvePoItemQty = (poItem) => {
    const raw = poItem?.quantity ?? poItem?.qty;
    const qty = Number(raw);
    return Number.isFinite(qty) ? qty : 0;
  };

  const buildPoQtyByIdentity = (items) => {
    const map = new Map();
    for (const it of Array.isArray(items) ? items : []) {
      const identity = normalizeItemIdentity(it);
      if (!identity) continue;
      const current = map.get(identity) || 0;
      map.set(identity, current + resolvePoItemQty(it));
    }
    return map;
  };

  const poQtyByIdentity = buildPoQtyByIdentity(selectedPoItems);

  const getMaxQtyForIdentity = (identity) => {
    if (!identity) return null;
    const poQty = poQtyByIdentity.get(identity);
    if (poQty == null) return null;
    return Math.max(0, poQty);
  };

  useEffect(() => {
    const wo = String(selectedProject?.wo_number || "").trim();
    if (!wo) return;
    setForm((prev) => {
      if (String(prev.work_order_number || "").trim()) return prev;
      return { ...prev, work_order_number: wo };
    });
  }, [selectedProject?.wo_number]);

  useEffect(() => {
    if (!projectId) {
      setProjectPos([]);
      return;
    }

    const loadPos = async () => {
      setLoadingPos(true);
      try {
        const poRes = await api.getPosByProject(projectId);
        if (poRes.success && Array.isArray(poRes.data)) {
          setProjectPos(poRes.data);
        } else {
          setProjectPos([]);
        }
      } catch {
        setProjectPos([]);
      } finally {
        setLoadingPos(false);
      }
    };

    loadPos();
  }, [projectId]);

  useEffect(() => {
    if (String(form.po_selection || "").trim()) return;
    const currentPoId = String(form.po_id || "").trim();
    const currentPoNumber = String(form.po_number || "").trim();
    if (!currentPoId && !currentPoNumber) return;

    const matched = projectPos.find((po) => {
      const poId = String(po?.po_id ?? "").trim();
      const poNumber = String(po?.order_no ?? "").trim();
      return (currentPoId && poId && currentPoId === poId) || (currentPoNumber && poNumber && currentPoNumber === poNumber);
    });

    if (matched) {
      setForm((prev) => ({ ...prev, po_selection: getPoSelectionValue(matched) }));
    } else if (currentPoId) {
      setForm((prev) => ({ ...prev, po_selection: `__poid__:${currentPoId}` }));
    } else if (currentPoNumber) {
      setForm((prev) => ({ ...prev, po_selection: currentPoNumber }));
    }
  }, [form.po_id, form.po_number, form.po_selection, projectPos]);

  useEffect(() => {
    const incomingDraft = location.state?.challanDraft;
    const incomingItems = location.state?.deliveryItems;
    const incomingPoItems = location.state?.selectedPoItems;

    if (incomingDraft && typeof incomingDraft === "object") {
      const nextItems = Array.isArray(incomingDraft.items) && incomingDraft.items.length > 0
        ? incomingDraft.items
        : [{ ...EMPTY_ITEM }];
      setForm({
        ...getEmptyForm(),
        ...incomingDraft,
        items: nextItems
      });
    } else if (Array.isArray(incomingItems) && incomingItems.length > 0) {
      setForm((prev) => ({ ...prev, items: incomingItems }));
    }

    if (Array.isArray(incomingPoItems)) {
      // Normalize legacy state so the "Make" column doesn't accidentally show the description.
      setSelectedPoItems(
        incomingPoItems.map((row, idx) => ({
          ...row,
          item_no: String(row?.item_no || row?.itemNo || row?.boq_item_code || row?.boqItemCode || row?.item_code || row?.itemCode || "").trim() || "-",
          name: extractMakeFromRemark(row?.remark) || row?.make || row?.name || "-",
          description: row?.description || "",
          width: row?.width || "",
          length: row?.length || "",
          quantity: row?.quantity || row?.qty || "",
          price: row?.price || row?.rate || "",
          boq_id: row?.boq_id ?? row?.boqId ?? "",
          boq_qty: row?.boq_qty ?? row?.boqQty ?? row?.quantity ?? row?.qty ?? "",
          _idx: idx,
        }))
      );
    }
  }, [location.state]);

  const selectPo = async (selected) => {
    if (!selected) {
      setForm((prev) => ({
        ...prev,
        po_id: "",
        po_number: "",
        po_selection: "",
      }));
      setSelectedPoItems([]);
      return;
    }

    const selectedPoId = selected.po_id != null ? String(selected.po_id) : "";
    const selectedPoNumber = selected.order_no ? String(selected.order_no) : (selectedPoId ? `PO-${selectedPoId}` : "");
    const selectedPoSelection = getPoSelectionValue(selected);
    setForm((prev) => ({
      ...prev,
      po_id: selectedPoId,
      po_number: selectedPoNumber,
      po_selection: selectedPoSelection,
    }));
    setSelectedPoItems(mapPoItemsForPreview(selected));

    // Best effort: fetch PR for this PO (same project) and use PR's item make in PO items.
    try {
      const indentNo = String(selected?.indent_no || selected?.indentNo || "").trim();
	      if (!projectId || !indentNo) return;
      const prRes = await api.getPrsByProject(projectId);
      const prs = prRes?.success && Array.isArray(prRes.data) ? prRes.data : [];
      const matchPr = prs.find((pr) => String(pr?.workorder_no || "").trim() === indentNo) || null;
      if (!matchPr) return;

      const prId = matchPr?.pr_id ?? matchPr?.id;
      if (!prId) return;
      const prFullRes = await api.getPrById(prId);
      const prFull = prFullRes?.success ? (prFullRes.data ?? prFullRes) : null;
      const prItems = Array.isArray(prFull?.items) ? prFull.items : [];
      setSelectedPoItems(mapPoItemsForPreview(selected, { prItems }));
    } catch {
      // ignore; fallback already shown
    }
  };

  const handlePoNumberSelect = (value) => {
    const hasChallanItems = form.items.filter(hasItemValue).length > 0;
    const currentPoId = String(form.po_id || "").trim();
    const currentPoNumber = String(form.po_number || "").trim();

    if (value === NONE_VALUE) {
      if ((currentPoId || currentPoNumber) && hasChallanItems) {
        toast({
          title: "Cannot change PO",
          description: "Clear challan items before removing or changing the PO selection.",
          variant: "destructive",
        });
        return;
      }
      selectPo(null);
      return;
    }

    const selected = value.startsWith("__poid__:")
      ? projectPos.find((po) => String(po.po_id) === value.replace("__poid__:", ""))
      : projectPos.find((po) => String(po.order_no) === String(value));

    const nextPoId = String(selected?.po_id ?? "").trim();
    const nextPoNumber = String(selected?.order_no ?? "").trim();
    const currentKey = currentPoId ? `id:${currentPoId}` : (currentPoNumber ? `no:${currentPoNumber}` : "");
    const nextKey = nextPoId ? `id:${nextPoId}` : (nextPoNumber ? `no:${nextPoNumber}` : "");

    if (currentKey && nextKey && currentKey !== nextKey && hasChallanItems) {
      toast({
        title: "Cannot change PO",
        description: "Only one PO can be used per challan. Clear challan items before selecting a different PO.",
        variant: "destructive",
      });
      return;
    }

    selectPo(selected);
  };

  const handleViewInDetail = () => {
    setDetailsOpen(true);
  };

  const updateItem = (index, field, value) => {
    if (field === "quantity" && String(form.po_id || "").trim()) {
      const identity = normalizeItemIdentity(form.items?.[index]);
      const maxQty = getMaxQtyForIdentity(identity);
      if (maxQty != null) {
        const nextQty = Number(value);
        if (Number.isFinite(nextQty) && nextQty > maxQty) {
          toast({
            title: "Quantity exceeds PO limit",
            description: `Max allowed for this PO item is ${maxQty}.`,
            variant: "destructive",
          });
          // Clamp the value so it can't exceed the remaining PO qty.
          // Keep as string to match form field shape.
          value = String(maxQty);
        }
      }
    }
    setForm((prev) => {
      const next = { ...prev, items: [...prev.items] };
      next.items[index] = { ...next.items[index], [field]: value };
      return next;
    });
  };

  const insertPoItemsToChallan = () => {
    if (selectedPoItems.length === 0) {
      toast({
        title: "Select PO",
        description: "Select a PO first to insert PO items into the challan.",
        variant: "destructive",
      });
      return;
    }

    const hasChallanItems = form.items.filter(hasItemValue).length > 0;
    if (hasChallanItems) {
      const ok = window.confirm("This will replace current challan items with PO items. Continue?");
      if (!ok) return;
    }

    const mapped = selectedPoItems.map((it) => ({
      item_no: it?.item_no || it?.itemNo || it?.boq_item_code || it?.boqItemCode || it?.item_code || it?.itemCode || "",
      name: it?.name || "",
      description: it?.description || "",
      width: it?.width || "",
      length: it?.length || "",
      quantity: it?.quantity || "",
      price: it?.price || "",
      boq_id: it?.boq_id || it?.boqId || "",
      boq_qty: it?.boq_qty || it?.boqQty || it?.quantity || "",
    }));

    setForm((prev) => ({ ...prev, items: mapped.length > 0 ? mapped : [{ ...EMPTY_ITEM }] }));
    setPoItemSearch("");
    toast({ title: "Inserted", description: `Inserted ${mapped.length} PO item(s) into challan items.` });
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  };

  const removeItem = (index) => {
    setForm((prev) => {
      const nextItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: nextItems.length > 0 ? nextItems : [{ ...EMPTY_ITEM }] };
    });
  };

  const goToChallans = () => {
    if (!targetProjectId) {
      navigate('/projects');
      return;
    }
    navigate(`/${targetProjectId}/challans`);
  };

  const handleCreate = async () => {
    if (!projectId) {
      toast({ title: "Select project", description: "Choose a project first.", variant: "destructive" });
      return;
    }
    const meaningfulItems = form.items.filter(hasItemValue);

    // Enforce PO item quantity cap: challan item qty cannot exceed remaining PO qty (PO qty - already delivered via other DCs).
    if (String(form.po_id || "").trim() && selectedPoItems.length > 0) {
      for (let i = 0; i < meaningfulItems.length; i += 1) {
        const item = meaningfulItems[i];
        const identity = normalizeItemIdentity(item);
        if (!identity) continue;
        const maxQty = getMaxQtyForIdentity(identity);
        if (maxQty == null) continue; // Not a PO-tracked item.

        const qty = toNumber(item?.quantity);
        if (qty > maxQty) {
          toast({
            title: "Quantity exceeds PO limit",
            description: `Row ${i + 1} exceeds the PO quantity limit (${maxQty}).`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const payload = {
      project_id: Number(projectId),
      challan_number: form.challan_number,
      items: form.items.map((it) => ({
        item_no: it.item_no || undefined,
        name: it.name,
        description: it.description,
        width: toNumber(it.width),
        length: toNumber(it.length),
        quantity: toNumber(it.quantity),
        price: toNumber(it.price),
        boq_id: it.boq_id || undefined,
        boq_qty: it.boq_qty != null && it.boq_qty !== "" ? toNumber(it.boq_qty) : toNumber(it.quantity),
      })),
      po_id: form.po_id ? Number(form.po_id) : undefined,
      po_number: form.po_number || undefined,
      challan_date: form.challan_date || undefined,
      work_order_number: form.work_order_number || undefined,
      order_date: form.order_date || undefined
    };

    setSaving(true);
    try {
      const res = await api.createDc(payload);
      if (res.success) {
        toast({ title: "Created", description: "Delivery challan saved." });
        goToChallans();
      } else {
        toast({ title: "Error", description: res.error || "Failed to create", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredPoItems = (() => {
    const q = String(poItemSearch || "").trim().toLowerCase();
    if (!q) return selectedPoItems;
    return selectedPoItems.filter((it) => {
      const name = String(it?.name || "").toLowerCase();
      const desc = String(it?.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  })();

  return (
    <div className="space-y-6">
      <datalist id="po-item-name-suggestions">
        {poItemAutocomplete.names.map((value) => (
          <option key={`po-name-${value}`} value={value} />
        ))}
      </datalist>
      <datalist id="po-item-desc-suggestions">
        {poItemAutocomplete.descriptions.map((value) => (
          <option key={`po-desc-${value}`} value={value} />
        ))}
      </datalist>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">New Delivery Challan</h1>
          <p className="text-muted-foreground mt-2">Select PO, review PO items (view only), then add challan items.</p>
        </div>
        <Button variant="outline" onClick={goToChallans} className="w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Challans
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Challan Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm">Challan Number</div>
              <Input className="h-11 text-base" value={form.challan_number} onChange={(e) => setForm((prev) => ({ ...prev, challan_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <div className="text-sm">PO Number</div>
              <Select
                value={
                  String(form.po_selection || "").trim()
                    ? String(form.po_selection).trim()
                    : (String(form.po_id || "").trim()
                        ? `__poid__:${String(form.po_id).trim()}`
                        : (String(form.po_number || "").trim() || NONE_VALUE))
                }
                onValueChange={handlePoNumberSelect}
              >
                <SelectTrigger className="h-11 text-base">
                  <SelectValue placeholder={loadingPos ? "Loading PO..." : "Select PO Number"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {projectPos.map((po) => (
                    <SelectItem
                      key={`${po.po_id}-${po.order_no || "no-order"}`}
                      value={getPoSelectionValue(po)}
                    >
                      {po.order_no || `PO-${po.po_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm">Challan Date</div>
              <Input className="h-11 text-base" type="date" value={form.challan_date} onChange={(e) => setForm((prev) => ({ ...prev, challan_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <div className="text-sm">Work Order Number</div>
              <Input className="h-11 text-base" value={form.work_order_number} onChange={(e) => setForm((prev) => ({ ...prev, work_order_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <div className="text-sm">Order Date</div>
              <Input className="h-11 text-base" type="date" value={form.order_date} onChange={(e) => setForm((prev) => ({ ...prev, order_date: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={form.items.filter(hasItemValue).length === 0}
          onClick={handleViewInDetail}
          className="w-full sm:w-auto"
        >
          View in Detail
        </Button>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Challan Item Details</DialogTitle>
            <DialogDescription>
              Review the items you have added before saving the challan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Added Challan Items ({form.items.filter(hasItemValue).length})</CardTitle>
              </CardHeader>
              <CardContent>
                {form.items.filter(hasItemValue).length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No challan items added yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Item No</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Width</TableHead>
                        <TableHead className="text-right">Length</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.items
                        .filter(hasItemValue)
                        .map((item, index) => (
                          <TableRow key={`challan-preview-${index}`}>
                            <TableCell className="font-mono text-xs">{item.item_no || "-"}</TableCell>
                            <TableCell className="font-medium">{item.name || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{item.width || "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{item.length || "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{item.quantity || "-"}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">PO Items (view only) ({selectedPoItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPoItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No PO selected.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Item No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Width</TableHead>
                        <TableHead className="text-right">Length</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {selectedPoItems.map((item, index) => (
                      <TableRow key={`po-preview-${index}`}>
                        <TableCell className="font-mono text-xs">{item.item_no || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.width || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.length || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>PO Items</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPoItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Select a PO to view linked PO items.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="border-b bg-muted/20 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-md">
                  <Input
                    className="h-11"
                    placeholder="Search PO items by item no or description..."
                    value={poItemSearch}
                    onChange={(e) => setPoItemSearch(e.target.value)}
                  />
                </div>
                {String(poItemSearch || "").trim() ? (
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredPoItems.length} of {selectedPoItems.length}
                  </div>
                ) : null}
              </div>
              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Item No</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Width</TableHead>
                      <TableHead className="text-right">Length</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPoItems.map((item, index) => (
                      <TableRow key={`po-item-${index}`}>
                        <TableCell className="font-mono text-xs">{item.item_no || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.width || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.length || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Challan Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={insertPoItemsToChallan}
              disabled={selectedPoItems.length === 0}
              className="w-full sm:w-auto"
              title={selectedPoItems.length === 0 ? "Select a PO to insert items" : "Insert all PO items into challan items"}
            >
              Insert PO Items
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden lg:grid lg:grid-cols-6 gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div>Item No</div>
            <div>Name</div>
            <div className="lg:col-span-2">Description</div>
            <div>Width</div>
            <div>Length</div>
            <div>Quantity</div>
          </div>
          {form.items.map((item, index) => (
            <div
              key={index}
              className={`grid grid-cols-1 gap-2 lg:grid-cols-8 ${index > 0 ? "border-t pt-3 lg:border-t-0 lg:pt-0" : ""}`}
            >
              <div className="text-xs font-medium text-muted-foreground lg:hidden">Sr.No {index + 1}</div>
              <Input
                className="h-11 text-base"
                placeholder="Item No"
                value={item.item_no}
                onChange={(e) => updateItem(index, 'item_no', e.target.value)}
              />
              <Input
                className="h-11 text-base"
                placeholder="Name"
                value={item.name}
                list={poItemAutocomplete.names.length ? "po-item-name-suggestions" : undefined}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
              />
              <Input
                className="lg:col-span-2 h-11 text-base"
                placeholder="Description"
                value={item.description}
                list={poItemAutocomplete.descriptions.length ? "po-item-desc-suggestions" : undefined}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
              />
              <Input className="h-11 text-base" placeholder="Width" value={item.width} onChange={(e) => updateItem(index, 'width', e.target.value)} />
              <Input className="h-11 text-base" placeholder="Length" value={item.length} onChange={(e) => updateItem(index, 'length', e.target.value)} />
              {(() => {
                const identity = normalizeItemIdentity(item);
                const maxQty = getMaxQtyForIdentity(identity);
                return (
                  <div className="space-y-1">
                    <Input
                      className="h-11 text-base"
                      placeholder="Quantity"
                      type="number"
                      min="0"
                      max={maxQty != null ? String(maxQty) : undefined}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    />
                    {maxQty != null ? (
                      <div className="text-xs text-muted-foreground">PO qty limit: {maxQty}</div>
                    ) : null}
                  </div>
                );
              })()}
              <Button variant="outline" size="icon" onClick={() => removeItem(index)} className="h-11 w-11">
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addItem} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={goToChallans}>Cancel</Button>
        <Button onClick={handleCreate} disabled={saving || !form.challan_number || form.items.length === 0}>
          {saving ? "Saving..." : "Save Challan"}
        </Button>
      </div>
    </div>
  );
}
