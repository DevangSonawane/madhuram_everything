import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

const toId = (row) => row?.mir_id ?? row?.id ?? row?._id ?? row?.mirId;
const toText = (v) => (v == null ? "" : String(v));

export default function LodhaChallanSummarySheet({ formData, mirs, dcs, onChange, readonly }) {
  const [open, setOpen] = useState(false);

  const linked = useMemo(() => new Set((formData?.linked_mir_ids || []).map(String)), [formData?.linked_mir_ids]);
  const mirList = Array.isArray(mirs) ? mirs : [];
  const dcList = Array.isArray(dcs) ? dcs : [];

  const linkedMirs = useMemo(
    () => mirList.filter((m) => linked.has(String(toId(m)))),
    [linked, mirList]
  );

  const toggle = (id, nextChecked) => {
    const current = new Set((formData?.linked_mir_ids || []).map(String));
    if (nextChecked) current.add(String(id));
    else current.delete(String(id));
    onChange({ linked_mir_ids: Array.from(current) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Link MIRs/challans to this RA bill for reference.
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={readonly}>Link MIRs</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Select MIRs for this RA bill</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px] text-center">Link</TableHead>
                    <TableHead>MIR Ref</TableHead>
                    <TableHead>Challan No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mirList.map((m) => {
                    const id = toId(m);
                    const isChecked = linked.has(String(id));
                    return (
                      <TableRow key={String(id)}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(v) => toggle(id, Boolean(v))}
                            disabled={readonly}
                          />
                        </TableCell>
                        <TableCell>{toText(m?.mir_refrence_no || m?.mir_reference_no || m?.reference_no || `MIR-${id}`)}</TableCell>
                        <TableCell>{toText(m?.challan_no || m?.challanNo || "-")}</TableCell>
                        <TableCell>{toText(m?.inspection_date_time || m?.client_submission_date || m?.created_at || "-")}</TableCell>
                        <TableCell>{toText(m?.client_name || "-")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Linked MIR</TableHead>
              <TableHead>Challan No</TableHead>
              <TableHead>DC No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedMirs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No MIRs linked to this RA bill.
                </TableCell>
              </TableRow>
            ) : (
              linkedMirs.map((m) => {
                const id = toId(m);
                const dcForMir = dcList.find((dc) => String(dc?.mir_id ?? dc?.mirId ?? "") === String(id));
                const dcNo = dcForMir?.dc_no ?? dcForMir?.dcNo ?? dcForMir?.challan_no ?? "-";
                return (
                  <TableRow key={String(id)}>
                    <TableCell>{toText(m?.mir_refrence_no || `MIR-${id}`)}</TableCell>
                    <TableCell>{toText(m?.challan_no || "-")}</TableCell>
                    <TableCell>{toText(dcNo)}</TableCell>
                    <TableCell>{toText(m?.inspection_date_time || m?.client_submission_date || "-")}</TableCell>
                    <TableCell>{toText(m?.mir_submited ? "Submitted" : "Draft")}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
