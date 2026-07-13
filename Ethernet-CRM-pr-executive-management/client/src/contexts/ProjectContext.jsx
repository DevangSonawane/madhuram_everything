import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from '../hooks/use-toast';
import { api } from '../lib/api';
import ProjectContext from './projectContextBase';
import { slugify } from '@/lib/utils';

export const ProjectProvider = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFetchingProjectsRef = useRef(false);

  const normalizeAssignedProjectKeys = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
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

  const fetchProjects = useCallback(async ({ showLoader = true } = {}) => {
    if (isFetchingProjectsRef.current) return;
    isFetchingProjectsRef.current = true;

    if (showLoader) setLoading(true);
    try {
      const result = await api.getProjects();
      if (result.success && result.data) {
        // API returns array of projects; ensure we have an array before mapping
        const rawProjects = Array.isArray(result.data) ? result.data : [];
        const mappedProjects = rawProjects.map(project => ({
          id: project.project_id || project.id,
          project_id: project.project_id,
          name: project.project_name || project.name,
          project_name: project.project_name,
          slug: slugify(project.project_name || project.name) || String(project.project_id || project.id || '').trim(),
          client: project.client_name || project.client,
          client_name: project.client_name,
          location: project.location,
          map_location: project.location_data
            ? {
                lat: project.location_data.latitude,
                lng: project.location_data.longitude,
                radius: project.location_data.radius,
                label: project.location_data.location_name,
              }
            : null,
          floor: project.floor ?? project.floors ?? project.no_of_floors ?? project.total_floors ?? project.floor_count,
          floors: project.floors ?? project.no_of_floors ?? project.total_floors ?? project.floor_count ?? project.floor, // For compatibility
          start_date: project.product_duration || project.project_startdate || project.start_date,
          product_duration: project.product_duration,
          value: project.estimate_value || project.value,
          estimate_value: project.estimate_value,
          flats: project.flats ?? project.number_of_flats ?? project.numberOfFlats ?? project.flat_count,
          number_of_flats: project.number_of_flats ?? project.numberOfFlats ?? project.flat_count ?? project.flats,
          refuge_flat: project.refuge_flat ?? project.refuse_per_flat ?? project.refuse_perflat,
          refuse_per_flat: project.refuse_per_flat ?? project.refuge_flat ?? project.refuse_perflat,
          toilets: project.toilets ?? project.toilets_per_flat ?? project.toilets_perflat,
          toilets_per_flat: project.toilets_per_flat ?? project.toilets ?? project.toilets_perflat,
          wo_number: project.wo_number,
          work_order_file: project.work_order_file,
          work_order_information: project.work_order_information,
          mas_file: project.mas_file,
          pr_po_tracking: project.pr_po_tracking || [],
          samples: project.samples || [],
          ml_management: project.ml_management || { ml_task: '' },
          manager_id: project.user_id || project.manager_id,
          status: project.status || 'Planning',
          created_at: project.created_at,
          updated_at: project.updated_at
        }));
        const normalizedRole = String(user?.role || '').toLowerCase();
        const isPrivilegedRole = normalizedRole === 'admin';
        const assignedKeys = new Set(normalizedProjectList);

        const filteredProjects = isPrivilegedRole
          ? mappedProjects
          : mappedProjects.filter((project) => {
              if (assignedKeys.size === 0) return false;
              const candidates = [
                project.id,
                project.project_id,
                project.name,
                project.project_name,
              ]
                .map((item) => String(item ?? '').trim().toLowerCase())
                .filter(Boolean);
              return candidates.some((key) => assignedKeys.has(key));
            });

        setProjects(filteredProjects);
      } else {
        if (result?.error) console.error('Failed to fetch projects:', result.error);
        toast({
          title: 'Error',
          description: result.error || 'Failed to load projects',
          variant: 'destructive'
        });
        setProjects([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects. Please try again.',
        variant: 'destructive'
      });
      setProjects([]);
    } finally {
      if (showLoader) setLoading(false);
      isFetchingProjectsRef.current = false;
    }
  }, [toast, user?.role, projectListKey]);

  // Fetch projects from API when user is available
  useEffect(() => {
    if (user || localStorage.getItem('inventory_user')) {
      fetchProjects();
    } else {
      setProjects([]);
      setSelectedProject(null);
      setLoading(false);
    }
  }, [user?.user_id, user?.token, fetchProjects]);

  // Load selected project from local storage
  useEffect(() => {
    const savedProjectId = localStorage.getItem('selected_project_id');
    if (savedProjectId && projects.length > 0) {
      const project = projects.find(p => p.project_id === savedProjectId || p.id === savedProjectId);
      if (project) {
        setSelectedProject(project);
      }
    }
  }, [projects]);

  const createProject = async (newProjectData) => {
    setLoading(true);
    try {
      const mapLocation = newProjectData?.map_location || newProjectData?.location_data || null;
      const latitude = mapLocation?.lat ?? mapLocation?.latitude ?? newProjectData?.location_latitude;
      const longitude = mapLocation?.lng ?? mapLocation?.longitude ?? newProjectData?.location_longitude;
      const radius = mapLocation?.radius ?? newProjectData?.location_radius;
      const locationName =
        mapLocation?.label ??
        mapLocation?.location_name ??
        newProjectData?.location_name ??
        newProjectData?.location ??
        "";

      // Map form data to API format
      const apiData = {
        project_name: newProjectData.name || newProjectData.project_name || '',
        product_duration: newProjectData.start_date || newProjectData.product_duration || '',
        client_name: newProjectData.client || newProjectData.client_name || '',
        location: newProjectData.location || '',
        floor: newProjectData.floors || newProjectData.floor || newProjectData.no_of_floors || newProjectData.total_floors || newProjectData.floor_count || '',
        estimate_value: newProjectData.value || newProjectData.estimate_value || '',
        flats: newProjectData.number_of_flats ?? newProjectData.flats ?? newProjectData.no_of_flats ?? '',
        refuge_flat: newProjectData.refuse_per_flat ?? newProjectData.refuge_flat ?? newProjectData.refuse_perflat ?? '',
        toilets: newProjectData.toilets_per_flat ?? newProjectData.toilets ?? newProjectData.toilets_perflat ?? '',
        wo_number: newProjectData.wo_number || '',
        work_order_information: newProjectData.work_order_information || '',
        pr_po_tracking: newProjectData.pr_po_tracking || [],
        samples: newProjectData.samples || [],
        ml_management: newProjectData.ml_management || { ml_task: '' },
        work_order_file: newProjectData.work_order_file,
        work_order_file_path: newProjectData.work_order_file_path || '',
        mas_file: newProjectData.mas_file,
        user_id: newProjectData.user_id || user?.user_id || user?.id || '',
        location_latitude: latitude ?? '',
        location_longitude: longitude ?? '',
        location_radius: radius ?? '',
        location_name: locationName,
      };

      const result = await api.createProject(apiData);
      
      if (result.success) {
        // Refresh list in background without blocking UI.
        fetchProjects({ showLoader: false });
        return result;
      } else {
        throw new Error(result.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project',
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateProject = async (projectId, projectUpdates) => {
    setLoading(true);
    try {
      const mapLocation = projectUpdates?.map_location || projectUpdates?.location_data || null;
      const latitude = mapLocation?.lat ?? mapLocation?.latitude ?? projectUpdates?.location_latitude;
      const longitude = mapLocation?.lng ?? mapLocation?.longitude ?? projectUpdates?.location_longitude;
      const radius = mapLocation?.radius ?? projectUpdates?.location_radius;
      const locationName =
        mapLocation?.label ??
        mapLocation?.location_name ??
        projectUpdates?.location_name ??
        projectUpdates?.location ??
        "";

      const apiData = {
        project_name: projectUpdates?.name || projectUpdates?.project_name || '',
        project_startdate:
          projectUpdates?.start_date ||
          projectUpdates?.project_startdate ||
          projectUpdates?.product_duration ||
          '',
        client_name: projectUpdates?.client || projectUpdates?.client_name || '',
        location: projectUpdates?.location || '',
        floor: projectUpdates?.floors || projectUpdates?.floor || projectUpdates?.no_of_floors || projectUpdates?.total_floors || projectUpdates?.floor_count || '',
        estimate_value: projectUpdates?.value || projectUpdates?.estimate_value || '',
        wo_number: projectUpdates?.wo_number || '',
        pr_po_tracking: projectUpdates?.pr_po_tracking || [],
        samples: projectUpdates?.samples || [],
        ml_management: projectUpdates?.ml_management || { ml_task: '' },
        work_order_file: projectUpdates?.work_order_file,
        mas_file: projectUpdates?.mas_file,
        flats: projectUpdates?.number_of_flats ?? projectUpdates?.flats ?? '',
        refuge_flat: projectUpdates?.refuse_per_flat ?? projectUpdates?.refuge_flat ?? '',
        toilets: projectUpdates?.toilets_per_flat ?? projectUpdates?.toilets ?? '',
        location_latitude: latitude ?? '',
        location_longitude: longitude ?? '',
        location_radius: radius ?? '',
        location_name: locationName,
      };

      const idToUpdate = projectId?.project_id ?? projectId?.id ?? projectId;
      const result = await api.updateProject(idToUpdate, apiData);
      if (result.success) {
        fetchProjects({ showLoader: false });
        toast({ title: 'Success', description: 'Project updated successfully' });
        return result;
      }
      throw new Error(result.error || 'Failed to update project');
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update project',
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId) => {
    setLoading(true);
    try {
      // Use project_id if available, otherwise use id
      const idToDelete = typeof projectId === 'object' && projectId.project_id 
        ? projectId.project_id 
        : projectId;
      
      const result = await api.deleteProject(idToDelete);
      
      if (result.success) {
        // If the deleted project was selected, clear selection
        if (selectedProject && (selectedProject.project_id === idToDelete || selectedProject.id === idToDelete)) {
          clearProject();
        }
        
        // Refresh list in background without blocking UI.
        fetchProjects({ showLoader: false });
        
        toast({
          title: 'Success',
          description: 'Project deleted successfully'
        });
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete project',
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const selectProject = (project) => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem('selected_project_id', project.id);
    } else {
      localStorage.removeItem('selected_project_id');
    }
  };

  const clearProject = () => {
    setSelectedProject(null);
    localStorage.removeItem('selected_project_id');
  };

  return (
    <ProjectContext.Provider value={{ 
      projects, 
      selectedProject, 
      selectProject, 
      clearProject, 
      loading,
      fetchProjects,
      createProject,
      updateProject,
      deleteProject
    }}>
      {children}
    </ProjectContext.Provider>
  );
};
