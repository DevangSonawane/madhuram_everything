import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building, MapPin, Calendar, FileText, Trash2, Edit, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/useAuth";
import { api } from "@/lib/api";
import ProjectForm from "@/components/forms/ProjectForm";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isProjectManager = user?.role === 'operational_manager';
  const canEditDelete = isAdmin || isProjectManager;

  const normalizeAssignedProjectKeys = (value) => {
    if (Array.isArray(value)) {
      return value
        .flatMap((entry) => {
          if (entry == null) return [];
          if (typeof entry === 'object') {
            return [entry.id, entry.project_id, entry.name, entry.project_name];
          }
          return [entry];
        })
        .map((item) => String(item).trim().toLowerCase())
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed
            .flatMap((entry) => {
              if (entry == null) return [];
              if (typeof entry === 'object') {
                return [entry.id, entry.project_id, entry.name, entry.project_name];
              }
              return [entry];
            })
            .map((item) => String(item).trim().toLowerCase())
            .filter(Boolean);
        }
      } catch {
        return value
          .split(',')
          .map((item) => String(item).trim().toLowerCase())
          .filter(Boolean);
      }
    }
    return [];
  };

  const normalizedProjectList = normalizeAssignedProjectKeys(user?.project_list);
  const projectListKey = normalizedProjectList.slice().sort().join('|');
  const assignedKeys = new Set(normalizedProjectList);
  const visibleProjects = isAdmin
    ? projects
    : projects.filter((project) => {
        const candidates = [
          project.project_id,
          project.id,
          project.project_name,
          project.name,
        ]
          .map((item) => String(item ?? '').trim().toLowerCase())
          .filter(Boolean);
        return candidates.some((key) => assignedKeys.has(key));
      });

  useEffect(() => {
    fetchProjects();
  }, [user?.role, projectListKey]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const result = await api.getProjects();
      if (result.success) {
        const rawProjects = Array.isArray(result.data) ? result.data : [];
        const isPrivilegedRole = isAdmin;
        const assignedKeys = new Set(normalizedProjectList);

        const filtered = isPrivilegedRole
          ? rawProjects
          : rawProjects.filter((project) => {
              if (assignedKeys.size === 0) return false;
              const candidates = [
                project.project_id,
                project.id,
                project.project_name,
                project.name,
              ]
                .map((item) => String(item ?? '').trim().toLowerCase())
                .filter(Boolean);
              return candidates.some((key) => assignedKeys.has(key));
            });

        setProjects(filtered);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to fetch projects",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while fetching projects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    try {
      setDeleting(true);
      const result = await api.deleteProject(projectToDelete.project_id);
      if (result.success) {
        toast({
          title: "Success",
          description: "Project deleted successfully"
        });
        setProjects(projects.filter(p => p.project_id !== projectToDelete.project_id));
        setProjectToDelete(null);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete project",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while deleting project",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateSuccess = (project) => {
    toast({
      title: "Success",
      description: "Project created successfully"
    });
    setIsNewProjectOpen(false);
    fetchProjects();
  };

  const handleEditSuccess = (project) => {
    toast({
      title: "Success",
      description: "Project updated successfully"
    });
    setIsEditProjectOpen(false);
    setProjectToEdit(null);
    fetchProjects();
  };

  const handleEditClick = async (project) => {
    // Fetch fresh project data using getProjectById to ensure we have latest data
    try {
      const result = await api.getProjectById(project.project_id);
      if (result.success) {
        setProjectToEdit(result.data);
        setIsEditProjectOpen(true);
      } else {
        // Fallback to using project from list if API call fails
        console.warn('Failed to fetch project details, using cached data:', result.error);
        setProjectToEdit(project);
        setIsEditProjectOpen(true);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      // Fallback to using project from list
      setProjectToEdit(project);
      setIsEditProjectOpen(true);
    }
  };

  const filteredProjects = visibleProjects.filter(p => 
    (p.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-2">Manage construction projects, work orders, and client details.</p>
        </div>
        <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Project</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Fill in the project details below. Fields marked with * are required.
              </DialogDescription>
            </DialogHeader>
            <div className="h-[70vh] overflow-y-auto pr-4">
              <ProjectForm
                onSuccess={handleCreateSuccess}
                onCancel={() => setIsNewProjectOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visibleProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(visibleProjects.map(p => p.client_name).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Work Orders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {visibleProjects.filter(p => p.work_order_file).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With MAS Files</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {visibleProjects.filter(p => p.mas_file).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle>Project List</CardTitle>
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isAdmin
                ? 'No projects found. Create your first project to get started.'
                : 'No projects assigned yet, please contact admin.'}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredProjects.map((project) => (
                  <div key={project.project_id} className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold leading-none tracking-tight">{project.project_name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">ID: {project.project_id}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs">Client</span>
                        <span className="font-medium">{project.client_name}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                         <span className="text-muted-foreground text-xs">Duration</span>
                         <span className="font-medium">
                           {project.product_duration ? new Date(project.product_duration).toLocaleDateString() : 'N/A'}
                         </span>
                      </div>
                      <div className="flex flex-col gap-1 col-span-2">
                         <span className="text-muted-foreground text-xs">Created</span>
                         <span className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
                            {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A'}
                         </span>
                      </div>
                      {project.work_order_file && (
                        <div className="flex flex-col gap-1 col-span-2">
                          <span className="text-muted-foreground text-xs">Work Order</span>
                          <a
                            href={api.getFileUrl(project.work_order_file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                          >
                            <FileText className="h-3 w-3" />
                            View File
                          </a>
                        </div>
                      )}
                    </div>

                    {(isAdmin || isProjectManager) && (
                      <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleEditClick(project)}
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="flex-1"
                          onClick={() => setProjectToDelete(project)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Product Duration</TableHead>
                    <TableHead>Work Order</TableHead>
                    <TableHead>PR/PO Tracking</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.project_id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{project.project_name}</span>
                          <span className="text-xs text-muted-foreground">ID: {project.project_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>{project.client_name}</TableCell>
                      <TableCell>
                        {project.product_duration ? (
                          <div className="flex items-center text-muted-foreground">
                            <Calendar className="mr-1 h-3 w-3" />
                            {new Date(project.product_duration).toLocaleDateString()}
                          </div>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {project.work_order_file ? (
                          <a
                            href={api.getFileUrl(project.work_order_file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" />
                            View
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">No file</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.pr_po_tracking && project.pr_po_tracking.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {project.pr_po_tracking.slice(0, 2).map((item, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                            {project.pr_po_tracking.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{project.pr_po_tracking.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="mr-1 h-3 w-3" />
                          {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {canEditDelete && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditClick(project)}
                            >
                              <Edit className="h-4 w-4 mr-1" /> Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => setProjectToDelete(project)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </Button>
                          </div>
                        )}
                        {!canEditDelete && (
                          <span className="text-muted-foreground text-sm">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project <strong>{projectToDelete?.project_name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project details below. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[70vh] overflow-y-auto pr-4">
            <ProjectForm
              project={projectToEdit}
              onSuccess={handleEditSuccess}
              onCancel={() => {
                setIsEditProjectOpen(false);
                setProjectToEdit(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
