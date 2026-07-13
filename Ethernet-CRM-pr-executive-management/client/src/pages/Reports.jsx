import React, { useState } from 'react';
import { 
  FileBarChart, 
  Download, 
  Calendar, 
  Filter, 
  PieChart, 
  TrendingUp,
  BarChart3,
  DollarSign
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
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

// Mock Data
const stockValueData = [
  { name: 'Jan', rawMaterial: 4000, finishedGoods: 2400, wip: 2400 },
  { name: 'Feb', rawMaterial: 3000, finishedGoods: 1398, wip: 2210 },
  { name: 'Mar', rawMaterial: 2000, finishedGoods: 9800, wip: 2290 },
  { name: 'Apr', rawMaterial: 2780, finishedGoods: 3908, wip: 2000 },
  { name: 'May', rawMaterial: 1890, finishedGoods: 4800, wip: 2181 },
  { name: 'Jun', rawMaterial: 2390, finishedGoods: 3800, wip: 2500 },
];

const movementData = [
  { name: 'Mon', inbound: 40, outbound: 24 },
  { name: 'Tue', inbound: 30, outbound: 13 },
  { name: 'Wed', inbound: 20, outbound: 98 },
  { name: 'Thu', inbound: 27, outbound: 39 },
  { name: 'Fri', inbound: 18, outbound: 48 },
  { name: 'Sat', inbound: 23, outbound: 38 },
  { name: 'Sun', inbound: 34, outbound: 43 },
];

export default function Reports() {
  const [dateRange, setDateRange] = useState("this_month");
  const { toast } = useToast();

  const handleExport = () => {
    toast({
        title: "Report Exported",
        description: `Inventory report for ${dateRange.replace('_', ' ')} has been downloaded.`,
    });
  };

  const handleCreatePO = (id) => {
    toast({
        title: "Purchase Order Created",
        description: `Draft PO created for Item #${id}. Check Purchase Orders page.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into inventory performance.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_quarter">Last Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory Summary</TabsTrigger>
          <TabsTrigger value="valuation">Stock Valuation</TabsTrigger>
          <TabsTrigger value="movement">Stock Movement</TabsTrigger>
          <TabsTrigger value="low_stock">Low Stock Report</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <FileBarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12,345</div>
                <p className="text-xs text-muted-foreground">+180 from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹1.2M</div>
                <p className="text-xs text-muted-foreground">+2.5% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24</div>
                <p className="text-xs text-muted-foreground">Items need attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Turnover Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4.5</div>
                <p className="text-xs text-muted-foreground">Rotations per year</p>
              </CardContent>
            </Card>
          </div>

          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Inventory Composition</CardTitle>
              <CardDescription>Breakdown by category over time</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stockValueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="rawMaterial" stackId="1" stroke="#8884d8" fill="#8884d8" name="Raw Materials" />
                  <Area type="monotone" dataKey="wip" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Work in Progress" />
                  <Area type="monotone" dataKey="finishedGoods" stackId="1" stroke="#ffc658" fill="#ffc658" name="Finished Goods" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="valuation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Valuation Analysis</CardTitle>
              <CardDescription>Monthly value tracking by category</CardDescription>
            </CardHeader>
            <CardContent className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockValueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis prefix="₹" />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Legend />
                  <Bar dataKey="rawMaterial" fill="hsl(var(--primary))" name="Raw Materials" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="wip" fill="hsl(var(--primary) / 0.6)" name="Work in Progress" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="finishedGoods" fill="hsl(var(--primary) / 0.3)" name="Finished Goods" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Stock Movement</CardTitle>
              <CardDescription>Inbound vs Outbound transactions</CardDescription>
            </CardHeader>
            <CardContent className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movementData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="inbound" stroke="hsl(var(--primary))" strokeWidth={2} name="Inbound (Received)" />
                  <Line type="monotone" dataKey="outbound" stroke="hsl(var(--destructive))" strokeWidth={2} name="Outbound (Issued)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="low_stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Alerts</CardTitle>
              <CardDescription>Items below reorder point</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">Item Name {i}</div>
                      <div className="text-sm text-muted-foreground">SKU: ITEM-00{i}</div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 w-full md:w-auto">
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <div className="text-sm text-muted-foreground">Current Stock</div>
                        <div className="font-bold text-red-600">5 Units</div>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <div className="text-sm text-muted-foreground">Reorder Point</div>
                        <div className="font-medium">20 Units</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleCreatePO(i)} className="w-full sm:w-auto">Create PO</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
