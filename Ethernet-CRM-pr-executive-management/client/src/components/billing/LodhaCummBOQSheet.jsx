import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrencyINR } from "@/lib/numberFormat";

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

const normalizeBoqIdentity = (value) => String(value ?? "").trim().toLowerCase();

const hasOwnFilledValue = (obj, key) => {
  if (!obj || typeof obj !== "object" || !(key in obj)) return false;
  const value = obj[key];
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const normalizeSavedBoqItems = (boqItems) =>
  (Array.isArray(boqItems) ? boqItems : []).map((row, index) => ({
    item_no: row?.item_no ?? row?.itemNo ?? row?.item_code ?? String(index + 1),
    section: row?.section ?? row?.category ?? "",
    description: row?.description ?? "",
    uom: row?.unit ?? row?.uom ?? "",
    wo_qty: toNumber(row?.wo_qty ?? row?.qty ?? row?.quantity ?? row?.order_qty ?? 0),
    rate: toNumber(row?.rate ?? row?.unit_rate ?? row?.unit_price ?? row?.unitPrice ?? row?.price ?? 0),
    prev_supply_qty: row?.prev_supply_qty,
    curr_supply_qty: row?.curr_supply_qty,
    prev_install_qty: row?.prev_install_qty,
    curr_install_qty: row?.curr_install_qty,
    prev_tc_qty: row?.prev_tc_qty,
    curr_tc_qty: row?.curr_tc_qty,
    prev_handover_qty: row?.prev_handover_qty,
    curr_handover_qty: row?.curr_handover_qty,
  }));

const buildPreferredBoqItems = (savedBoqItems, projectBoqItems) => {
  const projectItems = Array.isArray(projectBoqItems) ? projectBoqItems : [];
  const savedItems = normalizeSavedBoqItems(savedBoqItems);

  if (projectItems.length === 0) return savedItems;
  if (savedItems.length === 0) return projectItems;

  const savedByIdentity = new Map();
  savedItems.forEach((item, index) => {
    const itemNoKey = normalizeBoqIdentity(item?.item_no);
    const descKey = normalizeBoqIdentity(item?.description);
    if (itemNoKey) savedByIdentity.set(`item:${itemNoKey}`, item);
    if (descKey) savedByIdentity.set(`desc:${descKey}`, item);
    savedByIdentity.set(`index:${index}`, item);
  });

  return projectItems.map((item, index) => {
    const itemNoKey = normalizeBoqIdentity(item?.item_no);
    const descKey = normalizeBoqIdentity(item?.description);
    const saved =
      (itemNoKey ? savedByIdentity.get(`item:${itemNoKey}`) : null) ||
      (descKey ? savedByIdentity.get(`desc:${descKey}`) : null) ||
      savedByIdentity.get(`index:${index}`) ||
      null;

    return saved ? { ...item, ...saved } : item;
  });
};

const resolvePhaseValues = (item, phaseKey) => {
  const prevKey = `prev_${phaseKey}_qty`;
  const currKey = `curr_${phaseKey}_qty`;
  const woQty = toNumber(item?.wo_qty);
  const prevDone = hasOwnFilledValue(item, prevKey) ? toNumber(item?.[prevKey]) : woQty;
  const currDone = hasOwnFilledValue(item, currKey) ? toNumber(item?.[currKey]) : 0;
  return { prevDone, currDone, cummDone: prevDone + currDone };
};

const getItemKey = (item, index) => {
  const itemNoKey = normalizeBoqIdentity(item?.item_no);
  const descKey = normalizeBoqIdentity(item?.description);
  return itemNoKey || descKey || `index:${index}`;
};

const getDraftKey = (itemKey, phaseKey) => `${itemKey}::${phaseKey}`;

const PhaseRow = ({ label, phaseKey, item, itemKey, phaseWeight, readonly, draftValue, onDraftChange, onDraftCommit }) => {
  const { prevDone, currDone, cummDone } = resolvePhaseValues(item, phaseKey);

  const rate = toNumber(item?.rate);
  const prevBoq = prevDone * phaseWeight;
  const currBoq = currDone * phaseWeight;
  const cummBoq = cummDone * phaseWeight;

  const prevAmt = prevBoq * rate;
  const currAmt = currBoq * rate;
  const cummAmt = cummBoq * rate;

  return (
    <tr className="bg-white">
      <td className="border px-2 py-1 text-xs text-muted-foreground"></td>
      <td className="border px-2 py-1 text-xs text-muted-foreground whitespace-nowrap">{label}</td>
      <td className="border px-2 py-1 text-right text-xs">{item?.wo_qty ?? ""}</td>
      <td className="border px-2 py-1 text-right text-xs">{prevDone.toFixed(2)}</td>
      <td className="border px-1 py-1 text-right text-xs bg-[#EBF5FB]">
        <Input
          type="number"
          inputMode="decimal"
          className="h-7 text-right text-xs"
          value={draftValue}
          disabled={readonly}
          onChange={(e) => onDraftChange(itemKey, phaseKey, e.target.value)}
          onBlur={() => onDraftCommit(itemKey, phaseKey)}
        />
      </td>
      <td className="border px-2 py-1 text-right text-xs">{cummDone.toFixed(2)}</td>
      <td className="border px-2 py-1 text-right text-xs">{prevBoq.toFixed(2)}</td>
      <td className="border px-2 py-1 text-right text-xs">{currBoq.toFixed(2)}</td>
      <td className="border px-2 py-1 text-right text-xs">{cummBoq.toFixed(2)}</td>
      <td className="border px-2 py-1 text-center text-xs whitespace-nowrap overflow-hidden text-ellipsis">{item?.uom || ""}</td>
      <td className="border px-2 py-1 text-right text-xs">{rate ? rate.toFixed(2) : ""}</td>
      <td className="border px-2 py-1 text-right text-xs">{formatCurrencyINR(prevAmt)}</td>
      <td className="border px-2 py-1 text-right text-xs">{formatCurrencyINR(currAmt)}</td>
      <td className="border px-2 py-1 text-right text-xs">{formatCurrencyINR(cummAmt)}</td>
    </tr>
  );
};

export default function LodhaCummBOQSheet({ formData, onBoqItemsChange, phaseWeights, readonly, boqMaster }) {
  const sourceItems = Array.isArray(formData?.boq_items) ? formData.boq_items : [];
  const mergedItems = useMemo(() => buildPreferredBoqItems(sourceItems, boqMaster), [boqMaster, sourceItems]);
  const [draftCurrValues, setDraftCurrValues] = useState({});

  useEffect(() => {
    const nextDrafts = {};
    mergedItems.forEach((item, index) => {
      const itemKey = getItemKey(item, index);
      ["supply", "install", "tc", "handover"].forEach((phaseKey) => {
        const fieldKey = getDraftKey(itemKey, phaseKey);
        nextDrafts[fieldKey] = hasOwnFilledValue(item, `curr_${phaseKey}_qty`)
          ? String(item?.[`curr_${phaseKey}_qty`] ?? "")
          : "";
      });
    });
    setDraftCurrValues(nextDrafts);
  }, [mergedItems]);

  const items = useMemo(() => {
    return mergedItems.map((item, index) => {
      const itemKey = getItemKey(item, index);
      const nextItem = { ...item };
      ["supply", "install", "tc", "handover"].forEach((phaseKey) => {
        const draftKey = getDraftKey(itemKey, phaseKey);
        if (draftKey in draftCurrValues) {
          nextItem[`curr_${phaseKey}_qty`] = draftCurrValues[draftKey];
        }
      });
      return nextItem;
    });
  }, [draftCurrValues, mergedItems]);

  const totals = useMemo(() => {
    const sum = { prev: 0, curr: 0, cumm: 0 };
    items.forEach((item) => {
      const rate = toNumber(item?.rate);
      const addPhase = (key, weight) => {
        const { prevDone, currDone } = resolvePhaseValues(item, key);
        const prev = prevDone * weight * rate;
        const curr = currDone * weight * rate;
        sum.prev += prev;
        sum.curr += curr;
        sum.cumm += prev + curr;
      };
      addPhase("supply", phaseWeights?.supply ?? 0.6);
      addPhase("install", phaseWeights?.install ?? 0.25);
      addPhase("tc", phaseWeights?.tc ?? 0.1);
      addPhase("handover", phaseWeights?.handover ?? 0.05);
    });
    return sum;
  }, [items, phaseWeights]);

  const gst = {
    prev: totals.prev * 0.18,
    curr: totals.curr * 0.18,
    cumm: totals.cumm * 0.18,
  };

  const onDraftChange = (itemKey, phaseKey, nextValue) => {
    setDraftCurrValues((prev) => ({
      ...prev,
      [getDraftKey(itemKey, phaseKey)]: nextValue,
    }));
  };

  const onDraftCommit = (itemKey, phaseKey) => {
    const draftKey = getDraftKey(itemKey, phaseKey);
    const displayIndex = mergedItems.findIndex((item, index) => getItemKey(item, index) === itemKey);
    if (displayIndex < 0) return;
    const displayRow = mergedItems[displayIndex] || {};
    const itemNoKey = normalizeBoqIdentity(displayRow?.item_no);
    const descKey = normalizeBoqIdentity(displayRow?.description);
    const nextItems = sourceItems.slice();
    const sourceIndex = nextItems.findIndex((row, rowIndex) => {
      const rowItemNoKey = normalizeBoqIdentity(row?.item_no ?? row?.itemNo ?? row?.item_code);
      const rowDescKey = normalizeBoqIdentity(row?.description);
      return (
        (itemNoKey && rowItemNoKey === itemNoKey) ||
        (descKey && rowDescKey === descKey) ||
        rowIndex === displayIndex
      );
    });

    const baseRow =
      sourceIndex >= 0
        ? { ...(nextItems[sourceIndex] || {}) }
        : {
            item_no: displayRow?.item_no,
            section: displayRow?.section,
            description: displayRow?.description,
            uom: displayRow?.uom,
            wo_qty: displayRow?.wo_qty,
            rate: displayRow?.rate,
          };

    baseRow[`curr_${phaseKey}_qty`] = draftCurrValues[draftKey] ?? "";

    if (sourceIndex >= 0) {
      nextItems[sourceIndex] = baseRow;
    } else {
      nextItems.push(baseRow);
    }

    onBoqItemsChange(nextItems);
  };

  if (!items.length) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        No BOQ items found. Import BOQ in the AMEND BOQ tab, then come back to fill quantities.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 text-sm">
        <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
          <div>
            <div className="font-semibold">Company Name & Address</div>
            <div className="text-muted-foreground">From company defaults</div>
          </div>
          <div className="md:text-right">
            <div className="font-semibold">Reference</div>
            <div className="text-muted-foreground">{formData?.invoice_number || "-"}</div>
          </div>
          <div>
            <div className="font-semibold">Work Order No.</div>
            <div className="text-muted-foreground">{formData?.work_order_number || "-"}</div>
          </div>
          <div className="md:text-right">
            <div className="font-semibold">Work Order Date</div>
            <div className="text-muted-foreground">{formData?.work_order_date || "-"}</div>
          </div>
          <div>
            <div className="font-semibold">Project & Building Name</div>
            <div className="text-muted-foreground">{formData?.building_name || "-"}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1400px] w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: "70px" }} />
            <col style={{ width: "520px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "70px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
          </colgroup>
          <thead>
            <tr className="bg-muted/50">
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Sr.No</th>
              <th className="border px-2 py-2 text-xs text-center">Description of Work</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Current WO Qty</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Work Done - Prev</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Work Done - Curr</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Work Done - Cumm</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">BOQ Qty - Prev</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">BOQ Qty - Curr</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">BOQ Qty - Cumm</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">U.O.M.</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Rate / U.O.M.</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Amount - Prev</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Amount - Curr</th>
              <th className="border px-2 py-2 text-xs text-center whitespace-nowrap">Amount - Cumm</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const itemKey = getItemKey(item, idx);
              return (
              <React.Fragment key={`${item?.item_no}-${idx}`}>
                <tr className="bg-[#E2EFDA] font-semibold">
                  <td className="border px-2 py-1 text-xs text-center">{item?.item_no || idx + 1}</td>
                  <td className="border px-2 py-1 text-xs" colSpan={13}>
                    {item?.description || "-"}
                  </td>
                </tr>

                <PhaseRow
                  label="Supply @ 60%"
                  phaseKey="supply"
                  item={item}
                  itemKey={itemKey}
                  phaseWeight={phaseWeights?.supply ?? 0.6}
                  readonly={readonly}
                  draftValue={draftCurrValues[getDraftKey(itemKey, "supply")] ?? ""}
                  onDraftChange={onDraftChange}
                  onDraftCommit={onDraftCommit}
                />
                <PhaseRow
                  label="Install @ 25%"
                  phaseKey="install"
                  item={item}
                  itemKey={itemKey}
                  phaseWeight={phaseWeights?.install ?? 0.25}
                  readonly={readonly}
                  draftValue={draftCurrValues[getDraftKey(itemKey, "install")] ?? ""}
                  onDraftChange={onDraftChange}
                  onDraftCommit={onDraftCommit}
                />
                <PhaseRow
                  label="Testing @ 10%"
                  phaseKey="tc"
                  item={item}
                  itemKey={itemKey}
                  phaseWeight={phaseWeights?.tc ?? 0.1}
                  readonly={readonly}
                  draftValue={draftCurrValues[getDraftKey(itemKey, "tc")] ?? ""}
                  onDraftChange={onDraftChange}
                  onDraftCommit={onDraftCommit}
                />
                <PhaseRow
                  label="Handover @ 5%"
                  phaseKey="handover"
                  item={item}
                  itemKey={itemKey}
                  phaseWeight={phaseWeights?.handover ?? 0.05}
                  readonly={readonly}
                  draftValue={draftCurrValues[getDraftKey(itemKey, "handover")] ?? ""}
                  onDraftChange={onDraftChange}
                  onDraftCommit={onDraftCommit}
                />
              </React.Fragment>
            )})}

            <tr className="bg-muted/30 font-semibold">
              <td className="border px-2 py-2 text-sm text-right" colSpan={11}>TOTAL</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(totals.prev)}</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(totals.curr)}</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(totals.cumm)}</td>
            </tr>
            <tr className="bg-muted/10">
              <td className="border px-2 py-2 text-sm text-right font-semibold" colSpan={11}>GST 18%</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(gst.prev)}</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(gst.curr)}</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(gst.cumm)}</td>
            </tr>
            <tr className="bg-muted/10 font-semibold">
              <td className="border px-2 py-2 text-sm text-right" colSpan={11}>AMOUNT</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(totals.prev + gst.prev)}</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(totals.curr + gst.curr)}</td>
              <td className="border px-2 py-2 text-right text-sm">{formatCurrencyINR(totals.cumm + gst.cumm)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
