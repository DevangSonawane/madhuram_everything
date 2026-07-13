import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumberIN } from "@/lib/numberFormat";

const normalizeKey = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const prettyLabel = (value) =>
  String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toNumber = (value) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const num = toNumber(value);
  if (!Number.isFinite(num)) return "";
  if (num % 1 === 0) return formatNumberIN(num, { maximumFractionDigits: 0 });
  return formatNumberIN(num, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const parseFormattedNumber = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replace(/,/g, "");
};

const getItemNumber = (row) => {
  if (!row || typeof row !== "object") return "";
  const candidate =
    row.item_no ??
    row.itemNo ??
    row.item_code ??
    row.itemCode ??
    row.code ??
    row.item ??
    "";
  const text = String(candidate ?? "").trim();
  return text;
};

const isNumericColumn = (columnName) => {
  const k = normalizeKey(columnName);
  const numericKeys = new Set([
    "quantity",
    "rate",
    "amount",
    "basicrate",
    "discount",
    "finalrateafterdiscount",
    "fittings",
    "transportation",
    "support",
    "miscellaneous",
    "totalmaterialprice",
    "labour",
    "materialpluslabour",
    "profit",
    "totalrate",
  ]);
  if (numericKeys.has(k)) return true;
  if (k.includes("qty") || k.includes("quantity")) return true;
  if (k.includes("rate") || k.includes("amount") || k.includes("price") || k.includes("total")) return true;
  if (k.includes("discount") || k.includes("profit")) return true;
  return false;
};

const columnIndexToName = (index) => {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

export default function QuoteLineItemsExcel({
  items,
  columns,
  columnLabels,
  mode = "view", // "view" | "edit"
  readOnlyColumns,
  onCellChange,
  onAddRow,
  onAddColumn,
  onInsertColumnAfter,
  onRemoveColumn,
  onMoveColumn,
  onRenameColumn,
  onInsertRow,
  onRemoveRow,
  onMoveRow,
  className = "",
}) {
  const INITIAL_ROWS = 50;
  const PAGE_ROWS = 50;

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const safeColumns = useMemo(() => (Array.isArray(columns) ? columns : []), [columns]);
  const readOnlySet = useMemo(() => {
    if (!readOnlyColumns) return new Set();
    if (Array.isArray(readOnlyColumns)) {
      return new Set(readOnlyColumns.map((c) => normalizeKey(c)));
    }
    if (readOnlyColumns instanceof Set) {
      return new Set(Array.from(readOnlyColumns).map((c) => normalizeKey(c)));
    }
    return new Set();
  }, [readOnlyColumns]);
  // Preserve the exact sheet column order so "insert after" behaves like Excel.
  const orderedColumns = safeColumns;

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const isFiltered = Boolean(String(deferredSearch || "").trim());
  const [rowLimit, setRowLimit] = useState(INITIAL_ROWS);
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState(null); // {row, col} | null
  const [editDraft, setEditDraft] = useState("");
  const gridRef = useRef(null);
  const scrollerRef = useRef(null);
  const autoLoadRafRef = useRef(0);

  const rowHeight = 32;
  const headerHeight = 36;
  const footerHeight = mode === "edit" ? 32 : 0;
  const overscan = 8;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRafRef = useRef(0);
  const draggingColRef = useRef(null);
  const draggingRowRef = useRef(null);
  const [renamingCol, setRenamingCol] = useState(null); // { colIdx, draft } | null

  const filteredRowIndexes = useMemo(() => {
    const q = String(deferredSearch || "").trim().toLowerCase();
    if (!q) return safeItems.map((_, idx) => idx);
    return safeItems
      .map((row, idx) => {
        const hay = orderedColumns
          .slice(0, 8)
          .map((c) => String(row?.[c] ?? ""))
          .join(" ")
          .toLowerCase();
        return hay.includes(q) ? idx : -1;
      })
      .filter((idx) => idx >= 0);
  }, [deferredSearch, orderedColumns, safeItems]);

  const visibleRowIndexes = useMemo(() => {
    if (isFiltered) return filteredRowIndexes;
    return filteredRowIndexes.slice(0, Math.min(rowLimit, filteredRowIndexes.length));
  }, [filteredRowIndexes, isFiltered, rowLimit]);
  const rowCount = visibleRowIndexes.length;
  const getColumnLabel = (key) => {
    const labels = columnLabels && typeof columnLabels === "object" ? columnLabels : {};
    const v = labels[key];
    return v == null || v === "" ? prettyLabel(key) : String(v);
  };

  const setCellValue = (rowIndex, colIndex, nextValue) => {
    const col = orderedColumns[colIndex];
    if (!col) return;
    const numeric = isNumericColumn(col);
    onCellChange?.(rowIndex, col, numeric ? parseFormattedNumber(nextValue) : nextValue);
  };

  const clampCell = (cell) => ({
    row: Math.max(0, Math.min(rowCount - 1, cell.row)),
    col: Math.max(0, Math.min(orderedColumns.length - 1, cell.col)),
  });

  const selectedRowIndex = visibleRowIndexes[selectedCell.row] ?? visibleRowIndexes[0] ?? 0;
  const selectedColName = orderedColumns[selectedCell.col] ?? orderedColumns[0] ?? "";
  const selectedRawValue = selectedColName ? (safeItems[selectedRowIndex]?.[selectedColName] ?? "") : "";
  const selectedDisplayValue = isNumericColumn(selectedColName)
    ? formatNumber(selectedRawValue)
    : String(selectedRawValue ?? "");

  const focusGrid = () => {
    const el = gridRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  };

  const canViewMore = !isFiltered && rowLimit < filteredRowIndexes.length;
  const maybeAutoLoadMore = useCallback((scrollerEl) => {
    if (!canViewMore) return;
    if (!scrollerEl) return;
    const thresholdPx = 220;
    const nearBottom =
      scrollerEl.scrollTop + scrollerEl.clientHeight >= scrollerEl.scrollHeight - thresholdPx;
    if (!nearBottom) return;
    setRowLimit((prev) => Math.min(filteredRowIndexes.length, prev + PAGE_ROWS));
  }, [canViewMore, filteredRowIndexes.length]);

  const clearFilterAndFocus = () => {
    if (search) setSearch("");
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollTop = 0;
      focusGrid();
    });
  };

  const viewMore = () => {
    setRowLimit((prev) => Math.min(filteredRowIndexes.length, prev + PAGE_ROWS));
    requestAnimationFrame(() => {
      focusGrid();
      const scroller = scrollerRef.current;
      if (scroller) maybeAutoLoadMore(scroller);
    });
  };

  const insertColumnAfterSelected = () => {
    if (!orderedColumns.length) {
      onAddColumn?.();
      return;
    }
    if (onInsertColumnAfter) {
      const colName = orderedColumns[selectedCell.col] ?? orderedColumns[orderedColumns.length - 1];
      onInsertColumnAfter(colName, selectedCell.col);
      return;
    }
    onAddColumn?.();
  };

  const insertColumnAfter = (colIdx) => {
    if (!orderedColumns.length) {
      onAddColumn?.();
      return;
    }
    const idx = Math.max(0, Math.min(orderedColumns.length - 1, colIdx));
    const colName = orderedColumns[idx];
    if (onInsertColumnAfter) {
      onInsertColumnAfter(colName, idx);
      return;
    }
    onAddColumn?.();
  };

  const insertRowAfter = (rowIndex) => {
    if (onInsertRow) {
      onInsertRow(Math.max(0, rowIndex));
      return;
    }
    onAddRow?.();
  };

  const beginEdit = (nextSelected = selectedCell, initialDraft) => {
    const bounded = clampCell(nextSelected);
    const rowIndex = visibleRowIndexes[bounded.row] ?? 0;
    const colName = orderedColumns[bounded.col] ?? "";
    if (readOnlySet.has(normalizeKey(colName))) return;
    const raw = colName ? (safeItems[rowIndex]?.[colName] ?? "") : "";
    const draft = isNumericColumn(colName) ? formatNumber(raw) : String(raw ?? "");
    setSelectedCell(bounded);
    setEditingCell({ row: bounded.row, col: bounded.col });
    if (initialDraft !== undefined) setEditDraft(String(initialDraft));
    else setEditDraft(draft);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const bounded = clampCell(editingCell);
    const rowIndex = visibleRowIndexes[bounded.row] ?? 0;
    setCellValue(rowIndex, bounded.col, editDraft);
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (event) => {
    if (mode !== "edit") return;
    if (event.key === "Escape") {
      if (editingCell) {
        event.preventDefault();
        cancelEdit();
      }
      return;
    }

    const isEditing = Boolean(editingCell);
    if (isEditing) {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit();
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      beginEdit();
      return;
    }

    const move = (deltaRow, deltaCol) => {
      setSelectedCell((prev) => {
        const next = clampCell({ row: prev.row + deltaRow, col: prev.col + deltaCol });
        requestAnimationFrame(() => {
          const scroller = scrollerRef.current;
          if (!scroller) return;
          const nextTop = headerHeight + next.row * rowHeight;
          const nextBottom = nextTop + rowHeight;
          const viewTop = scroller.scrollTop;
          const viewBottom = scroller.scrollTop + scroller.clientHeight;
          if (nextTop < viewTop) scroller.scrollTop = Math.max(0, nextTop - rowHeight * 2);
          else if (nextBottom > viewBottom) scroller.scrollTop = nextBottom - scroller.clientHeight + rowHeight * 2;
          const colLeft = rowHeaderWidth + next.col * colWidth;
          const colRight = colLeft + colWidth;
          const viewLeft = scroller.scrollLeft;
          const viewRight = scroller.scrollLeft + scroller.clientWidth;
          if (colLeft < viewLeft) scroller.scrollLeft = Math.max(0, colLeft - colWidth * 0.5);
          else if (colRight > viewRight) scroller.scrollLeft = colRight - scroller.clientWidth + colWidth * 0.5;
        });
        return next;
      });
    };

    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1, 0);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(0, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(0, -1);
    } else if (event.key === "Tab") {
      event.preventDefault();
      move(0, event.shiftKey ? -1 : 1);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // Start typing directly into the active cell (Excel-like).
      event.preventDefault();
      beginEdit(selectedCell, event.key);
    }
  };

  const colWidth = 180;
  const rowHeaderWidth = mode === "edit" ? 88 : 56;
  const addColWidth = mode === "edit" ? 54 : 0;
  const gridMinWidth = rowHeaderWidth + orderedColumns.length * colWidth + addColWidth;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      if (scrollRafRef.current) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = 0;
        setScrollTop(el.scrollTop);
        maybeAutoLoadMore(el);
        if (autoLoadRafRef.current) cancelAnimationFrame(autoLoadRafRef.current);
        autoLoadRafRef.current = requestAnimationFrame(() => maybeAutoLoadMore(el));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    ro.observe(el);
    setViewportHeight(el.clientHeight);
    setScrollTop(el.scrollTop);
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = 0;
      if (autoLoadRafRef.current) cancelAnimationFrame(autoLoadRafRef.current);
      autoLoadRafRef.current = 0;
      ro.disconnect();
    };
  }, [maybeAutoLoadMore]);

  const totalContentHeight = headerHeight + rowCount * rowHeight + footerHeight;
  const startRow = Math.max(0, Math.floor((scrollTop - headerHeight) / rowHeight) - overscan);
  const endRow = Math.min(
    rowCount,
    Math.ceil((scrollTop - headerHeight + viewportHeight) / rowHeight) + overscan
  );
  const sliceRowIndexes = rowCount > 0 ? visibleRowIndexes.slice(startRow, endRow) : [];
  const topSpacer = Math.max(0, startRow * rowHeight);
  const bottomSpacer = Math.max(0, (rowCount - endRow) * rowHeight);

  return (
    <div className={`rounded-xl border border-border bg-background ${className}`}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Line Items</div>
          <div className="text-xs text-muted-foreground">Spreadsheet view (click cells, arrow keys to move).</div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="w-full sm:w-[280px]">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
          </div>
          {isFiltered ? (
            <Button type="button" variant="ghost" onClick={clearFilterAndFocus}>
              View All
            </Button>
          ) : null}
          {mode === "edit" && canViewMore ? (
            <Button type="button" variant="ghost" onClick={viewMore}>
              View More ({Math.min(rowLimit, filteredRowIndexes.length)}/{filteredRowIndexes.length})
            </Button>
          ) : null}
          {mode === "edit" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (search) setSearch("");
                onAddRow?.();
                requestAnimationFrame(() => focusGrid());
              }}
              disabled={!onAddRow}
            >
              Add Row
            </Button>
          ) : null}
        </div>
      </div>

      {mode === "edit" ? (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
          <div className="w-[72px] rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
            {columnIndexToName(selectedCell.col)}
            {selectedRowIndex + 1}
          </div>
          <div className="flex-1">
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={editingCell ? editDraft : selectedDisplayValue}
              onChange={(e) => {
                const next = e.target.value;
                if (!editingCell) beginEdit(selectedCell, next);
                else setEditDraft(next);
              }}
              onBlur={() => {
                if (editingCell) commitEdit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              placeholder="Edit cell…"
            />
          </div>
        </div>
      ) : null}

      <div ref={scrollerRef} className="h-[70vh] w-full overflow-auto">
        <div className="p-3">
          <div
            ref={gridRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="outline-none"
          >
            <div style={{ minWidth: gridMinWidth, height: totalContentHeight }}>
              {/* Column headers */}
              <div className="sticky top-0 z-20 flex bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40" style={{ height: headerHeight }}>
                <div
                  className="sticky left-0 z-30 flex items-center justify-center border border-border bg-muted/60 text-xs font-semibold text-muted-foreground"
                  style={{ width: rowHeaderWidth, height: 36 }}
                >
                  {mode === "edit" ? (
                    <button
                      type="button"
                      className="h-7 w-7 rounded border border-border bg-background text-sm font-semibold text-muted-foreground hover:bg-muted/40"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={insertColumnAfterSelected}
                      disabled={!onAddColumn && !onInsertColumnAfter}
                      title="Insert column after selected"
                    >
                      +
                    </button>
                  ) : null}
                </div>
                {orderedColumns.map((col, colIdx) => (
                  <div
                    key={col}
                    className="group border border-border bg-muted/60 px-2 py-1 text-xs text-muted-foreground"
                    style={{ width: colWidth, height: 36 }}
                    title={getColumnLabel(col)}
                    onDragOver={(e) => {
                      if (mode !== "edit" || !onMoveColumn) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      if (mode !== "edit" || !onMoveColumn) return;
                      e.preventDefault();
                      const from = draggingColRef.current;
                      if (typeof from !== "number") return;
                      if (from === colIdx) return;
                      onMoveColumn(from, colIdx);
                      draggingColRef.current = null;
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {mode === "edit" && renamingCol?.colIdx === colIdx ? (
                        <input
                          className="h-6 w-full rounded border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          autoFocus
                          value={renamingCol.draft}
                          onChange={(e) =>
                            setRenamingCol((prev) => (prev ? { ...prev, draft: e.target.value } : prev))
                          }
                          onBlur={() => {
                            const next = String(renamingCol?.draft ?? "").trim();
                            onRenameColumn?.(col, next);
                            setRenamingCol(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setRenamingCol(null);
                            }
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const next = String(renamingCol?.draft ?? "").trim();
                              onRenameColumn?.(col, next);
                              setRenamingCol(null);
                            }
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="truncate text-left font-medium text-black hover:underline dark:text-foreground"
                          onMouseDown={(e) => e.preventDefault()}
                          onDoubleClick={() => {
                            if (mode !== "edit") return;
                            if (!onRenameColumn) return;
                            setRenamingCol({ colIdx, draft: getColumnLabel(col) });
                          }}
                          title={mode === "edit" ? "Double-click to rename" : getColumnLabel(col)}
                        >
                          {getColumnLabel(col)}
                        </button>
                      )}
                      <span
                        className="shrink-0 cursor-grab select-none text-[10px] font-semibold text-muted-foreground active:cursor-grabbing"
                        draggable={mode === "edit" && Boolean(onMoveColumn)}
                        onDragStart={(e) => {
                          if (mode !== "edit" || !onMoveColumn) return;
                          draggingColRef.current = colIdx;
                          try {
                            e.dataTransfer.setData("text/plain", String(colIdx));
                          } catch {
                            // ignore
                          }
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          draggingColRef.current = null;
                        }}
                        title="Drag to reorder column"
                      >
                        {columnIndexToName(colIdx).toLowerCase()}
                      </span>
	                      {mode === "edit" ? (
	                        <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            className="h-5 w-5 rounded border border-border bg-background text-[12px] leading-none text-muted-foreground hover:bg-muted/40"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedCell((prev) => clampCell({ row: prev.row, col: colIdx }));
                              insertColumnAfter(colIdx);
                            }}
                            disabled={!onInsertColumnAfter}
                            title="Insert column after"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="h-5 w-5 rounded border border-border bg-background text-[12px] leading-none text-muted-foreground hover:bg-muted/40"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onRemoveColumn?.(col, colIdx)}
                            disabled={!onRemoveColumn}
                            title="Delete column"
                          >
                            ×
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
                {mode === "edit" ? (
                  <div
                    className="border border-border bg-muted/60 px-2 py-1 text-xs text-muted-foreground"
                    style={{ width: 54, height: 36 }}
                  >
                    <button
                      type="button"
                      className="h-full w-full rounded border border-border bg-background text-sm font-semibold text-muted-foreground hover:bg-muted/40"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertColumnAfter(orderedColumns.length - 1)}
                      disabled={!onAddColumn && !onInsertColumnAfter}
                      title="Insert column at end"
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Data rows */}
              {rowCount === 0 ? (
                <div className="border border-border bg-background px-3 py-10 text-center text-sm text-muted-foreground">
                  No matching items.
                </div>
              ) : (
                <>
                  <div style={{ height: topSpacer }} />
                  {sliceRowIndexes.map((rowIndex, i) => {
                    const visibleRow = startRow + i;
                    const row = safeItems[rowIndex] || {};
                    const itemNo = getItemNumber(row);
                    const excelRowNo = rowIndex + 1;
                  return (
                    <div key={`row-${rowIndex}`} className="group flex">
                      {/* Row header */}
		                      <div
		                        className="sticky left-0 z-10 flex items-center justify-between gap-2 border border-border bg-muted/30 px-2 text-xs text-muted-foreground"
		                        style={{ width: rowHeaderWidth, height: 32 }}
	                        onDragOver={(e) => {
	                          if (mode !== "edit" || !onMoveRow || deferredSearch) return;
	                          e.preventDefault();
	                          e.dataTransfer.dropEffect = "move";
	                        }}
	                        onDrop={(e) => {
	                          if (mode !== "edit" || !onMoveRow || deferredSearch) return;
	                          e.preventDefault();
	                          const from = draggingRowRef.current;
	                          if (typeof from !== "number") return;
	                          if (from === rowIndex) return;
	                          onMoveRow(from, rowIndex);
	                          draggingRowRef.current = null;
	                        }}
	                      >
	                        <span
	                          className="cursor-grab select-none tabular-nums active:cursor-grabbing"
	                          draggable={mode === "edit" && Boolean(onMoveRow) && !deferredSearch}
	                          onDragStart={(e) => {
	                            if (mode !== "edit" || !onMoveRow || deferredSearch) return;
	                            draggingRowRef.current = rowIndex;
	                            try {
	                              e.dataTransfer.setData("text/plain", String(rowIndex));
	                            } catch {
	                              // ignore
	                            }
	                            e.dataTransfer.effectAllowed = "move";
	                          }}
		                          onDragEnd={() => {
		                            draggingRowRef.current = null;
		                          }}
		                          title={[
                                deferredSearch ? "Disable search to reorder rows" : "Drag to reorder row",
                                `Row: ${excelRowNo}`,
                                itemNo ? `Item: ${itemNo}` : "",
                              ]
                                .filter(Boolean)
                                .join(" • ")}
		                        >
                              <span className="flex min-w-0 flex-col leading-[1.1]">
		                            <span className="tabular-nums font-semibold">{excelRowNo}</span>
                                {itemNo ? (
                                  <span className="max-w-[56px] truncate text-[10px] text-muted-foreground">
                                    {itemNo}
                                  </span>
                                ) : null}
                              </span>
		                        </span>
		                        {mode === "edit" ? (
		                          <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => insertRowAfter(rowIndex + 1)}
                              disabled={!onAddRow && !onInsertRow}
                              title="Insert row below"
                            >
                              +
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => onRemoveRow?.(rowIndex)}
                              disabled={!onRemoveRow || safeItems.length === 0}
                              title="Delete row"
                            >
                              ×
                            </Button>
                          </span>
                        ) : null}
                      </div>

                      {/* Cells */}
                      {orderedColumns.map((col, colIdx) => {
                        const numeric = isNumericColumn(col);
                        const disabled =
                          mode !== "edit" ||
                          readOnlySet.has(normalizeKey(col)) ||
                          normalizeKey(col) === normalizeKey("final_rate_after_discount");
                        const rawValue = row?.[col] ?? "";
                        const displayValue = numeric ? formatNumber(rawValue) : String(rawValue ?? "");
                        const isSelected = selectedCell.row === visibleRow && selectedCell.col === colIdx;
                        const isEditing =
                          Boolean(editingCell) && editingCell.row === visibleRow && editingCell.col === colIdx;

                        return (
                          <div
                            key={`${rowIndex}-${col}`}
                            className={[
                              "border border-border bg-background px-2 py-1 text-sm",
                              isSelected ? "relative ring-2 ring-inset ring-ring" : "",
                              disabled && mode === "edit" ? "bg-muted/20 text-muted-foreground" : "",
                            ].join(" ")}
                            style={{ width: colWidth, height: 32 }}
                            onMouseDown={() => {
                              setSelectedCell(clampCell({ row: visibleRow, col: colIdx }));
                              focusGrid();
                            }}
                            onDoubleClick={() => {
                              if (mode === "edit" && !disabled) beginEdit({ row: visibleRow, col: colIdx });
                            }}
                            title={displayValue}
                          >
                            {isEditing ? (
                              <input
                                className="h-full w-full bg-transparent p-0 text-sm outline-none"
                                autoFocus
                                value={editDraft}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setEditDraft(next);
                                }}
                                onBlur={commitEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelEdit();
                                  } else if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitEdit();
                                  }
                                }}
                              />
                            ) : (
                              <div className="truncate">{displayValue ? displayValue : ""}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                  })}
                  <div style={{ height: bottomSpacer }} />
                </>
              )}

              {mode === "edit" ? (
                <div className="flex">
                  <div
                    className="sticky left-0 z-10 flex items-center justify-center border border-border bg-muted/30 px-2 text-xs text-muted-foreground"
                    style={{ width: rowHeaderWidth, height: 32 }}
                  >
                    <button
                      type="button"
                      className="h-6 w-6 rounded border border-border bg-background text-sm font-semibold text-muted-foreground hover:bg-muted/40"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertRowAfter(selectedRowIndex + 1)}
                      disabled={!onAddRow && !onInsertRow}
                      title="Insert row after selected"
                    >
                      +
                    </button>
                  </div>
                  {orderedColumns.map((col) => (
                    <div
                      key={`footer-${col}`}
                      className="border border-border bg-background"
                      style={{ width: colWidth, height: 32 }}
                    />
                  ))}
                  {mode === "edit" ? (
                    <div className="border border-border bg-background" style={{ width: 54, height: 32 }} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
