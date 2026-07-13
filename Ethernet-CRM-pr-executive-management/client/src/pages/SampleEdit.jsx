import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { syncSampleBoqQuantities } from "@/lib/sampleBoqSync";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus, Eye } from "lucide-react";
import InventoryPicker from "@/components/InventoryPicker";
import { useResolvedProject } from "@/hooks/useResolvedProject";
import { getSamplePrimaryIdentifier, resolveSampleClient } from "@/lib/sampleDisplay";

const pickSampleFilePath = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed);
      return pickSampleFilePath(parsed);
    } catch {
      return trimmed;
    }
  }
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim());
    return first ? first.trim() : "";
  }
  if (typeof value === "object") {
    const candidates = [
      value.filePath,
      value.file_path,
      value.path,
      value.url,
      value.sample_file,
      value.sampleFile,
    ];
    return pickSampleFilePath(candidates.find(Boolean));
  }
  return "";
};

export default function SampleEdit() {
  const { id, projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const resolvedProject = useResolvedProject();
  const effectiveProjectId = resolvedProject.projectId ? Number(resolvedProject.projectId) : null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inventoryQtyStatus, setInventoryQtyStatus] = useState({});
  const [originalItemDescription, setOriginalItemDescription] = useState([]);
  const [sampleProjectId, setSampleProjectId] = useState("");
  const [sampleClient, setSampleClient] = useState("");
  const [form, setForm] = useState({
    building_name: "",
    site_name: "",
    work_done: "",
    sample_file: "",
    flats: "",
    location: { floor: "", flat_no: "", block: "", wing: "", coordinates: "" },
    item_description: [{ sr_no: "", item_name: "", item_code: "", code: "", brand_name: "", description: "", specification: "", unit: "", quantity: "", value: "", inventory_id: null, issued_qty: null, boq_id: null, boq_qty: null, boq_issued_qty: null }],
    add_fields: []
  });
  const [attachmentOpen, setAttachmentOpen] = useState(false);

  const parseMaybe = (val, fallback) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    }
    return val ?? fallback;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getSampleById(id);
        if (!res.success) return;

        const raw = res.data;
        const sample = Array.isArray(raw)
          ? raw.find((row) => String(row?.sample_id ?? row?.id ?? "") === String(id)) || raw[0]
          : raw?.sample || raw?.data || raw;
        if (!sample) return;

        const loc = parseMaybe(sample.location, {});
        const items = parseMaybe(sample.item_description, []);
        const adds = parseMaybe(sample.add_fields, []);
        const sampleFileRaw =
          sample.sample_file ??
          sample.sample_file_path ??
          sample.sample_files ??
          sample.files ??
          sample.file_path ??
          sample.attachment ??
          sample.attachment_path ??
          "";
        const sampleFile = pickSampleFilePath(sampleFileRaw);
        const normalizedItems = Array.isArray(items) ? items : [];
        const resolvedClient = resolveSampleClient(sample, sample.project_id);
        setSampleProjectId(String(sample.project_id || ""));
        setSampleClient(resolvedClient);
        setOriginalItemDescription(normalizedItems);

        setForm({
          building_name: sample.building_name || "",
          site_name: sample.site_name || "",
          work_done: sample.work_done || "",
          sample_file: sampleFile,
          flats: sample.flats || "",
          location: {
            floor: loc?.floor || "",
            flat_no: loc?.flat_no || loc?.flatNo || "",
            block: loc?.block || "",
            wing: loc?.wing || "",
            coordinates: loc?.coordinates || "",
          },
          item_description: normalizedItems.length
            ? normalizedItems.map((it) => {
              const itemFields = parseMaybe(it?.add_fields, []);
              const inventoryField = Array.isArray(itemFields)
                  ? itemFields.find((field) => String(field?.key || "") === "inventory_id")
                  : null;
                const itemName = getSamplePrimaryIdentifier(it, resolvedClient) || it.item_name || it.itemName || it.description || "";
                const brandName = it.brand_name || it.brandName || "";
                return {
                  sr_no: it.sr_no || "",
                  item_name: itemName,
                  item_code: it.item_code || it.itemCode || it.code || it.boq_item_code || it.hsn || "",
                  code: it.code || it.item_code || it.itemCode || it.boq_item_code || it.hsn || "",
                  brand_name: brandName,
                  description: it.description || itemName || "",
                  specification: it.specification || it.spec || "",
                  unit: it.unit || it.uom || it.UOM || "",
                  quantity: it.quantity || "",
                  value: it.value || "",
                  inventory_id: it.inventory_id ?? (inventoryField?.value ? Number(inventoryField.value) : null),
                  issued_qty: it.issued_qty ?? null,
                  boq_id: it.boq_id ?? (Array.isArray(itemFields) ? Number(itemFields.find((field) => String(field?.key || "") === "boq_id")?.value || null) : null),
                  boq_qty: it.boq_qty ?? (Array.isArray(itemFields) ? Number(itemFields.find((field) => String(field?.key || "") === "boq_qty")?.value || null) : null),
                  boq_issued_qty: it.boq_issued_qty ?? null,
                };
              })
            : [{ sr_no: "", item_name: "", item_code: "", code: "", brand_name: "", description: "", specification: "", unit: "", quantity: "", value: "", inventory_id: null, issued_qty: null, boq_id: null, boq_qty: null, boq_issued_qty: null }],
          add_fields: Array.isArray(adds)
            ? adds.map((f) => ({ key: f.key || "", value: f.value || "" }))
            : [],
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const save = async () => {
    const invalidInventory = (form.item_description || [])
      .map((item, index) => {
        const inventoryId = item?.inventory_id ? Number(item.inventory_id) : null;
        if (!inventoryId || !Number.isFinite(inventoryId)) return null;
        const status = inventoryQtyStatus?.[index];
        if (!status || status.valid !== false) return null;
        return { index, inventoryId, ...status };
      })
      .filter(Boolean);

    if (invalidInventory.length > 0) {
      const first = invalidInventory[0];
      toast({
        title: "Validation failed",
        description: `Row ${first.index + 1}: requested qty (${first.requestedQty}) exceeds available (${first.availableQty}).`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const nextAddFields = [
        ...(Array.isArray(form.add_fields) ? form.add_fields.filter((field) => String(field?.key || "").trim() !== "sample_client") : []),
        ...(sampleClient ? [{ key: "sample_client", value: sampleClient }] : []),
      ];
      const res = await api.updateSample(id, {
        building_name: form.building_name,
        site_name: form.site_name,
        work_done: form.work_done,
        sample_file: form.sample_file,
        flats: form.flats,
        flat_no: form.location?.flat_no || form.flats || "",
        location: {
          ...form.location,
          // Preserve a saved flat number when available; otherwise reuse the entered flat count.
          flat_no: form.location?.flat_no || form.flats || "",
        },
        item_description: form.item_description,
        add_fields: nextAddFields,
      });
      if (!res.success) {
        toast({ title: "Update failed", description: res.error || "Error", variant: "destructive" });
        return;
      }

      const boqSyncRes = await syncSampleBoqQuantities(api, sampleProjectId || effectiveProjectId, originalItemDescription, form.item_description);
      if (!boqSyncRes?.success) {
        toast({
          title: "Updated with BOQ warning",
          description: boqSyncRes?.error || "Could not sync BOQ quantities.",
          variant: "destructive",
        });
      }

      toast({ title: "Updated", description: "Sample updated" });
      navigate(`/${projectId}/samples/preview/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const fileUrl = form?.sample_file ? api.getApiFileUrl(form.sample_file) : null;
  const lower = String(form?.sample_file || "").toLowerCase();
  const isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
  const isPdf = lower.endsWith('.pdf');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-8 sm:px-6 lg:px-10">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Sample</h1>
          <p className="text-muted-foreground mt-2">Update sample details and save changes.</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/${projectId}/samples/preview/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Preview
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample #{id}</CardTitle>
          <CardDescription>Editing project sample data</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Building Name</Label>
                <Input value={form.building_name} onChange={(e) => setForm({ ...form, building_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Work Done</Label>
                <Input value={form.work_done} onChange={(e) => setForm({ ...form, work_done: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label>Floor</Label>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.location.floor}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        location: { ...form.location, floor: String(e.target.value || "").replace(/[^\d]/g, "") },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flats</Label>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.flats}
                    onChange={(e) => setForm({ ...form, flats: String(e.target.value || "").replace(/[^\d]/g, "") })}
                    placeholder="e.g. 12"
                  />
                  <p className="text-xs text-muted-foreground">Enter the flat count as a number.</p>
                </div>
                <div className="space-y-2">
                  <Label>Block</Label>
                  <Input value={form.location.block} onChange={(e) => setForm({ ...form, location: { ...form.location, block: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label>Wing</Label>
                  <Input value={form.location.wing} onChange={(e) => setForm({ ...form, location: { ...form.location, wing: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label>Coordinates</Label>
                  <Input value={form.location.coordinates} onChange={(e) => setForm({ ...form, location: { ...form.location, coordinates: e.target.value } })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Attachment</Label>
                {fileUrl ? (
                  <Button type="button" variant="outline" onClick={() => setAttachmentOpen(true)} className="mt-1">
                    <Eye className="mr-2 h-4 w-4" /> Preview Attachment
                  </Button>
                ) : (
                  <div className="text-sm text-muted-foreground">No attachment found</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Item Description</Label>
                  <Button size="sm" variant="outline" onClick={() => setForm({ ...form, item_description: [...form.item_description, { sr_no: "", item_name: "", brand_name: "", description: "", specification: "", unit: "", quantity: "", value: "", inventory_id: null, issued_qty: null, boq_id: null, boq_qty: null, boq_issued_qty: null }] })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Row
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.item_description.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-10 gap-3">
                      <Input placeholder="Sr No" value={row.sr_no} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], sr_no: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <div className="flex flex-col gap-2 md:col-span-3">
                        <Textarea className="min-h-20 resize-y" placeholder="Description" value={row.description} onChange={(e) => {
                          const next = [...form.item_description]; next[idx] = { ...next[idx], description: e.target.value }; setForm({ ...form, item_description: next });
                        }} />
                        <InventoryPicker
                          project_id={effectiveProjectId}
                          initialValue={row.description || ""}
                          selectedId={row.inventory_id}
                          minQty={Number(row.quantity) || 0}
                          onValidityChange={(status) => {
                            setInventoryQtyStatus((prev) => ({ ...(prev || {}), [idx]: status }));
                          }}
                          onSelect={(picked) => {
                            const next = [...form.item_description];
                            const qty = Number(next[idx]?.quantity);
                            next[idx] = {
                              ...next[idx],
                              inventory_id: picked.inventory_id,
                              issued_qty: next[idx]?.issued_qty ?? (Number.isFinite(qty) ? qty : null),
                            };
                            setForm({ ...form, item_description: next });
                          }}
                          onClear={() => {
                            const next = [...form.item_description];
                            next[idx] = { ...next[idx], inventory_id: null, issued_qty: null };
                            setForm({ ...form, item_description: next });
                          }}
                        />
                      </div>
                      <Input placeholder="Brand Name" value={row.brand_name || ""} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], brand_name: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Specification" value={row.specification || ""} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], specification: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Unit" value={row.unit || ""} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], unit: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Quantity" value={row.quantity} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], quantity: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Value" value={row.value} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], value: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Button size="sm" variant="destructive" onClick={() => {
                        const next = form.item_description.filter((_, i) => i !== idx);
                        setForm({ ...form, item_description: next });
                        setInventoryQtyStatus((prev) => {
                          const mapped = {};
                          Object.entries(prev || {}).forEach(([key, value]) => {
                            const index = Number(key);
                            if (!Number.isInteger(index)) return;
                            if (index === idx) return;
                            const nextIndex = index > idx ? index - 1 : index;
                            mapped[nextIndex] = value;
                          });
                          return mapped;
                        });
                      }}>
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Additional Fields</Label>
                  <Button size="sm" variant="outline" type="button" onClick={() => setForm({ ...form, add_fields: [...form.add_fields, { key: "", value: "" }] })}>
                    <Plus className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.add_fields.map((f, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                      <Input placeholder="Key" value={f.key} onChange={(e) => {
                        const next = [...form.add_fields]; next[idx] = { ...next[idx], key: e.target.value }; setForm({ ...form, add_fields: next });
                      }} />
                      <Input placeholder="Value" value={f.value} onChange={(e) => {
                        const next = [...form.add_fields]; next[idx] = { ...next[idx], value: e.target.value }; setForm({ ...form, add_fields: next });
                      }} />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setForm({ ...form, add_fields: form.add_fields.filter((_, i) => i !== idx) })}
                        className="md:w-auto w-full"
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => navigate(`/${projectId}/samples/preview/${id}`)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {fileUrl && (
        <Dialog open={attachmentOpen} onOpenChange={setAttachmentOpen}>
          <DialogContent className="h-[98vh] w-[99vw] max-w-[99vw]">
            <DialogHeader>
              <DialogTitle>Attachment Preview</DialogTitle>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/10 p-3">
              {isImage ? (
                <img src={fileUrl} alt="Sample File" className="max-h-[92vh] object-contain w-full rounded-md" />
              ) : isPdf ? (
                <iframe src={fileUrl} className="h-[92vh] w-full rounded-md" title="Sample Attachment Preview" />
              ) : (
                <div className="flex justify-center">
                  <Button asChild>
                    <a href={fileUrl} target="_blank" rel="noreferrer">Open Attachment</a>
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setAttachmentOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
