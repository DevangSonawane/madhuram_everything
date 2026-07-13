import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const YES_NO_NA = ["Yes", "No", "N/A"];

const CHECKLIST_ROWS = [
  { key: "A_1_a", sr: "1.a", section: "A", text: "SES copy duly signed..." },
  { key: "A_1_b", sr: "1.b", section: "A", text: "Tax invoice / bill of supply..." },
  { key: "A_1_c", sr: "1.c", section: "A", text: "Cumulative abstract sheet..." },
  { key: "A_1_d", sr: "1.d", section: "A", text: "Measurement sheet..." },
  { key: "A_1_e", sr: "1.e", section: "A", text: "PF challan for last month..." },
  { key: "A_1_f", sr: "1.f", section: "A", text: "ESIC challan/WCP..." },
  { key: "A_1_g", sr: "1.g", section: "A", text: "Material reconciliation (every 3rd RA)" },
  { key: "A_1_i", sr: "1.i", section: "A", text: "NCR Log (every 3rd RA)" },
  { key: "A_1_j", sr: "1.j", section: "A", text: "Basic rate variation (every 3rd RA)" },
  { key: "A_1_k", sr: "1.k", section: "A", text: "BG Expired Date" },
  { key: "A_2_a", sr: "2.a", section: "A", text: "Supply of water/machinery original challan..." },
  { key: "A_2_b", sr: "2.b", section: "A", text: "Attendance sheet/labour supply challan..." },
  { key: "A_3_a", sr: "3.a", section: "A", text: "No due certificate (Final RA Bill)" },
  { key: "A_3_b", sr: "3.b", section: "A", text: "Work completion certificate (Final RA Bill)" },
  { key: "A_3_c", sr: "3.c", section: "A", text: "Statement of hold... (Final RA Bill)" },
  { key: "A_4_a", sr: "4.a", section: "A", text: "MITR supported by DC" },
  { key: "A_4_b", sr: "4.b", section: "A", text: "ITR certified by engineer" },
  { key: "B_1", sr: "B.1", section: "B", text: "Vendor GST No in invoice matches GST No on SES" },
  { key: "B_2", sr: "B.2", section: "B", text: "Company GSTN in invoice matches GST No on SES" },
  { key: "B_3", sr: "B.3", section: "B", text: "First 4 digit of HSN/SAC matches with WO" },
  { key: "B_4", sr: "B.4", section: "B", text: "Invoice rate, BOQ description and tax rate match with SES" },
  { key: "B_5", sr: "B.5", section: "B", text: "GL code maintained in work order as per nature of work" },
  { key: "B_6", sr: "B.6", section: "B", text: "Tax % maintained in work order with invoice" },
  { key: "B_7", sr: "B.7", section: "B", text: "Retention % in work order per T&C" },
  { key: "B_8", sr: "B.8", section: "B", text: "Debit/credit note posted in SAP" },
  { key: "B_9", sr: "B.9", section: "B", text: "Work order closure tick done (for final RA bill)" },
  { key: "B_10", sr: "B.10", section: "B", text: "Adjust open advances (>6 months façade, >3 months others)" },
  { key: "B_11", sr: "B.11", section: "B", text: "Debit note adjusted against same project" },
  { key: "B_12", sr: "B.12", section: "B", text: "DCO approval if contract value > Rs 1 cr (final RA bill)" },
];

const getAutoChecks = (formData) => {
  const hasSupplier = Boolean(String(formData?.supplier_gstin || "").trim());
  const hasBuyer = Boolean(String(formData?.bill_to_gstin || "").trim());
  const sacOk = String(formData?.sac_code || "").trim().slice(0, 4).length === 4;
  const taxOk = Number(formData?.cgst_rate) > 0 && Number(formData?.sgst_rate) > 0;

  return {
    B_1: hasBuyer ? "Yes" : null,
    B_2: hasSupplier ? "Yes" : null,
    B_3: sacOk ? "Yes" : null,
    B_4: null,
    B_6: taxOk ? "Yes" : null,
  };
};

export default function LodhaCheckListSheet({ value, onChange, formData, readonly }) {
  const checklist = value || {};
  const auto = useMemo(() => getAutoChecks(formData), [formData]);

  const getRowValue = (rowKey, who) => {
    const v = checklist?.[rowKey]?.[who] ?? "";
    if (v) return v;
    const autoV = auto?.[rowKey];
    return autoV || "";
  };

  const setRowValue = (rowKey, who, next) => {
    onChange({
      ...(checklist || {}),
      [rowKey]: {
        ...(checklist?.[rowKey] || {}),
        [who]: next,
      },
    });
  };

  const setRemark = (rowKey, who, next) => {
    onChange({
      ...(checklist || {}),
      [rowKey]: {
        ...(checklist?.[rowKey] || {}),
        [`${who}_remark`]: next,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <div className="text-sm font-semibold">Invoice Processing Check-List - Construction Services</div>
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <div><span className="text-muted-foreground">Project Name:</span> {formData?.building_name || "-"}</div>
            <div><span className="text-muted-foreground">Work Order No:</span> {formData?.work_order_number || "-"}</div>
          </div>
          <div className="space-y-1 md:text-right">
            <div><span className="text-muted-foreground">Contractor:</span> Madhuram Enterprises</div>
            <div><span className="text-muted-foreground">RA Bill No:</span> {formData?.ra_number || "-"}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Auto-checks are applied where possible; you can override them.
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px] text-center">Sr.No</TableHead>
            <TableHead>Checklist Item</TableHead>
            <TableHead className="w-[170px] text-center">Site (Yes/No/NA)</TableHead>
            <TableHead className="w-[220px] text-center">Site Remark</TableHead>
            <TableHead className="w-[170px] text-center">Account (Yes/No/NA)</TableHead>
            <TableHead className="w-[220px] text-center">Account Remark</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CHECKLIST_ROWS.map((row) => {
            const siteValue = getRowValue(row.key, "site");
            const accValue = getRowValue(row.key, "account");
            const isAuto = Boolean(auto?.[row.key]);
            return (
              <TableRow key={row.key} className={row.section === "B" ? "bg-muted/10" : ""}>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span>{row.sr}</span>
                    {isAuto ? <Badge variant="outline">Auto</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{row.text}</TableCell>
                <TableCell>
                  <Select
                    value={siteValue}
                    onValueChange={(v) => setRowValue(row.key, "site", v)}
                    disabled={readonly}
                  >
                    <SelectTrigger className={isAuto && !readonly ? "opacity-70" : ""}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {YES_NO_NA.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={checklist?.[row.key]?.site_remark ?? ""}
                    disabled={readonly}
                    onChange={(e) => setRemark(row.key, "site", e.target.value)}
                    placeholder="Remark"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={accValue}
                    onValueChange={(v) => setRowValue(row.key, "account", v)}
                    disabled={readonly}
                  >
                    <SelectTrigger className={isAuto && !readonly ? "opacity-70" : ""}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {YES_NO_NA.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={checklist?.[row.key]?.account_remark ?? ""}
                    disabled={readonly}
                    onChange={(e) => setRemark(row.key, "account", e.target.value)}
                    placeholder="Remark"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="rounded-md border p-4 text-sm">
        <div className="font-semibold mb-2">Signatures</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {["Billing Eng", "Commercial Manager", "Bill Processor", "Bill Approved"].map((label) => (
            <div key={label} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-2 space-y-2">
                <Input
                  value={checklist?.signatures?.[label]?.name ?? ""}
                  disabled={readonly}
                  onChange={(e) =>
                    onChange({
                      ...(checklist || {}),
                      signatures: {
                        ...(checklist?.signatures || {}),
                        [label]: { ...(checklist?.signatures?.[label] || {}), name: e.target.value },
                      },
                    })
                  }
                  placeholder="Name"
                />
                <Input
                  type="date"
                  value={checklist?.signatures?.[label]?.date ?? ""}
                  disabled={readonly}
                  onChange={(e) =>
                    onChange({
                      ...(checklist || {}),
                      signatures: {
                        ...(checklist?.signatures || {}),
                        [label]: { ...(checklist?.signatures?.[label] || {}), date: e.target.value },
                      },
                    })
                  }
                  placeholder="Date"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
