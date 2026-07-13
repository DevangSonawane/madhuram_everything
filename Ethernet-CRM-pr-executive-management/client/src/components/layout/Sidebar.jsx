import React from 'react';
import { NavLink, useParams, useLocation, useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package2, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from '@/contexts/useAuth';
import { useProject } from '@/contexts/useProject';
import { getAccessibleMenuCategories } from '@/lib/accessControl';

export function Sidebar({ className, isCollapsed, toggleSidebar }) {
  // If props are not provided (e.g. mobile sheet usage), use local state logic or defaults
  // For mobile sheet, it's always expanded, so we don't need collapse logic there really.
  // But to be safe, we can default isCollapsed to false if undefined.
  
  const { user, logout } = useAuth();
  const { selectedProject } = useProject();
  const collapsed = isCollapsed === undefined ? false : isCollapsed;
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const visibleCategories = getAccessibleMenuCategories(user);
  const effectiveProjectSlug = projectId ?? selectedProject?.slug ?? selectedProject?.id ?? selectedProject?.project_id;
  const isMobileViewport = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(max-width: 768px)").matches
    : false;

  const normalizeTitle = (title) =>
    String(title || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const hasDedicatedAdminPages = (() => {
    const flat = visibleCategories.flatMap((cat) => cat.items || []);
    const hasUsers = flat.some((it) => String(it.path || it.to || "").split("?")[0] === "/user-management");
    const hasAccess = flat.some((it) => String(it.path || it.to || "").split("?")[0] === "/access-control");
    return hasUsers && hasAccess;
  })();

  const getPath = (path) => {
    if (path === '/projects') return '/projects';
    if (!effectiveProjectSlug) return path;
    
    if (path === '/') return `/${effectiveProjectSlug}`;
    // Attendance is a global page; when inside a project, open it with project_id filter (mobile friendly).
    if (path === '/attendance') {
      const pid = selectedProject?.project_id ?? selectedProject?.id ?? "";
      const query = pid ? `?project_id=${encodeURIComponent(String(pid))}&mark_attendance=1` : "?mark_attendance=1";
      return `/attendance${query}`;
    }
    return `/${effectiveProjectSlug}${path}`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={cn(
      "pb-12 h-screen border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 relative flex flex-col shadow-xl z-50", 
      collapsed ? "w-20" : "w-72",
      className
    )}>
      {toggleSidebar && (
        <div className="absolute -right-3 top-8 z-50">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-7 w-7 rounded-full shadow-md bg-background border-border hover:bg-accent text-foreground p-0 flex items-center justify-center"
            onClick={toggleSidebar}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      )}

      <div className={cn("flex items-center h-20 px-6", collapsed ? "justify-center px-2" : "")}>
        <div className="flex items-center gap-3 font-bold text-2xl text-sidebar-primary tracking-tight">
           <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1.5 rounded-lg shadow-lg shadow-sidebar-primary/20">
             <Package2 className="h-6 w-6" />
           </div>
           {!collapsed && <span className="text-sidebar-foreground font-bold text-xl tracking-tight">Madhuram</span>}
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-4 px-3">
        <div className="space-y-6">
          {visibleCategories.map((category, index) => (
            <div
              key={
                String(category.category || "").trim() ||
                (Array.isArray(category.items)
                  ? category.items.map((it) => it.to || it.path || it.title).filter(Boolean).join("|")
                  : `cat-${index}`)
              }
              className="space-y-1"
            >
              {!collapsed && category.category ? (
                <h3 className="px-4 text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest mb-2 font-mono">
                  {category.category}
                </h3>
              ) : null}
              {category.items.map((item) => {
                // Attendance in the sidebar should be mobile-only.
                if (item.path === "/attendance" && !isMobileViewport) return null;
                // Keep Attendance visible inside project sidebar (opens global attendance filtered by project).
                const targetUrl = item.to || item.path;
                const targetBase = String(targetUrl).split('?')[0] || item.path;
                const targetPath = getPath(targetUrl);
                const activeBasePath = getPath(targetBase);
                const baseActive =
                  targetBase === '/'
                    ? location.pathname === activeBasePath
                    : location.pathname.startsWith(activeBasePath);

                const itemTab = (() => {
                  const raw = String(targetUrl || "");
                  if (!raw.includes("?")) return "";
                  try {
                    const [, search] = raw.split("?");
                    const params = new URLSearchParams(search);
                    return String(params.get("tab") || "");
                  } catch {
                    return "";
                  }
                })();

                const currentTab = (() => {
                  try {
                    return String(new URLSearchParams(location.search || "").get("tab") || "");
                  } catch {
                    return "";
                  }
                })();

                const isActive = baseActive && (!itemTab || itemTab === currentTab);

                // If dedicated pages exist, hide any legacy "User Management" link (e.g. older /users route).
                if (
                  hasDedicatedAdminPages &&
                  normalizeTitle(item.title) === "user management" &&
                  String(item.path || item.to || "").split("?")[0] === "/users"
                ) {
                  return null;
                }
                return (
                  <NavLink
                    key={item.to || item.path}
                    to={targetPath}
                    className={() =>
                      cn(
                        "flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                        collapsed ? "justify-center px-2" : "",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )
                    }
                    title={collapsed ? item.title : undefined}
                  >
                    <item.icon className={cn("h-5 w-5 flex-shrink-0 transition-transform duration-200", collapsed ? "mr-0" : "mr-3", "group-hover:scale-110")} />
                    {!collapsed && <span>{item.title}</span>}
                    {/* Active Indicator Glow */}
                    {!collapsed && (
                      <div
                        className={cn(
                          "absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sidebar-primary rounded-l-full transition-opacity duration-300",
                          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                      />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className={cn("mt-auto px-3", collapsed ? "flex justify-center" : "")}>
        <Button
          variant="outline"
          onClick={handleLogout}
          className={cn("w-full justify-start gap-2", collapsed ? "w-12 justify-center px-0" : "")}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Logout"}
        </Button>
      </div>
      
    </div>
  );
}
