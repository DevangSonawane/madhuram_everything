import React, { useState, useRef } from 'react';
import { motion as Motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/useProject';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building, Calendar, MapPin, Loader2, Plus, Trash2, FileText, Upload, CheckCircle2, LogOut, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { hasPageAccess } from "@/lib/accessControl";
import { MAX_FILE_SIZE } from "@/constants/fileLimits";
import { extractTextFromPdf } from "@/lib/pdfUtils";
import { extractWorkOrderFields, mapExtractedToProjectForm } from "@/lib/workOrderExtractor";
import { GlobalSidebar } from '@/components/layout/GlobalSidebar';
import { MapLocationPicker } from "@/components/MapLocationPicker";

const MAX_BACKEND_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB
const todayDateOnly = () => new Date().toISOString().slice(0, 10);

export default function ProjectSelection() {
  const { projects, loading, selectProject, createProject, updateProject, deleteProject } = useProject();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isEditLocationPickerOpen, setIsEditLocationPickerOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [_projectToEdit, setProjectToEdit] = useState(null);
  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    location: '',
    map_location: null, // { lat, lng, label }
    floors: '',
    number_of_flats: '',
    refuse_per_flat: '',
    toilets_per_flat: '',
    start_date: todayDateOnly(),
    value: '',
    wo_number: '',
    status: 'Planning'
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [workOrderFile, setWorkOrderFile] = useState(null);
  const [, setCompressingWorkOrder] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState({
    name: '',
    client: '',
    location: '',
    start_date: todayDateOnly(),
    value: '',
    wo_number: ''
  });
  const workOrderInputRef = useRef(null);
  const editWorkOrderInputRef = useRef(null);
  const editMasInputRef = useRef(null);

  const [editProjectDraft, setEditProjectDraft] = useState({
    id: null,
    name: '',
    client: '',
    location: '',
    map_location: null, // { lat, lng, label, radius? }
    floors: '',
    number_of_flats: '',
    refuse_per_flat: '',
    toilets_per_flat: '',
    start_date: '',
    value: '',
    wo_number: '',
    work_order_file: null,
    mas_file: null,
  });

  const isPdf = (f) => f && (f.type === 'application/pdf' || (f.name || '').toLowerCase().endsWith('.pdf'));

  const processWorkOrderFile = async (file) => {
    if (!file || !(file instanceof File)) return;

    // Simply set the file and run extraction for PDFs.
    setWorkOrderFile(file);
    if (isPdf(file)) runExtractAndPreview(file);

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Large file selected',
        description: `Selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Large files may take longer to upload.`,
      });
    }
  };

  const canAccessProjectsPage = hasPageAccess(user, '/projects');

  const projectList = Array.isArray(projects) ? projects : [];
  const normalizedRole = String(user?.role || '').toLowerCase();
  const canViewAllProjects = normalizedRole === 'admin';
  const rawProjectList = Array.isArray(user?.project_list)
    ? user.project_list
    : (() => {
        if (typeof user?.project_list !== 'string') return [];
        try {
          const parsed = JSON.parse(user.project_list);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return user.project_list
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        }
      })();
  const assignedProjectIds = new Set(
    Array.isArray(rawProjectList)
      ? rawProjectList
          .flatMap((entry) => {
            if (entry == null) return [];
            if (typeof entry === 'object') {
              return [
                entry.id,
                entry.project_id,
                entry.name,
                entry.project_name,
              ];
            }
            return [entry];
          })
          .map((value) => String(value).trim().toLowerCase())
          .filter(Boolean)
      : []
  );

  const filteredProjects = projectList.filter((project) => {
    if (!user) return false;

    if (canViewAllProjects) return true;

    // Non-admin users can only see projects explicitly assigned by admin.
    if (assignedProjectIds.size === 0) return false;
    const projectKeys = [
      project?.project_id,
      project?.id,
      project?.name,
      project?.project_name,
    ]
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter(Boolean);

    return projectKeys.some((key) => assignedProjectIds.has(key));
  });

  const handleSelectProject = (project) => {
    if (!project) {
      console.error('No project provided to handleSelectProject');
      return;
    }
    
    const projectId = project.id || project.project_id;
    if (!projectId) {
      console.error('Project missing id:', project);
      toast({
        title: 'Error',
        description: 'Project ID is missing. Please try again.',
        variant: 'destructive'
      });
      return;
    }
    
    selectProject(project);
    navigate(`/${project?.slug || projectId}`);
  };

  const ACCEPT_WO = '.pdf,.csv,.xlsx,.xls';

  const runExtractAndPreview = async (file) => {
    setExtractError(null);
    setExtracting(true);
    console.log('Starting PDF extraction for file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    try {
      // For large files, process even fewer pages for faster results
      // Most work order info is in first 5 pages
      const raw = await extractTextFromPdf(file, {
        maxHeaderPages: 5, // Reduced from 10 to 5 for faster processing
        maxTailPages: 3, // Reduced from 5 to 3
        batchSize: 5, // Process pages in parallel
        preserveLines: false // Faster without line preservation
      });
      
      console.log('PDF text extracted, length:', raw.length);
      const ext = extractWorkOrderFields(raw);
      console.log('Extracted work order fields:', ext);
      const mapped = mapExtractedToProjectForm(ext);
      console.log('Mapped to form fields:', mapped);
      
      // Auto-populate form fields immediately
      setNewProject((prev) => {
        const updated = { ...prev };
        let fieldsFilled = [];
        // Only fill empty fields to avoid overwriting user input
        if (!prev.name && mapped.name) {
          updated.name = mapped.name;
          fieldsFilled.push('name');
        }
        if (!prev.client && mapped.client) {
          updated.client = mapped.client;
          fieldsFilled.push('client');
        }
        if (!prev.start_date && mapped.start_date) {
          updated.start_date = mapped.start_date;
          fieldsFilled.push('start_date');
        }
        if (!prev.value && mapped.value) {
          updated.value = mapped.value;
          fieldsFilled.push('value');
        }
        if (!prev.wo_number && mapped.wo_number) {
          updated.wo_number = mapped.wo_number;
          fieldsFilled.push('wo_number');
        }
        console.log('Auto-filled fields:', fieldsFilled);
        return updated;
      });
      
      // Show success notification
      const extractedFields = [];
      if (mapped.name) extractedFields.push('Project Name');
      if (mapped.client) extractedFields.push('Client');
      if (mapped.start_date) extractedFields.push('Start Date');
      if (mapped.wo_number) extractedFields.push('Work Order Number');
      
      if (extractedFields.length > 0) {
        toast({
          title: 'Fields auto-filled',
          description: `Extracted and filled: ${extractedFields.join(', ')}. You can edit any field as needed.`,
        });
      } else {
        toast({
          title: 'PDF ready',
          description: "We couldn’t auto-detect fields from this PDF, but it’s attached and ready. Please fill the form manually.",
          variant: 'default',
        });
      }
      
      // Store preview for optional manual review
      setExtractedPreview({ ...mapped });
    } catch (err) {
      console.error(err);
      setExtractError(err?.message || 'Could not read PDF.');
      toast({
        title: 'Extraction failed',
        description: 'We couldn’t read this PDF. You can still attach it and fill the form manually.',
        variant: 'destructive',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    await processWorkOrderFile(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const ext = (file.name || '').toLowerCase();
    const ok = ext.endsWith('.pdf') || ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls');
    if (!ok) {
      toast({ title: 'Invalid file', description: 'Use PDF, CSV, or Excel.', variant: 'destructive' });
      return;
    }

    await processWorkOrderFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeWorkOrderFile = () => {
    // Note: workOrderFile is a File object, not a blob URL, so no cleanup needed here
    // Blob URLs are only created for previews, which we don't store separately
    setWorkOrderFile(null);
    setExtractError(null);
    setPreviewOpen(false);
    if (workOrderInputRef.current) workOrderInputRef.current.value = '';
  };

  const applyPreviewToForm = () => {
    setNewProject((prev) => {
      const next = { ...prev };
      if (!prev.name && extractedPreview.name) next.name = extractedPreview.name;
      if (!prev.client && extractedPreview.client) next.client = extractedPreview.client;
      if (!prev.location && extractedPreview.location) next.location = extractedPreview.location;
      if (!prev.start_date && extractedPreview.start_date) next.start_date = extractedPreview.start_date;
      if (!prev.value && extractedPreview.value) next.value = extractedPreview.value;
      if (!prev.wo_number && extractedPreview.wo_number) next.wo_number = extractedPreview.wo_number;
      return next;
    });
    setPreviewOpen(false);
    toast({ title: 'Applied', description: 'Extracted values filled into empty fields.' });
  };

  const updatePreview = (field, value) => {
    setExtractedPreview((p) => ({ ...p, [field]: value }));
  };

  const handleCreateProject = async () => {
    setIsCreating(true);
    try {
      // Map to API format - createProject in context handles the mapping
      const projectData = {
        name: newProject.name,
        client: newProject.client,
        location: newProject.location,
        map_location: newProject.map_location,
        floors: newProject.floors,
        number_of_flats: newProject.number_of_flats,
        refuse_per_flat: newProject.refuse_per_flat,
        toilets_per_flat: newProject.toilets_per_flat,
        start_date: newProject.start_date,
        value: newProject.value,
        wo_number: newProject.wo_number,
        status: newProject.status || 'Planning',
        work_order_file: workOrderFile || null,
        work_order_file_path: ''
      };
      
      // Fast path: upload directly unless file exceeds backend hard limit.
      if (projectData.work_order_file && projectData.work_order_file.size > MAX_BACKEND_UPLOAD_SIZE) {
        const original = projectData.work_order_file;
        setCompressingWorkOrder(true);
        toast({
          title: 'Preparing upload',
          description: 'File is above 100MB, trying compression...',
        });

        try {
          const compResult = await api.compressFile(original);
          if (!compResult?.success || !compResult?.data?.url) {
            throw new Error(compResult?.error || 'Compression failed.');
          }

          let fileUrl = api.getApiFileUrl(compResult.data.url);
          if (fileUrl.startsWith('http://')) {
            fileUrl = fileUrl.replace(/^http:\/\//i, 'https://');
          }
          fileUrl = api.getCompressedFileFetchUrl(fileUrl);

          let response;
          try {
            const userData = JSON.parse(localStorage.getItem('inventory_user') || '{}');
            const token = userData?.token;
            response = token
              ? await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } })
              : await fetch(fileUrl);
          } catch {
            response = await fetch(fileUrl);
          }

          if (!response.ok) {
            throw new Error(`Failed to fetch compressed file (${response.status}).`);
          }

          const blob = await response.blob();
          if (!blob || blob.size === 0) {
            throw new Error('Compressed file is empty.');
          }

          const compressedFile = new File([blob], original.name, { type: original.type || blob.type });
          projectData.work_order_file = compressedFile;
          projectData.work_order_file_path = String(compResult.data.url);
          setWorkOrderFile(compressedFile);

          toast({
            title: 'Compression complete',
            description: 'Using compressed work order for project creation.',
          });
        } catch (err) {
          toast({
            title: 'Compression failed',
            description: err?.message || 'Could not compress file above 100MB. Please use a smaller file.',
            variant: 'destructive',
          });
          return;
        } finally {
          setCompressingWorkOrder(false);
        }
      }

      let result = await createProject(projectData);

      const shouldRetryWithCompressedPath =
        !result?.success &&
        !!projectData.work_order_file &&
        /file size too large|max limit is 100mb/i.test(String(result?.error || ''));

      if (shouldRetryWithCompressedPath) {
        try {
          setCompressingWorkOrder(true);
          toast({
            title: 'Retrying upload',
            description: 'Server rejected file size. Trying compressed upload path...',
          });

          const compResult = await api.compressFile(projectData.work_order_file);
          if (!compResult?.success || !compResult?.data?.url) {
            throw new Error(compResult?.error || 'Compression retry failed.');
          }

          const retryData = {
            ...projectData,
            work_order_file: null,
            work_order_file_path: String(compResult.data.url),
          };
          result = await createProject(retryData);
        } catch (retryError) {
          result = {
            success: false,
            error: retryError?.message || 'Compressed retry failed.',
          };
        } finally {
          setCompressingWorkOrder(false);
        }
      }

      const shouldCreateWithoutFile =
        !result?.success &&
        !!projectData.work_order_file &&
        /file size too large|max limit is 100mb|gateway time-out|timeout|failed to fetch/i.test(String(result?.error || ''));

      if (shouldCreateWithoutFile) {
        const finalRetryData = {
          ...projectData,
          work_order_file: null,
          work_order_file_path: '',
        };
        const finalRetryResult = await createProject(finalRetryData);
        if (finalRetryResult?.success) {
          result = finalRetryResult;
          toast({
            title: 'Project created without file',
            description: 'Work order upload failed on server. Project is created; attach file later when API is stable.',
          });
        }
      }
      
      if (result.success) {
        toast({
          title: "Project Created",
          description: "New project has been successfully created.",
        });
        setIsNewProjectOpen(false);
        setNewProject({
            name: '',
            client: '',
            location: '',
            floors: '',
            start_date: '',
            value: '',
            wo_number: '',
            status: 'Planning'
        });
        setWorkOrderFile(null);
        setPreviewOpen(false);
        setExtractError(null);
        if (workOrderInputRef.current) workOrderInputRef.current.value = '';
      } else {
        toast({
          title: "Error",
          description: result.error || result.message || "Failed to create project",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create project",
        variant: "destructive"
      });
    } finally {
        setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleDeleteProject = async () => {
    if (projectToDelete) {
      try {
        await deleteProject(projectToDelete.id ?? projectToDelete.project_id);
        toast({
          title: "Project Deleted",
          description: `Project ${projectToDelete.name} has been deleted successfully.`,
        });
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "Failed to delete project",
          variant: "destructive"
        });
      } finally {
        setProjectToDelete(null);
      }
    }
  };

  const openEditDialog = (project) => {
    if (!project) return;
    const projectId = project.id || project.project_id;
    setProjectToEdit(project);
    setEditProjectDraft({
      id: projectId,
      name: project.name || project.project_name || '',
      client: project.client || project.client_name || '',
      location: project.location || '',
      map_location: project.map_location || null,
      floors: project.floors || project.floor || '',
      number_of_flats: project.number_of_flats ?? project.flats ?? '',
      refuse_per_flat: project.refuse_per_flat ?? project.refuge_flat ?? '',
      toilets_per_flat: project.toilets_per_flat ?? project.toilets ?? '',
      start_date: project.start_date || project.project_startdate || project.product_duration || '',
      value: project.value || project.estimate_value || '',
      wo_number: project.wo_number || '',
      work_order_file: null,
      mas_file: null,
    });
    if (editWorkOrderInputRef.current) editWorkOrderInputRef.current.value = '';
    if (editMasInputRef.current) editMasInputRef.current.value = '';
    setIsEditProjectOpen(true);
  };

  const handleUpdateProject = async () => {
    if (!editProjectDraft?.id) return;
    setIsUpdating(true);
    try {
      const payload = {
        name: editProjectDraft.name,
        client: editProjectDraft.client,
        location: editProjectDraft.location,
        map_location: editProjectDraft.map_location,
        floors: editProjectDraft.floors,
        number_of_flats: editProjectDraft.number_of_flats,
        refuse_per_flat: editProjectDraft.refuse_per_flat,
        toilets_per_flat: editProjectDraft.toilets_per_flat,
        start_date: editProjectDraft.start_date,
        value: editProjectDraft.value,
        wo_number: editProjectDraft.wo_number,
        work_order_file: editProjectDraft.work_order_file,
        mas_file: editProjectDraft.mas_file,
      };

      const result = await updateProject(editProjectDraft.id, payload);
      if (result?.success) {
        toast({ title: 'Updated', description: 'Project updated successfully.' });
        setIsEditProjectOpen(false);
        setProjectToEdit(null);
      } else {
        toast({
          title: 'Update failed',
          description: result?.error || result?.message || 'Failed to update project',
          variant: 'destructive',
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (!canAccessProjectsPage) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Access Restricted</CardTitle>
              <CardDescription>Only pages assigned by admin are visible to your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  return (
    <Motion.div
      className="min-h-screen w-full bg-background flex flex-col md:flex-row"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <aside className="hidden md:block fixed inset-y-0 left-0 z-50">
        <GlobalSidebar />
      </aside>

      <div className="flex-1 pt-6 pb-0 px-6 md:pt-8 md:pb-0 md:px-8 md:pl-72">
        <div className="max-w-6xl mx-auto space-y-8 pl-2 md:pl-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Welcome, {user?.name}</h1>
              <p className="text-lg text-muted-foreground">Select a project to continue to the dashboard.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                  {/* Only show create project if needed (e.g. Admin or Manager) */}
                  <Dialog
                    open={isNewProjectOpen}
                    onOpenChange={(open) => {
                      setIsNewProjectOpen(open);
                      if (!open) setPreviewOpen(false);
                    }}
                  >
                  <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New Project</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                        <Label htmlFor="name">Project Name</Label>
                        <Input 
                            id="name" 
                            placeholder="e.g. Lodha Park" 
                            value={newProject.name}
                            onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                        />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="client">Client Name</Label>
                        <Input 
                            id="client" 
                            placeholder="e.g. Lodha Group" 
                            value={newProject.client}
                            onChange={(e) => setNewProject({...newProject, client: e.target.value})}
                        />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input 
                            id="location" 
                            placeholder="Project Address" 
                            value={newProject.location}
                            onChange={(e) => setNewProject({...newProject, location: e.target.value, map_location: null})}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => setIsLocationPickerOpen(true)}
                          >
                            <MapPin className="mr-2 h-4 w-4" />
                            Select location from maps
                          </Button>
                          {newProject.map_location && (
                            <span className="text-xs text-muted-foreground">
                              {newProject.map_location.lat.toFixed(6)}, {newProject.map_location.lng.toFixed(6)}
                            </span>
                          )}
                        </div>
                        {newProject.map_location && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="new_radius">Radius (meters)</Label>
                              <Input
                                id="new_radius"
                                type="number"
                                step="1"
                                value={newProject.map_location.radius ?? 300}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setNewProject((p) => ({
                                    ...p,
                                    map_location: {
                                      ...(p.map_location || {}),
                                      radius: v === "" ? "" : Number(v),
                                    },
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                        <Label htmlFor="floors">No. of Floors</Label>
                        <Input 
                            id="floors" 
                            type="number" 
                            value={newProject.floors}
                            onChange={(e) => setNewProject({...newProject, floors: e.target.value})}
                        />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="value">Est. Value</Label>
                        <Input 
                            id="value" 
                            placeholder="₹" 
                            value={newProject.value}
                            onChange={(e) => setNewProject({...newProject, value: e.target.value})}
                        />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                        <Label htmlFor="number_of_flats">Number of Flats</Label>
                        <Input
                            id="number_of_flats"
                            type="number"
                            value={newProject.number_of_flats}
                            onChange={(e) => setNewProject({ ...newProject, number_of_flats: e.target.value })}
                        />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="refuse_per_flat">Refuse per Flat</Label>
                        <Input
                            id="refuse_per_flat"
                            type="number"
                            step="0.01"
                            value={newProject.refuse_per_flat}
                            onChange={(e) => setNewProject({ ...newProject, refuse_per_flat: e.target.value })}
                        />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="toilets_per_flat">Toilets per Flat</Label>
                        <Input
                            id="toilets_per_flat"
                            type="number"
                            step="0.01"
                            value={newProject.toilets_per_flat}
                            onChange={(e) => setNewProject({ ...newProject, toilets_per_flat: e.target.value })}
                        />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input 
                                id="start_date" 
                                type="date"
                                value={newProject.start_date}
                                onChange={(e) => setNewProject({...newProject, start_date: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="wo_number">WO Number</Label>
                            <Input 
                                id="wo_number" 
                                placeholder="Optional"
                                value={newProject.wo_number}
                                onChange={(e) => setNewProject({...newProject, wo_number: e.target.value})}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                        <Label>Upload Work Order</Label>
                        <div
                          className="border-2 border-dashed rounded-lg p-6 text-center transition-colors hover:bg-muted/50"
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        >
                          <input
                            ref={workOrderInputRef}
                            id="work_order_file"
                            type="file"
                            accept={ACCEPT_WO}
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                          {workOrderFile ? (
                            <div className="flex flex-col items-center gap-2">
                              <FileText className="h-10 w-10 text-primary" />
                              <span className="font-medium">{workOrderFile.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {workOrderFile.size > 1024 * 1024 
                                  ? `${(workOrderFile.size / 1024 / 1024).toFixed(2)} MB`
                                  : `${(workOrderFile.size / 1024).toFixed(1)} KB`}
                                {isPdf(workOrderFile) && (extracting ? ' · Extracting…' : ' · PDF ready')}
                              </span>
                              {extractError && (
                                <span className="text-sm text-destructive">{extractError}</span>
                              )}
                              <div className="flex gap-2 mt-1">
                                <Button type="button" variant="outline" size="sm" onClick={() => workOrderInputRef.current?.click()}>
                                  Replace
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={removeWorkOrderFile}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <label htmlFor="work_order_file" className="flex flex-col items-center gap-2 cursor-pointer">
                              <Upload className="h-10 w-10 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                Drag and drop or click to upload
                              </span>
                              <span className="text-xs text-muted-foreground">PDF, CSV, Excel</span>
                            </label>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            PDF: we’ll try to extract project details for preview. CSV/Excel: attach only.
                        </p>
                    </div>

                    </div>
                    <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNewProjectOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateProject} disabled={isCreating}>
                        {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Project
                    </Button>
                    </DialogFooter>
                </DialogContent>
                </Dialog>

                <MapLocationPicker
                  open={isLocationPickerOpen}
                  onOpenChange={setIsLocationPickerOpen}
                  onSelect={({ lat, lng, label }) => {
                    const fallbackLabel = `Lat ${Number(lat).toFixed(6)}, Lng ${Number(lng).toFixed(6)}`;
                    const nextLabel = (label || "").trim() || fallbackLabel;
                    setNewProject((prev) => ({
                      ...prev,
                      location: nextLabel,
                      map_location: {
                        ...(prev.map_location || {}),
                        lat: Number(lat),
                        lng: Number(lng),
                        label: nextLabel,
                        radius: prev.map_location?.radius ?? 300,
                      },
                    }));
                  }}
                />

                <MapLocationPicker
                  open={isEditLocationPickerOpen}
                  onOpenChange={setIsEditLocationPickerOpen}
                  onSelect={({ lat, lng, label }) => {
                    const fallbackLabel = `Lat ${Number(lat).toFixed(6)}, Lng ${Number(lng).toFixed(6)}`;
                    const nextLabel = (label || "").trim() || fallbackLabel;
                    setEditProjectDraft((prev) => ({
                      ...prev,
                      location: nextLabel,
                      map_location: {
                        ...(prev.map_location || {}),
                        lat: Number(lat),
                        lng: Number(lng),
                        label: nextLabel,
                      },
                    }));
                  }}
                />

                <Dialog
                  open={isEditProjectOpen}
                  onOpenChange={(open) => {
                    setIsEditProjectOpen(open);
                    if (!open) {
                      setProjectToEdit(null);
                      setIsEditLocationPickerOpen(false);
                    }
                  }}
                >
                  <DialogContent className="sm:max-w-[650px]">
                    <DialogHeader>
                      <DialogTitle>Edit Project</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_name">Project Name</Label>
                          <Input
                            id="edit_name"
                            value={editProjectDraft.name}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_client">Client Name</Label>
                          <Input
                            id="edit_client"
                            value={editProjectDraft.client}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, client: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit_location">Location</Label>
                        <Input
                          id="edit_location"
                          placeholder="Project Address"
                          value={editProjectDraft.location}
                          onChange={(e) =>
                            setEditProjectDraft((p) => ({
                              ...p,
                              location: e.target.value,
                              map_location: null,
                            }))
                          }
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsEditLocationPickerOpen(true)}>
                            <MapPin className="mr-2 h-4 w-4" />
                            Select location from maps
                          </Button>
                          {editProjectDraft.map_location && (
                            <span className="text-xs text-muted-foreground">
                              {Number(editProjectDraft.map_location.lat).toFixed(6)}, {Number(editProjectDraft.map_location.lng).toFixed(6)}
                            </span>
                          )}
                        </div>
                        {editProjectDraft.map_location && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit_radius">Radius (meters)</Label>
                              <Input
                                id="edit_radius"
                                type="number"
                                step="1"
                                value={editProjectDraft.map_location.radius ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditProjectDraft((p) => ({
                                    ...p,
                                    map_location: {
                                      ...(p.map_location || {}),
                                      radius: v === "" ? "" : Number(v),
                                    },
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_floors">No. of Floors</Label>
                          <Input
                            id="edit_floors"
                            type="number"
                            value={editProjectDraft.floors}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, floors: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_value">Est. Value</Label>
                          <Input
                            id="edit_value"
                            placeholder="₹"
                            value={editProjectDraft.value}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, value: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_flats">Flats</Label>
                          <Input
                            id="edit_flats"
                            type="number"
                            value={editProjectDraft.number_of_flats}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, number_of_flats: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_refuge">Refuge Flat</Label>
                          <Input
                            id="edit_refuge"
                            type="number"
                            value={editProjectDraft.refuse_per_flat}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, refuse_per_flat: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_toilets">Toilets</Label>
                          <Input
                            id="edit_toilets"
                            type="number"
                            value={editProjectDraft.toilets_per_flat}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, toilets_per_flat: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_start_date">Start Date</Label>
                          <Input
                            id="edit_start_date"
                            type="date"
                            value={editProjectDraft.start_date}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, start_date: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_wo_number">WO Number</Label>
                          <Input
                            id="edit_wo_number"
                            placeholder="Optional"
                            value={editProjectDraft.wo_number}
                            onChange={(e) => setEditProjectDraft((p) => ({ ...p, wo_number: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label>Work Order File (optional)</Label>
                        <div className="flex items-center gap-3">
                          <input
                            ref={editWorkOrderInputRef}
                            type="file"
                            accept={ACCEPT_WO}
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setEditProjectDraft((p) => ({ ...p, work_order_file: f }));
                            }}
                            className="sr-only"
                            id="edit_work_order_file"
                          />
                          <Button type="button" variant="outline" onClick={() => editWorkOrderInputRef.current?.click()}>
                            Choose file
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {editProjectDraft.work_order_file?.name || "No new file selected"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label>MAS File (optional)</Label>
                        <div className="flex items-center gap-3">
                          <input
                            ref={editMasInputRef}
                            type="file"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setEditProjectDraft((p) => ({ ...p, mas_file: f }));
                            }}
                            className="sr-only"
                            id="edit_mas_file"
                          />
                          <Button type="button" variant="outline" onClick={() => editMasInputRef.current?.click()}>
                            Choose file
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {editProjectDraft.mas_file?.name || "No new file selected"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEditProjectOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateProject} disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Project
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Preview extracted from work order
                      </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      Review and edit below. Apply will fill only <strong>empty</strong> project fields.
                    </p>
                    <ScrollArea className="max-h-[60vh] pr-4">
                      <div className="grid gap-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="preview_name">Project name</Label>
                          <Input
                            id="preview_name"
                            value={extractedPreview.name}
                            onChange={(e) => updatePreview('name', e.target.value)}
                            placeholder="e.g. Oakwood Kalyan"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="preview_client">Client (issuer)</Label>
                          <Input
                            id="preview_client"
                            value={extractedPreview.client}
                            onChange={(e) => updatePreview('client', e.target.value)}
                            placeholder="e.g. Golden Mile Builders"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="preview_location">Location</Label>
                          <Textarea
                            id="preview_location"
                            value={extractedPreview.location}
                            onChange={(e) => updatePreview('location', e.target.value)}
                            placeholder="Project address"
                            rows={2}
                            className="resize-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="preview_start_date">Start date</Label>
                            <Input
                              id="preview_start_date"
                              type="date"
                              value={extractedPreview.start_date}
                              onChange={(e) => updatePreview('start_date', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="preview_value">Est. value</Label>
                            <Input
                              id="preview_value"
                              value={extractedPreview.value}
                              onChange={(e) => updatePreview('value', e.target.value)}
                              placeholder="₹"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="preview_wo_number">WO number</Label>
                          <Input
                            id="preview_wo_number"
                            value={extractedPreview.wo_number}
                            onChange={(e) => updatePreview('wo_number', e.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                    </ScrollArea>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={applyPreviewToForm}>
                        Apply to form
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                  </Dialog>
              </div>
          </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id ?? project.project_id ?? project.name} className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-t-primary relative group" onClick={() => handleSelectProject(project)}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    <CardDescription className="mt-1">{project.client}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={project.status === 'Active' || project.status === 'In Progress' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(project);
                          }}
                          aria-label="Edit project"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(project);
                          }}
                          aria-label="Delete project"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="leading-snug">{project.location || 'No location specified'}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  Started: {project.start_date || 'N/A'}
                </div>
                {project.work_order_file && (
                    <div className="flex items-center text-sm text-muted-foreground mt-2">
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Work order attached</span>
                    </div>
                )}
              </CardContent>
              <CardFooter>
                <Button className="w-full">Select Project</Button>
              </CardFooter>
            </Card>
          ))}
          
          {filteredProjects.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                {isAdmin
                  ? "No projects found. Create one to get started."
                  : "No projects assigned yet, please contact admin."}
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete the project <strong>{projectToDelete?.name}</strong>?</p>
            <p className="text-sm text-muted-foreground mt-2">This action cannot be undone. All associated data will be removed.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProject}>Delete Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Motion.div>
  );
}
