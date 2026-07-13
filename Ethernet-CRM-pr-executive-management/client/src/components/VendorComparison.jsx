import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Plus, ArrowRightLeft, DollarSign, ArrowLeft, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function VendorComparison({ onBack }) {
  const [vendors, setVendors] = useState([
    { id: 1, name: 'Vendor 1', products: [{ name: '', price: '' }] },
    { id: 2, name: 'Vendor 2', products: [{ name: '', price: '' }] }
  ]);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState([]);

  const addVendor = () => {
    setVendors([
      ...vendors,
      { id: Date.now(), name: `Vendor ${vendors.length + 1}`, products: [{ name: '', price: '' }] }
    ]);
  };

  const removeVendor = (id) => {
    setVendors(vendors.filter(v => v.id !== id));
  };

  const updateVendorName = (id, name) => {
    setVendors(vendors.map(v => v.id === id ? { ...v, name } : v));
  };

  const addProduct = (vendorId) => {
    setVendors(vendors.map(v => 
      v.id === vendorId 
        ? { ...v, products: [...v.products, { name: '', price: '' }] }
        : v
    ));
  };

  const removeProduct = (vendorId, index) => {
    setVendors(vendors.map(v => 
      v.id === vendorId 
        ? { ...v, products: v.products.filter((_, i) => i !== index) }
        : v
    ));
  };

  const updateProduct = (vendorId, index, field, value) => {
    setVendors(vendors.map(v => 
      v.id === vendorId 
        ? { 
            ...v, 
            products: v.products.map((p, i) => 
              i === index ? { ...p, [field]: value } : p
            ) 
          }
        : v
    ));
  };

  const compareAll = () => {
    const allProducts = new Set();
    const productMap = {};

    // Collect all unique normalized product names
    vendors.forEach(vendor => {
      vendor.products.forEach(product => {
        if (product.name && product.price) {
          const normalizedName = product.name.trim().toLowerCase();
          allProducts.add(normalizedName);
          
          if (!productMap[normalizedName]) {
            productMap[normalizedName] = { name: product.name, prices: {} };
          }
          productMap[normalizedName].prices[vendor.id] = parseFloat(product.price);
        }
      });
    });

    const result = Array.from(allProducts).map(key => {
      const item = productMap[key];
      const prices = Object.values(item.prices);
      const minPrice = Math.min(...prices);
      return {
        name: item.name,
        prices: item.prices,
        bestPrice: minPrice
      };
    });

    setComparisonData(result);
    setShowComparison(true);
  };

  const exportToExcel = () => {
    // Generate comparison data if not already generated
    const allProducts = new Set();
    const productMap = {};
    
    vendors.forEach(vendor => {
      vendor.products.forEach(product => {
        if (product.name && product.price) {
          const normalizedName = product.name.trim().toLowerCase();
          allProducts.add(normalizedName);
          if (!productMap[normalizedName]) {
            productMap[normalizedName] = { name: product.name, prices: {} };
          }
          productMap[normalizedName].prices[vendor.id] = parseFloat(product.price);
        }
      });
    });

    const data = Array.from(allProducts).map(key => {
      const item = productMap[key];
      const row = { 'Product Name': item.name };
      
      let minPrice = Infinity;
      vendors.forEach(v => {
        const price = item.prices[v.id];
        row[v.name] = price || '';
        if (price && price < minPrice) minPrice = price;
      });
      
      row['Best Price'] = minPrice === Infinity ? '' : minPrice;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    XLSX.writeFile(wb, "Vendor_Comparison.xlsx");
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Vendor Price Comparison</h2>
            <p className="text-muted-foreground">Compare product prices across multiple vendors</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={exportToExcel}>
            <Download className="mr-2 h-4 w-4" /> Export Excel
           </Button>
           <Button variant="outline" onClick={addVendor}>
            <Plus className="mr-2 h-4 w-4" /> Add Vendor
          </Button>
          <Button onClick={compareAll} disabled={vendors.length < 2}>
            <ArrowRightLeft className="mr-2 h-4 w-4" /> Compare All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((vendor) => (
          <Card key={vendor.id} className="relative shadow-md">
            <CardHeader className="pb-3 bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <Input 
                  value={vendor.name} 
                  onChange={(e) => updateVendorName(vendor.id, e.target.value)}
                  className="font-semibold text-lg h-9 bg-background"
                  placeholder="Vendor Name"
                />
                <Button variant="destructive" size="sm" onClick={() => removeVendor(vendor.id)}>
                  Delete
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {vendor.products.map((product, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input 
                      placeholder="Product Name" 
                      value={product.name}
                      onChange={(e) => updateProduct(vendor.id, index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <div className="relative w-28">
                      <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="number" 
                        placeholder="Price" 
                        value={product.price}
                        onChange={(e) => updateProduct(vendor.id, index, 'price', e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => removeProduct(vendor.id, index)} className="h-8 px-2 text-xs">
                      Delete
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2 border-dashed" onClick={() => addProduct(vendor.id)}>
                  <Plus className="mr-2 h-3 w-3" /> Add Product
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showComparison && comparisonData.length > 0 && (
        <Card className="mt-8 border-primary/20 shadow-lg animate-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-primary flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Comparison Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[200px]">Product Name</TableHead>
                  {vendors.map(v => (
                    <TableHead key={v.id} className="text-center font-bold">{v.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonData.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium bg-muted/10">{item.name}</TableCell>
                    {vendors.map(v => {
                      const price = item.prices[v.id];
                      const isBest = price === item.bestPrice;
                      return (
                        <TableCell key={v.id} className="text-center">
                          {price ? (
                            <div className={`flex items-center justify-center gap-2 ${isBest ? "text-green-600 font-bold" : ""}`}>
                              ${price}
                              {isBest && <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 shadow-none border-green-200">Best</Badge>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
