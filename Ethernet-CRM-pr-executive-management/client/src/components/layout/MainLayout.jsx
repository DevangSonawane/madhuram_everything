import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalSidebar } from './GlobalSidebar';
import { Header } from './Header';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { cn } from "@/lib/utils";
import { useProject } from '@/contexts/useProject';
import { useAuth } from '@/contexts/useAuth';
import { hasPageAccess, normalizeProjectRoutePath } from '@/lib/accessControl';
import { AppLoader } from '@/components/ui/loader';

export function MainLayout({ children, contentClassName = "content-shell" }) {
  const location = useLocation();
  const { projectId } = useParams();
  const { projects, selectedProject, selectProject, loading } = useProject();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Sync URL with Project Context
  useEffect(() => {
    if (!loading && projects.length > 0) {
      if (projectId) {
        // If we are on a project route, ensure the project is selected in context
        // Handle both string and number comparisons
        const currentProjectId = String(selectedProject?.id || selectedProject?.project_id || '');
        const urlKey = String(projectId);
        const isNumericKey = /^\d+$/.test(urlKey);
        
        const project = projects.find((p) => {
          const id = String(p?.id || p?.project_id || "");
          if (isNumericKey && id === urlKey) return true;
          const slug = String(p?.slug || "").trim();
          return slug && slug === urlKey;
        });

        if (project) {
          const projectIdValue = String(project?.id || project?.project_id || "");
          if (currentProjectId !== projectIdValue) {
            selectProject(project);
          }

          // Canonicalize numeric URLs -> slug URLs
          if (isNumericKey && project.slug) {
            const segments = String(location.pathname || "").split("/").filter(Boolean);
            if (segments.length > 0) {
              if (segments[0] === "projects" && segments.length > 1) {
                segments[1] = project.slug;
              } else {
                segments[0] = project.slug;
              }
              navigate(`/${segments.join("/")}${location.search || ""}`, { replace: true });
            } else {
              navigate(`/${project.slug}${location.search || ""}`, { replace: true });
            }
          }
        } else if (!isNumericKey) {
          // slug not found
          console.warn(`Project ${urlKey} not found in available projects`);
          navigate('/projects');
        } else if (isNumericKey) {
          // numeric id not found
          console.warn(`Project ${urlKey} not found in available projects`);
          navigate('/projects');
        }
      }
    } else if (!loading && projects.length === 0 && projectId) {
      // Projects loaded but list is empty
      navigate('/projects');
    }
  }, [projectId, projects, selectedProject, loading, navigate, selectProject, location.pathname, location.search]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isGlobalSidebarCollapsed, setIsGlobalSidebarCollapsed] = useState(false);
  const currentPagePath = normalizeProjectRoutePath(location.pathname);
  const isCurrentPageAllowed = hasPageAccess(user, currentPagePath);
  const shouldShowSidebar = isCurrentPageAllowed;
  const showProjectSidebar = shouldShowSidebar && Boolean(projectId);
  const showGlobalSidebar = !projectId;
  const isQuotesRoute = location.pathname.startsWith("/projects/quotes");
  const desktopPaddingClass = showProjectSidebar
    ? (showGlobalSidebar
        ? (
            isGlobalSidebarCollapsed
              ? (isSidebarCollapsed ? "md:pl-[144px]" : "md:pl-[400px]")
              : (isSidebarCollapsed ? "md:pl-[304px]" : "md:pl-[576px]")
          )
        : (isSidebarCollapsed ? "md:pl-20" : "md:pl-72"))
    : (showGlobalSidebar ? (isGlobalSidebarCollapsed ? "md:pl-20" : "md:pl-72") : "md:pl-0");

  if (loading) {
    return <AppLoader fullscreen label="Loading workspace..." />;
  }

  return (
    <div className="min-h-screen w-full flex bg-muted/30">
      {showGlobalSidebar && (
        <div className="hidden md:block fixed inset-y-0 left-0 z-50">
          <GlobalSidebar
            isCollapsed={isGlobalSidebarCollapsed}
            toggleSidebar={() => setIsGlobalSidebarCollapsed((prev) => !prev)}
          />
        </div>
      )}
      {showProjectSidebar && (
        <div
          className={cn(
            "hidden md:block fixed inset-y-0 transition-all duration-300",
            showGlobalSidebar
              ? (isGlobalSidebarCollapsed ? "left-20" : "left-72")
              : "left-0",
            isSidebarCollapsed ? "w-20" : "w-72",
          )}
        >
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>
      )}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 min-w-0",
        desktopPaddingClass
      )}>
        <Header />
        <main className="flex-1 p-2 sm:p-3 md:p-5 overflow-y-auto overflow-x-hidden">
          <div className={cn(contentClassName, isQuotesRoute ? "max-w-none" : null)}>
            <AnimatePresence mode="wait">
              <Motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="min-h-full w-full"
              >
                {isCurrentPageAllowed ? (
                  children ?? <Outlet />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <p className="text-center text-2xl md:text-3xl font-semibold text-destructive">
                      Please contact admin to get access
                    </p>
                  </div>
                )}
              </Motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
