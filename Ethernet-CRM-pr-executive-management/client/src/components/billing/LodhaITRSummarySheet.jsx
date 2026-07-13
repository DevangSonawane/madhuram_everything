import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

const toId = (row) => row?.itr_id ?? row?.id ?? row?._id ?? row?.itrId;
const toText = (v) => (v == null ? "" : String(v));

export default function LodhaITRSummarySheet({ formData, itrs, onChange, readonly }) {
  const [open, setOpen] = useState(false);

  const linked = useMemo(() => new Set((formData?.linked_itr_ids || []).map(String)), [formData?.linked_itr_ids]);
  const itrList = Array.isArray(itrs) ? itrs : [];

  const linkedItrs = useMemo(
    () => itrList.filter((m) => linked.has(String(toId(m)))),
    [linked, itrList]
  );

  const toggle = (id, nextChecked) => {
    const current = new Set((formData?.linked_itr_ids || []).map(String));
    if (nextChecked) current.add(String(id));
    else current.delete(String(id));
    onChange({ linked_itr_ids: Array.from(current) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Link ITRs (Installation Test Reports) to this RA bill for reference.
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={readonly}>Link ITRs</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Select ITRs for this RA bill</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px] text-center">Link</TableHead>
                    <TableHead>ITR Ref</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itrList.map((itr) => {
                    const id = toId(itr);
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
                        <TableCell>{toText(itr?.itr_ref_no || itr?.itrRefNo || itr?.itr_refrence_no || itr?.reference_no || `ITR-${id}`)}</TableCell>
                        <TableCell>{toText(itr?.inspection_date_time || itr?.created_at || "-")}</TableCell>
                        <TableCell>{toText(itr?.client_name || itr?.clientEmployer || "-")}</TableCell>
                        <TableCell>{toText(itr?.status || "-")}</TableCell>
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
              <TableHead>Linked ITR</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedItrs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No ITRs linked to this RA bill.
                </TableCell>
              </TableRow>
            ) : (
              linkedItrs.map((itr) => {
                const id = toId(itr);
                return (
                  <TableRow key={String(id)}>
                    <TableCell>{toText(itr?.itr_ref_no || `ITR-${id}`)}</TableCell>
                    <TableCell>{toText(itr?.inspection_date_time || "-")}</TableCell>
                    <TableCell>{toText(itr?.client_name || "-")}</TableCell>
                    <TableCell>{toText(itr?.status || "-")}</TableCell>
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

