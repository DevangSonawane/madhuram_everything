import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PackagePlus, Search, Briefcase, ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from '@/contexts/useAuth';

const GLOBAL_ITEMS = [
  {
    title: 'Projects',
    path: '/projects',
    icon: Briefcase,
  },
  {
    title: 'Attendance',
    path: '/attendance',
    to: '/attendance?tab=all',
    icon: ClipboardCheck,
  },
  {
    title: 'Add Inventory',
    path: '/projects/inventory/add',
    icon: PackagePlus,
  },
  {
    title: 'Search',
    path: '/projects/quotes/search',
    icon: Search,
  },
];

export function GlobalSidebar({ className, embedded = false, isCollapsed = false, toggleSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const collapsed = embedded ? false : isCollapsed;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  return (
    <div
      className={cn(
        "border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 relative flex flex-col z-50",
        embedded ? "w-full border-b" : "h-screen border-r shadow-xl pb-12",
        collapsed ? "w-20" : "w-72",
        className,
      )}
    >
      {!embedded && toggleSidebar && (
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
      <div className={cn("flex items-center h-20", collapsed ? "justify-center px-2" : "px-5")}>
        <div className="flex items-center gap-3 font-bold text-2xl text-sidebar-primary tracking-tight">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1.5 rounded-lg shadow-lg shadow-sidebar-primary/20">
            <Package2 className="h-6 w-6" />
          </div>
          {!collapsed && <span className="text-sidebar-foreground font-bold text-xl tracking-tight">Madhuram</span>}
        </div>
      </div>

      <ScrollArea className={cn("py-4 px-3", embedded ? "max-h-[45vh]" : "flex-1")}>
        <div className="space-y-6">
          <div className="space-y-1">
            {!collapsed && (
              <h3 className="px-4 text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest mb-2 font-mono">
                Global
              </h3>
            )}
            {GLOBAL_ITEMS.map((item) => {
              const targetUrl = item.to || item.path;
              const isActive =
                item.path === '/projects'
                  ? location.pathname === '/projects'
                  : location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={`${item.path}::${item.to || ''}`}
                  to={targetUrl}
                  className={() =>
                    cn(
                      "flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                      collapsed ? "justify-center px-2" : "",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )
                  }
                >
                  <item.icon className={cn("h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110", collapsed ? "mr-0" : "mr-3")} />
                  {!collapsed && <span>{item.title}</span>}
                  {!collapsed && (
                    <div
                      className={cn(
                        "absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sidebar-primary rounded-l-full transition-opacity duration-300",
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                      )}
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <div className={cn("mt-auto px-3", embedded ? "pb-4" : "")}>
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
