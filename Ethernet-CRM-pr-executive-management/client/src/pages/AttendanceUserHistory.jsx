import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCcw, Image as ImageIcon, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const resolvePhotoUrl = (path) => {
  if (!path || typeof path !== "string") return "";
  const url = api.getApiFileUrl(path);
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
};

const resolvePhotoPath = (item, keys) => {
  const values = resolveValueList(item, keys);
  const first = values.find((val) => val != null && String(val).trim() !== "");
  return first ? String(first) : "";
};

const resolveValue = (item, keys) => {
  if (!item) return null;
  for (const key of keys) {
    const direct = item[key];
    if (direct != null && direct !== "") return direct;
    if (key.startsWith("user.") && item.user) {
      const userKey = key.replace("user.", "");
      const nested = item.user[userKey];
      if (nested != null && nested !== "") return nested;
    }
  }
  return null;
};

const splitMultiValue = (value) => {
  if (typeof value !== "string") return [value];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!/[;,\\n]/.test(trimmed)) return [trimmed];
  const parts = trimmed
    .split(/[;,\\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [trimmed];
  const timeLike = (part) => /\\d/.test(part);
  if (!parts.every(timeLike)) return [trimmed];
  return parts;
};

const resolveValueList = (item, keys) => {
  if (!item) return [];
  for (const key of keys) {
    const direct = item[key];
    if (direct != null && direct !== "") {
      if (Array.isArray(direct)) {
        return direct.map((value) => (typeof value === "string" ? value.trim() : value));
      }
      return splitMultiValue(direct);
    }
    if (key.startsWith("user.") && item.user) {
      const userKey = key.replace("user.", "");
      const nested = item.user[userKey];
      if (nested != null && nested !== "") {
        if (Array.isArray(nested)) {
          return nested.map((value) => (typeof value === "string" ? value.trim() : value));
        }
        return splitMultiValue(nested);
      }
    }
  }
  return [];
};

const expandAttendanceRows = (items) =>
  (Array.isArray(items) ? items : []).flatMap((item, index) => {
    const checkIns = resolveValueList(item, [
      "check_in_time",
      "checkin_time",
      "check_in_at",
      "check_in",
      "created_at",
      "updated_at",
    ]);
    const checkOuts = resolveValueList(item, [
      "check_out_time",
      "checkout_time",
      "check_out_at",
      "check_out",
      "out_time",
      "checkout_at",
      "checked_out_at",
      "checkout_datetime",
      "check_out_datetime",
    ]);
    const rows = Math.max(checkIns.length, checkOuts.length, 1);
    return Array.from({ length: rows }, (_, rowIndex) => ({
      ...item,
      __rowIndex: rowIndex,
      __sourceIndex: index,
      __checkInValue: checkIns[rowIndex] ?? checkIns[0] ?? null,
      __checkOutValue: checkOuts[rowIndex] ?? checkOuts[0] ?? null,
    }));
  });

const parseTimeValue = (value, baseDate) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const anchor = baseDate && !Number.isNaN(baseDate.getTime())
        ? new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
        : new Date(1970, 0, 1);
      anchor.setHours(hours, minutes, 0, 0);
      return anchor;
    }
  }
  return null;
};

const minutesFromTime = (value, baseDate) => {
  const date = parseTimeValue(value, baseDate);
  if (!date) return null;
  return date.getHours() * 60 + date.getMinutes();
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });

const _loadImageDataUrl = async (url) => {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const blob = await res.blob();
  if (!blob || blob.size === 0) throw new Error("Empty image");
  return await blobToDataUrl(blob);
};

const _loadHtmlImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });

const formatTimeValue = (value, baseDate) => {
  if (!value) return "-";
  const date = parseTimeValue(value, baseDate);
  if (!date) return value.toString();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
};

const buildTimingRemark = ({ type, actualMinutes, expectedMinutes }) => {
  if (actualMinutes == null || expectedMinutes == null) return null;
  const diff = actualMinutes - expectedMinutes;
  if (diff === 0) {
    return { text: "On time", variant: "default" };
  }
  const minutes = Math.abs(diff);
  const isLate = diff > 0;
  if (type === "checkout") {
    return {
      text: `Checked out ${isLate ? "late" : "early"} by ${minutes} min`,
      variant: isLate ? "destructive" : "secondary",
    };
  }
  return {
    text: `${isLate ? "Late" : "Early"} by ${minutes} min`,
    variant: isLate ? "destructive" : "secondary",
  };
};

const parseAttendanceDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const resolveAttendanceStatus = (item) => {
  if (!item) return "";
  return item.status || item.attendance_status || item.marked_status || "";
};

const formatStatusLabel = (status) => {
  if (!status) return "Unmarked";
  const normalized = status.toString().toLowerCase();
  if (normalized === "present") return "Present";
  if (normalized === "absent") return "Absent";
  if (normalized === "half_day" || normalized === "half-day" || normalized === "half day") return "Half Day";
  return status.toString();
};

const statusBadgeVariant = (status) => {
  const normalized = status.toString().toLowerCase();
  if (normalized === "present") return "default";
  if (normalized === "absent") return "destructive";
  if (normalized === "half_day" || normalized === "half-day" || normalized === "half day") return "secondary";
  return "secondary";
};

const statusBadgeClassName = (status) => {
  if (!status) return "";
  const normalized = status.toString().toLowerCase();
  if (normalized === "present") {
    return "border border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100";
  }
  if (normalized === "half_day" || normalized === "half-day" || normalized === "half day") {
    return "border border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100";
  }
  return "";
};

const getInitials = (value) => {
  if (!value) return "U";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function AttendanceUserHistory() {
  const { projectId, userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [datePreset, setDatePreset] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [previewPhase, setPreviewPhase] = useState("checkin");
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const userFromState = location?.state?.user || null;

  const userLabel = useMemo(() => {
    if (userFromState) {
      return userFromState.name || userFromState.username || userFromState.email || null;
    }
    if (history.length > 0) {
      const sample = history[0];
      return sample.user_name || sample.user?.name || sample.user?.username || null;
    }
    return null;
  }, [userFromState, history]);

  const userEmail = useMemo(() => {
    if (userFromState) return userFromState.email || null;
    if (history.length > 0) return history[0].email || history[0].user?.email || null;
    return null;
  }, [userFromState, history]);

  const userPhone = useMemo(() => {
    if (userFromState) return userFromState.phone_number || userFromState.phone || null;
    if (history.length > 0) return history[0].phone_number || history[0].user?.phone_number || null;
    return null;
  }, [userFromState, history]);

  const avatarUrl = useMemo(() => {
    if (userFromState?.avatar) return resolvePhotoUrl(userFromState.avatar);
    if (history.length > 0 && history[0].avatar) return resolvePhotoUrl(history[0].avatar);
    return "";
  }, [userFromState, history]);

  const fetchHistory = useCallback(async ({ silent = false } = {}) => {
    if (!userId) {
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const result = await api.getAttendanceByUser(userId);
      if (!result.success) {
        setHistory([]);
        toast({
          title: "Failed to load attendance",
          description: result.error || "Could not fetch attendance history.",
          variant: "destructive",
        });
        return;
      }
      setHistory(Array.isArray(result.data) ? result.data : []);
    } catch {
      setHistory([]);
      toast({
        title: "Failed to load attendance",
        description: "Could not fetch attendance history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    if (userId) return;
    navigate("/attendance?tab=users", { replace: true });
  }, [navigate, userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const dateRange = useMemo(() => {
    const parseYmd = (value) => {
      if (!value || typeof value !== "string") return null;
      const trimmed = value.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
      const [year, month, day] = trimmed.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const today = new Date();
    const midnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    midnightToday.setHours(0, 0, 0, 0);

    const makeEndOfDay = (date) => {
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return end;
    };

    const getMonthRange = (year, monthIndex) => {
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    };

    if (datePreset === "today") {
      return { start: midnightToday, end: makeEndOfDay(midnightToday), label: "Today" };
    }

    if (datePreset === "yesterday") {
      const start = new Date(midnightToday);
      start.setDate(start.getDate() - 1);
      return { start, end: makeEndOfDay(start), label: "Yesterday" };
    }

    if (datePreset === "last_week") {
      const start = new Date(midnightToday);
      start.setDate(start.getDate() - 6);
      return { start, end: makeEndOfDay(midnightToday), label: "Last week" };
    }

    if (datePreset === "last_month") {
      const prevMonth = new Date(midnightToday.getFullYear(), midnightToday.getMonth() - 1, 1);
      const range = getMonthRange(prevMonth.getFullYear(), prevMonth.getMonth());
      return { ...range, label: "Last month" };
    }

    if (datePreset === "custom") {
      const startRaw = parseYmd(fromDate);
      const endRaw = parseYmd(toDate);
      if (!startRaw && !endRaw) return { start: null, end: null, label: "Custom" };
      const start = startRaw || endRaw;
      const end = endRaw || startRaw;
      if (!start || !end) return { start: null, end: null, label: "Custom" };
      start.setHours(0, 0, 0, 0);
      const endOfDay = makeEndOfDay(end);
      if (start.getTime() <= endOfDay.getTime()) {
        return { start, end: endOfDay, label: `${fromDate || toDate} to ${toDate || fromDate}` };
      }
      // Swap when user selects a reversed range
      const swappedStart = new Date(endOfDay.getFullYear(), endOfDay.getMonth(), endOfDay.getDate());
      swappedStart.setHours(0, 0, 0, 0);
      const swappedEnd = makeEndOfDay(start);
      return { start: swappedStart, end: swappedEnd, label: `${toDate} to ${fromDate}` };
    }

    return { start: null, end: null, label: "All" };
  }, [datePreset, fromDate, toDate]);

  const filteredHistory = useMemo(() => {
    const baseFiltered = (() => {
      const { start, end } = dateRange || {};
      if (!start || !end) return history;
      return history.filter((item) => {
        const baseDate = parseAttendanceDate(item?.date || item?.created_at || item?.updated_at);
        if (!baseDate) return false;
        const time = baseDate.getTime();
        return time >= start.getTime() && time <= end.getTime();
      });
    })();
    return baseFiltered;
  }, [dateRange, history]);

  const expandedHistory = useMemo(
    () => expandAttendanceRows(filteredHistory),
    [filteredHistory]
  );

  const downloadUserAttendanceReportExcel = async () => {
    if (pdfDownloading) return;
    if (!Array.isArray(expandedHistory) || expandedHistory.length === 0) {
      toast({
        title: "No attendance records",
        description: "There are no records to download.",
        variant: "destructive",
      });
      return;
    }

    const safeFilenamePart = (value) =>
      String(value || "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 60) || "NA";

    const generatedAt = new Date().toLocaleString();
    const userName = userLabel || userEmail || userPhone || userId || "User";
    const searchLabel = "All";

    try {
      setPdfDownloading(true);

      const rows = expandedHistory.map((item, index) => {
        const baseDate = parseAttendanceDate(item?.date || item?.created_at || item?.updated_at);
        const actualCheckIn =
          item?.__checkInValue ??
          resolveValue(item, ["check_in_time", "checkin_time", "check_in_at", "check_in", "created_at", "updated_at"]);
        const actualCheckOut =
          item?.__checkOutValue ??
          resolveValue(item, [
            "check_out_time",
            "checkout_time",
            "check_out_at",
            "check_out",
            "out_time",
            "checkout_at",
            "checked_out_at",
            "checkout_datetime",
            "check_out_datetime",
          ]);
        const status = resolveAttendanceStatus(item);

        const checkInSelfie = resolvePhotoPath(item, [
          "photo_selfie",
          "selfie_photo",
          "check_in_photo_selfie",
          "checkin_photo_selfie",
          "check_in_selfie",
          "checkin_selfie",
          "photo_selfie_check_in",
          "photo_selfie_in",
        ]);
        const checkInSite = resolvePhotoPath(item, [
          "photo_site",
          "site_photo",
          "check_in_photo_site",
          "checkin_photo_site",
          "check_in_site",
          "photo_site_check_in",
          "photo_site_in",
        ]);
        const checkOutSelfie = resolvePhotoPath(item, [
          "photo_selfie_checkout",
          "photo_selfie_check_out",
          "check_out_photo_selfie",
          "checkout_photo_selfie",
          "check_out_selfie",
          "checkout_selfie",
          "photo_selfie_out",
        ]);
        const checkOutSite = resolvePhotoPath(item, [
          "photo_site_checkout",
          "photo_site_check_out",
          "check_out_photo_site",
          "checkout_photo_site",
          "check_out_site",
          "photo_site_out",
        ]);

        return {
          "#": index + 1,
          User: userName,
          Project: projectId || "All",
          Date: String(formatDate(item?.date || item?.created_at) || "-"),
          "Check In": String(formatTimeValue(actualCheckIn, baseDate) || "-"),
          "Check Out": String(formatTimeValue(actualCheckOut, baseDate) || "-"),
          "Location (Check-in)": String(item?.location || "-"),
          "Latitude (Check-in)": item?.latitude ?? "-",
          "Longitude (Check-in)": item?.longitude ?? "-",
          "Location (Check-out)": String(item?.check_out_location || item?.checkout_location || "-"),
          "Latitude (Check-out)": item?.check_out_latitude ?? item?.checkOutLatitude ?? "-",
          "Longitude (Check-out)": item?.check_out_longitude ?? item?.checkOutLongitude ?? "-",
          Status: String(formatStatusLabel(status) || "-"),
          Remark: String(item?.remark || item?.remarks || "-"),
          "Check-in Selfie URL": checkInSelfie ? resolvePhotoUrl(checkInSelfie) : "",
          "Check-in Site URL": checkInSite ? resolvePhotoUrl(checkInSite) : "",
          "Check-out Selfie URL": checkOutSelfie ? resolvePhotoUrl(checkOutSelfie) : "",
          "Check-out Site URL": checkOutSite ? resolvePhotoUrl(checkOutSite) : "",
        };
      });

      const filename = `Attendance-User-${safeFilenamePart(userName)}-${safeFilenamePart(projectId || "NA")}.xlsx`;
      const workbook = XLSX.utils.book_new();
      const meta = [
        { Key: "User", Value: userName },
        { Key: "Project", Value: projectId || "All" },
        { Key: "Search", Value: searchLabel },
        { Key: "Date filter", Value: dateRange?.label || "All" },
        { Key: "Generated", Value: generatedAt },
        { Key: "Records", Value: rows.length },
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(meta), "Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Attendance");
      XLSX.writeFile(workbook, filename);
    } catch {
      toast({
        title: "Download failed",
        description: "Could not generate the Excel file.",
        variant: "destructive",
      });
    } finally {
      setPdfDownloading(false);
    }
  };

  const downloadUserAttendanceReportPdf = async () => {
    if (pdfDownloading) return;
    if (!Array.isArray(expandedHistory) || expandedHistory.length === 0) {
      toast({
        title: "No attendance records",
        description: "There are no records to download.",
        variant: "destructive",
      });
      return;
    }

    const safeFilenamePart = (value) =>
      String(value || "")
        .trim()
        .replace(/\\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 60) || "NA";

    const generatedAt = new Date().toLocaleString();
    const userName = userLabel || userEmail || userPhone || userId || "User";
    const searchLabel = "All";

    try {
      setPdfDownloading(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const margin = 10;

      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text("Attendance Report", doc.internal.pageSize.getWidth() / 2, 14, { align: "center" });
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      doc.text(`User: ${userName}`, margin, 22);
      doc.text(`Project: ${projectId || "All"}`, margin, 28);
      doc.text(`Search: ${searchLabel}`, margin, 34);
      doc.text(`Date filter: ${dateRange?.label || "All"}`, margin, 40);
      doc.text(`Generated: ${generatedAt}`, margin, 46);

      const tableRows = expandedHistory.map((item, index) => {
        const baseDate = parseAttendanceDate(item?.date || item?.created_at || item?.updated_at);
        const actualCheckIn =
          item?.__checkInValue ??
          resolveValue(item, ["check_in_time", "checkin_time", "check_in_at", "check_in", "created_at", "updated_at"]);
        const actualCheckOut =
          item?.__checkOutValue ??
          resolveValue(item, [
            "check_out_time",
            "checkout_time",
            "check_out_at",
            "check_out",
            "out_time",
            "checkout_at",
            "checked_out_at",
            "checkout_datetime",
            "check_out_datetime",
          ]);
        const status = resolveAttendanceStatus(item);

        return [
          String(index + 1),
          String(formatDate(item?.date || item?.created_at) || "-"),
          String(formatTimeValue(actualCheckIn, baseDate) || "-"),
          String(formatTimeValue(actualCheckOut, baseDate) || "-"),
          String(item?.location || "-"),
          String(formatStatusLabel(status) || "-"),
        ];
      });

      autoTable(doc, {
        startY: 54,
        margin: { left: margin, right: margin },
        theme: "grid",
        head: [["#", "Date", "Check In", "Check Out", "Location", "Status"]],
        body: tableRows,
        styles: { font: "times", fontSize: 8.5, cellPadding: 2, valign: "middle" },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 28, halign: "center" },
          2: { cellWidth: 28, halign: "center" },
          3: { cellWidth: 28, halign: "center" },
          4: { cellWidth: 150, halign: "left" },
          5: { cellWidth: 24, halign: "center" },
        },
      });

      doc.save(`Attendance-User-${safeFilenamePart(userName)}-${safeFilenamePart(projectId || "NA")}.pdf`);
    } catch {
      toast({
        title: "Download failed",
        description: "Could not generate the PDF.",
        variant: "destructive",
      });
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-emerald-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 h-auto px-0 text-muted-foreground"
              onClick={() => navigate(projectId ? `/${projectId}/attendance` : "/attendance?tab=users")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Attendance
            </Button>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-14 w-14">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={userLabel || "User"} /> : null}
                <AvatarFallback>{getInitials(userLabel || userEmail || "User")}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {userLabel || "User"}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Attendance History</span>
                  {userEmail ? <span>{userEmail}</span> : null}
                  {userPhone ? <span>{userPhone}</span> : null}
                </div>
              </div>
            </div>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
            <Button
              variant="outline"
              onClick={downloadUserAttendanceReportExcel}
              disabled={loading || pdfDownloading || expandedHistory.length === 0}
            >
              {pdfDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Downloading
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download Excel
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={downloadUserAttendanceReportPdf}
              disabled={loading || pdfDownloading || expandedHistory.length === 0}
            >
              {pdfDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Downloading
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => fetchHistory({ silent: true })} disabled={refreshing}>
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Attendance History</CardTitle>
          <CardDescription>Every attendance record captured for this user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Date filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All attendance</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last_week">Last week</SelectItem>
                  <SelectItem value="last_month">Last month</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {datePreset === "custom" ? (
              <>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="md:col-span-3"
                />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="md:col-span-3"
                />
              </>
            ) : (
              <div className="md:col-span-3" />
            )}
            <div className="md:col-span-12">
              <Button
                variant="ghost"
                className="h-auto px-0 text-sm text-muted-foreground"
                onClick={() => {
                  setDatePreset("all");
                  setFromDate("");
                  setToDate("");
                }}
                disabled={
                  datePreset === "all" &&
                  !fromDate &&
                  !toDate
                }
              >
                Clear filters
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance history...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    No attendance records found for this user.
                  </TableCell>
                </TableRow>
              ) : (
                expandedHistory.map((item) => {
                  const baseDate = parseAttendanceDate(item.date || item.created_at || item.updated_at);
                  const actualCheckIn =
                    item.__checkInValue ??
                    resolveValue(item, [
                      "check_in_time",
                      "checkin_time",
                      "check_in_at",
                      "check_in",
                      "created_at",
                      "updated_at",
                    ]);
                  const expectedCheckIn = resolveValue(item, [
                    "expected_check_in_time",
                    "scheduled_check_in_time",
                    "user_check_in_time",
                    "shift_check_in_time",
                    "check_in_expected",
                    "check_in_time_expected",
                    "user.check_in_time",
                  ]);
                  const actualCheckOut =
                    item.__checkOutValue ??
                    resolveValue(item, [
                      "check_out_time",
                      "checkout_time",
                      "check_out_at",
                      "check_out",
                      "out_time",
                      "checkout_at",
                      "checked_out_at",
                      "checkout_datetime",
                      "check_out_datetime",
                    ]);
                  const expectedCheckOut = resolveValue(item, [
                    "expected_check_out_time",
                    "scheduled_check_out_time",
                    "user_check_out_time",
                    "shift_check_out_time",
                    "check_out_expected",
                    "check_out_time_expected",
                    "user.check_out_time",
                  ]);
                  const checkInRemark = buildTimingRemark({
                    type: "checkin",
                    actualMinutes: minutesFromTime(actualCheckIn, baseDate),
                    expectedMinutes: minutesFromTime(expectedCheckIn, baseDate),
                  });
                  const checkOutRemark = buildTimingRemark({
                    type: "checkout",
                    actualMinutes: minutesFromTime(actualCheckOut, baseDate),
                    expectedMinutes: minutesFromTime(expectedCheckOut, baseDate),
                  });
                  const status = resolveAttendanceStatus(item);

                  return (
                    <TableRow
                      key={`${item.attendance_id || item.id || `${item.date}-${item.created_at}`}-${item.__sourceIndex ?? 0}-${item.__rowIndex ?? 0}`}
                      className="cursor-pointer hover:bg-muted/40"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setPreviewItem(item);
                        setPreviewPhase("checkin");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          setPreviewItem(item);
                          setPreviewPhase("checkin");
                        }
                      }}
                    >
                      <TableCell>{formatDate(item.date || item.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-medium">
                            {formatTimeValue(actualCheckIn, baseDate)}
                          </div>
                          {checkInRemark ? (
                            <Badge variant={checkInRemark.variant} className="w-fit">
                              {checkInRemark.text}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No remark</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-medium">
                            {formatTimeValue(actualCheckOut, baseDate)}
                          </div>
                          {checkOutRemark ? (
                            <Badge variant={checkOutRemark.variant} className="w-fit">
                              {checkOutRemark.text}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No remark</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {item.location || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(status || "")} className={statusBadgeClassName(status)}>
                          {formatStatusLabel(status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Attendance Preview</DialogTitle>
          </DialogHeader>
          {previewItem ? (
            <div className="space-y-5">
              {(() => {
                const checkInSelfie = resolvePhotoPath(previewItem, [
                  "photo_selfie",
                  "selfie_photo",
                  "check_in_photo_selfie",
                  "checkin_photo_selfie",
                  "check_in_selfie",
                  "checkin_selfie",
                  "photo_selfie_check_in",
                  "photo_selfie_in",
                ]);
                const checkInSite = resolvePhotoPath(previewItem, [
                  "photo_site",
                  "site_photo",
                  "check_in_photo_site",
                  "checkin_photo_site",
                  "check_in_site",
                  "photo_site_check_in",
                  "photo_site_in",
                ]);
                const checkOutSelfie = resolvePhotoPath(previewItem, [
                  "photo_selfie_checkout",
                  "photo_selfie_check_out",
                  "check_out_photo_selfie",
                  "checkout_photo_selfie",
                  "check_out_selfie",
                  "checkout_selfie",
                  "photo_selfie_out",
                ]);
                const checkOutSite = resolvePhotoPath(previewItem, [
                  "photo_site_checkout",
                  "photo_site_check_out",
                  "check_out_photo_site",
                  "checkout_photo_site",
                  "check_out_site",
                  "photo_site_out",
                ]);

                const hasCheckoutPhotos = Boolean(checkOutSelfie || checkOutSite);
                const isCheckout = previewPhase === "checkout";
                const selfiePath = isCheckout ? checkOutSelfie : checkInSelfie;
                const sitePath = isCheckout ? checkOutSite : checkInSite;
                const phaseLabel = isCheckout ? "Check-out Photos" : "Check-in Photos";

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{phaseLabel}</div>
                      {hasCheckoutPhotos ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setPreviewPhase("checkin")}
                            disabled={!isCheckout}
                            title="Show check-in photos"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setPreviewPhase("checkout")}
                            disabled={isCheckout}
                            title="Show check-out photos"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Selfie</div>
                        {selfiePath ? (
                          <img
                            src={resolvePhotoUrl(selfiePath)}
                            alt="Attendance selfie"
                            className="h-56 w-full rounded-xl border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                            <ImageIcon className="mr-2 h-4 w-4" /> No selfie uploaded
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Site Photo</div>
                        {sitePath ? (
                          <img
                            src={resolvePhotoUrl(sitePath)}
                            alt="Attendance site"
                            className="h-56 w-full rounded-xl border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                            <ImageIcon className="mr-2 h-4 w-4" /> No site photo uploaded
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Name</div>
                  <div className="font-medium">{previewItem.user_name || userLabel || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Phone</div>
                  <div className="font-medium">{previewItem.phone_number || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Date</div>
                  <div className="font-medium">{formatDate(previewItem.date || previewItem.created_at)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Location</div>
                  <div className="font-medium">{previewItem.location || "-"}</div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
