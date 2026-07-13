import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const EMPTY_ITEM = { name: "", description: "", width: "", length: "", quantity: "", price: "" };

const hasItemValue = (item) => {
  if (!item) return false;
  return ["name", "description", "width", "length", "quantity", "price"].some((key) => {
    const value = item[key];
    return value != null && String(value).trim() !== "";
  });
};

const mapPoItemToHalfDelivery = (item, index) => {
  const parsedQty = Number(item?.quantity);
  return {
    name: item?.name || item?.description || `Item ${index + 1}`,
    description: item?.description || "",
    width: item?.width || "",
    length: item?.length || "",
    quantity: Number.isFinite(parsedQty) ? String(parsedQty / 2) : "",
    price: item?.price || ""
  };
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

const mapPoItemsToHalfDelivery = (poItems) => {
  if (!Array.isArray(poItems) || poItems.length === 0) return [{ ...EMPTY_ITEM }];
  return poItems.map((item, index) => mapPoItemToHalfDelivery(item, index));
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapPoItemsForRemaining = (poItems) => {
  if (!Array.isArray(poItems) || poItems.length === 0) return [];
  return poItems.map((item, index) => ({
    // PO item `name` can be empty; use remark make as "name" for display but keep description stable.
    name: (() => {
      const makeFromRemark = String(item?.remark || "").match(/\bmake\s*:\s*(.+)$/i);
      const make = String(item?.make || "").trim() || (makeFromRemark ? String(makeFromRemark[1] || "").trim() : "");
      return make || `Item ${index + 1}`;
    })(),
    description: item?.description || item?.material_description || item?.remarks || "",
    width: item?.width != null ? String(item.width) : "",
    length: item?.length != null ? String(item.length) : "",
    quantity: toNumber(item?.quantity ?? item?.qty ?? 0),
    price: item?.price ?? item?.rate ?? "",
  }));
};

const clampNonNegative = (value) => {
  const num = toNumber(value);
  return num < 0 ? 0 : num;
};

export default function ChallanItemDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const dcId = useMemo(() => {
    const fromState = location.state?.dc_id || location.state?.dc?.dc_id || null;
    if (fromState != null && fromState !== "") return fromState;
    const fromQuery = searchParams.get("dc_id") || searchParams.get("dcId") || "";
    return fromQuery ? fromQuery : null;
  }, [location.state, searchParams]);
  const pathReadOnly = location.pathname.includes("/challans/detail");
  const readOnly = Boolean(location.state?.readOnly) || pathReadOnly;

  const initialPoItems = useMemo(() => {
    const fromPoItems = Array.isArray(location.state?.poItems) ? location.state.poItems : [];
    if (fromPoItems.length > 0) return fromPoItems;
    const fromSelected = Array.isArray(location.state?.selectedPoItems) ? location.state.selectedPoItems : [];
    return fromSelected;
  }, [location.state]);

  const [poItems, setPoItems] = useState(() => initialPoItems);
  const returnPath = location.state?.returnPath || `/${projectId}/challans/new`;
  const challanDraft = location.state?.challanDraft && typeof location.state.challanDraft === "object"
    ? location.state.challanDraft
    : null;

  const poIdForLookup = useMemo(() => {
    const raw = challanDraft?.po_id ?? location.state?.po_id ?? location.state?.poId ?? null;
    return raw != null && String(raw).trim() !== "" ? raw : null;
  }, [challanDraft?.po_id, location.state]);

  const [deliveryItems, setDeliveryItems] = useState(() => {
    const incoming = Array.isArray(location.state?.deliveryItems) ? location.state.deliveryItems : [];
    const meaningful = incoming.filter(hasItemValue);
    if (meaningful.length > 0) return incoming;
    return mapPoItemsToHalfDelivery(poItems);
  });
  const [dcDetails, setDcDetails] = useState(null);
  const [remainingLoading, setRemainingLoading] = useState(false);
  const [remainingRows, setRemainingRows] = useState([]);
  const [remainingError, setRemainingError] = useState("");

  const poItemAutocomplete = useMemo(() => {
    const mapped = mapPoItemsForRemaining(poItems);
    const names = new Set();
    const descriptions = new Set();
    mapped.forEach((it) => {
      const name = String(it?.name || "").trim();
      const description = String(it?.description || "").trim();
      if (name) names.add(name);
      if (description) descriptions.add(description);
    });
    return {
      names: Array.from(names),
      descriptions: Array.from(descriptions),
    };
  }, [poItems]);

  useEffect(() => {
    if (readOnly) return;
    if (poItems.length > 0) return;
    if (!poIdForLookup) return;
    let active = true;
    const loadPoItems = async () => {
      try {
        const res = await api.getPoById(poIdForLookup);
        if (!active) return;
        const rows = res?.success && Array.isArray(res.data?.items) ? res.data.items : [];
        setPoItems(rows);
      } catch {
        // ignore
      }
    };
    loadPoItems();
    return () => {
      active = false;
    };
  }, [readOnly, poItems.length, poIdForLookup]);

  const parseMaybeJson = (value, fallback) => {
    if (typeof value !== "string") return value ?? fallback;
    const t = value.trim();
    if (!t) return fallback;
    try {
      return JSON.parse(t);
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    if (!readOnly || !dcId) return;
    const loadDc = async () => {
      try {
        const res = await api.getDcById(dcId);
        if (!res.success) {
          toast({ title: "Failed to load challan", description: res.error || "Could not fetch challan details.", variant: "destructive" });
          return;
        }
        const dc = res.data || null;
        setDcDetails(dc);
        const items = parseMaybeJson(dc?.items, []);
        const rows = Array.isArray(items) ? items : [];
        setDeliveryItems(rows.map((it) => ({
          name: it?.name ?? "",
          description: it?.description ?? "",
          width: it?.width ?? "",
          length: it?.length ?? "",
          quantity: it?.quantity ?? "",
          price: it?.price ?? "",
        })));
      } catch {
        toast({ title: "Failed to load challan", description: "Could not fetch challan details.", variant: "destructive" });
      }
    };
    loadDc();
  }, [readOnly, dcId, toast]);

  useEffect(() => {
    if (!readOnly || !dcId) return;
    if (!dcDetails) return;

    const poId = dcDetails?.po_id ?? dcDetails?.poId ?? dcDetails?.po?.po_id ?? dcDetails?.po?.id ?? null;
    if (!poId) {
      setRemainingRows([]);
      setRemainingError("This challan is not linked to a PO, so remaining items cannot be calculated.");
      return;
    }

    const loadRemaining = async () => {
      setRemainingLoading(true);
      setRemainingError("");
      try {
        const poRes = await api.getPoById(poId);
        if (!poRes?.success) {
          setRemainingRows([]);
          setRemainingError(poRes?.error || "Could not load PO details to calculate remaining items.");
          return;
        }

        const po = poRes.data || null;
        const mappedPoItems = mapPoItemsForRemaining(po?.items);
        if (mappedPoItems.length === 0) {
          setRemainingRows([]);
          setRemainingError("No PO items found to calculate remaining items.");
          return;
        }

        const deliveredByIdentity = new Map();
        // "Delivered" should reflect this challan's entered quantities (not cumulative across all DCs).
        (Array.isArray(deliveryItems) ? deliveryItems : []).forEach((item) => {
          // DC items use `description` as the stable key. Do not match by `name` (which is used as Make).
          const identity = normalizeItemIdentity({
            description: item?.description ?? "",
            width: item?.width ?? "",
            length: item?.length ?? "",
          });
          if (!identity) return;
          const qty = toNumber(item?.quantity ?? 0);
          if (qty <= 0) return;
          const current = deliveredByIdentity.get(identity) || 0;
          deliveredByIdentity.set(identity, current + qty);
        });

        const rows = mappedPoItems.map((poItem) => {
          const identity = normalizeItemIdentity(poItem);
          const orderedQty = toNumber(poItem?.quantity ?? 0);
          const deliveredQty = identity ? toNumber(deliveredByIdentity.get(identity) || 0) : 0;
          const pendingQty = clampNonNegative(orderedQty - deliveredQty);
          return {
            ...poItem,
            ordered_qty: orderedQty,
            delivered_qty: deliveredQty,
            pending_qty: pendingQty,
          };
        }).sort((a, b) => b.pending_qty - a.pending_qty);

        setRemainingRows(rows);
        if (rows.length === 0) {
          setRemainingError("");
        }
      } catch {
        setRemainingRows([]);
        setRemainingError("Could not calculate remaining items.");
      } finally {
        setRemainingLoading(false);
      }
    };

    loadRemaining();
  }, [readOnly, dcId, dcDetails, deliveryItems]);

  const updateDeliveryItem = (index, field, value) => {
    setDeliveryItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeDeliveryItem = (index) => {
    setDeliveryItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ ...EMPTY_ITEM }];
    });
  };

  const addBlankDeliveryItem = () => {
    setDeliveryItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  };

  const addPoItemToDelivery = (item, index) => {
    const nextRow = mapPoItemToHalfDelivery(item, index);
    setDeliveryItems((prev) => [...prev, nextRow]);
  };

  const applyAndReturn = () => {
    navigate(returnPath, {
      state: {
        deliveryItems,
        selectedPoItems: poItems,
        challanDraft: {
          ...(challanDraft || {}),
          items: deliveryItems
        }
      }
    });
  };

  const backToChallan = () => {
    if (!projectId) {
      navigate("/projects");
      return;
    }
    navigate(`/${projectId}/challans`);
  };

  return (
    <div className="min-h-screen w-full max-w-none space-y-6 bg-background px-4 py-6 sm:px-6 lg:px-10">
      {!readOnly ? (
        <>
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
        </>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Challan Item Detail</h1>
          <p className="mt-2 text-muted-foreground">
            {readOnly
              ? "View the challan items created for this delivery."
              : "Review PO items and update delivery items, then apply to challan."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={backToChallan}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {!readOnly && (
            <Button type="button" onClick={applyAndReturn}>
              Apply to Challan
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {!readOnly && (
          <Card>
            <CardHeader>
              <CardTitle>PO Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {poItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No PO items available. Go back and select a PO first.
                </div>
              ) : (
                poItems.map((item, index) => (
                  <div key={`po-item-detail-${index}`} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{item.name || `Item ${index + 1}`}</div>
                        <div className="text-sm text-muted-foreground">{item.description || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          W: {item.width || "-"} | L: {item.length || "-"} | Qty: {item.quantity || "-"}
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => addPoItemToDelivery(item, index)}>
                        Add
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{readOnly ? "Challan Items" : "Delivery Items"}</CardTitle>
              {!readOnly && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={addBlankDeliveryItem}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Row
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {deliveryItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {readOnly ? "No challan items available." : "Add delivery items to continue."}
              </div>
            ) : (
              deliveryItems.map((item, index) => (
                <div key={`delivery-item-detail-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border p-3">
                  {readOnly ? (
                    <>
                      <div className="text-sm font-medium">{item.name || `Item ${index + 1}`}</div>
                      <div className="text-sm text-muted-foreground">{item.description || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        W: {item.width || "-"} | L: {item.length || "-"} | Qty: {item.quantity || "-"}
                      </div>
                    </>
                  ) : (
                    <>
                      <Input
                        className="h-10 text-sm"
                        placeholder="Name"
                        value={item.name}
                        list={poItemAutocomplete.names.length ? "po-item-name-suggestions" : undefined}
                        onChange={(e) => updateDeliveryItem(index, "name", e.target.value)}
                      />
                      <Input
                        className="h-10 text-sm"
                        placeholder="Description"
                        value={item.description}
                        list={poItemAutocomplete.descriptions.length ? "po-item-desc-suggestions" : undefined}
                        onChange={(e) => updateDeliveryItem(index, "description", e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          className="h-10 text-sm"
                          placeholder="Width"
                          value={item.width}
                          onChange={(e) => updateDeliveryItem(index, "width", e.target.value)}
                        />
                        <Input
                          className="h-10 text-sm"
                          placeholder="Length"
                          value={item.length}
                          onChange={(e) => updateDeliveryItem(index, "length", e.target.value)}
                        />
                        <Input
                          className="h-10 text-sm"
                          placeholder="Quantity"
                          value={item.quantity}
                          onChange={(e) => updateDeliveryItem(index, "quantity", e.target.value)}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeDeliveryItem(index)} className="h-10 w-10">
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {dcId ? (
        <Card>
          <CardHeader>
            <CardTitle>PO Ordered vs Delivered vs Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            {remainingLoading ? (
              <div className="text-sm text-muted-foreground">Loading remaining items...</div>
            ) : remainingError ? (
              <div className="text-sm text-muted-foreground">{remainingError}</div>
            ) : remainingRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">All PO items are fully delivered.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remainingRows.map((row, idx) => (
                    <TableRow key={`remaining-${idx}`}>
	                      <TableCell>
	                        <div className="font-medium">{row.name || "-"}</div>
	                        <div className="text-xs text-muted-foreground">{row.description || "-"}</div>
	                      </TableCell>
                      <TableCell className="text-right">{row.ordered_qty}</TableCell>
                      <TableCell className="text-right">{row.delivered_qty}</TableCell>
                      <TableCell className="text-right">{row.pending_qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
