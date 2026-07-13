import React, { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyINR } from "@/lib/numberFormat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { amountToWords } from "@/lib/amountToWords";

const cell = "border border-black px-1 py-1 text-[10px]";
const headerCell = "border border-black bg-[#D9D9D9] px-1 py-1 text-center font-semibold text-[9px]";

export default function LodhaTaxInvoiceSheet({ formData, computed, onChange, readonly, invoices, invoiceDetails }) {
  const cgstRate = (Number(formData?.cgst_rate) || 0.09) * 100;
  const sgstRate = (Number(formData?.sgst_rate) || 0.09) * 100;

  const amountInWordsFromRa = computed?.amount_in_words || "";
  const taxableValue = computed?.taxable_value || 0;
  const cgstAmount = computed?.cgst_amount || 0;
  const sgstAmount = computed?.sgst_amount || 0;
  const totalInvoice = computed?.total_invoice_amount || 0;

  const invoiceMeta = useMemo(() => ({
    invoice_number: formData?.invoice_number || "",
    invoice_date: formData?.invoice_date || "",
    supplier_gstin: formData?.supplier_gstin || "",
    pf_number: formData?.pf_number || "",
    esic_number: formData?.esic_number || "",
    ptr_number: formData?.ptr_number || "",
    mlwf_number: formData?.mlwf_number || "",
    company_name: formData?.company_name || "",
    company_address: formData?.company_address || "",
    bill_to_name: formData?.bill_to_name || "",
    bill_to_address: formData?.bill_to_address || "",
    bill_to_gstin: formData?.bill_to_gstin || "",
    bill_to_state: formData?.bill_to_state || "",
    bill_to_state_code: formData?.bill_to_state_code || "",
    work_order_number: formData?.work_order_number || "",
    work_order_date: formData?.work_order_date || "",
    plant_name: formData?.plant_name || "",
    ra_number: formData?.ra_number || "",
    place_of_supply: formData?.place_of_supply || "",
    work_description: formData?.work_description || "PLUMBING WORKS",
    sac_code: formData?.sac_code || "998322",
    imported_invoice_ids: Array.isArray(formData?.imported_invoice_ids) ? formData.imported_invoice_ids : [],
  }), [formData]);

  const inlineInput =
    "w-full bg-transparent text-[10px] border-b border-dashed border-gray-300 focus:outline-none focus:border-gray-700 disabled:border-transparent";

  const invoiceList = Array.isArray(invoices) ? invoices : [];
  const detailsList = Array.isArray(invoiceDetails) ? invoiceDetails : [];
  const selectedInvoiceIdSet = useMemo(
    () => new Set(invoiceMeta.imported_invoice_ids.map((id) => String(id))),
    [invoiceMeta.imported_invoice_ids]
  );

  const toDateOnly = (value) => {
    if (!value) return "";
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes("T")) return s.slice(0, 10);
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return s;
  };

  const toNumberSafe = (value) => {
    if (value == null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const primaryImportedInvoice = useMemo(() => {
    if (!detailsList.length) return null;
    const lastId =
      invoiceMeta.imported_invoice_ids.length > 0
        ? String(invoiceMeta.imported_invoice_ids[invoiceMeta.imported_invoice_ids.length - 1])
        : null;
    if (lastId) {
      const match = detailsList.find((d) => String(d?.id) === lastId);
      if (match) return match;
    }
    return detailsList[0] || null;
  }, [detailsList, invoiceMeta.imported_invoice_ids]);

  const importedHeader = useMemo(() => {
    const form = primaryImportedInvoice?.form;
    if (!form) return null;

    const t = String(primaryImportedInvoice?.template || "").toLowerCase();
    if (t === "hiranandani") {
      const h = form?.header || {};
      return {
        invoice_number: h.invoice_number || "",
        invoice_date: toDateOnly(h.invoice_date || ""),
        supplier_gstin: h.supplier_gstin || "",
        pf_number: h.pf_number || "",
        esic_number: h.esic_number || "",
        ptr_number: h.ptr_number || "",
        mlwf_number: h.mlwf_number || "",
        bill_to_name: h.bill_to_name || "",
        bill_to_address: h.bill_to_address || "",
        bill_to_gstin: h.bill_to_gstin || "",
        bill_to_state: h.bill_to_state || "",
        bill_to_state_code: h.bill_to_state_code || "",
        place_of_supply: h.ship_to_address || h.building_name || h.ship_to_name || "",
        work_order_number: h.work_order_number || "",
        work_order_date: toDateOnly(h.work_order_date || ""),
        plant_name: h.building_name || "",
        ra_number: h.ra_number || "",
      };
    }

    const h = form?.header || {};
    const bs = form?.billingShipping || {};
    const pw = form?.projectWork || {};
    return {
      invoice_number: h.invoice_number || "",
      invoice_date: toDateOnly(h.invoice_date || ""),
      supplier_gstin: h.supplier_gstin || "",
      pf_number: h.pf_number || "",
      esic_number: h.esic_number || "",
      ptr_number: h.ptr_number || "",
      mlwf_number: h.mlwf_number || "",
      bill_to_name: bs.buyer_name || bs.receiver_name || "",
      bill_to_address: bs.buyer_address || bs.receiver_address || "",
      bill_to_gstin: bs.buyer_gstin || "",
      bill_to_state: bs.buyer_state_name || "",
      bill_to_state_code: bs.buyer_state_code || "",
      place_of_supply: bs.place_of_supply || "",
      work_order_number: pw.work_order_number || "",
      work_order_date: toDateOnly(pw.work_order_date || ""),
      plant_name: pw.plant_name || "",
      ra_number: String(pw.bill_no || "").replace(/[^0-9]/g, "") || "",
    };
  }, [primaryImportedInvoice]);

  const displayMeta = useMemo(() => {
    if (!importedHeader) return invoiceMeta;
    // Prefer imported invoice header for display while invoices are selected.
    return { ...invoiceMeta, ...importedHeader };
  }, [importedHeader, invoiceMeta]);

  useEffect(() => {
    if (!importedHeader) return;
    const patch = {};
    const fillIfEmpty = (key, value) => {
      if (value == null) return;
      const next = String(value).trim();
      if (!next) return;
      if (!String(invoiceMeta?.[key] ?? "").trim()) patch[key] = value;
    };

    fillIfEmpty("invoice_number", importedHeader.invoice_number);
    fillIfEmpty("invoice_date", importedHeader.invoice_date);
    fillIfEmpty("supplier_gstin", importedHeader.supplier_gstin);
    fillIfEmpty("pf_number", importedHeader.pf_number);
    fillIfEmpty("esic_number", importedHeader.esic_number);
    fillIfEmpty("ptr_number", importedHeader.ptr_number);
    fillIfEmpty("mlwf_number", importedHeader.mlwf_number);
    fillIfEmpty("bill_to_name", importedHeader.bill_to_name);
    fillIfEmpty("bill_to_address", importedHeader.bill_to_address);
    fillIfEmpty("bill_to_gstin", importedHeader.bill_to_gstin);
    fillIfEmpty("bill_to_state", importedHeader.bill_to_state);
    fillIfEmpty("bill_to_state_code", importedHeader.bill_to_state_code);
    fillIfEmpty("place_of_supply", importedHeader.place_of_supply);
    fillIfEmpty("work_order_number", importedHeader.work_order_number);
    fillIfEmpty("work_order_date", importedHeader.work_order_date);
    fillIfEmpty("plant_name", importedHeader.plant_name);

    if (Object.keys(patch).length) onChange(patch);
  }, [importedHeader, invoiceMeta, onChange]);

  const normalizedImportedLines = useMemo(() => {
    if (selectedInvoiceIdSet.size === 0) return [];
    const lines = [];

    const sources = detailsList.length
      ? detailsList.map((d) => ({ id: d?.id, form: d?.form, template: d?.template }))
      : invoiceList.map((row) => ({
          id: row?.id ?? row?.lodha_invoice_id ?? row?.invoice_id ?? row?._id ?? row?.invoiceId,
          form: null,
          template: row?.__template || row?.template || "",
        }));

    sources.forEach((src) => {
      const id = src?.id;
      if (id == null) return;
      if (!selectedInvoiceIdSet.has(String(id))) return;

      const form = src?.form;
      if (!form) return;

      const t = String(src?.template || "").toLowerCase();
      const items = Array.isArray(form?.items) ? form.items : [];
      const totals = form?.totals || {};

      const taxable = Number(
        totals?.total_taxable_value ??
          totals?.total_taxable_value_amount ??
          totals?.total_taxable ??
          totals?.totalTaxableValue ??
          0
      );
      const cgstAmt = toNumberSafe(
        totals?.total_cgst ??
          totals?.total_cgst_amount ??
          totals?.totalCgstAmount ??
          0
      );
      const sgstAmt = toNumberSafe(
        totals?.total_sgst ??
          totals?.total_sgst_amount ??
          totals?.totalSgstAmount ??
          0
      );

      const taxableSafe = toNumberSafe(taxable);
      const cgstSafe = toNumberSafe(cgstAmt);
      const sgstSafe = toNumberSafe(sgstAmt);

      const computedFromItems = items.reduce(
        (acc, it) => {
          acc.taxable += toNumberSafe(it?.taxable_value);
          acc.cgst += toNumberSafe(it?.cgst_amount);
          acc.sgst += toNumberSafe(it?.sgst_amount);
          return acc;
        },
        { taxable: 0, cgst: 0, sgst: 0 }
      );

      const finalTaxable = taxableSafe || computedFromItems.taxable;
      const finalCgst = cgstSafe || computedFromItems.cgst;
      const finalSgst = sgstSafe || computedFromItems.sgst;

      const firstLine = items[0] || {};
      const desc =
        firstLine?.description ||
        invoiceMeta.work_description ||
        "PLUMBING WORKS";
      const sac =
        firstLine?.sac_code ||
        invoiceMeta.sac_code ||
        "998322";

      lines.push({
        id,
        invoiceNo:
          (t === "hiranandani" ? form?.header?.invoice_number : form?.header?.invoice_number) || "",
        template: src?.template || "",
        description: desc,
        sac_code: sac,
        taxable_value: finalTaxable,
        cgst_amount: finalCgst,
        sgst_amount: finalSgst,
      });
    });

    return lines;
  }, [detailsList, invoiceList, invoiceMeta.sac_code, invoiceMeta.work_description, selectedInvoiceIdSet]);

  const lineItemsToRender = normalizedImportedLines.length
    ? normalizedImportedLines
    : [
        {
          id: "ra",
          invoiceNo: invoiceMeta.invoice_number,
          description: invoiceMeta.work_description,
          sac_code: invoiceMeta.sac_code,
          taxable_value: taxableValue,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
        },
      ];

  const totalsToRender = useMemo(() => {
    const t = lineItemsToRender.reduce(
      (acc, it) => {
        acc.taxable += Number(it.taxable_value) || 0;
        acc.cgst += Number(it.cgst_amount) || 0;
        acc.sgst += Number(it.sgst_amount) || 0;
        return acc;
      },
      { taxable: 0, cgst: 0, sgst: 0 }
    );
    return { ...t, total: t.taxable + t.cgst + t.sgst };
  }, [lineItemsToRender]);

  const amountInWordsToRender = useMemo(() => {
    if (!normalizedImportedLines.length) return amountInWordsFromRa;
    return amountToWords(totalsToRender.total);
  }, [amountInWordsFromRa, normalizedImportedLines.length, totalsToRender.total]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label>RA Bill No</Label>
          <Input
            value={displayMeta.ra_number}
            disabled={readonly}
            onChange={(e) => onChange({ ra_number: e.target.value })}
            placeholder='3'
          />
        </div>
        <div className="space-y-1">
          <Label>Invoice No</Label>
          <Input
            value={displayMeta.invoice_number}
            disabled={readonly}
            onChange={(e) => onChange({ invoice_number: e.target.value })}
            placeholder="ME/PROJECT-PL/3"
          />
        </div>
        <div className="space-y-1">
          <Label>Invoice Date</Label>
          <Input
            type="date"
            value={displayMeta.invoice_date}
            disabled={readonly}
            onChange={(e) => onChange({ invoice_date: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="text-sm text-muted-foreground">
          Import line items from Invoices module (Lodha invoices for this project).
        </div>
          <Dialog>
            <DialogTrigger asChild>
            <Button variant="outline" disabled={readonly || invoiceList.length === 0}>
              Select Invoices
            </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Select invoices to include in TAX INVOICE</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto space-y-2">
              {invoiceList.length === 0 ? (
                <div className="text-sm text-muted-foreground">No invoices found for this project.</div>
              ) : (
                invoiceList.map((row) => {
                  const id = row?.id ?? row?.lodha_invoice_id ?? row?.invoice_id ?? row?._id ?? row?.invoiceId;
                  if (id == null) return null;
                  const inv = row?.invoice ?? row?.data?.invoice ?? row;
                  const invNo = inv?.invoiceNo ?? row?.invoice_no ?? row?.invoice_number ?? `Invoice-${id}`;
                  const checked = selectedInvoiceIdSet.has(String(id));
                  return (
                    <label key={String(id)} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = new Set(invoiceMeta.imported_invoice_ids.map((x) => String(x)));
                          if (v) next.add(String(id));
                          else next.delete(String(id));
                          onChange({ imported_invoice_ids: Array.from(next) });
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{String(invNo)}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {String(inv?.invoiceDate ?? row?.invoice_date ?? row?.created_at ?? "")}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1200px] border-collapse border-2 border-black">
          <tbody>
            <tr>
              <td className="border border-black p-2 text-center" colSpan={14}>
                <div className="text-[14px] font-bold">{displayMeta.company_name || " "}</div>
                <div className="text-[11px]">{displayMeta.company_address || " "}</div>
              </td>
            </tr>
            <tr>
              <td className="border border-black py-2 text-center font-serif text-[22px] font-bold" colSpan={14}>
                TAX INVOICE
              </td>
            </tr>

            <tr>
              <td className={`${cell}`} colSpan={7}>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>Invoice No :</div>
                  <div className="font-semibold">{displayMeta.invoice_number || "-"}</div>
                  <div>Invoice Date :</div>
                  <div className="font-semibold">{displayMeta.invoice_date || "-"}</div>
                  <div>GSTIN :</div>
                  <div className="font-semibold">
                    <input
                      className={inlineInput}
                      value={displayMeta.supplier_gstin}
                      disabled={readonly}
                      onChange={(e) => onChange({ supplier_gstin: e.target.value })}
                      placeholder="GSTIN"
                    />
                  </div>
                  <div>PF / ESIC :</div>
                  <div className="font-semibold">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={inlineInput}
                        value={displayMeta.pf_number}
                        disabled={readonly}
                        onChange={(e) => onChange({ pf_number: e.target.value })}
                        placeholder="PF"
                      />
                      <input
                        className={inlineInput}
                        value={displayMeta.esic_number}
                        disabled={readonly}
                        onChange={(e) => onChange({ esic_number: e.target.value })}
                        placeholder="ESIC"
                      />
                    </div>
                  </div>
                </div>
              </td>
              <td className={`${cell}`} colSpan={7}>
                <div className="text-[10px] font-semibold">Receiver Details:</div>
                <div className="text-[10px]">
                  <input
                    className={inlineInput}
                    value={displayMeta.bill_to_name}
                    disabled={readonly}
                    onChange={(e) => onChange({ bill_to_name: e.target.value })}
                    placeholder="Receiver name"
                  />
                </div>
                <div className="text-[10px] whitespace-pre-wrap">
                  <input
                    className={inlineInput}
                    value={displayMeta.bill_to_address}
                    disabled={readonly}
                    onChange={(e) => onChange({ bill_to_address: e.target.value })}
                    placeholder="Receiver address"
                  />
                </div>
                <div className="text-[10px]">
                  Place of Supply:{" "}
                  <input
                    className={inlineInput}
                    value={displayMeta.place_of_supply}
                    disabled={readonly}
                    onChange={(e) => onChange({ place_of_supply: e.target.value })}
                    placeholder="Place of supply"
                  />
                </div>
              </td>
            </tr>

            <tr>
              <td className={`${cell}`} colSpan={14}>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <div>
                      <span className="font-semibold">Buyer:</span>{" "}
                      <input
                        className={inlineInput}
                        value={displayMeta.bill_to_name}
                        disabled={readonly}
                        onChange={(e) => onChange({ bill_to_name: e.target.value })}
                        placeholder="Buyer name"
                      />
                    </div>
                    <div className="whitespace-pre-wrap">
                      <input
                        className={inlineInput}
                        value={displayMeta.bill_to_address}
                        disabled={readonly}
                        onChange={(e) => onChange({ bill_to_address: e.target.value })}
                        placeholder="Buyer address"
                      />
                    </div>
                    <div>
                      State Name:{" "}
                      <input
                        className={inlineInput}
                        value={displayMeta.bill_to_state}
                        disabled={readonly}
                        onChange={(e) => onChange({ bill_to_state: e.target.value })}
                        placeholder="State"
                      />
                    </div>
                    <div>
                      State Code:{" "}
                      <input
                        className={inlineInput}
                        value={displayMeta.bill_to_state_code}
                        disabled={readonly}
                        onChange={(e) => onChange({ bill_to_state_code: e.target.value })}
                        placeholder="Code"
                      />
                    </div>
                    <div>
                      GSTIN:{" "}
                      <input
                        className={inlineInput}
                        value={displayMeta.bill_to_gstin}
                        disabled={readonly}
                        onChange={(e) => onChange({ bill_to_gstin: e.target.value })}
                        placeholder="Buyer GSTIN"
                      />
                    </div>
                  </div>
                  <div>
                    <div>
                      WO No:{" "}
                      <input
                        className={inlineInput}
                        value={displayMeta.work_order_number}
                        disabled={readonly}
                        onChange={(e) => onChange({ work_order_number: e.target.value })}
                        placeholder="WO No"
                      />{" "}
                      DT{" "}
                      <input
                        className={inlineInput}
                        value={displayMeta.work_order_date}
                        disabled={readonly}
                        onChange={(e) => onChange({ work_order_date: e.target.value })}
                        placeholder="WO Date"
                      />
                    </div>
                    <div>
                      PLANT NAME:{" "}
                      <input
                        className={inlineInput}
                        value={displayMeta.plant_name}
                        disabled={readonly}
                        onChange={(e) => onChange({ plant_name: e.target.value })}
                        placeholder="Plant/Site"
                      />
                    </div>
                    <div>BILL NO: <span className="font-semibold">RA {displayMeta.ra_number || "-"}</span></div>
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td className={headerCell}>SN</td>
              <td className={headerCell}>Description of Service/Goods</td>
              <td className={headerCell}>SAC/HSN Code</td>
              <td className={headerCell}>UOM</td>
              <td className={headerCell}>Qty</td>
              <td className={headerCell}>Rate</td>
              <td className={headerCell}>Total Value</td>
              <td className={headerCell}>Discount</td>
              <td className={headerCell}>Taxable Value</td>
              <td className={headerCell}>CGST Rate</td>
              <td className={headerCell}>CGST Amt</td>
              <td className={headerCell}>SGST Rate</td>
              <td className={headerCell}>SGST Amt</td>
              <td className={headerCell}>IGST/Cess</td>
            </tr>

            {lineItemsToRender.map((it, idx) => (
              <tr key={String(it.id)}>
                <td className={`${cell} text-center`}>{idx + 1}</td>
                <td className={`${cell} text-left`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate">{it.description}</div>
                    {it.template ? (
                      <div className="text-[9px] text-muted-foreground whitespace-nowrap">
                        ({String(it.template).toUpperCase()})
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className={`${cell} text-center`}>{it.sac_code}</td>
                <td className={`${cell} text-center`}></td>
                <td className={`${cell} text-right`}></td>
                <td className={`${cell} text-right`}></td>
                <td className={`${cell} text-right`}>{formatCurrencyINR(it.taxable_value)}</td>
                <td className={`${cell} text-right`}>0</td>
                <td className={`${cell} text-right`}>{formatCurrencyINR(it.taxable_value)}</td>
                <td className={`${cell} text-center`}>{cgstRate.toFixed(0)}%</td>
                <td className={`${cell} text-right`}>{formatCurrencyINR(it.cgst_amount)}</td>
                <td className={`${cell} text-center`}>{sgstRate.toFixed(0)}%</td>
                <td className={`${cell} text-right`}>{formatCurrencyINR(it.sgst_amount)}</td>
                <td className={`${cell} text-center`}>0</td>
              </tr>
            ))}

            <tr>
              <td className={`${cell} text-center font-semibold`} colSpan={6}>Total</td>
              <td className={`${cell} text-right font-semibold`}>{formatCurrencyINR(totalsToRender.taxable)}</td>
              <td className={`${cell} text-right`}></td>
              <td className={`${cell} text-right font-semibold`}>{formatCurrencyINR(totalsToRender.taxable)}</td>
              <td className={`${cell} text-center`}></td>
              <td className={`${cell} text-right font-semibold`}>{formatCurrencyINR(totalsToRender.cgst)}</td>
              <td className={`${cell} text-center`}></td>
              <td className={`${cell} text-right font-semibold`}>{formatCurrencyINR(totalsToRender.sgst)}</td>
              <td className={`${cell} text-center`}>0</td>
            </tr>

            <tr>
              <td className={`${cell}`} colSpan={14}>
                <div className="text-[10px]">
                  <span className="font-semibold">Total Invoice Value (In figure):</span> {formatCurrencyINR(totalsToRender.total)}
                </div>
              </td>
            </tr>
            <tr>
              <td className={`${cell}`} colSpan={14}>
                <div className="text-[10px]">
                  <span className="font-semibold">Total Invoice Value (In words):</span> {amountInWordsToRender || "-"}
                </div>
              </td>
            </tr>

            <tr>
              <td className={`${cell} bg-gray-50`} colSpan={14}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-[10px] italic">
                    Declaration: We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
                  </div>
                  <div className="text-right text-[10px]">
                    <div className="font-semibold">For MADHURAM ENTERPRISES</div>
                    <div className="mt-6">Authorised Signatory</div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
