import React, { useState } from 'react';
import { 
  Undo2, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Eye,
  FileText
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";

// Mock Data
const initialReturns = [
  {
    id: "RET-2024-001",
    item: "Power Drill",
    quantity: 1,
    returnedBy: "John Doe",
    department: "Maintenance",
    reason: "Project Completed",
    condition: "Good",
    date: "2024-03-20",
    status: "Pending Inspection"
  },
  {
    id: "RET-2024-002",
    item: "Copper Wire 2mm",
    quantity: 15,
    returnedBy: "Project Alpha",
    department: "Projects",
    reason: "Excess Material",
    condition: "Good",
    date: "2024-03-19",
    status: "Approved"
  },
  {
    id: "RET-2024-003",
    item: "Safety Helmet",
    quantity: 1,
    returnedBy: "Jane Smith",
    department: "Production",
    reason: "Damaged",
    condition: "Damaged",
    date: "2024-03-18",
    status: "Rejected"
  }
];

export default function Returns() {
  const { toast } = useToast();
  const [returns, setReturns] = useState(initialReturns);
  const [isNewReturnOpen, setIsNewReturnOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  
  // New Return State
  const [newReturn, setNewReturn] = useState({
    returnedBy: "",
    item: "",
    quantity: "",
    condition: "",
    reason: ""
  });

  // Inspection State
  const [inspectionData, setInspectionData] = useState({
    notes: "",
    targetLocation: ""
  });

  const handleStatusUpdate = (id, newStatus) => {
    if (newStatus === "Approved" && !inspectionData.targetLocation) {
        toast({
            title: "Error",
            description: "Please select a target warehouse/zone for approved items.",
            variant: "destructive",
        });
        return;
    }

    setReturns(returns.map(r => r.id === id ? { ...r, status: newStatus } : r));
    setSelectedReturn(null);
    setInspectionData({ notes: "", targetLocation: "" });
    
    toast({
      title: "Return Processed",
      description: `Return has been ${newStatus.toLowerCase()}.`,
    });
  };

  const handleCreateReturn = () => {
    if (!newReturn.returnedBy || !newReturn.item || !newReturn.quantity || !newReturn.condition) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const ret = {
      id: `RET-2024-${String(returns.length + 1).padStart(3, '0')}`,
      item: newReturn.item.split('|')[0] || "Unknown Item",
      quantity: parseInt(newReturn.quantity),
      returnedBy: newReturn.returnedBy.split('|')[0] || "Unknown User",
      department: newReturn.returnedBy.split('|')[1] || "General",
      reason: newReturn.reason || "No reason provided",
      condition: newReturn.condition,
      date: new Date().toISOString().split('T')[0],
      status: "Pending Inspection"
    };

    setReturns([ret, ...returns]);
    setIsNewReturnOpen(false);
    setNewReturn({ returnedBy: "", item: "", quantity: "", condition: "", reason: "" });
    
    toast({
      title: "Success",
      description: "Return initiated successfully.",
    });
  };

  const columns = [
    {
      accessorKey: "id",
      header: "Return ID",
      cell: ({ row }) => <div className="font-medium">{row.getValue("id")}</div>,
    },
    {
      accessorKey: "item",
      header: "Item",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.getValue("item")}</div>
          <div className="text-xs text-muted-foreground">{row.original.condition}</div>
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Qty",
    },
    {
      accessorKey: "returnedBy",
      header: "Returned By",
      cell: ({ row }) => (
        <div>
          <div>{row.getValue("returnedBy")}</div>
          <div className="text-xs text-muted-foreground">{row.original.department}</div>
        </div>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status");
        return (
          <Badge variant={
            status === "Approved" ? "default" :
            status === "Rejected" ? "destructive" :
            "secondary"
          }>
            {status}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            {row.original.status === "Pending Inspection" && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedReturn(row.original)}
              >
                Inspect
              </Button>
            )}
            <Button variant="ghost" size="icon">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Returns Management</h1>
          <p className="text-muted-foreground">
            Process items returned from projects and employees.
          </p>
        </div>
        <Button onClick={() => setIsNewReturnOpen(true)} className="w-full sm:w-auto">
          <Undo2 className="mr-2 h-4 w-4" /> New Return
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Inspection</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Items returned to stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected Returns</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Damaged / Unusable</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search returns..."
            className="pl-8 w-full"
          />
        </div>
        <Button variant="outline" className="flex gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4" />
          Status
        </Button>
      </div>

      <div className="hidden md:block">
        <DataTable columns={columns} data={returns} />
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {returns.map((ret) => (
          <Card key={ret.id}>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{ret.item}</div>
                  <div className="text-sm text-muted-foreground">{ret.id}</div>
                </div>
                <Badge variant={
                  ret.status === "Approved" ? "default" :
                  ret.status === "Rejected" ? "destructive" :
                  "secondary"
                }>
                  {ret.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                 <div>
                   <span className="text-muted-foreground block">Qty:</span>
                   <span>{ret.quantity}</span>
                 </div>
                 <div>
                   <span className="text-muted-foreground block">Condition:</span>
                   <span>{ret.condition}</span>
                 </div>
                 <div className="col-span-2">
                   <span className="text-muted-foreground block">Returned By:</span>
                   <span>{ret.returnedBy} ({ret.department})</span>
                 </div>
                 <div className="col-span-2">
                   <span className="text-muted-foreground block">Reason:</span>
                   <span>{ret.reason}</span>
                 </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                  {ret.status === "Pending Inspection" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setSelectedReturn(ret)}
                    >
                      Inspect
                    </Button>
                  )}
                  <Button variant="ghost" size="icon">
                    <Eye className="h-4 w-4" />
                  </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Return Dialog */}
      <Dialog open={isNewReturnOpen} onOpenChange={setIsNewReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Return</DialogTitle>
            <DialogDescription>
              Record an item being returned to inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Returned By</Label>
              <Select value={newReturn.returnedBy} onValueChange={(val) => setNewReturn({...newReturn, returnedBy: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee or project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="John Doe|Maintenance">John Doe (Maintenance)</SelectItem>
                  <SelectItem value="Project Alpha|Projects">Project Alpha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={newReturn.item} onValueChange={(val) => setNewReturn({...newReturn, item: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Power Drill|TOOL-001">Power Drill</SelectItem>
                  <SelectItem value="Copper Wire|MAT-002">Copper Wire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input 
                    type="number" 
                    min="1" 
                    value={newReturn.quantity}
                    onChange={(e) => setNewReturn({...newReturn, quantity: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={newReturn.condition} onValueChange={(val) => setNewReturn({...newReturn, condition: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Good">Good / Unused</SelectItem>
                    <SelectItem value="Used">Used / Functional</SelectItem>
                    <SelectItem value="Damaged">Damaged / Scrap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason for Return</Label>
              <Textarea 
                placeholder="Why is this being returned?" 
                value={newReturn.reason}
                onChange={(e) => setNewReturn({...newReturn, reason: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewReturnOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateReturn}>Create Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspection Dialog */}
      <Dialog open={!!selectedReturn} onOpenChange={(open) => !open && setSelectedReturn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inspect Return: {selectedReturn?.id}</DialogTitle>
            <DialogDescription>
              Verify item condition and approve stock addition.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Item:</span>
                <span className="font-medium">{selectedReturn?.item}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Quantity:</span>
                <span className="font-medium">{selectedReturn?.quantity}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Returned By:</span>
                <span className="font-medium">{selectedReturn?.returnedBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Stated Condition:</span>
                <span className="font-medium">{selectedReturn?.condition}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Inspection Notes</Label>
              <Textarea 
                placeholder="Verify condition, check for defects..." 
                value={inspectionData.notes}
                onChange={(e) => setInspectionData({...inspectionData, notes: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Target Warehouse/Zone</Label>
              <Select
                value={inspectionData.targetLocation}
                onValueChange={(val) => setInspectionData({...inspectionData, targetLocation: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Where to store it?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wh-main-a">Main Warehouse - Zone A</SelectItem>
                  <SelectItem value="wh-scrap">Scrap Yard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <div className="flex gap-2 w-full justify-end">
              <Button 
                variant="destructive" 
                onClick={() => handleStatusUpdate(selectedReturn.id, "Rejected")}
              >
                Reject
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleStatusUpdate(selectedReturn.id, "Approved")}
              >
                Approve & Add to Stock
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
