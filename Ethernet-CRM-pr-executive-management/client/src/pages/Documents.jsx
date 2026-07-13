import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderOpen, FileText, Search, Download, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

// Mock Document Data
const MOCK_DOCS = [
  { id: 1, name: "Lodha_Contract_Agreement.pdf", type: "Contract", project: "Lodha World One", date: "2026-01-10", size: "2.4 MB" },
  { id: 2, name: "Astral_Pipes_Catalog_2026.pdf", type: "Catalog", project: "General", date: "2026-01-05", size: "5.1 MB" },
  { id: 3, name: "PO_2026_005_Signed.pdf", type: "Purchase Order", project: "Lodha World One", date: "2026-02-12", size: "0.8 MB" },
  { id: 4, name: "Site_Safety_Guidelines.pdf", type: "Policy", project: "All", date: "2025-12-01", size: "1.2 MB" },
];

export default function Documents() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Document Repository</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Centralized storage for all project and product documents.</p>
        </div>
        <Button className="w-full sm:w-auto">
          <Upload className="mr-2 h-4 w-4" /> Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <FolderOpen className="h-8 w-8 text-blue-500 mr-2" />
            <div className="font-bold">Contracts</div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">12 Files</div>
          </CardContent>
        </Card>
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <FolderOpen className="h-8 w-8 text-yellow-500 mr-2" />
            <div className="font-bold">Invoices</div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">45 Files</div>
          </CardContent>
        </Card>
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <FolderOpen className="h-8 w-8 text-green-500 mr-2" />
            <div className="font-bold">Technical Specs</div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">28 Files</div>
          </CardContent>
        </Card>
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <FolderOpen className="h-8 w-8 text-purple-500 mr-2" />
            <div className="font-bold">Site Photos</div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">150+ Files</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
           <div className="flex items-center space-x-2 mt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              className="max-w-sm w-full"
            />
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {MOCK_DOCS.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-muted-foreground" />
                    <div>
                      <div className="font-medium truncate max-w-[200px]">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.type}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
                  <div>
                    <div className="text-muted-foreground text-xs">Project</div>
                    <div>{item.project}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Size</div>
                    <div>{item.size}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground text-xs">Date Uploaded</div>
                    <div>{item.date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date Uploaded</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_DOCS.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    {item.name}
                  </TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.project}</TableCell>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>{item.size}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
