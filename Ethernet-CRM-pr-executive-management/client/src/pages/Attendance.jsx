import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, RefreshCcw, Image as ImageIcon, ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Download, X } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useProject } from "@/contexts/useProject";
import { useAuth } from "@/contexts/useAuth";
import { format, isValid, parse } from "date-fns";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import attendanceHeaderUrl from "@/assets/attendance-header.jpeg";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const resolvePhotoUrl = (path) => {
  if (!path) return "";
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

const isBlockedAttendanceError = (result) => {
  const message = String(result?.error || "").toLowerCase();
  return result?.status === 403 && message.includes("currently blocked");
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

const parseYmdDate = (value) => {
  if (!value) return undefined;
  if (value instanceof Date && isValid(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const haversineDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function CalendarDatePicker({ value, onChange, placeholder = "Pick a date", disabled = false, className } = {}) {
  const selectedDate = parseYmdDate(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          {selectedDate ? format(selectedDate, "dd MMM yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange?.(date ? format(date, "yyyy-MM-dd") : "")}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

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

const loadImageDataUrl = async (url) => {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const blob = await res.blob();
  if (!blob || blob.size === 0) throw new Error("Empty image");
  return await blobToDataUrl(blob);
};

const loadHtmlImage = (src) =>
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

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

const CHECKIN_TIME_KEYS = [
  "check_in_time",
  "checkin_time",
  "check_in_at",
  "check_in",
  "checkin_at",
  "checkin",
  "created_at",
  "updated_at",
];

const CHECKOUT_TIME_KEYS = [
  "check_out_time",
  "checkout_time",
  "check_out_at",
  "checkout_at",
  "checkout",
  "checkout_datetime",
];

const getUserKeyFromUser = (user) =>
  normalizePhone(user?.phone_number) ||
  String(
    user?.id ||
      user?._id ||
      user?.user_id ||
      user?.userId ||
      user?.email ||
      user?.username ||
      user?.name ||
      ""
  );

const getUserKeyFromAttendance = (item) =>
  normalizePhone(item?.phone_number || item?.user?.phone_number) ||
  String(
    item?.user_id ||
      item?.userId ||
      item?.user?.id ||
      item?.user?._id ||
      item?.user?.user_id ||
      item?.user_name ||
      ""
  );

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

const isSameDay = (left, right) => {
  if (!left || !right) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

const resolveAttendanceStatus = (item) => {
  if (!item) return "";
  return (
    item.status ||
    item.attendance_status ||
    item.marked_status ||
    ""
  );
};

const isAbsentAttendance = (item) => String(resolveAttendanceStatus(item) || "").toLowerCase() === "absent";

const resolveAttendanceId = (item) => {
  if (!item) return null;
  return item.attendance_id || item.id || null;
};

const getAttendanceDateKey = (value) => {
  const date = parseAttendanceDate(value);
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
};

const resolveAttendanceProjectId = (item) => {
  if (!item) return "";
  const raw =
    item.project_id ??
    item.projectId ??
    item.project?.id ??
    item.project?.project_id ??
    item.project?.projectId ??
    "";
  return String(raw || "").trim();
};

const isSameYmd = (left, right) => {
  const l = parseAttendanceDate(left);
  const r = parseAttendanceDate(right);
  if (!l || !r) return false;
  return (
    l.getFullYear() === r.getFullYear() &&
    l.getMonth() === r.getMonth() &&
    l.getDate() === r.getDate()
  );
};

const formatStatusLabel = (status) => {
  if (!status) return "Pending";
  const normalized = status.toString().toLowerCase();
  if (normalized === "present") return "Present";
  if (normalized === "absent") return "Absent";
  if (normalized === "half_day" || normalized === "half-day" || normalized === "half day") return "Half Day";
  if (normalized === "pending" || normalized === "unmarked") return "Pending";
  return status.toString();
};

const statusBadgeVariant = (status) => {
  if (!status) return "secondary";
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

const resolveAttendanceType = (item) => {
  if (!item) return "not_checked_in";
  const hasIn = Boolean(item?.__checkInValue ?? resolveValue(item, CHECKIN_TIME_KEYS));
  const hasOut = Boolean(item?.__checkOutValue ?? resolveValue(item, CHECKOUT_TIME_KEYS));
  if (hasOut) return "checked_out";
  if (hasIn) return "checked_in";
  return "not_checked_in";
};

export default function Attendance() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { projects, selectedProject } = useProject();
  const { user } = useAuth();
  const [isMobileView, setIsMobileView] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [allNameQuery, setAllNameQuery] = useState("");
  const [usersQuery, setUsersQuery] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [statusSaving, setStatusSaving] = useState({});
  const [previewPhase, setPreviewPhase] = useState("checkin");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [globalPdfDownloading, setGlobalPdfDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = String(searchParams.get("tab") || "").toLowerCase();
    if (tabParam === "all" || tabParam === "users" || tabParam === "today") return tabParam;
    return "today";
  });
  const [filtersDraft, setFiltersDraft] = useState({
    date: "",
    status: "",
    attendance_type: "",
    project_id: "",
  });
  const [filtersApplied, setFiltersApplied] = useState({
    date: "",
    status: "",
    attendance_type: "",
    project_id: "",
  });
  const [todayStatusFilter, setTodayStatusFilter] = useState("__all__");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [uploadingSite, setUploadingSite] = useState(false);
  const [globalView, setGlobalView] = useState("today");
  const [globalDatePreset, setGlobalDatePreset] = useState("all");
  const [globalMonthValue, setGlobalMonthValue] = useState("");
  const [globalFromDate, setGlobalFromDate] = useState("");
  const [globalToDate, setGlobalToDate] = useState("");
  const [globalStatusFilter, setGlobalStatusFilter] = useState("__all__");
  const [globalUserKey, setGlobalUserKey] = useState("__all__");
  const [leaveBanner, setLeaveBanner] = useState(null);
  const [leaveGrantOpen, setLeaveGrantOpen] = useState(false);
  const [leaveGrantSaving, setLeaveGrantSaving] = useState(false);
  const [leaveGrantKey, setLeaveGrantKey] = useState("");
  const [absentSavingKeys, setAbsentSavingKeys] = useState(() => new Set());
  const [leaveGrantForm, setLeaveGrantForm] = useState({
    user_id: "",
    user_name: "",
    from_date: "",
    to_date: "",
    reason: "",
  });
  const [leaveGrantedKeys, setLeaveGrantedKeys] = useState(() => new Set());
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    project_id: "",
    user_name: "",
    phone_number: "",
    date: "",
    location: "",
    latitude: "",
    longitude: "",
    remark: "",
    status: "pending",
    photo_selfie: "",
    photo_site: "",
    check_out_location: "",
    check_out_latitude: "",
    check_out_longitude: "",
    check_out_photo_selfie: "",
    check_out_photo_site: "",
    check_out_time: "",
  });

  const [mobileMarkOpen, setMobileMarkOpen] = useState(false);
  const [mobileMode, setMobileMode] = useState("checkin"); // checkin | checkout
  const [mobileSubmitting, setMobileSubmitting] = useState(false);
  const [mobileUploadingSelfie, setMobileUploadingSelfie] = useState(false);
  const [mobileUploadingSite, setMobileUploadingSite] = useState(false);
  const [mobileForm, setMobileForm] = useState({
    project_id: "",
    photo_selfie: "",
    photo_site: "",
    location: "",
    latitude: "",
    longitude: "",
    check_out_time: "",
    check_out_location: "",
    check_out_latitude: "",
    check_out_longitude: "",
    check_out_photo_selfie: "",
    check_out_photo_site: "",
  });

  const effectiveProjectFilter = projectId || filtersApplied.project_id || "";

  // Allow opening global attendance with a project filter from query string (e.g. from project sidebar).
  useEffect(() => {
    if (projectId) return;
    const qProjectId = String(searchParams.get("project_id") || "").trim();
    if (!qProjectId) return;
    setFiltersDraft((prev) => ({ ...prev, project_id: qProjectId }));
    setFiltersApplied((prev) => ({ ...prev, project_id: qProjectId }));
    setMobileForm((prev) => ({ ...prev, project_id: prev.project_id || qProjectId }));
    setCreateForm((prev) => ({ ...prev, project_id: prev.project_id || qProjectId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, searchParams]);

  // Mobile-only: if opened from project sidebar with mark_attendance=1, open the mark dialog directly.
  useEffect(() => {
    if (projectId) return;
    if (!isMobileView) return;
    const shouldMark = String(searchParams.get("mark_attendance") || "").trim();
    if (shouldMark !== "1") return;
    openMobileMark();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isMobileView, searchParams]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobileView(Boolean(mql.matches));
    update();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  const fetchAttendance = async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const result = await api.getAttendance({
        start_date: filtersApplied.date || undefined,
        end_date: filtersApplied.date || undefined,
        status: filtersApplied.status || undefined,
        project_id: effectiveProjectFilter || undefined,
      });
      if (!result.success) {
        setAttendance([]);
        toast({
          title: "Failed to load attendance",
          description: result.error || "Could not fetch attendance records.",
          variant: "destructive",
        });
        return;
      }
      setAttendance(Array.isArray(result.data) ? result.data : []);
    } catch {
      setAttendance([]);
      toast({
        title: "Failed to load attendance",
        description: "Could not fetch attendance records.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filtersApplied.date, filtersApplied.status, filtersApplied.project_id]);

  useEffect(() => {
    if (projectId) return;
    if (usersLoaded || usersLoading) return;
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, usersLoaded, usersLoading]);

  const fetchLeaves = async () => {
    if (leaveLoading) return;
    setLeaveLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await api.getLeaves({
        status: "approved",
        leave_type: "admin_granted",
        from_date: today,
        to_date: today,
      });
      if (!result.success) {
        setLeaveRecords([]);
        return;
      }
      setLeaveRecords(Array.isArray(result.data) ? result.data : []);
    } catch {
      setLeaveRecords([]);
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) return;
    if (!usersLoaded || usersLoading) return;
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, usersLoaded, usersLoading]);

  useEffect(() => {
    if (projectId) return;
    setGlobalView("today");
  }, [projectId]);

  useEffect(() => {
    if (globalDatePreset !== "month") return;
    if (String(globalMonthValue || "").trim()) return;
    const now = new Date();
    setGlobalMonthValue(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }, [globalDatePreset, globalMonthValue]);

  const globalMonthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 18 }, (_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - idx, 1);
      return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: format(date, "MMM yyyy"),
      };
    });
  }, []);

  const globalUserOptions = useMemo(() => {
    const allowedRoles = new Set(["admin", "labour", "po_officer", "operational_manager"]);
    const pool = Array.isArray(users) ? users : [];
    const filtered = pool.filter((u) => allowedRoles.has(String(u?.role || "").toLowerCase()));
    filtered.sort((a, b) =>
      String(a?.name || a?.username || "").localeCompare(String(b?.name || b?.username || ""))
    );
    return filtered
      .map((u) => ({
        key: getUserKeyFromUser(u),
        label: u?.name || u?.username || u?.phone_number || u?.email || "-",
      }))
      .filter((opt) => Boolean(opt.key));
  }, [users]);

  const usersIndex = useMemo(() => {
    const byKey = new Map();
    const byId = new Map();
    const byPhone = new Map();
    const pool = Array.isArray(users) ? users : [];

    for (const u of pool) {
      const key = getUserKeyFromUser(u);
      if (key && !byKey.has(key)) byKey.set(key, u);

      const id = String(u?.id || u?._id || u?.user_id || u?.userId || "").trim();
      if (id && !byId.has(id)) byId.set(id, u);

      const phone = normalizePhone(u?.phone_number);
      if (phone && !byPhone.has(phone)) byPhone.set(phone, u);
    }

    return { byKey, byId, byPhone };
  }, [users]);

  const resolveAttendanceUserLabel = (item) => {
    const direct = resolveValue(item, ["user_name", "user.name", "user.username", "user.email"]);
    if (direct != null && String(direct).trim() !== "") return String(direct);

    const attendanceUserId = String(
      item?.user_id || item?.userId || item?.user?.id || item?.user?._id || item?.user?.user_id || ""
    ).trim();
    if (attendanceUserId) {
      const match = usersIndex.byId.get(attendanceUserId);
      if (match) return String(match?.name || match?.username || match?.email || match?.phone_number || "-");
    }

    const phone = normalizePhone(item?.phone_number || item?.user?.phone_number);
    if (phone) {
      const match = usersIndex.byPhone.get(phone);
      if (match) return String(match?.name || match?.username || match?.email || match?.phone_number || "-");
    }

    const key = getUserKeyFromAttendance(item);
    if (key) {
      const match = usersIndex.byKey.get(key);
      if (match) return String(match?.name || match?.username || match?.email || match?.phone_number || "-");
    }

    return "-";
  };

  useEffect(() => {
    const tabParam = String(searchParams.get("tab") || "").toLowerCase();
    const normalized = tabParam === "all" || tabParam === "users" || tabParam === "today" ? tabParam : "today";
    setActiveTab(normalized);
  }, [searchParams]);

  useEffect(() => {
    // For the global attendance view, default to "All projects" (no filter).
    if (!projectId) return;
    const defaultProjectId = projectId || selectedProject?.id || selectedProject?.project_id || "";
    if (!defaultProjectId) return;
    setFiltersDraft((prev) => (prev.project_id ? prev : { ...prev, project_id: String(defaultProjectId) }));
    setFiltersApplied((prev) => (prev.project_id ? prev : { ...prev, project_id: String(defaultProjectId) }));
  }, [projectId, selectedProject?.id, selectedProject?.project_id]);

  useEffect(() => {
    const defaultProjectId = projectId || selectedProject?.id || selectedProject?.project_id || "";
    setCreateForm((prev) => ({
      ...prev,
      project_id: prev.project_id || (defaultProjectId ? String(defaultProjectId) : ""),
      date: prev.date || new Date().toISOString().slice(0, 10),
    }));
  }, [projectId, selectedProject?.id, selectedProject?.project_id]);

  const filteredAttendance = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return attendance;
    return attendance.filter((item) => {
      const name = resolveAttendanceUserLabel(item).toLowerCase();
      const phone = (item.phone_number || "").toLowerCase();
      const location = (item.location || "").toLowerCase();
      const date = (item.date || "").toLowerCase();
      return (
        name.includes(normalized) ||
        phone.includes(normalized) ||
        location.includes(normalized) ||
        date.includes(normalized)
      );
    });
  }, [attendance, query, usersIndex]);

  const todayAttendance = useMemo(() => {
    const today = new Date();
    return filteredAttendance.filter((item) => {
      const dateValue = parseAttendanceDate(item.date || item.created_at || item.updated_at);
      return isSameDay(dateValue, today);
    });
  }, [filteredAttendance]);

  const expandedTodayAttendance = useMemo(
    () => expandAttendanceRows(todayAttendance),
    [todayAttendance]
  );

  const filteredTodayAttendance = useMemo(() => {
    const selectedStatus = String(todayStatusFilter || "__all__").toLowerCase();
    if (selectedStatus === "__all__") return expandedTodayAttendance;
    return expandedTodayAttendance.filter((item) => String(resolveAttendanceStatus(item) || "").toLowerCase() === selectedStatus);
  }, [expandedTodayAttendance, todayStatusFilter]);

  const hasCheckIn = (item) =>
    Boolean(item?.__checkInValue ?? resolveValue(item, CHECKIN_TIME_KEYS));

  const hasCheckOut = (item) =>
    Boolean(item?.__checkOutValue ?? resolveValue(item, CHECKOUT_TIME_KEYS));

  const getMonthRange = (year, monthIndex) => {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const globalRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);

    if (globalDatePreset === "today") {
      const start = new Date(today);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (globalDatePreset === "yesterday") {
      const start = new Date(today);
      start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (globalDatePreset === "last_week") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (globalDatePreset === "last_month") {
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return getMonthRange(prevMonth.getFullYear(), prevMonth.getMonth());
    }

    if (globalDatePreset === "month") {
      const [year, month] = String(globalMonthValue || "")
        .split("-")
        .map((value) => Number(value));
      if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
        return getMonthRange(year, month - 1);
      }
    }

    if (globalDatePreset === "custom") {
      const start = parseYmdDate(globalFromDate);
      const endRaw = parseYmdDate(globalToDate);
      if (start && endRaw) {
        const end = new Date(endRaw);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      return { start: null, end: null };
    }

    return { start: null, end: null };
  }, [globalDatePreset, globalFromDate, globalMonthValue, globalToDate]);

  const notCheckedTargetDate = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);

    if (globalDatePreset === "yesterday") {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return d;
    }

    if (globalDatePreset === "custom") {
      return parseYmdDate(globalFromDate) || parseYmdDate(globalToDate) || today;
    }

    return today;
  }, [globalDatePreset, globalFromDate, globalToDate]);

  const notCheckedTargetDateKey = format(notCheckedTargetDate, "yyyy-MM-dd");
  const notCheckedTargetDateLabel = format(notCheckedTargetDate, "dd MMM yyyy");

  const globalBaseAttendance = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return attendance;
    return attendance.filter((item) => {
      const name = resolveAttendanceUserLabel(item).toLowerCase();
      const phone = (item.phone_number || "").toLowerCase();
      const location = (item.location || "").toLowerCase();
      const date = (item.date || "").toLowerCase();
      return (
        name.includes(normalized) ||
        phone.includes(normalized) ||
        location.includes(normalized) ||
        date.includes(normalized)
      );
    });
  }, [attendance, query, usersIndex]);

  const globalFilteredAttendance = useMemo(() => {
    const { start, end } = globalRange || {};
    const selectedUser = String(globalUserKey || "__all__");
    const selectedStatus = String(globalStatusFilter || "__all__").toLowerCase();
    const pool = Array.isArray(globalBaseAttendance) ? globalBaseAttendance : [];
    return pool.filter((item) => {
      if (selectedUser !== "__all__") {
        const key = getUserKeyFromAttendance(item);
        if (!key || key !== selectedUser) return false;
      }
      if (selectedStatus !== "__all__") {
        const status = String(resolveAttendanceStatus(item) || "").toLowerCase();
        if (status !== selectedStatus) return false;
      }
      if (!start || !end) return true;
      const dateValue = parseAttendanceDate(item?.date || item?.created_at || item?.updated_at);
      if (!dateValue) return false;
      const time = dateValue.getTime();
      return time >= start.getTime() && time <= end.getTime();
    });
  }, [globalBaseAttendance, globalRange, globalStatusFilter, globalUserKey]);

  const globalAttendanceItems = useMemo(() => {
    const expanded = expandAttendanceRows(globalFilteredAttendance);
    if (globalView === "checked") return expanded.filter(hasCheckIn);
    if (globalView === "checkout") return expanded.filter(hasCheckOut);
    return expanded;
  }, [globalFilteredAttendance, globalView]);

  const globalAttendanceTitle = useMemo(() => {
    if (globalView === "checked") return "Checked In";
    if (globalView === "checkout") return "Checked Out";
    if (globalView === "not_checked") return "Not Checked In";
    if (globalView === "all") return "Attendance";
    return "Attendance List";
  }, [globalView]);

  const globalAttendanceDescription = useMemo(() => {
    if (globalView === "checked") return "Users who have checked in today.";
    if (globalView === "checkout") return "Users who have checked out today.";
    if (globalView === "not_checked") {
      return `Users who have not checked in on ${notCheckedTargetDateLabel}.`;
    }
    if (globalDatePreset === "today") return "Today’s attendance records.";
    if (globalDatePreset === "yesterday") return "Yesterday’s attendance records.";
    if (globalDatePreset === "last_week") return "Attendance records from the last 7 days.";
    if (globalDatePreset === "last_month") return "Attendance records from last month.";
    if (globalDatePreset === "month") return "Attendance records for the selected month.";
    if (globalDatePreset === "custom") return "Attendance records for the selected date range.";
    return "All attendance records.";
  }, [globalDatePreset, globalView, notCheckedTargetDateLabel]);

  const expandedAllAttendance = useMemo(() => {
    const normalizedName = allNameQuery.trim().toLowerCase();
    const filtered = (Array.isArray(attendance) ? attendance : []).filter((item) => {
      const name = resolveAttendanceUserLabel(item).toLowerCase();
      if (normalizedName && !name.includes(normalizedName)) return false;
      const selectedAttendanceType = String(filtersApplied.attendance_type || "");
      if (selectedAttendanceType && resolveAttendanceType(item) !== selectedAttendanceType) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const left = parseAttendanceDate(a?.date || a?.created_at || a?.updated_at);
      const right = parseAttendanceDate(b?.date || b?.created_at || b?.updated_at);
      const l = left ? left.getTime() : 0;
      const r = right ? right.getTime() : 0;
      return r - l;
    });

    return expandAttendanceRows(filtered);
  }, [attendance, allNameQuery, filtersApplied.attendance_type, usersIndex]);

  const filteredUsers = useMemo(() => {
    const normalized = usersQuery.trim().toLowerCase();
    const allowedRoles = new Set([
      "admin",
      "labour",
      "po_officer",
      "operational_manager",
    ]);
    const attendanceUsers = users.filter((user) =>
      allowedRoles.has((user.role || "").toString().toLowerCase())
    );
    if (!normalized) return attendanceUsers;
    return attendanceUsers.filter((user) => {
      const name = (user.name || user.username || "").toLowerCase();
      const phone = (user.phone_number || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const role = (user.role || "").toLowerCase();
      return (
        name.includes(normalized) ||
        phone.includes(normalized) ||
        email.includes(normalized) ||
        role.includes(normalized)
      );
    });
  }, [users, usersQuery]);

  const checkedInUserKeysToday = useMemo(() => {
    const keys = new Set();
    for (const item of todayAttendance) {
      if (!hasCheckIn(item)) continue;
      const key = getUserKeyFromAttendance(item);
      if (key) keys.add(key);
    }
    return keys;
  }, [todayAttendance]);

  const checkedOutUserKeysToday = useMemo(() => {
    const keys = new Set();
    for (const item of todayAttendance) {
      if (!hasCheckOut(item)) continue;
      const key = getUserKeyFromAttendance(item);
      if (key) keys.add(key);
    }
    return keys;
  }, [todayAttendance]);

  const checkedUsersToday = useMemo(() => {
    const pool = filteredUsers;
    if (!Array.isArray(pool) || pool.length === 0) return [];
    return pool.filter((user) => checkedInUserKeysToday.has(getUserKeyFromUser(user)));
  }, [checkedInUserKeysToday, filteredUsers]);

  const checkedOutUsersToday = useMemo(() => {
    const pool = filteredUsers;
    if (!Array.isArray(pool) || pool.length === 0) return [];
    return pool.filter((user) => checkedOutUserKeysToday.has(getUserKeyFromUser(user)));
  }, [checkedOutUserKeysToday, filteredUsers]);

  const leaveUserKeysToday = useMemo(() => {
    const keys = new Set();
    for (const rec of Array.isArray(leaveRecords) ? leaveRecords : []) {
      const userId = String(rec?.user_id || rec?.user?.id || rec?.user?.user_id || "").trim();
      if (userId) keys.add(userId);
      const phone = normalizePhone(rec?.phone_number || rec?.user?.phone_number);
      if (phone) keys.add(phone);
    }
    for (const key of leaveGrantedKeys) keys.add(key);
    return keys;
  }, [leaveGrantedKeys, leaveRecords]);

  const checkedUsersTodayCount = checkedUsersToday.length;
  const checkedOutTodayCount = checkedOutUsersToday.length;

  const leaveUsersToday = useMemo(() => {
    const approvedLeaveIdsToday = new Set();
    for (const rec of Array.isArray(leaveRecords) ? leaveRecords : []) {
      const userId = String(rec?.user_id || rec?.user?.id || rec?.user?.user_id || "").trim();
      if (userId) approvedLeaveIdsToday.add(userId);
      const phone = normalizePhone(rec?.phone_number || rec?.user?.phone_number);
      if (phone) approvedLeaveIdsToday.add(phone);
    }
    const pool = filteredUsers;
    if (!Array.isArray(pool) || pool.length === 0) return [];
    return pool.filter((u) => {
      const key = getUserKeyFromUser(u);
      const id = String(u?.id || u?._id || u?.user_id || u?.userId || "");
      return (
        (key && leaveGrantedKeys.has(key)) ||
        (id && leaveGrantedKeys.has(id)) ||
        (id && approvedLeaveIdsToday.has(id)) ||
        (key && approvedLeaveIdsToday.has(key))
      );
    });
  }, [filteredUsers, leaveGrantedKeys, leaveRecords]);

  const leaveTodayCount = useMemo(() => leaveUsersToday.length, [leaveUsersToday.length]);

  const notCheckedAttendanceRows = useMemo(() => {
    const pool = Array.isArray(attendance) ? attendance : [];
    return pool.filter((item) => {
      const dateValue = item?.date || item?.created_at || item?.updated_at;
      return isSameYmd(dateValue, notCheckedTargetDateKey);
    });
  }, [attendance, notCheckedTargetDateKey]);

  const notCheckedAttendanceUserKeys = useMemo(() => {
    const keys = new Set();
    for (const item of notCheckedAttendanceRows) {
      const key = getUserKeyFromAttendance(item);
      if (key) keys.add(key);
    }
    return keys;
  }, [notCheckedAttendanceRows]);

  const notCheckedUsersToday = useMemo(() => {
    const pool = filteredUsers;
    if (!Array.isArray(pool) || pool.length === 0) return [];

    const selectedDate = parseAttendanceDate(notCheckedTargetDateKey);
    const selectedIsToday = isSameDay(selectedDate, new Date());
    const leaveKeysToExclude = selectedIsToday ? leaveUserKeysToday : new Set();
    const selectedUserKey = String(globalUserKey || "__all__");
    const normalizedQuery = query.trim().toLowerCase();

    return pool.filter((user) => {
      const key = getUserKeyFromUser(user);
      const id = String(user?.id || user?._id || user?.user_id || user?.userId || "");
      const name = String(user?.name || user?.username || "").toLowerCase();
      const phone = String(user?.phone_number || "").toLowerCase();
      const email = String(user?.email || "").toLowerCase();
      const role = String(user?.role || "").toLowerCase();

      if (
        selectedUserKey !== "__all__" &&
        key !== selectedUserKey &&
        id !== selectedUserKey
      ) {
        return false;
      }

      if (
        normalizedQuery &&
        !name.includes(normalizedQuery) &&
        !phone.includes(normalizedQuery) &&
        !email.includes(normalizedQuery) &&
        !role.includes(normalizedQuery)
      ) {
        return false;
      }

      if (notCheckedAttendanceUserKeys.has(key)) return false;
      if (
        (key && leaveKeysToExclude.has(key)) ||
        (id && leaveKeysToExclude.has(id))
      ) {
        return false;
      }
      return true;
    });
  }, [
    filteredUsers,
    globalUserKey,
    leaveUserKeysToday,
    notCheckedAttendanceUserKeys,
    notCheckedTargetDateKey,
    query,
  ]);

  const notCheckedTodayCount = notCheckedUsersToday.length;

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const result = await api.getUsers();
      if (!result.success) {
        setUsers([]);
        toast({
          title: "Failed to load users",
          description: result.error || "Could not fetch users.",
          variant: "destructive",
        });
        return;
      }
      setUsers(Array.isArray(result.data) ? result.data : []);
      setUsersLoaded(true);
    } catch {
      setUsers([]);
      toast({
        title: "Failed to load users",
        description: "Could not fetch users.",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const openLeaveGrant = (targetUser, attendanceDate = notCheckedTargetDateKey) => {
    setLeaveGrantKey(getUserKeyFromUser(targetUser));
    const userId =
      targetUser?.id ||
      targetUser?._id ||
      targetUser?.user_id ||
      targetUser?.userId ||
      "";
    const userName =
      targetUser?.name ||
      targetUser?.username ||
      targetUser?.user_name ||
      targetUser?.email ||
      targetUser?.phone_number ||
      "";
    const selectedDate = String(attendanceDate || notCheckedTargetDateKey || new Date().toISOString().slice(0, 10)).trim();
    setLeaveGrantForm({
      user_id: String(userId || ""),
      user_name: String(userName || ""),
      from_date: selectedDate,
      to_date: selectedDate,
      reason: "",
    });
    setLeaveGrantOpen(true);
  };

  const grantLeave = async () => {
    if (leaveGrantSaving) return;
    const resolvedUserName =
      String(leaveGrantForm.user_name || "").trim() ||
      (Array.isArray(users) ? users : [])
        .map((u) => ({
          id: u?.id || u?._id || u?.user_id || u?.userId,
          name: u?.name || u?.username || u?.email || u?.phone_number,
        }))
        .find((u) => String(u.id || "") === String(leaveGrantForm.user_id || ""))?.name ||
      "User";
    const payload = {
      user_id: String(leaveGrantForm.user_id || "").trim(),
      user_name: resolvedUserName,
      from_date: String(leaveGrantForm.from_date || "").trim(),
      to_date: String(leaveGrantForm.to_date || "").trim(),
      reason: String(leaveGrantForm.reason || "").trim() || "Leave",
    };
    if (!payload.user_id || !payload.user_name || !payload.from_date || !payload.to_date) {
      toast({
        title: "Missing fields",
        description: "User, name, and dates are required.",
        variant: "destructive",
      });
      return;
    }
    setLeaveGrantSaving(true);
    try {
      const result = await api.grantLeaveAdmin(payload);
      if (!result.success) {
        toast({
          title: "Leave grant failed",
          description: result.error || "Could not grant leave.",
          variant: "destructive",
        });
        return;
      }
      setLeaveGrantedKeys((prev) => {
        const next = new Set(prev);
        if (leaveGrantKey) next.add(leaveGrantKey);
        if (payload.user_id) next.add(String(payload.user_id));
        return next;
      });
      setLeaveBanner({
        title: "Leave granted",
        description: `${payload.user_name || "User"}: ${payload.from_date} → ${payload.to_date}`,
      });
      toast({ title: "Leave granted", description: "Leave has been granted successfully." });
      setLeaveGrantOpen(false);
      fetchLeaves();
    } catch {
      toast({
        title: "Leave grant failed",
        description: "Could not grant leave.",
        variant: "destructive",
      });
    } finally {
      setLeaveGrantSaving(false);
    }
  };

  const upsertAttendanceStatusForUser = async (
    targetUser,
    { status, bannerTitle, attendanceDate } = {}
  ) => {
    const key = getUserKeyFromUser(targetUser);
    if (!key) return;
    if (absentSavingKeys.has(key)) return;
    const targetDate = String(attendanceDate || new Date().toISOString().slice(0, 10)).trim();
    const pool = Array.isArray(attendance) ? attendance : [];
    let existing = null;
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      const row = pool[i];
      if (getUserKeyFromAttendance(row) !== key) continue;
      const rowDate = row?.date || row?.created_at || row?.updated_at;
      if (!isSameYmd(rowDate, targetDate)) continue;
      existing = row;
      break;
    }
    const existingAttendanceId = existing ? resolveAttendanceId(existing) : null;

    if (existingAttendanceId) {
      setAbsentSavingKeys((prev) => new Set(prev).add(key));
      try {
        const result = await api.updateAttendanceStatus(existingAttendanceId, status);
        if (!result.success) {
          toast({
            title: "Failed to update status",
            description: result.error || "Could not update attendance status.",
            variant: "destructive",
          });
          return;
        }
        setLeaveBanner({
          title: bannerTitle || "Status updated",
          description: `${targetUser?.name || targetUser?.username || "User"} marked ${status} for ${targetDate}.`,
        });
        toast({ title: "Status updated", description: `Attendance marked ${status}.` });
        fetchAttendance({ silent: true });
      } catch {
        toast({
          title: "Failed to update status",
          description: "Could not update attendance status.",
          variant: "destructive",
        });
      } finally {
        setAbsentSavingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
      return;
    }

    const resolveProjectIdForUser = (userRow) => {
      const explicit =
        filtersDraft.project_id ||
        filtersApplied.project_id ||
        selectedProject?.id ||
        selectedProject?.project_id ||
        "";
      if (explicit) return explicit;

      // Fallback to last selected project (if any).
      try {
        const savedProjectId = localStorage.getItem("selected_project_id");
        if (savedProjectId && String(savedProjectId).trim()) return String(savedProjectId).trim();
      } catch {
        // ignore
      }

      // Some user payloads include a single project field instead of project_list.
      const directProjectId =
        userRow?.project_id ??
        userRow?.projectId ??
        userRow?.project ??
        "";
      if (directProjectId != null && String(directProjectId).trim()) {
        const resolved = String(directProjectId).trim();
        if (/^\\d+$/.test(resolved)) return resolved;
        // Treat as project name.
        const name = resolved.toLowerCase();
        const match = (Array.isArray(projects) ? projects : []).find((p) => {
          const pName = String(p?.project_name ?? p?.name ?? "").trim().toLowerCase();
          const pSlug = String(p?.slug ?? "").trim().toLowerCase();
          const nameSlug = pName ? pName.replace(/\s+/g, "-") : "";
          return (pName && pName === name) || (pSlug && pSlug === name) || (nameSlug && nameSlug === name);
        });
        if (match) return String(match?.project_id ?? match?.id ?? "").trim();
      }

      const list = (() => {
        const raw = userRow?.project_list;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          if (!trimmed) return [];
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            // fall through
          }
          return trimmed
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
        }
        return [];
      })();
      const tryResolveFromEntry = (entry) => {
        if (entry == null) return "";
        if (typeof entry === "number") return String(entry);
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          if (!trimmed) return "";
          // If it's already an id-like string, use it directly.
          if (/^\d+$/.test(trimmed)) return trimmed;
          // Otherwise, treat it as a project name and map it.
          const name = trimmed.toLowerCase();
          const match = (Array.isArray(projects) ? projects : []).find((p) => {
            const pName = String(p?.project_name ?? p?.name ?? "").trim().toLowerCase();
            const pSlug = String(p?.slug ?? "").trim().toLowerCase();
            const nameSlug = pName ? pName.replace(/\s+/g, "-") : "";
            return (pName && pName === name) || (pSlug && pSlug === name) || (nameSlug && nameSlug === name);
          });
          if (match) return String(match?.project_id ?? match?.id ?? "").trim();
          return "";
        }
        if (typeof entry === "object") {
          const id = entry?.project_id ?? entry?.id ?? entry?.value ?? entry?.key;
          if (id != null && String(id).trim()) return String(id).trim();
          const name = String(entry?.project_name ?? entry?.name ?? "").trim();
          if (name) return tryResolveFromEntry(name);
        }
        return "";
      };

      // Prefer a deterministic choice: first resolvable project in the list.
      for (const entry of list) {
        const resolved = tryResolveFromEntry(entry);
        if (resolved) return resolved;
      }

      // If there is exactly one project in the system/context, use it as a fallback.
      const allProjects = Array.isArray(projects) ? projects : [];
      if (allProjects.length === 1) {
        const only = allProjects[0];
        const onlyId = only?.project_id ?? only?.id;
        if (onlyId != null && String(onlyId).trim()) return String(onlyId).trim();
      }

      return "";
    };

    const projectIdValue = resolveProjectIdForUser(targetUser);
    if (!projectIdValue) {
      toast({
        title: "Project missing",
        description: "Select a project first to mark absent/leave.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      project_id: String(projectIdValue).trim(),
      user_id: String(targetUser?.id || targetUser?._id || targetUser?.user_id || targetUser?.userId || "").trim(),
      user_name: String(targetUser?.name || targetUser?.username || "").trim(),
      phone_number: targetUser?.phone_number || targetUser?.phoneNumber || undefined,
      date: targetDate,
      status: status || "absent",
    };

    if (!payload.user_id) {
      toast({
        title: "User ID missing",
        description: "This user does not have an ID to mark absent.",
        variant: "destructive",
      });
      return;
    }

    setAbsentSavingKeys((prev) => new Set(prev).add(key));
    try {
      const result = await api.createAttendance(payload);
      if (!result.success) {
        if (isBlockedAttendanceError(result)) {
          toast({
            title: "User is blocked",
            description: `${payload.user_name || "User"} is currently on leave or blocked, so attendance cannot be recorded.`,
            variant: "destructive",
          });
          fetchLeaves();
          return;
        }
        toast({
          title: "Failed to mark absent",
          description: result.error || "Could not mark absent.",
          variant: "destructive",
        });
        return;
      }
      // Some deployments ignore `status` on create and default to pending.
      // Ensure the record reflects the intended status using PATCH /attendance/{id}/status.
      const createdAttendanceId = resolveAttendanceId(result.data);
      if (createdAttendanceId) {
        const patchRes = await api.updateAttendanceStatus(createdAttendanceId, payload.status);
        if (!patchRes?.success) {
          toast({
            title: "Saved but status not updated",
            description: patchRes?.error || "Attendance saved, but status update failed.",
            variant: "destructive",
          });
        }
      }
      setLeaveBanner({
        title: bannerTitle || "Status updated",
        description: `${payload.user_name || "User"} marked ${payload.status} for ${targetDate}.`,
      });
      toast({ title: "Status updated", description: `Attendance saved as ${payload.status}.` });
      fetchAttendance({ silent: true });
    } catch {
      toast({
        title: "Failed to mark absent",
        description: "Could not mark absent.",
        variant: "destructive",
      });
    } finally {
      setAbsentSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleUserHistoryOpen = (user) => {
    const userId = user?.id || user?._id || user?.user_id || user?.userId;
    if (!userId) {
      toast({
        title: "User ID missing",
        description: "This user does not have an ID to load attendance history.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/attendance/user/${userId}`, { state: { user } });
  };

  const handleStatusChange = async (item, status) => {
    const attendanceId = resolveAttendanceId(item);
    if (!attendanceId) {
      toast({
        title: "Attendance ID missing",
        description: "This attendance record cannot be updated.",
        variant: "destructive",
      });
      return;
    }
    const currentStatus = resolveAttendanceStatus(item).toString().toLowerCase();
    if (currentStatus === status) return;
    setStatusSaving((prev) => ({ ...prev, [attendanceId]: true }));
    try {
      const result = await api.updateAttendanceStatus(attendanceId, status);
      if (!result.success) {
        toast({
          title: "Failed to update attendance",
          description: result.error || "Could not update attendance status.",
          variant: "destructive",
        });
        return;
      }
      setAttendance((prev) =>
        prev.map((row) =>
          resolveAttendanceId(row) === attendanceId
            ? { ...row, status }
            : row
        )
      );
      toast({
        title: "Attendance updated",
        description: `${resolveAttendanceUserLabel(item)} marked ${status}.`,
      });
    } catch {
      toast({
        title: "Failed to update attendance",
        description: "Could not update attendance status.",
        variant: "destructive",
      });
    } finally {
      setStatusSaving((prev) => {
        const next = { ...prev };
        delete next[attendanceId];
        return next;
      });
    }
  };

  const openPreview = (item) => {
    setPreviewItem(item);
    setPreviewPhase("checkin");
  };

  const closePreview = () => {
    setPreviewItem(null);
  };

  const downloadAttendanceReportPdf = async () => {
    if (pdfDownloading) return;
    if (!Array.isArray(expandedAllAttendance) || expandedAllAttendance.length === 0) {
      toast({
        title: "No attendance records",
        description: "Apply filters and try again.",
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

    const activeProjectId = effectiveProjectFilter || filtersApplied.project_id || projectId || "";
    const projectRecord =
      (activeProjectId &&
        (Array.isArray(projects) ? projects : []).find(
          (project) => String(project.id || project.project_id) === String(activeProjectId)
        )) ||
      null;
    const projectLabel =
      projectRecord?.name ||
      projectRecord?.project_name ||
      selectedProject?.name ||
      selectedProject?.project_name ||
      (activeProjectId ? `Project ${activeProjectId}` : "All Projects");

    const formattedFilters = {
      date: filtersApplied.date ? String(filtersApplied.date) : "All",
      status: filtersApplied.status ? formatStatusLabel(filtersApplied.status) : "All",
      attendanceType: filtersApplied.attendance_type
        ? String(filtersApplied.attendance_type).replace(/_/g, " ")
        : "All",
      name: allNameQuery?.trim() ? allNameQuery.trim() : "All",
    };

    try {
      setPdfDownloading(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const frameX = margin;
      const frameY = margin;
      const frameW = pageWidth - margin * 2;
      const generatedAt = new Date().toLocaleString();

      let headerDataUrl = "";
      let headerImgW = 0;
      let headerImgH = 0;
      let headerImgType = "JPEG";
      try {
        headerDataUrl = await loadImageDataUrl(attendanceHeaderUrl);
        headerImgType = String(headerDataUrl).startsWith("data:image/png") ? "PNG" : "JPEG";
        const headerImg = await loadHtmlImage(headerDataUrl);
        const naturalW = headerImg.naturalWidth || 1;
        const naturalH = headerImg.naturalHeight || 1;
        const ratio = naturalH / naturalW;

        const maxLogoW = Math.min(frameW * 0.55, 90);
        const maxLogoH = 22;
        let desiredW = maxLogoW;
        let desiredH = desiredW * ratio;
        if (desiredH > maxLogoH) {
          desiredH = maxLogoH;
          desiredW = desiredH / ratio;
        }
        headerImgW = Math.max(10, desiredW);
        headerImgH = Math.max(6, desiredH);
      } catch {
        headerDataUrl = "";
        headerImgW = 0;
        headerImgH = 0;
      }

      const renderHeader = () => {
        let cursorY = frameY;
        if (headerDataUrl) {
          doc.addImage(
            headerDataUrl,
            headerImgType,
            frameX + (frameW - headerImgW) / 2,
            cursorY,
            headerImgW,
            headerImgH,
            undefined,
            "FAST"
          );
          cursorY += headerImgH + 6;
        }

        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text("Confidential attendance report", frameX + frameW / 2, cursorY + 6, { align: "center" });

        const gridTopY = cursorY + 12;
        const gridH = 24;
        const rowH = gridH / 2;
        const colW = frameW / 4;

        const drawCenteredCell = (label, value, x, y, w, h) => {
          doc.setLineWidth(0.3);
          doc.rect(x, y, w, h);

          const padX = 2;
          const labelY = y + h * 0.38;
          const singleValueY = y + h * 0.78;
          const multiValueY1 = y + h * 0.68;
          const multiValueY2 = y + h * 0.88;
          const maxTextW = Math.max(10, w - padX * 2);

          doc.setFont("times", "bold");
          doc.setFontSize(9.5);
          doc.text(String(label || ""), x + w / 2, labelY, { align: "center" });

          doc.setFont("times", "normal");
          doc.setFontSize(9);
          const valueText = value == null ? "" : String(value);
          const lines = doc.splitTextToSize(valueText, maxTextW).slice(0, 2);
          if (lines.length === 0) return;
          if (lines.length === 1) {
            doc.text(String(lines[0]), x + w / 2, singleValueY, { align: "center" });
            return;
          }
          doc.text(String(lines[0]), x + w / 2, multiValueY1, { align: "center" });
          doc.text(String(lines[1]), x + w / 2, multiValueY2, { align: "center" });
        };

        drawCenteredCell("Project", projectLabel, frameX, gridTopY, colW, rowH);
        drawCenteredCell("Date", formattedFilters.date, frameX + colW, gridTopY, colW, rowH);
        drawCenteredCell("Status", formattedFilters.status, frameX + colW * 2, gridTopY, colW, rowH);
        drawCenteredCell("Records", expandedAllAttendance.length, frameX + colW * 3, gridTopY, colW, rowH);

        drawCenteredCell("Name", formattedFilters.name, frameX, gridTopY + rowH, colW * 2, rowH);
        drawCenteredCell("Attendance Type", formattedFilters.attendanceType, frameX + colW * 2, gridTopY + rowH, colW, rowH);
        drawCenteredCell("Generated", generatedAt, frameX + colW * 3, gridTopY + rowH, colW, rowH);

        return gridTopY + gridH;
      };

      const tableStartY = renderHeader() + 4;

      const tableRows = expandedAllAttendance.map((item, index) => {
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
        const hideTimings = isAbsentAttendance(item);

        return [
          String(index + 1),
          resolveAttendanceUserLabel(item),
          String(item?.phone_number || "-"),
          String(formatDate(item?.date || item?.created_at) || "-"),
          String(hideTimings ? "-" : formatTimeValue(actualCheckIn, baseDate) || "-"),
          String(hideTimings ? "-" : formatTimeValue(actualCheckOut, baseDate) || "-"),
          String(item?.location || "-"),
          String(formatStatusLabel(status) || "-"),
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: frameX, right: frameX, top: tableStartY, bottom: margin },
        tableWidth: frameW,
        theme: "grid",
        head: [["#", "Name", "Phone", "Date", "Check In", "Check Out", "Location", "Status"]],
        body: tableRows,
        styles: {
          font: "times",
          fontSize: 8.5,
          cellPadding: 2,
          valign: "middle",
          lineColor: [40, 40, 40],
          lineWidth: 0.15,
          textColor: [20, 20, 20],
        },
        headStyles: {
          fontStyle: "bold",
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          halign: "center",
          valign: "middle",
        },
        alternateRowStyles: { fillColor: [245, 252, 249] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 34, halign: "left" },
          2: { cellWidth: 24, halign: "center" },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 20, halign: "center" },
          5: { cellWidth: 20, halign: "center" },
          6: { cellWidth: 129, halign: "left", overflow: "linebreak" },
          7: { cellWidth: 20, halign: "center" },
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            renderHeader();
          }
        },
      });

      const filename = `Attendance-${safeFilenamePart(projectLabel)}-${safeFilenamePart(formattedFilters.date)}-${safeFilenamePart(formattedFilters.status)}-${safeFilenamePart(formattedFilters.attendanceType)}.pdf`;
      doc.save(filename);
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

  const downloadGlobalAttendancePdf = async () => {
    if (globalPdfDownloading) return;
    const safeFilenamePart = (value) =>
      String(value || "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 60) || "NA";

    const resolveGlobalUserLabel = () => {
      const selected = String(globalUserKey || "__all__");
      if (!selected || selected === "__all__") return "All";
      const match = usersIndex.byKey.get(selected);
      return String(match?.name || match?.username || match?.email || match?.phone_number || selected);
    };

    const resolveGlobalDateLabel = () => {
      if (globalDatePreset === "all") return "All";
      if (globalDatePreset === "today") return new Date().toISOString().slice(0, 10);
      if (globalDatePreset === "yesterday") {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
      }
      if (globalDatePreset === "last_week") return "Last-7-Days";
      if (globalDatePreset === "last_month") return "Last-Month";
      if (globalDatePreset === "month") return globalMonthValue ? String(globalMonthValue) : "Month";
      if (globalDatePreset === "custom") {
        if (globalFromDate && globalToDate) return `${globalFromDate}_to_${globalToDate}`;
        return "Custom";
      }
      return String(globalDatePreset || "All");
    };

    const viewLabelMap = {
      all: "Attendance",
      checked: "Checked-In",
      checkout: "Checked-Out",
      not_checked: "Not-Checked-In",
      users: "Users",
      leave: "Leave",
      today: "Attendance",
    };

    const resolvedViewLabel = viewLabelMap[String(globalView || "all")] || "Attendance";
    const dateLabel = resolveGlobalDateLabel();
    const userLabel = resolveGlobalUserLabel();

    try {
      setGlobalPdfDownloading(true);
      const generatedAt = new Date().toLocaleString();

      if (String(globalView) === "users") {
        if (!Array.isArray(filteredUsers) || filteredUsers.length === 0) {
          toast({
            title: "No users found",
            description: "Users are still loading or none are available.",
            variant: "destructive",
          });
          return;
        }

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;

        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text("Global Users (Attendance)", pageWidth / 2, 14, { align: "center" });
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.text(`Generated: ${generatedAt}`, margin, 20);

        autoTable(doc, {
          startY: 26,
          margin: { left: margin, right: margin },
          theme: "grid",
          head: [["Name", "Phone", "Role", "Email"]],
          body: filteredUsers.map((u) => [
            String(u?.name || u?.username || "-"),
            String(u?.phone_number || "-"),
            String(u?.role || "-"),
            String(u?.email || "-"),
          ]),
          styles: { font: "times", fontSize: 8.5, cellPadding: 2, valign: "middle" },
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: "bold" },
        });

        doc.save(`global-users-${new Date().toISOString().slice(0, 10)}.pdf`);
        return;
      }

      if (String(globalView) === "not_checked") {
        if (!Array.isArray(notCheckedUsersToday) || notCheckedUsersToday.length === 0) {
          toast({
            title: "No users found",
            description: "Everyone is checked in or users are still loading.",
            variant: "destructive",
          });
          return;
        }

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;

        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text(`Not Checked In (${notCheckedTargetDateLabel})`, pageWidth / 2, 14, {
          align: "center",
        });
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.text(`Date: ${notCheckedTargetDateLabel}`, margin, 20);
        doc.text(`Generated: ${generatedAt}`, margin, 26);

        autoTable(doc, {
          startY: 32,
          margin: { left: margin, right: margin },
          theme: "grid",
          head: [["Name", "Phone", "Role", "Email", "Leave Granted"]],
          body: notCheckedUsersToday.map((u) => {
            const key = getUserKeyFromUser(u);
            return [
              String(u?.name || u?.username || "-"),
              String(u?.phone_number || "-"),
              String(u?.role || "-"),
              String(u?.email || "-"),
              leaveGrantedKeys.has(key) ? "Yes" : "No",
            ];
          }),
          styles: { font: "times", fontSize: 8.5, cellPadding: 2, valign: "middle" },
          headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255], fontStyle: "bold" },
        });

        doc.save(`not-checked-in-${notCheckedTargetDateKey}.pdf`);
        return;
      }

      const rowsSource = Array.isArray(globalAttendanceItems) ? globalAttendanceItems : [];
      if (rowsSource.length === 0) {
        toast({
          title: "No attendance records",
          description: "No records match the selected filters.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const frameX = margin;
      const frameY = margin;
      const frameW = pageWidth - margin * 2;

      const renderHeader = () => {
        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.text(`Global Attendance (${resolvedViewLabel})`, pageWidth / 2, frameY + 8, { align: "center" });

        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.text(`Date: ${dateLabel}`, frameX, frameY + 14);
        doc.text(`User: ${userLabel}`, frameX, frameY + 19);
        doc.text(`Generated: ${generatedAt}`, frameX, frameY + 24);
        doc.text(`Records: ${rowsSource.length}`, frameX, frameY + 29);

        return frameY + 33;
      };

      const tableStartY = renderHeader() + 2;
      const tableRows = rowsSource.map((item, index) => {
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
        const hideTimings = isAbsentAttendance(item);

        return [
          String(index + 1),
          resolveAttendanceUserLabel(item),
          String(item?.phone_number || "-"),
          String(formatDate(item?.date || item?.created_at) || "-"),
          String(hideTimings ? "-" : formatTimeValue(actualCheckIn, baseDate) || "-"),
          String(hideTimings ? "-" : formatTimeValue(actualCheckOut, baseDate) || "-"),
          String(item?.location || "-"),
          String(formatStatusLabel(status) || "-"),
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: frameX, right: frameX, top: tableStartY, bottom: margin },
        tableWidth: frameW,
        theme: "grid",
        head: [["#", "Name", "Phone", "Date", "Check In", "Check Out", "Location", "Status"]],
        body: tableRows,
        styles: {
          font: "times",
          fontSize: 8.5,
          cellPadding: 2,
          valign: "middle",
          lineColor: [40, 40, 40],
          lineWidth: 0.15,
          textColor: [20, 20, 20],
        },
        headStyles: {
          fontStyle: "bold",
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          halign: "center",
          valign: "middle",
        },
        alternateRowStyles: { fillColor: [245, 252, 249] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 34, halign: "left" },
          2: { cellWidth: 24, halign: "center" },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 20, halign: "center" },
          5: { cellWidth: 20, halign: "center" },
          6: { cellWidth: 129, halign: "left", overflow: "linebreak" },
          7: { cellWidth: 20, halign: "center" },
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            renderHeader();
          }
        },
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `global-attendance-${safeFilenamePart(resolvedViewLabel)}-${safeFilenamePart(dateLabel)}-${safeFilenamePart(userLabel)}-${today}.pdf`;
      doc.save(filename);
    } catch (e) {
      toast({
        title: "PDF export failed",
        description: e?.message || "Could not generate PDF.",
        variant: "destructive",
      });
    } finally {
      setGlobalPdfDownloading(false);
    }
  };

  const downloadAttendanceReportExcel = async () => {
    if (pdfDownloading) return;
    if (!Array.isArray(expandedAllAttendance) || expandedAllAttendance.length === 0) {
      toast({
        title: "No attendance records",
        description: "Apply filters and try again.",
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

    const activeProjectId = effectiveProjectFilter || filtersApplied.project_id || projectId || "";
    const projectRecord =
      (activeProjectId &&
        (Array.isArray(projects) ? projects : []).find(
          (project) => String(project.id || project.project_id) === String(activeProjectId)
        )) ||
      null;
    const projectLabel =
      projectRecord?.name ||
      projectRecord?.project_name ||
      selectedProject?.name ||
      selectedProject?.project_name ||
      (activeProjectId ? `Project ${activeProjectId}` : "All Projects");

    const formattedFilters = {
      date: filtersApplied.date ? String(filtersApplied.date) : "All",
      status: filtersApplied.status ? formatStatusLabel(filtersApplied.status) : "All",
      attendanceType: filtersApplied.attendance_type
        ? String(filtersApplied.attendance_type).replace(/_/g, " ")
        : "All",
      name: allNameQuery?.trim() ? allNameQuery.trim() : "All",
    };

    try {
      setPdfDownloading(true);
      const rows = expandedAllAttendance.map((item, index) => {
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
        const hideTimings = isAbsentAttendance(item);

        return {
          "#": index + 1,
          Name: resolveAttendanceUserLabel(item),
          Phone: String(item?.phone_number || "-"),
          Date: String(formatDate(item?.date || item?.created_at) || "-"),
          "Check In": String(hideTimings ? "-" : formatTimeValue(actualCheckIn, baseDate) || "-"),
          "Check Out": String(hideTimings ? "-" : formatTimeValue(actualCheckOut, baseDate) || "-"),
          Location: String(item?.location || "-"),
          Status: String(formatStatusLabel(status) || "-"),
        };
      });

      const filename = `Attendance-${safeFilenamePart(projectLabel)}-${safeFilenamePart(formattedFilters.date)}-${safeFilenamePart(formattedFilters.status)}-${safeFilenamePart(formattedFilters.attendanceType)}.xlsx`;
      const generatedAt = new Date().toLocaleString();
      const columns = ["#", "Name", "Phone", "Date", "Check In", "Check Out", "Location", "Status"];
      const headerRows = [
        ["Confidential attendance report"],
        [],
        [
          "Project",
          projectLabel,
          "Date",
          formattedFilters.date,
          "Status",
          formattedFilters.status,
          "Attendance Type",
          formattedFilters.attendanceType,
        ],
        ["Name", formattedFilters.name, "Generated", generatedAt],
        [],
        columns,
      ];

      const dataRows = rows.map((row) => columns.map((col) => row[col]));
      const sheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);

      sheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
      ];
      sheet["!cols"] = [
        { wch: 6 },  // #
        { wch: 22 }, // Name
        { wch: 16 }, // Phone
        { wch: 14 }, // Date
        { wch: 12 }, // Check In
        { wch: 12 }, // Check Out
        { wch: 32 }, // Location
        { wch: 12 }, // Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
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

  const downloadGlobalAttendanceExcel = async () => {
    if (globalPdfDownloading) return;
    const safeFilenamePart = (value) =>
      String(value || "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 60) || "NA";

    const resolveGlobalUserLabel = () => {
      const selected = String(globalUserKey || "__all__");
      if (!selected || selected === "__all__") return "All";
      const match = usersIndex.byKey.get(selected);
      return String(match?.name || match?.username || match?.email || match?.phone_number || selected);
    };

    const resolveGlobalDateLabel = () => {
      if (globalDatePreset === "all") return "All";
      if (globalDatePreset === "today") return new Date().toISOString().slice(0, 10);
      if (globalDatePreset === "yesterday") {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
      }
      if (globalDatePreset === "last_week") return "Last-7-Days";
      if (globalDatePreset === "last_month") return "Last-Month";
      if (globalDatePreset === "month") return globalMonthValue ? String(globalMonthValue) : "Month";
      if (globalDatePreset === "custom") {
        if (globalFromDate && globalToDate) return `${globalFromDate}_to_${globalToDate}`;
        return "Custom";
      }
      return String(globalDatePreset || "All");
    };

    const viewLabelMap = {
      all: "Attendance",
      checked: "Checked-In",
      checkout: "Checked-Out",
      not_checked: "Not-Checked-In",
      users: "Users",
      leave: "Leave",
      today: "Attendance",
    };

    const resolvedViewLabel = viewLabelMap[String(globalView || "all")] || "Attendance";
    const dateLabel = resolveGlobalDateLabel();
    const userLabel = resolveGlobalUserLabel();

    try {
      setGlobalPdfDownloading(true);
      const today = new Date().toISOString().slice(0, 10);

      const generatedAt = new Date().toLocaleString();

      if (String(globalView) === "users") {
        if (!Array.isArray(filteredUsers) || filteredUsers.length === 0) {
          toast({
            title: "No users found",
            description: "Users are still loading or none are available.",
            variant: "destructive",
          });
          return;
        }

        const rows = filteredUsers.map((u, index) => ({
          "#": index + 1,
          Name: String(u?.name || u?.username || "-"),
          Phone: String(u?.phone_number || "-"),
          Role: String(u?.role || "-"),
          Email: String(u?.email || "-"),
        }));

        const columns = ["#", "Name", "Phone", "Role", "Email"];
        const headerRows = [
          ["Global Users (Attendance)"],
          [],
          ["Generated", generatedAt],
          ["Total", rows.length],
          [],
          columns,
        ];

        const dataRows = rows.map((row) => columns.map((col) => row[col]));
        const sheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
        sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
        sheet["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 26 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Users");
        XLSX.writeFile(workbook, `global-users-${today}.xlsx`);
        return;
      }

      if (String(globalView) === "not_checked") {
        if (!Array.isArray(notCheckedUsersToday) || notCheckedUsersToday.length === 0) {
          toast({
            title: "No users found",
            description: "Everyone is checked in or users are still loading.",
            variant: "destructive",
          });
          return;
        }

        const rows = notCheckedUsersToday.map((u, index) => ({
          "#": index + 1,
          Name: String(u?.name || u?.username || "-"),
          Phone: String(u?.phone_number || "-"),
          Role: String(u?.role || "-"),
          Email: String(u?.email || "-"),
          "Leave Granted": leaveGrantedKeys.has(getUserKeyFromUser(u)) ? "Yes" : "No",
        }));

        const columns = ["#", "Name", "Phone", "Role", "Email", "Leave Granted"];
        const headerRows = [
          [`Not Checked In (${notCheckedTargetDateLabel})`],
          [],
          ["Date", notCheckedTargetDateLabel, "Generated", generatedAt],
          ["Total", rows.length],
          [],
          columns,
        ];

        const dataRows = rows.map((row) => columns.map((col) => row[col]));
        const sheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
        sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
        sheet["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 26 }, { wch: 14 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Not Checked In");
        XLSX.writeFile(workbook, `not-checked-in-${notCheckedTargetDateKey}.xlsx`);
        return;
      }

      const rowsSource = Array.isArray(globalAttendanceItems) ? globalAttendanceItems : [];
      if (rowsSource.length === 0) {
        toast({
          title: "No attendance records",
          description: "No records match the selected filters.",
          variant: "destructive",
        });
        return;
      }

      const rows = rowsSource.map((item, index) => {
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
        const hideTimings = isAbsentAttendance(item);

        return {
          "#": index + 1,
          Name: resolveAttendanceUserLabel(item),
          Phone: String(item?.phone_number || "-"),
          Date: String(formatDate(item?.date || item?.created_at) || "-"),
          "Check In": String(hideTimings ? "-" : formatTimeValue(actualCheckIn, baseDate) || "-"),
          "Check Out": String(hideTimings ? "-" : formatTimeValue(actualCheckOut, baseDate) || "-"),
          Location: String(item?.location || "-"),
          Status: String(formatStatusLabel(status) || "-"),
        };
      });

      const columns = ["#", "Name", "Phone", "Date", "Check In", "Check Out", "Location", "Status"];
      const headerRows = [
        [`Global Attendance (${resolvedViewLabel})`],
        [],
        ["Date", dateLabel, "User", userLabel],
        ["Generated", generatedAt],
        ["Total", rows.length],
        [],
        columns,
      ];

      const dataRows = rows.map((row) => columns.map((col) => row[col]));
      const sheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
      sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
      sheet["!cols"] = [
        { wch: 6 }, // #
        { wch: 22 }, // Name
        { wch: 16 }, // Phone
        { wch: 14 }, // Date
        { wch: 12 }, // Check In
        { wch: 12 }, // Check Out
        { wch: 32 }, // Location
        { wch: 12 }, // Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
      const filename = `global-attendance-${safeFilenamePart(resolvedViewLabel)}-${safeFilenamePart(dateLabel)}-${safeFilenamePart(userLabel)}-${today}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (e) {
      toast({
        title: "Excel export failed",
        description: e?.message || "Could not generate Excel.",
        variant: "destructive",
      });
    } finally {
      setGlobalPdfDownloading(false);
    }
  };

  const getDayLabel = (dateValue) => {
    if (!dateValue) return "";
    const date = parseAttendanceDate(dateValue);
    if (!date) return "";
    try {
      return date.toLocaleDateString(undefined, { weekday: "long" });
    } catch {
      return "";
    }
  };

  const extractUploadedPath = (payload) => {
    const candidate =
      payload?.filePath ||
      payload?.file_path ||
      payload?.path ||
      payload?.url ||
      payload?.file ||
      payload?.data?.filePath ||
      payload?.data?.file_path ||
      payload?.data?.path ||
      payload?.data?.url ||
      payload?.data?.file;
    if (Array.isArray(candidate)) return candidate[0] || "";
    if (candidate == null) return "";
    return String(candidate);
  };

  const uploadAttendancePhoto = async (file, kind) => {
    if (!file) return;
    if (kind === "selfie") setUploadingSelfie(true);
    if (kind === "site") setUploadingSite(true);
    try {
      const result = await api.uploadAttendanceImage(file, {
        userId: user?.user_id || user?.id,
        userName: createForm.user_name || user?.name,
      });
      if (!result.success) {
        toast({
          title: "Upload failed",
          description: result.error || "Could not upload image.",
          variant: "destructive",
        });
        return;
      }
      const path = extractUploadedPath(result.data);
      if (!path) {
        toast({
          title: "Upload failed",
          description: "Server did not return uploaded file path.",
          variant: "destructive",
        });
        return;
      }
      const key = kind === "selfie" ? "photo_selfie" : "photo_site";
      setCreateForm((prev) => ({ ...prev, [key]: path }));
      toast({ title: "Uploaded", description: "Photo uploaded successfully." });
    } finally {
      if (kind === "selfie") setUploadingSelfie(false);
      if (kind === "site") setUploadingSite(false);
    }
  };

  const uploadAttendanceCheckoutPhoto = async (file, kind) => {
    if (!file) return;
    const savingKind = kind === "selfie" ? "selfie" : "site";
    if (savingKind === "selfie") setUploadingSelfie(true);
    if (savingKind === "site") setUploadingSite(true);
    try {
      const result = await api.uploadAttendanceImage(file, {
        userId: user?.user_id || user?.id,
        userName: createForm.user_name || user?.name,
      });
      if (!result.success) {
        toast({
          title: "Upload failed",
          description: result.error || "Could not upload image.",
          variant: "destructive",
        });
        return;
      }
      const path = extractUploadedPath(result.data);
      if (!path) {
        toast({
          title: "Upload failed",
          description: "Server did not return uploaded file path.",
          variant: "destructive",
        });
        return;
      }
      const key = kind === "selfie" ? "check_out_photo_selfie" : "check_out_photo_site";
      setCreateForm((prev) => ({ ...prev, [key]: path }));
      toast({ title: "Uploaded", description: "Photo uploaded successfully." });
    } finally {
      if (savingKind === "selfie") setUploadingSelfie(false);
      if (savingKind === "site") setUploadingSite(false);
    }
  };

  const myTodayAttendance = useMemo(() => {
    const myId = String(user?.user_id || user?.id || "").trim();
    if (!myId) return null;
    const today = new Date().toISOString().slice(0, 10);
    const pool = Array.isArray(attendance) ? attendance : [];
    // Prefer latest record for today.
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      const row = pool[i];
      const rowUserId = String(row?.user_id || row?.userId || "").trim();
      if (!rowUserId || rowUserId !== myId) continue;
      const dateValue = row?.date || row?.created_at || row?.updated_at;
      if (isSameYmd(dateValue, today)) return row;
    }
    return null;
  }, [attendance, user?.user_id, user?.id]);

  const myTodayAttendanceByProject = useMemo(() => {
    const myId = String(user?.user_id || user?.id || "").trim();
    if (!myId) return {};
    const today = new Date().toISOString().slice(0, 10);
    const pool = Array.isArray(attendance) ? attendance : [];
    const map = {};
    // Prefer latest record per project for today.
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      const row = pool[i];
      const rowUserId = String(row?.user_id || row?.userId || "").trim();
      if (!rowUserId || rowUserId !== myId) continue;
      const pid = resolveAttendanceProjectId(row);
      if (!pid) continue;
      const dateValue = row?.date || row?.created_at || row?.updated_at;
      if (!isSameYmd(dateValue, today)) continue;
      if (!map[pid]) map[pid] = row;
    }
    return map;
  }, [attendance, user?.user_id, user?.id]);

  const myTodayMobileAttendance = useMemo(() => {
    const pid = String(mobileForm.project_id || "").trim();
    if (!pid) return null;
    return myTodayAttendanceByProject?.[pid] || null;
  }, [mobileForm.project_id, myTodayAttendanceByProject]);

  const myTodayMobileHasCheckout = useMemo(() => {
    if (!myTodayMobileAttendance) return false;
    return Boolean(resolveValue(myTodayMobileAttendance, ["check_out_time", "checkout_time", "check_out_at", "checkout_at"]));
  }, [myTodayMobileAttendance]);

  const openMobileMark = () => {
    const defaultProjectId =
      String(selectedProject?.id || selectedProject?.project_id || "").trim() ||
      (() => {
        try {
          return String(localStorage.getItem("selected_project_id") || "").trim();
        } catch {
          return "";
        }
      })();

    const existingForProject = defaultProjectId ? myTodayAttendanceByProject?.[defaultProjectId] || null : null;
    const hasCheckoutForProject = Boolean(
      resolveValue(existingForProject, ["check_out_time", "checkout_time", "check_out_at", "checkout_at"])
    );

    if (existingForProject && hasCheckoutForProject) {
      toast({
        title: "Already marked",
        description: "You have already checked in and checked out for this project today.",
        variant: "destructive",
      });
      return;
    }

    const mode = existingForProject && !hasCheckoutForProject ? "checkout" : "checkin";
    setMobileMode(mode);

    setMobileForm((prev) => ({
      ...prev,
      project_id: defaultProjectId || prev.project_id,
      // reset media/location fields each time
      photo_selfie: "",
      photo_site: "",
      location: "",
      latitude: "",
      longitude: "",
      check_out_time: "",
      check_out_location: "",
      check_out_latitude: "",
      check_out_longitude: "",
      check_out_photo_selfie: "",
      check_out_photo_site: "",
    }));

    setMobileMarkOpen(true);
  };

  const resolveProjectForMobile = (projectIdValue) => {
    const pid = String(projectIdValue || "").trim();
    if (!pid) return null;
    const pool = Array.isArray(projects) ? projects : [];
    return pool.find((p) => String(p?.id ?? p?.project_id ?? "").trim() === pid) || null;
  };

  const resolveProjectGeoFence = (projectRow) => {
    if (!projectRow) return null;
    const map = projectRow?.map_location || projectRow?.location_data || null;
    const lat = toFiniteNumber(map?.lat ?? map?.latitude ?? projectRow?.location_latitude);
    const lng = toFiniteNumber(map?.lng ?? map?.longitude ?? projectRow?.location_longitude);
    const radius = toFiniteNumber(map?.radius ?? projectRow?.location_radius) ?? 300;
    if (lat == null || lng == null) return null;
    return { lat, lng, radius };
  };

  const captureBrowserLocation = async ({ mode }) => {
    if (!navigator?.geolocation) {
      toast({ title: "Location unavailable", description: "Geolocation is not supported on this device.", variant: "destructive" });
      return null;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos?.coords?.latitude;
          const lng = pos?.coords?.longitude;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            toast({ title: "Location failed", description: "Could not read GPS coordinates.", variant: "destructive" });
            resolve(null);
            return;
          }
          const locationText = `${lat}, ${lng}`;
          setMobileForm((prev) =>
            mode === "checkout"
              ? {
                  ...prev,
                  check_out_latitude: String(lat),
                  check_out_longitude: String(lng),
                  check_out_location: prev.check_out_location || locationText,
                }
              : {
                  ...prev,
                  latitude: String(lat),
                  longitude: String(lng),
                  location: prev.location || locationText,
                }
          );
          resolve({ lat, lng });
        },
        () => {
          toast({ title: "Location denied", description: "Please allow location permission to mark attendance.", variant: "destructive" });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const uploadMobileAttendanceImage = async (file, kind) => {
    if (!file) return;
    const isCheckOut = mobileMode === "checkout";
    if (kind === "selfie") setMobileUploadingSelfie(true);
    if (kind === "site") setMobileUploadingSite(true);
    try {
      const result = await api.uploadAttendanceImage(file, {
        userId: user?.user_id || user?.id,
        userName: user?.name,
      });
      if (!result.success) {
        toast({ title: "Upload failed", description: result.error || "Could not upload image.", variant: "destructive" });
        return;
      }
      const path = extractUploadedPath(result.data);
      if (!path) {
        toast({ title: "Upload failed", description: "Server did not return uploaded file path.", variant: "destructive" });
        return;
      }
      setMobileForm((prev) => {
        if (!isCheckOut) {
          return { ...prev, [kind === "selfie" ? "photo_selfie" : "photo_site"]: path };
        }
        return { ...prev, [kind === "selfie" ? "check_out_photo_selfie" : "check_out_photo_site"]: path };
      });
    } finally {
      if (kind === "selfie") setMobileUploadingSelfie(false);
      if (kind === "site") setMobileUploadingSite(false);
    }
  };

  const submitMobileAttendance = async () => {
    if (mobileSubmitting) return;
    const myId = String(user?.user_id || user?.id || "").trim();
    if (!myId) {
      toast({ title: "User missing", description: "Could not resolve your user id.", variant: "destructive" });
      return;
    }
    const pid = String(mobileForm.project_id || "").trim();
    if (!pid) {
      toast({ title: "Project required", description: "Select a project to mark attendance.", variant: "destructive" });
      return;
    }

    const existingForProject = myTodayAttendanceByProject?.[pid] || null;
    const hasCheckoutForProject = Boolean(
      resolveValue(existingForProject, ["check_out_time", "checkout_time", "check_out_at", "checkout_at"])
    );

    const projectRow = resolveProjectForMobile(pid) || selectedProject || null;
    const geo = resolveProjectGeoFence(projectRow);
    if (!geo) {
      toast({
        title: "Project location missing",
        description: "This project does not have a location set. Please ask admin to set project location.",
        variant: "destructive",
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setMobileSubmitting(true);
    try {
      if (mobileMode === "checkin") {
        if (existingForProject) {
          toast({
            title: "Already checked in",
            description: hasCheckoutForProject
              ? "You have already checked in and checked out for this project today."
              : "You have already checked in for this project today. Please use Check Out.",
            variant: "destructive",
          });
          if (!hasCheckoutForProject) setMobileMode("checkout");
          return;
        }
        if (!mobileForm.photo_selfie || !mobileForm.photo_site) {
          toast({ title: "Photos required", description: "Upload selfie and site photo to check in.", variant: "destructive" });
          return;
        }
        const lat = toFiniteNumber(mobileForm.latitude);
        const lng = toFiniteNumber(mobileForm.longitude);
        if (lat == null || lng == null) {
          toast({ title: "Location required", description: "Tap Use GPS to capture your location.", variant: "destructive" });
          return;
        }
        const dist = haversineDistanceMeters(lat, lng, geo.lat, geo.lng);
        if (dist > geo.radius) {
          toast({
            title: "Outside site radius",
            description: `You are ~${Math.round(dist)}m away. Allowed radius is ${Math.round(geo.radius)}m.`,
            variant: "destructive",
          });
          return;
        }
        const payload = {
          project_id: Number(pid),
          user_id: myId,
          user_name: user?.name || user?.username || undefined,
          phone_number: user?.phone_number || undefined,
          date: today,
          day: getDayLabel(today) || undefined,
          status: "pending",
          photo_selfie: mobileForm.photo_selfie,
          photo_site: mobileForm.photo_site,
          location: mobileForm.location || undefined,
          latitude: String(lat),
          longitude: String(lng),
        };
        const result = await api.createAttendance(payload);
        if (!result.success) {
          toast({ title: "Check-in failed", description: result.error || "Could not mark attendance.", variant: "destructive" });
          return;
        }
        if (result?.data) {
          setAttendance((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            next.push(result.data);
            return next;
          });
        }
        toast({ title: "Checked in", description: "Attendance submitted." });
      } else {
        const existing = existingForProject || myTodayAttendance;
        const attendanceId = resolveAttendanceId(existing);
        if (!attendanceId) {
          toast({ title: "Check-out failed", description: "Unable to find today’s check-in. Please check in again.", variant: "destructive" });
          return;
        }
        if (!mobileForm.check_out_photo_selfie || !mobileForm.check_out_photo_site) {
          toast({ title: "Photos required", description: "Upload check-out selfie and site photo.", variant: "destructive" });
          return;
        }
        const lat = toFiniteNumber(mobileForm.check_out_latitude);
        const lng = toFiniteNumber(mobileForm.check_out_longitude);
        if (lat == null || lng == null) {
          toast({ title: "Location required", description: "Tap Use GPS to capture your location.", variant: "destructive" });
          return;
        }
        const dist = haversineDistanceMeters(lat, lng, geo.lat, geo.lng);
        if (dist > geo.radius) {
          toast({
            title: "Outside site radius",
            description: `You are ~${Math.round(dist)}m away. Allowed radius is ${Math.round(geo.radius)}m.`,
            variant: "destructive",
          });
          return;
        }
        const payload = {
          user_id: myId,
          photo_selfie: mobileForm.check_out_photo_selfie,
          photo_site: mobileForm.check_out_photo_site,
          location: mobileForm.check_out_location || undefined,
          latitude: String(lat),
          longitude: String(lng),
        };
        const result = await api.checkoutAttendance(attendanceId, payload);
        if (!result.success) {
          toast({ title: "Check-out failed", description: result.error || "Could not check out.", variant: "destructive" });
          return;
        }
        // Optimistically update local list to reflect checkout instantly.
        if (result?.data) {
          setAttendance((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            const idx = next.findIndex((row) => resolveAttendanceId(row) === attendanceId);
            if (idx >= 0) next[idx] = { ...next[idx], ...result.data };
            return next;
          });
        }
        toast({ title: "Checked out", description: "Check-out saved." });
      }

      setMobileMarkOpen(false);
      fetchAttendance({ silent: true });
    } finally {
      setMobileSubmitting(false);
    }
  };

  const handleCreateAttendance = async () => {
    const numericProjectId = Number(createForm.project_id || effectiveProjectFilter || 0) || 0;
    const toNumberOrUndefined = (value) => {
      if (value == null || value === "") return undefined;
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    };
    const normalizeDateTime = (value) => {
      if (!value) return undefined;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
      return String(value);
    };
    const payload = {
      project_id: numericProjectId || undefined,
      user_name: createForm.user_name || undefined,
      phone_number: createForm.phone_number || undefined,
      date: createForm.date || undefined,
      day: getDayLabel(createForm.date) || undefined,
      status: createForm.status || "pending",
      remark: createForm.remark || undefined,
      user_id: user?.user_id || user?.id || undefined,
      photo_selfie: createForm.photo_selfie || undefined,
      photo_site: createForm.photo_site || undefined,
      location: createForm.location || undefined,
      latitude: toNumberOrUndefined(createForm.latitude),
      longitude: toNumberOrUndefined(createForm.longitude),
      check_out_time: normalizeDateTime(createForm.check_out_time),
      check_out_photo_selfie: createForm.check_out_photo_selfie || undefined,
      check_out_photo_site: createForm.check_out_photo_site || undefined,
      check_out_location: createForm.check_out_location || undefined,
      check_out_latitude: toNumberOrUndefined(createForm.check_out_latitude),
      check_out_longitude: toNumberOrUndefined(createForm.check_out_longitude),
    };

    if (!payload.project_id) {
      toast({ title: "Project required", description: "Select a project.", variant: "destructive" });
      return;
    }
    if (!payload.date) {
      toast({ title: "Date required", description: "Select a date.", variant: "destructive" });
      return;
    }
    if (!payload.user_name) {
      toast({ title: "Name required", description: "Enter user name.", variant: "destructive" });
      return;
    }

    setCreateSaving(true);
    try {
      const result = await api.createAttendance(payload);
      if (!result.success) {
        toast({
          title: "Create failed",
          description: result.error || "Could not create attendance record.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Saved", description: "Attendance record created." });
      setCreateOpen(false);
      setCreateForm((prev) => ({
        ...prev,
        location: "",
        latitude: "",
        longitude: "",
        remark: "",
        photo_selfie: "",
        photo_site: "",
        check_out_time: "",
        check_out_location: "",
        check_out_latitude: "",
        check_out_longitude: "",
        check_out_photo_selfie: "",
        check_out_photo_site: "",
      }));
      fetchAttendance({ silent: true });
    } finally {
      setCreateSaving(false);
    }
  };

  const renderAllAttendanceRow = (item) => {
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
    const hideTimings = isAbsentAttendance(item);
    const attendanceId = resolveAttendanceId(item);

    return (
      <TableRow
        key={`${attendanceId || `${item.user_name}-${item.date}`}-${item.__sourceIndex ?? 0}-${item.__rowIndex ?? 0}`}
        className="cursor-pointer hover:bg-muted/40"
        role="button"
        tabIndex={0}
        onClick={() => openPreview(item)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") openPreview(item);
        }}
      >
        <TableCell className="font-medium">{resolveAttendanceUserLabel(item)}</TableCell>
        <TableCell>{formatDate(item.date || item.created_at)}</TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">{hideTimings ? "-" : formatTimeValue(actualCheckIn, baseDate)}</div>
            {!hideTimings && checkInRemark ? (
              <Badge variant={checkInRemark.variant} className="w-fit">
                {checkInRemark.text}
              </Badge>
            ) : hideTimings ? null : (
              <span className="text-xs text-muted-foreground">No remark</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">{hideTimings ? "-" : formatTimeValue(actualCheckOut, baseDate)}</div>
            {!hideTimings && checkOutRemark ? (
              <Badge variant={checkOutRemark.variant} className="w-fit">
                {checkOutRemark.text}
              </Badge>
            ) : hideTimings ? null : (
              <span className="text-xs text-muted-foreground">No remark</span>
            )}
          </div>
        </TableCell>
        <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
          {item.location || "-"}
        </TableCell>
        <TableCell>
          <Badge variant={statusBadgeVariant(status)} className={statusBadgeClassName(status)}>
            {formatStatusLabel(status)}
          </Badge>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-emerald-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review attendance submissions with selfie and site photos.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
            {!projectId ? (
              <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
                <Button
                  variant="outline"
                  onClick={downloadGlobalAttendanceExcel}
                  disabled={globalPdfDownloading}
                  className="w-full lg:w-auto"
                >
                  {globalPdfDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" /> Export Excel
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadGlobalAttendancePdf}
                  disabled={globalPdfDownloading}
                  className="w-full lg:w-auto"
                >
                  {globalPdfDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" /> Export PDF
                    </>
                  )}
                </Button>
              </div>
            ) : null}
            <Button
              variant="outline"
              onClick={() => fetchAttendance({ silent: true })}
              disabled={refreshing}
              className="w-full lg:w-auto"
            >
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

      {projectId ? (
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (value === "today") {
                next.delete("tab");
              } else {
                next.set("tab", value);
              }
              return next;
            },
            { replace: true }
          );
          if (value === "users" && !usersLoaded && !usersLoading) {
            fetchUsers();
          }
        }}
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="today">Today's Attendance</TabsTrigger>
          <TabsTrigger value="all">Attendance</TabsTrigger>
          <TabsTrigger value="users">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg">Today's Attendance</CardTitle>
            <CardDescription>Review today&apos;s attendance and mark present, Half Day, or absent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="md:w-44">
                  <Select value={todayStatusFilter} onValueChange={setTodayStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Status</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative md:flex-1 md:max-w-xl">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="pl-3"
                    placeholder="Search by name, phone, date, or location..."
                  />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTodayAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                        No attendance records found for today.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTodayAttendance.map((item) => {
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
                      const hideTimings = isAbsentAttendance(item);
                      const attendanceId = resolveAttendanceId(item);
                      const saving = attendanceId ? !!statusSaving[attendanceId] : false;
                      return (
                        <TableRow
                          key={`${attendanceId || `${item.user_name}-${item.date}`}-${item.__sourceIndex ?? 0}-${item.__rowIndex ?? 0}`}
                          className="cursor-pointer hover:bg-muted/40"
                          role="button"
                          tabIndex={0}
                          onClick={() => openPreview(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") openPreview(item);
                          }}
                        >
                          <TableCell className="font-medium">{resolveAttendanceUserLabel(item)}</TableCell>
                          <TableCell>{formatDate(item.date || item.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-medium">
                                {hideTimings ? "-" : formatTimeValue(actualCheckIn, baseDate)}
                              </div>
                              {!hideTimings && checkInRemark ? (
                                <Badge variant={checkInRemark.variant} className="w-fit">
                                  {checkInRemark.text}
                                </Badge>
                              ) : hideTimings ? null : (
                                <span className="text-xs text-muted-foreground">No remark</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-medium">
                                {hideTimings ? "-" : formatTimeValue(actualCheckOut, baseDate)}
                              </div>
                              {!hideTimings && checkOutRemark ? (
                                <Badge variant={checkOutRemark.variant} className="w-fit">
                                  {checkOutRemark.text}
                                </Badge>
                              ) : hideTimings ? null : (
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
                          <TableCell>
                            <div className="flex flex-nowrap gap-2 overflow-x-auto">
                              <Button
                                size="sm"
                                variant={status?.toString().toLowerCase() === "present" ? "secondary" : "outline"}
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleStatusChange(item, "present");
                                }}
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                  </>
                                ) : (
                                  "Present"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={status?.toString().toLowerCase() === "half_day" ? "secondary" : "outline"}
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleStatusChange(item, "half_day");
                                }}
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                  </>
                                ) : (
                                  "Half Day"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={status?.toString().toLowerCase() === "absent" ? "destructive" : "outline"}
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleStatusChange(item, "absent");
                                }}
                              >
                                Absent
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg">Attendance</CardTitle>
              <CardDescription>Filter attendance by date range, status, attendance type, and project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                <div className="md:w-44 lg:w-52">
                  <Input
                    value={allNameQuery}
                    onChange={(event) => setAllNameQuery(event.target.value)}
                    className="pl-3"
                    placeholder="Filter by name..."
                  />
                </div>
                <div className="md:w-44">
                  <CalendarDatePicker
                    value={filtersDraft.date}
                    placeholder="Date"
                    onChange={(date) => setFiltersDraft((prev) => ({ ...prev, date }))}
                  />
                </div>
                <div className="md:w-40">
                  <Select
                    value={filtersDraft.status || "__all__"}
                    onValueChange={(value) =>
                      setFiltersDraft((prev) => ({ ...prev, status: value === "__all__" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Status</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:w-48">
                  <Select
                    value={filtersDraft.attendance_type || "__all__"}
                    onValueChange={(value) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        attendance_type: value === "__all__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Attendance Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Types</SelectItem>
                      <SelectItem value="checked_in">Checked In</SelectItem>
                      <SelectItem value="checked_out">Checked Out</SelectItem>
                      <SelectItem value="not_checked_in">Not Checked In</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!projectId ? (
                  <div className="md:w-56">
                    <Select
                      value={filtersDraft.project_id || "__all__"}
                      onValueChange={(value) =>
                        setFiltersDraft((prev) => ({ ...prev, project_id: value === "__all__" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Projects</SelectItem>
                        {projects.map((project) => {
                          const id = String(project.id || project.project_id);
                          const label =
                            project.name || project.project_name || `Project ${project.id || project.project_id}`;
                          return (
                            <SelectItem key={id} value={id}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="flex gap-2 md:ml-auto">
                  <Button
                    variant="outline"
                    onClick={() => setFiltersApplied({ ...filtersDraft })}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadAttendanceReportExcel}
                    disabled={loading || pdfDownloading || expandedAllAttendance.length === 0}
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
                    onClick={downloadAttendanceReportPdf}
                    disabled={loading || pdfDownloading || expandedAllAttendance.length === 0}
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAllNameQuery("");
                      setFiltersDraft({
                        date: "",
                        status: "",
                        attendance_type: "",
                        project_id: projectId
                          ? ""
                          : (selectedProject?.id || selectedProject?.project_id
                              ? String(selectedProject?.id || selectedProject?.project_id)
                              : ""),
                      });
                      setFiltersApplied({
                        date: "",
                        status: "",
                        attendance_type: "",
                        project_id: projectId
                          ? ""
                          : (selectedProject?.id || selectedProject?.project_id
                              ? String(selectedProject?.id || selectedProject?.project_id)
                              : ""),
                      });
                    }}
                    disabled={
                      !allNameQuery &&
                      !filtersDraft.date &&
                      !filtersDraft.status &&
                      !filtersDraft.attendance_type &&
                      !filtersDraft.project_id
                    }
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Saved Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : expandedAllAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                        No attendance records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    expandedAllAttendance.map(renderAllAttendanceRow)
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg">Staff</CardTitle>
              <CardDescription>All registered staff members.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  value={usersQuery}
                  onChange={(event) => setUsersQuery(event.target.value)}
                  className="pl-3"
                  placeholder="Search staff by name, role, email, or phone..."
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id || user._id || user.username || user.email}>
                        <TableCell className="font-medium">
                          <Button
                            variant="link"
                            className="h-auto p-0 text-left"
                            onClick={() => handleUserHistoryOpen(user)}
                          >
                            {user.name || user.username || "-"}
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.role || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.phone_number || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.email || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      ) : (
        <>
          {leaveBanner ? (
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <AlertTitle className="flex items-start justify-between gap-3">
                <span>{leaveBanner.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-mr-2 -mt-2 h-8 w-8"
                  onClick={() => setLeaveBanner(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertTitle>
              <AlertDescription>{leaveBanner.description}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {isMobileView ? (
              <Card
                className="border-0 shadow-sm ring-1 ring-border/50 bg-gradient-to-br from-violet-50 to-violet-100 transition hover:shadow-md cursor-pointer dark:from-violet-950/30 dark:to-violet-900/20 sm:col-span-2"
                role="button"
                tabIndex={0}
                onClick={openMobileMark}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") openMobileMark();
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-violet-900/90 dark:text-violet-200">
                    Mark Attendance
                  </CardTitle>
                  <CardDescription className="text-xs">Check-in / Check-out</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {myTodayAttendance ? "Tap to check out or view status." : "Tap to check in for today."}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card
              className={cn(
                "border-0 shadow-sm ring-1 ring-border/50 bg-gradient-to-br from-slate-50 to-slate-100 transition hover:shadow-md cursor-pointer dark:from-slate-950/30 dark:to-slate-900/10",
                globalView === "all" && "ring-2 ring-slate-500/60"
              )}
              role="button"
              tabIndex={0}
              onClick={() => {
                setGlobalView("all");
                setQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setGlobalView("all");
                  setQuery("");
                }
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-900/90 dark:text-slate-100">
                  Attendance
                </CardTitle>
                <CardDescription className="text-xs">Attendance records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-950 dark:text-slate-50">
                  {loading ? "—" : globalFilteredAttendance.length}
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border-0 shadow-sm ring-1 ring-border/50 bg-gradient-to-br from-emerald-50 to-emerald-100 transition hover:shadow-md cursor-pointer dark:from-emerald-950/40 dark:to-emerald-900/20",
                globalView === "checked" && "ring-2 ring-emerald-500/60"
              )}
              role="button"
              tabIndex={0}
              onClick={() => {
                setGlobalView("checked");
                setQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setGlobalView("checked");
                  setQuery("");
                }
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900/90 dark:text-emerald-200">
                  Checked
                </CardTitle>
                <CardDescription className="text-xs">Checked in today</CardDescription>
              </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-950 dark:text-emerald-100">
                  {loading ? "—" : checkedUsersTodayCount}
              </div>
            </CardContent>
          </Card>

            <Card
              className={cn(
                "border-0 shadow-sm ring-1 ring-border/50 bg-gradient-to-br from-blue-50 to-indigo-100 transition hover:shadow-md cursor-pointer dark:from-blue-950/30 dark:to-indigo-900/15",
                globalView === "checkout" && "ring-2 ring-blue-500/60"
              )}
              role="button"
              tabIndex={0}
              onClick={() => {
                setGlobalView("checkout");
                setQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setGlobalView("checkout");
                  setQuery("");
                }
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-900/90 dark:text-blue-200">
                  Checked Out
                </CardTitle>
                <CardDescription className="text-xs">Checked out today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-950 dark:text-blue-100">
                  {loading ? "—" : checkedOutTodayCount}
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border-0 shadow-sm ring-1 ring-border/50 bg-gradient-to-br from-rose-50 to-rose-100 transition hover:shadow-md cursor-pointer dark:from-rose-950/30 dark:to-rose-900/20",
                globalView === "not_checked" && "ring-2 ring-rose-500/60"
              )}
              role="button"
              tabIndex={0}
              onClick={() => {
                setGlobalView("not_checked");
                setQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setGlobalView("not_checked");
                  setQuery("");
                }
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-rose-900/90 dark:text-rose-200">
                  Not Checked
                </CardTitle>
                <CardDescription className="text-xs">
                  No check-in on {notCheckedTargetDateLabel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-rose-950 dark:text-rose-100">
                  {loading ? "—" : notCheckedTodayCount}
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border-0 shadow-sm ring-1 ring-border/50 bg-gradient-to-br from-sky-50 to-indigo-100 transition hover:shadow-md cursor-pointer dark:from-sky-950/25 dark:to-indigo-900/20",
                globalView === "users" && "ring-2 ring-sky-500/60"
              )}
              role="button"
              tabIndex={0}
              onClick={() => {
                setGlobalView("users");
                setUsersQuery("");
                setUsersViewFilter("all");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setGlobalView("users");
                  setUsersQuery("");
                  setUsersViewFilter("all");
                }
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-900/90 dark:text-slate-100">
                  Users
                </CardTitle>
                <CardDescription className="text-xs">
                  Registered staff
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-950 dark:text-slate-50">
                  {usersLoading && !usersLoaded ? "—" : filteredUsers.length}
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border-0 shadow-sm ring-1 ring-border/50 bg-gradient-to-br from-amber-50 to-orange-100 transition hover:shadow-md cursor-pointer dark:from-amber-950/25 dark:to-orange-900/20",
                globalView === "leave" && "ring-2 ring-amber-500/60"
              )}
              role="button"
              tabIndex={0}
              onClick={() => setGlobalView("leave")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setGlobalView("leave");
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-900/90 dark:text-amber-200">
                  Leave
                </CardTitle>
                <CardDescription className="text-xs">Leave granted today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-950 dark:text-amber-100">
                  {leaveGrantSaving ? "—" : leaveTodayCount}
                </div>
              </CardContent>
            </Card>
          </div>

          {globalView === "users" ? (
            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg">Users</CardTitle>
                <CardDescription>Registered staff and attendance profiles.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                  <div className="relative md:flex-1">
                    <Input
                      value={usersQuery}
                      onChange={(event) => setUsersQuery(event.target.value)}
                      className="pl-3"
                      placeholder="Search staff by name, role, email, or phone..."
                    />
                  </div>
                  <div className="flex gap-2 md:ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setUsersQuery("")}
                      disabled={!usersQuery}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>History</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id || user._id || user.username || user.email}>
                          <TableCell className="font-medium">
                            <Button
                              variant="link"
                              className="h-auto p-0 text-left"
                              onClick={() => handleUserHistoryOpen(user)}
                            >
                              {user.name || user.username || "-"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.role || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.phone_number || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.email || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUserHistoryOpen(user)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : globalView === "leave" ? (
            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg">Leave</CardTitle>
                <CardDescription>Users granted leave (this session).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveUsersToday.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                          No leave granted users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaveUsersToday.map((u) => (
                        <TableRow key={getUserKeyFromUser(u) || u.id || u._id || u.email || u.username}>
                          <TableCell className="font-medium">{u.name || u.username || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{u.role || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{u.phone_number || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{u.email || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="default">Leave</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg">{globalAttendanceTitle}</CardTitle>
                <CardDescription>{globalAttendanceDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                  <div className="md:w-44">
                    <Select value={globalDatePreset} onValueChange={setGlobalDatePreset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Date filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All attendance</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="last_week">Last week</SelectItem>
                        <SelectItem value="last_month">Last month</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="custom">Custom range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {globalDatePreset === "month" ? (
                    <div className="md:w-44">
                      <Select value={globalMonthValue || "__current__"} onValueChange={(val) => setGlobalMonthValue(val === "__current__" ? "" : val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__current__">Select month</SelectItem>
                          {globalMonthOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {globalDatePreset === "custom" ? (
                    <>
                      <div className="md:w-44">
                        <CalendarDatePicker
                          value={globalFromDate}
                          placeholder="From"
                          onChange={(date) => setGlobalFromDate(date)}
                        />
                      </div>
                      <div className="md:w-44">
                        <CalendarDatePicker
                          value={globalToDate}
                          placeholder="To"
                          onChange={(date) => setGlobalToDate(date)}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="md:w-56">
                    <Select value={globalUserKey} onValueChange={setGlobalUserKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="User" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All users</SelectItem>
                        {globalUserOptions.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:w-44">
                    <Select value={globalStatusFilter} onValueChange={setGlobalStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Status</SelectItem>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="half_day">Half Day</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="relative md:flex-1">
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="pl-3"
                      placeholder="Search by name, phone, date, or location..."
                    />
                  </div>

                  <div className="flex gap-2 md:ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setGlobalDatePreset("all");
                        setGlobalMonthValue("");
                        setGlobalFromDate("");
                        setGlobalToDate("");
                        setGlobalUserKey("__all__");
                        setGlobalStatusFilter("__all__");
                        setQuery("");
                      }}
                      disabled={
                        globalDatePreset === "all" &&
                        !globalMonthValue &&
                        !globalFromDate &&
                        !globalToDate &&
                        globalUserKey === "__all__" &&
                        globalStatusFilter === "__all__" &&
                        !query
                      }
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      {globalView === "not_checked" ? null : (
                        <>
                          <TableHead>Check In</TableHead>
                          <TableHead>Check Out</TableHead>
                          <TableHead>Location</TableHead>
                        </>
                      )}
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={globalView === "not_checked" ? 4 : 7} className="h-24 text-center text-muted-foreground">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : globalView === "not_checked" ? (
                      notCheckedUsersToday.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                            No users found.
                          </TableCell>
                        </TableRow>
                    ) : (
                      notCheckedUsersToday.map((user) => {
                        const userKey = getUserKeyFromUser(user);
                        const isOnLeave = Boolean(userKey && leaveUserKeysToday.has(userKey));

                        return (
                          <TableRow key={getUserKeyFromUser(user) || user.id || user._id || user.email || user.username}>
                            <TableCell className="font-medium">{user.name || user.username || "-"}</TableCell>
                            <TableCell>{formatDate(notCheckedTargetDate)}</TableCell>
                            <TableCell>
                              {isOnLeave ? (
                                <Badge variant="default">On leave</Badge>
                              ) : (
                                <Badge variant="secondary">-</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-nowrap gap-2 overflow-x-auto">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    upsertAttendanceStatusForUser(user, {
                                      status: "present",
                                      bannerTitle: "Present marked",
                                      attendanceDate: notCheckedTargetDateKey,
                                    })
                                  }
                                  disabled={absentSavingKeys.has(userKey) || isOnLeave}
                                >
                                  {absentSavingKeys.has(userKey) ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                    </>
                                  ) : (
                                    "Present"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    upsertAttendanceStatusForUser(user, {
                                      status: "half_day",
                                      bannerTitle: "Half day marked",
                                      attendanceDate: notCheckedTargetDateKey,
                                    })
                                  }
                                  disabled={absentSavingKeys.has(userKey) || isOnLeave}
                                >
                                  {absentSavingKeys.has(userKey) ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                    </>
                                  ) : (
                                    "Half Day"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    upsertAttendanceStatusForUser(user, {
                                      status: "absent",
                                      bannerTitle: "Absent marked",
                                      attendanceDate: notCheckedTargetDateKey,
                                    })
                                  }
                                  disabled={absentSavingKeys.has(userKey) || isOnLeave}
                                >
                                  {absentSavingKeys.has(userKey) ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                    </>
                                  ) : (
                                    "Absent"
                                  )}
                                </Button>
                                {isAdmin ? (
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => openLeaveGrant(user, notCheckedTargetDateKey)}
                                    disabled={leaveGrantSaving || isOnLeave}
                                  >
                                    Leave
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )
                    ) : globalAttendanceItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                          No attendance records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      globalAttendanceItems.map((item) => {
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
                      const hideTimings = isAbsentAttendance(item);
                      const attendanceId = resolveAttendanceId(item);
                      const saving = attendanceId ? !!statusSaving[attendanceId] : false;
                      return (
                        <TableRow
                          key={`${attendanceId || `${item.user_name}-${item.date}`}-${item.__sourceIndex ?? 0}-${item.__rowIndex ?? 0}`}
                          className="cursor-pointer hover:bg-muted/40"
                          role="button"
                          tabIndex={0}
                          onClick={() => openPreview(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") openPreview(item);
                          }}
                        >
                          <TableCell className="font-medium">{resolveAttendanceUserLabel(item)}</TableCell>
                          <TableCell>{formatDate(item.date || item.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-medium">
                                {hideTimings ? "-" : formatTimeValue(actualCheckIn, baseDate)}
                              </div>
                              {!hideTimings && checkInRemark ? (
                                <Badge variant={checkInRemark.variant} className="w-fit">
                                  {checkInRemark.text}
                                </Badge>
                              ) : hideTimings ? null : (
                                <span className="text-xs text-muted-foreground">No remark</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-medium">
                                {hideTimings ? "-" : formatTimeValue(actualCheckOut, baseDate)}
                              </div>
                              {!hideTimings && checkOutRemark ? (
                                <Badge variant={checkOutRemark.variant} className="w-fit">
                                  {checkOutRemark.text}
                                </Badge>
                              ) : hideTimings ? null : (
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
                          <TableCell>
                            <div className="flex flex-nowrap gap-2 overflow-x-auto">
                              <Button
                                size="sm"
                                variant={status?.toString().toLowerCase() === "present" ? "secondary" : "outline"}
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleStatusChange(item, "present");
                                }}
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                  </>
                                ) : (
                                  "Present"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={status?.toString().toLowerCase() === "half_day" ? "secondary" : "outline"}
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleStatusChange(item, "half_day");
                                }}
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                  </>
                                ) : (
                                  "Half Day"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={status?.toString().toLowerCase() === "absent" ? "destructive" : "outline"}
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleStatusChange(item, "absent");
                                }}
                              >
                                Absent
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={mobileMarkOpen} onOpenChange={setMobileMarkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{mobileMode === "checkout" ? "Check Out" : "Check In"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mobileMode === "checkin" ? "default" : "outline"}
                onClick={() => {
                  setMobileMode("checkin");
                  setMobileForm((prev) => ({
                    ...prev,
                    photo_selfie: "",
                    photo_site: "",
                    location: "",
                    latitude: "",
                    longitude: "",
                  }));
                }}
                disabled={mobileSubmitting || Boolean(myTodayMobileAttendance)}
              >
                Check In
              </Button>
              <Button
                type="button"
                variant={mobileMode === "checkout" ? "default" : "outline"}
                onClick={() => {
                  setMobileMode("checkout");
                  setMobileForm((prev) => ({
                    ...prev,
                    check_out_time: "",
                    check_out_location: "",
                    check_out_latitude: "",
                    check_out_longitude: "",
                    check_out_photo_selfie: "",
                    check_out_photo_site: "",
                  }));
                }}
                disabled={mobileSubmitting || !myTodayMobileAttendance || myTodayMobileHasCheckout}
              >
                Check Out
              </Button>
            </div>

            {myTodayMobileAttendance && myTodayMobileHasCheckout ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                You have already checked in and checked out for this project today.
              </div>
            ) : null}

            {mobileMode === "checkout" && !myTodayMobileAttendance ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                No check-in found for today. Please check in first.
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium">Project</label>
              <div className="mt-1">
                <Select
                  value={mobileForm.project_id || "__none__"}
                  onValueChange={(value) =>
                    setMobileForm((prev) => ({ ...prev, project_id: value === "__none__" ? "" : value }))
                  }
                  disabled={mobileSubmitting || Boolean(myTodayMobileAttendance)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select project</SelectItem>
                    {(Array.isArray(projects) ? projects : []).map((p) => {
                      const id = String(p?.id || p?.project_id || "").trim();
                      if (!id) return null;
                      const label = p?.name || p?.project_name || `Project ${id}`;
                      return (
                        <SelectItem key={id} value={id}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Note: Attendance is allowed only within the project’s site radius (default 300m). Use GPS before submitting.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Location</label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={mobileMode === "checkout" ? mobileForm.check_out_location : mobileForm.location}
                    onChange={(event) => {
                      const value = event.target.value;
                      setMobileForm((prev) =>
                        mobileMode === "checkout"
                          ? { ...prev, check_out_location: value }
                          : { ...prev, location: value }
                      );
                    }}
                    placeholder="Auto-filled from GPS"
                    disabled={mobileSubmitting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => captureBrowserLocation({ mode: mobileMode })}
                    disabled={mobileSubmitting}
                  >
                    Use GPS
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Time</label>
                <div className="mt-1">
                  <Input
                    value={mobileMode === "checkout" ? mobileForm.check_out_time : ""}
                    onChange={(event) => setMobileForm((prev) => ({ ...prev, check_out_time: event.target.value }))}
                    placeholder={mobileMode === "checkout" ? "ISO time (optional)" : "Auto"}
                    disabled={mobileSubmitting || mobileMode !== "checkout"}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Selfie</div>
                  <label className="text-sm text-primary cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        uploadMobileAttendanceImage(file, "selfie");
                      }}
                      disabled={mobileSubmitting || mobileUploadingSelfie}
                    />
                    {mobileUploadingSelfie ? "Uploading..." : "Upload"}
                  </label>
                </div>
                {(mobileMode === "checkout" ? mobileForm.check_out_photo_selfie : mobileForm.photo_selfie) ? (
                  <img
                    src={resolvePhotoUrl(mobileMode === "checkout" ? mobileForm.check_out_photo_selfie : mobileForm.photo_selfie)}
                    alt="Selfie"
                    className="mt-2 h-28 w-full rounded object-cover"
                  />
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">No file selected.</div>
                )}
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Site Photo</div>
                  <label className="text-sm text-primary cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        uploadMobileAttendanceImage(file, "site");
                      }}
                      disabled={mobileSubmitting || mobileUploadingSite}
                    />
                    {mobileUploadingSite ? "Uploading..." : "Upload"}
                  </label>
                </div>
                {(mobileMode === "checkout" ? mobileForm.check_out_photo_site : mobileForm.photo_site) ? (
                  <img
                    src={resolvePhotoUrl(mobileMode === "checkout" ? mobileForm.check_out_photo_site : mobileForm.photo_site)}
                    alt="Site"
                    className="mt-2 h-28 w-full rounded object-cover"
                  />
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">No file selected.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMobileMarkOpen(false)} disabled={mobileSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitMobileAttendance}
                disabled={
                  mobileSubmitting ||
                  (mobileMode === "checkout" && (!myTodayMobileAttendance || myTodayMobileHasCheckout)) ||
                  (mobileMode === "checkin" && Boolean(myTodayMobileAttendance))
                }
              >
                {mobileSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  mobileMode === "checkout" ? "Check Out" : "Check In"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveGrantOpen} onOpenChange={setLeaveGrantOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Leave</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium">User</label>
              <div className="mt-1">
                <Input
                  value={leaveGrantForm.user_name}
                  onChange={(event) =>
                    setLeaveGrantForm((prev) => ({ ...prev, user_name: event.target.value }))
                  }
                  placeholder="User name"
                  disabled
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">From</label>
                <div className="mt-1">
                  <CalendarDatePicker
                    value={leaveGrantForm.from_date}
                    placeholder="From date"
                    onChange={(from_date) => setLeaveGrantForm((prev) => ({ ...prev, from_date }))}
                    disabled={leaveGrantSaving}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <div className="mt-1">
                  <CalendarDatePicker
                    value={leaveGrantForm.to_date}
                    placeholder="To date"
                    onChange={(to_date) => setLeaveGrantForm((prev) => ({ ...prev, to_date }))}
                    disabled={leaveGrantSaving}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Reason</label>
              <div className="mt-1">
                <Input
                  value={leaveGrantForm.reason}
                  onChange={(event) =>
                    setLeaveGrantForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                  placeholder="Reason for leave"
                  disabled={leaveGrantSaving}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setLeaveGrantOpen(false)} disabled={leaveGrantSaving}>
                Cancel
              </Button>
              <Button type="button" onClick={grantLeave} disabled={leaveGrantSaving}>
                {leaveGrantSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Granting...
                  </>
                ) : (
                  "Leave"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Attendance</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {!projectId ? (
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Project</label>
                <div className="mt-1">
                  <Select
                    value={createForm.project_id || "__none__"}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({ ...prev, project_id: value === "__none__" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" disabled>
                        Select project
                      </SelectItem>
                      {projects.map((project) => {
                        const id = String(project.id || project.project_id);
                        const label =
                          project.name || project.project_name || `Project ${project.id || project.project_id}`;
                        return (
                          <SelectItem key={id} value={id}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium">Date</label>
              <div className="mt-1">
                <CalendarDatePicker
                  value={createForm.date}
                  placeholder="Select date"
                  onChange={(date) => setCreateForm((prev) => ({ ...prev, date }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <div className="mt-1">
                <Select
                  value={createForm.status || "pending"}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">User Name</label>
              <Input
                value={createForm.user_name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, user_name: event.target.value }))}
                placeholder="Enter user name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                value={createForm.phone_number}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, phone_number: event.target.value }))}
                placeholder="Enter phone number"
              />
            </div>

            <div className="md:col-span-2 rounded-md border p-3">
              <div className="text-sm font-medium">Check-in</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    value={createForm.location}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, location: event.target.value }))}
                    placeholder="Enter check-in location"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Latitude</label>
                  <Input
                    value={createForm.latitude}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, latitude: event.target.value }))}
                    placeholder="e.g. 19.0760"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Longitude</label>
                  <Input
                    value={createForm.longitude}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, longitude: event.target.value }))}
                    placeholder="e.g. 72.8777"
                  />
                </div>
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Selfie Photo</div>
                    <label className="text-sm text-primary cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          uploadAttendancePhoto(file, "selfie");
                        }}
                        disabled={uploadingSelfie}
                      />
                      {uploadingSelfie ? "Uploading..." : "Upload"}
                    </label>
                  </div>
                  {createForm.photo_selfie ? (
                    <img
                      src={resolvePhotoUrl(createForm.photo_selfie)}
                      alt="Selfie"
                      className="mt-2 h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No file selected.</div>
                  )}
                </div>
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Site Photo</div>
                    <label className="text-sm text-primary cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          uploadAttendancePhoto(file, "site");
                        }}
                        disabled={uploadingSite}
                      />
                      {uploadingSite ? "Uploading..." : "Upload"}
                    </label>
                  </div>
                  {createForm.photo_site ? (
                    <img
                      src={resolvePhotoUrl(createForm.photo_site)}
                      alt="Site"
                      className="mt-2 h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No file selected.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-md border p-3">
              <div className="text-sm font-medium">Check-out (optional)</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Check-out Time</label>
                  <Input
                    type="datetime-local"
                    value={createForm.check_out_time}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, check_out_time: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    value={createForm.check_out_location}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, check_out_location: event.target.value }))}
                    placeholder="Enter check-out location"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Latitude</label>
                  <Input
                    value={createForm.check_out_latitude}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, check_out_latitude: event.target.value }))}
                    placeholder="e.g. 19.0760"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Longitude</label>
                  <Input
                    value={createForm.check_out_longitude}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, check_out_longitude: event.target.value }))}
                    placeholder="e.g. 72.8777"
                  />
                </div>
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Selfie Photo</div>
                    <label className="text-sm text-primary cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          uploadAttendanceCheckoutPhoto(file, "selfie");
                        }}
                        disabled={uploadingSelfie}
                      />
                      {uploadingSelfie ? "Uploading..." : "Upload"}
                    </label>
                  </div>
                  {createForm.check_out_photo_selfie ? (
                    <img
                      src={resolvePhotoUrl(createForm.check_out_photo_selfie)}
                      alt="Check-out selfie"
                      className="mt-2 h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No file selected.</div>
                  )}
                </div>
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Site Photo</div>
                    <label className="text-sm text-primary cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          uploadAttendanceCheckoutPhoto(file, "site");
                        }}
                        disabled={uploadingSite}
                      />
                      {uploadingSite ? "Uploading..." : "Upload"}
                    </label>
                  </div>
                  {createForm.check_out_photo_site ? (
                    <img
                      src={resolvePhotoUrl(createForm.check_out_photo_site)}
                      alt="Check-out site"
                      className="mt-2 h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No file selected.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">Remark</label>
              <Input
                value={createForm.remark}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, remark: event.target.value }))}
                placeholder="Optional remark"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSaving}>
                Cancel
              </Button>
              <Button onClick={handleCreateAttendance} disabled={createSaving || uploadingSelfie || uploadingSite}>
                {createSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewItem} onOpenChange={(open) => !open && closePreview()}>
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

              {(() => {
                const baseDate = parseAttendanceDate(previewItem.date || previewItem.created_at || previewItem.updated_at);
                const isCheckout = previewPhase === "checkout";
                const hideTimings = isAbsentAttendance(previewItem);
                const timeValue = isCheckout
                  ? resolveValue(previewItem, [
                      "check_out_time",
                      "checkout_time",
                      "check_out_at",
                      "check_out",
                      "out_time",
                      "checkout_at",
                      "checked_out_at",
                      "checkout_datetime",
                      "check_out_datetime",
                    ])
                  : resolveValue(previewItem, [
                      "check_in_time",
                      "checkin_time",
                      "check_in_at",
                      "check_in",
                      "created_at",
                      "updated_at",
                    ]);

                const locationValue = isCheckout
                  ? (
                      previewItem.check_out_location ||
                      previewItem.checkout_location ||
                      previewItem.checkOutLocation ||
                      previewItem.location ||
                      "-"
                    )
                  : (previewItem.location || "-");
                const latitudeValue = isCheckout ? (previewItem.check_out_latitude ?? previewItem.checkOutLatitude ?? "-") : (previewItem.latitude ?? "-");
                const longitudeValue = isCheckout ? (previewItem.check_out_longitude ?? previewItem.checkOutLongitude ?? "-") : (previewItem.longitude ?? "-");
                const locationLabel = isCheckout ? "Location (Check-out)" : "Location (Check-in)";
                const timeLabel = isCheckout ? "Time (Check-out)" : "Time (Check-in)";

                return (
                  <div className="grid gap-4 sm:grid-cols-2 text-sm">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Name</div>
                      <div className="font-medium">{resolveAttendanceUserLabel(previewItem)}</div>
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
                      <div className="text-muted-foreground">{timeLabel}</div>
                      <div className="font-medium">{hideTimings ? "-" : formatTimeValue(timeValue, baseDate)}</div>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <div className="text-muted-foreground">{locationLabel}</div>
                      <div className="font-medium">{locationValue}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Latitude</div>
                      <div className="font-medium">{latitudeValue}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Longitude</div>
                      <div className="font-medium">{longitudeValue}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
