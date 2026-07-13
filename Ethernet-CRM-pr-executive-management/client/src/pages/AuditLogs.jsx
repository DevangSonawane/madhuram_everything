import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Activity,
  FileText
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";

// Mock Data
const logs = [
  {
    id: "LOG-1001",
    timestamp: "2024-03-20 14:30:22",
    user: "Admin User",
    action: "CREATE",
    entity: "Purchase Order",
    entityId: "PO-2024-001",
    details: "Created new PO for Acme Supplies",
    ip: "192.168.1.10"
  },
  {
    id: "LOG-1002",
    timestamp: "2024-03-20 12:15:00",
    user: "John Doe",
    action: "UPDATE",
    entity: "Stock Item",
    entityId: "MAT-001",
    details: "Updated stock quantity: 500 -> 450",
    ip: "192.168.1.25"
  },
  {
    id: "LOG-1003",
    timestamp: "2024-03-19 09:45:11",
    user: "Jane Smith",
    action: "DELETE",
    entity: "Return Request",
    entityId: "RET-2024-003",
    details: "Deleted rejected return request",
    ip: "192.168.1.30"
  },
  {
    id: "LOG-1004",
    timestamp: "2024-03-19 08:30:00",
    user: "System",
    action: "LOGIN",
    entity: "Session",
    entityId: "-",
    details: "User Jane Smith logged in",
    ip: "192.168.1.30"
  },
  {
    id: "LOG-1005",
    timestamp: "2024-03-18 16:20:45",
    user: "Mike Johnson",
    action: "APPROVE",
    entity: "Material Request",
    entityId: "MR-2024-055",
    details: "Approved request for Production Line 1",
    ip: "192.168.1.15"
  }
];

export default function AuditLogs() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all_actions");
  const [userFilter, setUserFilter] = useState("all_users");

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === "all_actions" || log.action.toLowerCase() === actionFilter.toLowerCase();
    const matchesUser = userFilter === "all_users" || 
      (userFilter === "admin" && log.user === "Admin User") ||
      (userFilter === "john" && log.user === "John Doe") ||
      (userFilter === "jane" && log.user === "Jane Smith") ||
      (userFilter === "mike" && log.user === "Mike Johnson");

    return matchesSearch && matchesAction && matchesUser;
  });

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Audit logs are being exported to CSV.",
    });
    // Simulate download
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: "Your file has been downloaded successfully.",
      });
    }, 2000);
  };

  const columns = [
    {
      accessorKey: "timestamp",
      header: "Timestamp",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="font-mono text-xs">{row.getValue("timestamp")}</span>
        </div>
      ),
    },
    {
      accessorKey: "user",
      header: "User",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{row.getValue("user")}</span>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => {
        const action = row.getValue("action");
        const variant = 
          action === "CREATE" ? "default" :
          action === "UPDATE" ? "secondary" :
          action === "DELETE" ? "destructive" :
          action === "APPROVE" ? "outline" : "outline";
        
        return <Badge variant={variant}>{action}</Badge>;
      },
    },
    {
      accessorKey: "entity",
      header: "Entity",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.getValue("entity")}</span>
          <span className="text-xs text-muted-foreground">{row.original.entityId}</span>
        </div>
      ),
    },
    {
      accessorKey: "details",
      header: "Details",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate" title={row.getValue("details")}>
          {row.getValue("details")}
        </div>
      ),
    },
    {
      accessorKey: "ip",
      header: "IP Address",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue("ip")}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track system activity and user actions for security and compliance.
          </p>
        </div>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" /> Export Logs
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15,231</div>
            <p className="text-xs text-muted-foreground">Events logged this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Actions</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">Deletions & security changes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-muted-foreground">Users active today</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_actions">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="login">Login</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_users">All Users</SelectItem>
              <SelectItem value="admin">Admin User</SelectItem>
              <SelectItem value="john">John Doe</SelectItem>
              <SelectItem value="jane">Jane Smith</SelectItem>
              <SelectItem value="mike">Mike Johnson</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="hidden md:block">
        <DataTable columns={columns} data={logs} />
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredLogs.map((log) => (
          <Card key={log.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-sm">{log.user}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="font-mono">{log.timestamp}</span>
                  </div>
                </div>
                <Badge variant={
                  log.action === "CREATE" ? "default" :
                  log.action === "UPDATE" ? "secondary" :
                  log.action === "DELETE" ? "destructive" :
                  "outline"
                }>{log.action}</Badge>
              </div>

              <div className="space-y-2 text-sm border-t pt-2">
                <div>
                  <span className="text-muted-foreground text-xs">Entity:</span>
                  <div className="font-medium">{log.entity} <span className="text-xs text-muted-foreground">({log.entityId})</span></div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Details:</span>
                  <p className="text-sm">{log.details}</p>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  IP: {log.ip}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
