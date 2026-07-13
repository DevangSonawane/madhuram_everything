import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/**
 * DiagramViewer Component
 * Displays extracted PDF diagrams in a modal with navigation and extracted values
 * 
 * @param {boolean} open - Whether the modal is open
 * @param {function} onOpenChange - Callback when modal state changes
 * @param {Array} diagrams - Array of { pageNumber, imageDataUrl, width, height, values }
 * @param {Array} extractedValues - Array of extracted CPVC items
 */
export default function DiagramViewer({ open, onOpenChange, diagrams = [], extractedValues = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  if (!diagrams || diagrams.length === 0) {
    return null;
  }

  const currentDiagram = diagrams[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < diagrams.length - 1;

  const handlePrev = () => {
    if (canGoPrev) {
      setCurrentIndex(currentIndex - 1);
      setZoom(1); // Reset zoom when changing pages
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setCurrentIndex(currentIndex + 1);
      setZoom(1); // Reset zoom when changing pages
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' && canGoPrev) {
      handlePrev();
    } else if (e.key === 'ArrowRight' && canGoNext) {
      handleNext();
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  // Filter values that might be related to current page (simple heuristic)
  let pageValues = extractedValues.filter((item, idx) => {
    // Show all values, or you could filter by page number if available
    return true;
  });

  // Apply search filter
  if (searchQuery) {
    pageValues = pageValues.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      return (
        (item.name && item.name.toLowerCase().includes(searchLower)) ||
        (item.unit && item.unit.toLowerCase().includes(searchLower)) ||
        (item.dimensions && item.dimensions.toLowerCase().includes(searchLower)) ||
        (item.specifications && item.specifications.toLowerCase().includes(searchLower)) ||
        (item.quantity && item.quantity.toString().includes(searchQuery)) ||
        (item.floor && item.floor.toString().includes(searchQuery))
      );
    });
  }

  // Group values by type (CPVC vs Suspended Work)
  const cpvcValues = pageValues.filter(item => !item.workType || item.workType !== 'Suspended');
  const suspendedValues = pageValues.filter(item => item.workType === 'Suspended');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-7xl w-full h-[90vh] p-0 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Diagrams & Extracted Values</DialogTitle>
          <DialogDescription>
            Page {currentIndex + 1} of {diagrams.length} (CPVC & Suspended Work)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden p-6">
          {/* Left side: Diagram */}
          <div className="flex-1 flex flex-col bg-muted/20 rounded-lg p-4 overflow-hidden relative">
            <div className="flex-1 flex items-center justify-center overflow-auto">
              {currentDiagram && (
                <div className="relative max-w-full max-h-full">
                  <img
                    src={currentDiagram.imageDataUrl}
                    alt={`Diagram Page ${currentDiagram.pageNumber}`}
                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: 'center',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Controls Container */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2">
              {/* Navigation Controls */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={!canGoPrev}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={!canGoNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              
              {/* Zoom Controls */}
              <div className="flex justify-center">
                <div className="flex gap-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="px-3 py-1 text-sm font-medium min-w-[60px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Extracted Values */}
          <div className="w-96 flex flex-col border rounded-lg overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b space-y-3">
                <div>
                  <CardTitle className="text-lg">Extracted Values</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {pageValues.length} items found
                    {cpvcValues.length > 0 && suspendedValues.length > 0 && (
                      <span className="ml-2">
                        ({cpvcValues.length} CPVC, {suspendedValues.length} Suspended)
                      </span>
                    )}
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search values..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-0">
                {pageValues.length > 0 ? (
                  <div className="p-4 space-y-4">
                    {/* CPVC Items */}
                    {cpvcValues.length > 0 && (
                      <>
                        {cpvcValues.length > 0 && suspendedValues.length > 0 && (
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            CPVC Items
                          </div>
                        )}
                        {cpvcValues.map((item, idx) => (
                          <div
                            key={`cpvc-${idx}`}
                            className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{item.name || `Item ${idx + 1}`}</h4>
                                {item.dimensions && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Dimensions: {item.dimensions}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {item.unit && (
                                  <Badge variant="outline" className="ml-2">
                                    {item.unit}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-xs">CPVC</Badge>
                              </div>
                            </div>
                            
                            {item.quantity && (
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">Quantity:</span>
                                <span className="font-medium">{item.quantity}</span>
                              </div>
                            )}

                            {item.specifications && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Specs:</span> {item.specifications}
                              </div>
                            )}

                            {item.floor && (
                              <div className="text-xs">
                                <Badge variant="secondary">Floor: {item.floor}</Badge>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {/* Suspended Work Items */}
                    {suspendedValues.length > 0 && (
                      <>
                        {cpvcValues.length > 0 && suspendedValues.length > 0 && (
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">
                            Suspended Work Items
                          </div>
                        )}
                        {suspendedValues.map((item, idx) => (
                          <div
                            key={`suspended-${idx}`}
                            className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors border-orange-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{item.name || `Suspended Item ${idx + 1}`}</h4>
                                {item.dimensions && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Dimensions: {item.dimensions}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {item.unit && (
                                  <Badge variant="outline" className="ml-2">
                                    {item.unit}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                                  Suspended
                                </Badge>
                              </div>
                            </div>
                            
                            {item.quantity && (
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">Quantity:</span>
                                <span className="font-medium">{item.quantity}</span>
                              </div>
                            )}

                            {item.specifications && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Specs:</span> {item.specifications}
                              </div>
                            )}

                            {item.floor && (
                              <div className="text-xs">
                                <Badge variant="secondary">Floor: {item.floor}</Badge>
                              </div>
                            )}

                            {item.status && (
                              <div className="text-xs">
                                <Badge variant={item.status === 'Suspended' ? 'secondary' : 'outline'}>
                                  Status: {item.status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No values extracted from this page</p>
                    <p className="text-xs mt-2">Values are extracted from the entire document</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Page Indicator */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
          <div className="flex gap-2">
            {diagrams.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoom(1);
                }}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? 'w-8 bg-primary'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to page ${idx + 1}`}
              />
            ))}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
