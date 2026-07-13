import React, { useState } from 'react';
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const initialData = [
  {
    id: "MAT-001",
    name: "Cement Grade 53",
    category: "Raw Material",
    unit: "Bags",
    stock: 450,
    price: 350.00,
    status: "In Stock"
  },
  {
    id: "MAT-002",
    name: "Steel Rods 10mm",
    category: "Raw Material",
    unit: "Kg",
    stock: 1200,
    price: 65.50,
    status: "In Stock"
  },
  {
    id: "MAT-003",
    name: "Bricks (Red)",
    category: "Construction",
    unit: "Nos",
    stock: 50,
    price: 8.00,
    status: "Low Stock"
  },
  {
    id: "MAT-004",
    name: "Paint (White Emulsion)",
    category: "Finishing",
    unit: "Liters",
    stock: 0,
    price: 1200.00,
    status: "Out of Stock"
  },
   {
    id: "MAT-005",
    name: "Sand (River)",
    category: "Raw Material",
    unit: "Tons",
    stock: 25,
    price: 4500.00,
    status: "In Stock"
  },
];

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { UnitSelect } from "@/components/forms/UnitSelect";

export default function Materials() {
  const [data, setData] = useState(initialData);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    category: "",
    unit: "",
    price: "",
    stock: 0,
    status: "In Stock"
  });
  const { toast } = useToast();

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setNewMaterial((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSelectChange = (value) => {
    setNewMaterial((prev) => ({
      ...prev,
      category: value,
    }));
  };

  const handleAddMaterial = () => {
    if (!newMaterial.name || !newMaterial.category || !newMaterial.unit || !newMaterial.price) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const material = {
      id: `MAT-${String(data.length + 1).padStart(3, '0')}`,
      ...newMaterial,
      price: parseFloat(newMaterial.price),
      stock: parseInt(newMaterial.stock) || 0,
      status: parseInt(newMaterial.stock) > 10 ? "In Stock" : parseInt(newMaterial.stock) > 0 ? "Low Stock" : "Out of Stock"
    };

    setData([...data, material]);
    setIsAddDialogOpen(false);
    setNewMaterial({
      name: "",
      category: "",
      unit: "",
      price: "",
      stock: 0,
      status: "In Stock"
    });
    
    toast({
      title: "Success",
      description: "Material added successfully.",
    });
  };

  const columns = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "category",
      header: "Category",
    },
    {
      accessorKey: "unit",
      header: "Unit",
    },
    {
      accessorKey: "stock",
      header: "Stock Level",
      cell: ({ row }) => {
        const stock = parseFloat(row.getValue("stock"))
        return (
          <div className="font-medium">
              {stock}
          </div>
        )
      }
    },
    {
      accessorKey: "price",
      header: "Unit Price",
      cell: ({ row }) => {
        const price = parseFloat(row.getValue("price"))
        const formatted = new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(price)
        return <div className="font-medium">{formatted}</div>
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
          const status = row.getValue("status");
          let variant = "default";
          if (status === "Low Stock") variant = "warning"; 
          if (status === "Out of Stock") variant = "destructive";
          if (status === "In Stock") variant = "outline"; 
  
          let className = "";
          if (status === "In Stock") className = "bg-green-100 text-green-800 hover:bg-green-100 border-green-200";
          if (status === "Low Stock") className = "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200";
          if (status === "Out of Stock") className = "bg-red-100 text-red-800 hover:bg-red-100 border-red-200";
  
          return <Badge variant="outline" className={className}>{status}</Badge>
      }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const payment = row.original
   
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(payment.id)}
              >
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                  Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Materials</h1>
            <p className="text-muted-foreground">Manage your inventory materials and stock levels.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Add Material
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Material</DialogTitle>
              <DialogDescription>
                Enter the details of the new material here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newMaterial.name}
                  onChange={handleInputChange}
                  className="col-span-3"
                  placeholder="e.g. Cement"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Category
                </Label>
                <Select onValueChange={handleSelectChange} value={newMaterial.category}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Raw Material">Raw Material</SelectItem>
                    <SelectItem value="Construction">Construction</SelectItem>
                    <SelectItem value="Finishing">Finishing</SelectItem>
                    <SelectItem value="Tools">Tools</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit" className="text-right">
                  Unit
                </Label>
                <UnitSelect
                  value={newMaterial.unit}
                  onValueChange={(value) => setNewMaterial((prev) => ({ ...prev, unit: value }))}
                  triggerClassName="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">
                  Price
                </Label>
                <Input
                  id="price"
                  type="number"
                  value={newMaterial.price}
                  onChange={handleInputChange}
                  className="col-span-3"
                  placeholder="0.00"
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stock" className="text-right">
                  Initial Stock
                </Label>
                <Input
                  id="stock"
                  type="number"
                  value={newMaterial.stock}
                  onChange={handleInputChange}
                  className="col-span-3"
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddMaterial}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {data.map((material) => (
            <Card key={material.id}>
                <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="font-semibold text-base">{material.name}</div>
                            <div className="text-xs text-muted-foreground">{material.id}</div>
                        </div>
                        {columns.find(c => c.accessorKey === 'status').cell({ row: { getValue: () => material.status } })}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span className="text-muted-foreground text-xs block">Category</span>
                            <span className="font-medium">{material.category}</span>
                        </div>
                         <div>
                            <span className="text-muted-foreground text-xs block">Unit</span>
                            <span className="font-medium">{material.unit}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground text-xs block">Stock Level</span>
                            <span className="font-medium">{material.stock}</span>
                        </div>
                         <div>
                            <span className="text-muted-foreground text-xs block">Unit Price</span>
                            <span className="font-medium">
                                {new Intl.NumberFormat("en-IN", {
                                    style: "currency",
                                    currency: "INR",
                                }).format(material.price)}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <DataTable columns={columns} data={data} searchKey="name" />
      </div>
    </div>
  );
}
