import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UnitSelect, AREA_UNITS, convertPricePerUnit, convertQuantity } from "@/components/forms/UnitSelect";

export function PriceListItemsManualEntry({
  items,
  onAdd,
  onRemove,
  onChange,
  title = 'Items',
  description = 'Enter each line item manually.',
  addLabel = 'Add Item',
}) {
  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const computeNetPrice = (item) => {
    const price = toNumber(item.price);
    const discount = toNumber(item.discount_percent);
    if (price == null) return "";
    if (discount == null) return String(price);
    const next = price - (price * Math.max(0, Math.min(100, discount))) / 100;
    const rounded = Math.round(next * 1e6) / 1e6;
    return String(rounded);
  };

  const areaUnitSet = new Set(AREA_UNITS);

  const updateWithAdaptiveCalc = (index, key, value) => {
    const prevItem = items[index] || {};
    onChange(index, key, value);

    const nextItem = { ...prevItem, [key]: value };
    const unitKey = String(nextItem.units || '').trim().toUpperCase();
    const isArea = areaUnitSet.has(unitKey);

    if (key === "units" && prevItem.units && prevItem.units !== value) {
      const converted = convertQuantity(nextItem.quantity, prevItem.units, value);
      if (converted != null && !isArea) {
        onChange(index, "quantity", converted);
      }
      const convertedPrice = convertPricePerUnit(nextItem.price, prevItem.units, value);
      if (convertedPrice != null) {
        onChange(index, "price", convertedPrice);
      }
    }

    if (!isArea) return;

    const width = toNumber(nextItem.width);
    const height = toNumber(nextItem.height);
    if (width == null || height == null) {
      if (key === "units" && prevItem.units && prevItem.units !== value) {
        const converted = convertQuantity(nextItem.quantity, prevItem.units, value);
        if (converted != null) {
          onChange(index, "quantity", converted);
        }
      }
      return;
    }

    const area = width * height;
    if (!Number.isFinite(area) || area <= 0) return;

    const rounded = Math.round(area * 1000) / 1000;
    onChange(index, 'quantity', String(rounded));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Total items: {items.length}</div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" /> {addLabel}
          </Button>
        </div>

        {items.map((item, index) => (
          <div key={`manual-item-${index}`} className="rounded-lg border bg-background p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-medium">Item {index + 1}</div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onRemove(index)}
                disabled={items.length === 1}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={item.name || ''} onChange={(e) => onChange(index, 'name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Brand</Label>
                <Input value={item.brand || ''} onChange={(e) => onChange(index, 'brand', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input type="number" value={item.quantity ?? ''} onChange={(e) => onChange(index, 'quantity', e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Units</Label>
                <UnitSelect
                  value={item.units || ""}
                  onValueChange={(value) => updateWithAdaptiveCalc(index, "units", value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Price</Label>
                <Input type="number" value={item.price ?? ''} onChange={(e) => onChange(index, 'price', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={item.discount_percent ?? ''}
                  onChange={(e) => onChange(index, 'discount_percent', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Net Price</Label>
                <Input value={computeNetPrice(item)} readOnly className="bg-muted" />
              </div>

              <div className="space-y-1">
                <Label>Width</Label>
                <Input
                  type="number"
                  value={item.width ?? ''}
                  onChange={(e) => updateWithAdaptiveCalc(index, 'width', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Height</Label>
                <Input
                  type="number"
                  value={item.height ?? ''}
                  onChange={(e) => updateWithAdaptiveCalc(index, 'height', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Stock Status</Label>
                <Select
                  value={item.stockin || ''}
                  onValueChange={(value) => onChange(index, 'stockin', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stock status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock_in">Stock In</SelectItem>
                    <SelectItem value="stock_out">Stock Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Billing Status</Label>
                <Select
                  value={item.billing || ''}
                  onValueChange={(value) => onChange(index, 'billing', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select billing status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing_in">Billing In</SelectItem>
                    <SelectItem value="billing_out">Billing Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Project Id</Label>
                <Input value={item.project_id ?? ''} onChange={(e) => onChange(index, 'project_id', e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <Label>Notes</Label>
                <Input value={item.notes || ''} onChange={(e) => onChange(index, 'notes', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
