import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Upload, FileText, CheckCircle2, Shrink, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MAX_FILE_SIZE, MAX_COMPRESSION_API_SIZE } from "@/constants/fileLimits";
import { extractTextFromPdf } from "@/lib/pdfUtils";
import { extractWorkOrderFields, mapExtractedToProjectFormForm } from "@/lib/workOrderExtractor";

const MAX_BACKEND_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB

const todayDateOnly = () => new Date().toISOString().slice(0, 10);

export default function ProjectForm({ project, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    project_name: '',
    product_duration: todayDateOnly(),
    client_name: '',
    location: '',
    floor: '',
    estimate_value: '',
    number_of_flats: '',
    refuse_per_flat: '',
    toilets_per_flat: '',
    work_order_information: '',
    wo_number: '',
    pr_po_tracking: [],
    samples: [],
    ml_management: {
      ml_task: ''
    }
  });

  const [files, setFiles] = useState({
    work_order_file: null,
    mas_file: null
  });

  const [filePreviews, setFilePreviews] = useState({
    work_order_file: null,
    mas_file: null
  });

  const [prPoInput, setPrPoInput] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [compressing, setCompressing] = useState({
    work_order_file: false,
    mas_file: false
  });
  const [extractedPreview, setExtractedPreview] = useState({
    project_name: '',
    client_name: '',
    product_duration: '',
    work_order_information: '',
    wo_number: ''
  });
  const workOrderInputRef = useRef(null);
  const { toast } = useToast();

  const ACCEPT_WO = '.pdf,.csv,.xlsx,.xls,.doc,.docx';
  const isPdf = (f) => f && (f.type === 'application/pdf' || (f.name || '').toLowerCase().endsWith('.pdf'));

  // Process file: set file and preview, run extraction for PDFs.
  // Do NOT auto-call the compression API here. Compression (if needed) will be
  // performed just before the create-project API during form submission.
  const processFileForUpload = async (file, fileType) => {
    if (!file || !(file instanceof File)) return;

    const setFileAndPreview = (f) => {
      setFiles(prev => ({ ...prev, [fileType]: f }));
      setFilePreviews(prev => {
        const oldUrl = prev[fileType];
        if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
        return { ...prev, [fileType]: URL.createObjectURL(f) };
      });
      if (fileType === 'work_order_file' && isPdf(f)) runExtractAndPreview(f);
    };

    setFileAndPreview(file);

    // Inform user if file exceeds the final upload limit so they know it will
    // be compressed at submission time (or they'll need to compress manually).
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Large file selected',
        description: `Selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB. If larger than ${ (MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB, it will be compressed automatically before creating the project.`,
      });
    }
  };

  useEffect(() => {
    if (project) {
      // Handle ml_management - API returns object but expects array in request
      let mlManagement = { ml_task: '' };
      if (project.ml_management) {
        if (Array.isArray(project.ml_management) && project.ml_management.length > 0) {
          mlManagement = { ml_task: project.ml_management[0] || '' };
        } else if (typeof project.ml_management === 'object' && project.ml_management.ml_task) {
          mlManagement = { ml_task: project.ml_management.ml_task };
        }
      }

      setFormData({
        project_name: project.project_name || '',
        product_duration: project.product_duration || project.project_startdate || '',
        client_name: project.client_name || '',
        location: project.location || '',
        floor: project.floor || '',
        estimate_value: project.estimate_value || '',
        number_of_flats: project.number_of_flats ?? project.no_of_flats ?? '',
        refuse_per_flat: project.refuse_per_flat ?? project.refuse_perflat ?? '',
        toilets_per_flat: project.toilets_per_flat ?? project.toilets_perflat ?? '',
        work_order_information: project.work_order_information || '',
        wo_number: project.wo_number || '',
        pr_po_tracking: project.pr_po_tracking || [],
        samples: project.samples || [],
        ml_management: mlManagement
      });

      // Set file previews for existing files
      if (project.work_order_file) {
        setFilePreviews(prev => ({
          ...prev,
          work_order_file: api.getFileUrl(project.work_order_file)
        }));
      }
      if (project.mas_file) {
        setFilePreviews(prev => ({
          ...prev,
          mas_file: api.getFileUrl(project.mas_file)
        }));
      }
    }
  }, [project]);

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Revoke all blob URLs when component unmounts
      Object.values(filePreviews).forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [filePreviews]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'ml_task') {
      setFormData(prev => ({
        ...prev,
        ml_management: {
          ...prev.ml_management,
          ml_task: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const runExtractAndPreview = async (file) => {
    setExtractError(null);
    setExtracting(true);
    try {
      // Optimized extraction: only process first 10 pages + last 5 pages for faster results
      const raw = await extractTextFromPdf(file, {
        maxHeaderPages: 10,
        maxTailPages: 5,
        batchSize: 5, // Process pages in parallel
        preserveLines: false // Faster without line preservation
      });
      
      const ext = extractWorkOrderFields(raw);
      const mapped = mapExtractedToProjectFormForm(ext);
      
      // Auto-populate form fields immediately
      console.log('Extracted data:', mapped); // Debug log
      setFormData((prev) => {
        const updated = { ...prev };
        // Only fill empty fields to avoid overwriting user input
        if (!prev.project_name && mapped.project_name) {
          updated.project_name = mapped.project_name;
          console.log('Auto-filled project_name:', mapped.project_name);
        }
        if (!prev.client_name && mapped.client_name) {
          updated.client_name = mapped.client_name;
          console.log('Auto-filled client_name:', mapped.client_name);
        }
        if (!prev.product_duration && mapped.product_duration) {
          updated.product_duration = mapped.product_duration;
          console.log('Auto-filled product_duration:', mapped.product_duration);
        }
        if (!prev.work_order_information && mapped.work_order_information) {
          updated.work_order_information = mapped.work_order_information;
          console.log('Auto-filled work_order_information');
        }
        if (!prev.wo_number && mapped.wo_number) {
          updated.wo_number = mapped.wo_number;
          console.log('Auto-filled wo_number:', mapped.wo_number);
        }
        return updated;
      });
      
      // Show success notification
      const extractedFields = [];
      if (mapped.project_name) extractedFields.push('Project Name');
      if (mapped.client_name) extractedFields.push('Client Name');
      if (mapped.product_duration) extractedFields.push('Product Duration');
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
        description: "We couldn't read this PDF. You can still attach it and fill the form manually.",
        variant: 'destructive',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleFileChange = async (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // Reset so same file can be selected again
    await processFileForUpload(file, fileType);
  };

  const handleWorkOrderDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (compressing.work_order_file) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const ext = (file.name || '').toLowerCase();
    const ok = ['.pdf', '.csv', '.xlsx', '.xls', '.doc', '.docx'].some((x) => ext.endsWith(x));
    if (!ok) {
      toast({ title: 'Invalid file', description: 'Use PDF, CSV, Excel, or Word.', variant: 'destructive' });
      return;
    }

    await processFileForUpload(file, 'work_order_file');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeFile = (fileType) => {
    // Clean up blob URL to prevent memory leaks
    setFilePreviews(prev => {
      const currentUrl = prev[fileType];
      if (currentUrl && currentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentUrl);
      }
      const next = { ...prev, [fileType]: null };
      if (fileType === 'work_order_file' && project?.work_order_file) {
        next.work_order_file = api.getFileUrl(project.work_order_file);
      }
      return next;
    });
    setFiles(prev => ({ ...prev, [fileType]: null }));
    if (fileType === 'work_order_file') {
      setExtractError(null);
      setPreviewOpen(false);
      if (workOrderInputRef.current) workOrderInputRef.current.value = '';
    }
  };

  const handleCompressFile = async (fileType) => {
    const file = files[fileType];
    if (!file || !(file instanceof File)) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to compress.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > MAX_COMPRESSION_API_SIZE) {
      toast({
        title: 'File too large to compress',
        description: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum for compression is ${(MAX_COMPRESSION_API_SIZE / 1024 / 1024).toFixed(0)} MB. Please compress manually.`,
        variant: 'destructive',
      });
      return;
    }

    setCompressing(prev => ({ ...prev, [fileType]: true }));

    try {
      const result = await api.compressFile(file);
      
      if (result.success && result.data) {
        const { url, original_size, compressed_size, message } = result.data;
        
        if (!url) {
          throw new Error('Compression succeeded but no file URL returned');
        }
        
        // Fetch the compressed file from the URL
        // URL from API should be a full URL (e.g., https://api.madhuram.enterprises/uploads/filename)
        // If it's relative, construct the full URL; if http, normalize to https to avoid 301
        let fileUrl = api.getApiFileUrl(url);
        if (fileUrl.startsWith('http://')) {
          fileUrl = fileUrl.replace(/^http:\/\//i, 'https://');
        }
        // In dev, use proxy URL to avoid CORS when fetching from api.madhuram.enterprises
        fileUrl = api.getCompressedFileFetchUrl(fileUrl);
        
        // Fetch the compressed file (uploads are typically public, no auth needed)
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch compressed file: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const compressedFile = new File([blob], file.name, { type: file.type || blob.type });
        
        // Replace the original file with compressed version
        setFiles(prev => ({ ...prev, [fileType]: compressedFile }));
        
        // Update preview
        const newPreviewUrl = URL.createObjectURL(compressedFile);
        setFilePreviews(prev => {
          // Clean up old blob URL
          const oldUrl = prev[fileType];
          if (oldUrl && oldUrl.startsWith('blob:')) {
            URL.revokeObjectURL(oldUrl);
          }
          return { ...prev, [fileType]: newPreviewUrl };
        });

        // Show success message with compression stats
        try {
          const originalBytes = typeof original_size === 'string' ? parseInt(original_size) : original_size;
          const compressedBytes = typeof compressed_size === 'string' ? parseInt(compressed_size) : compressed_size;
          
          if (originalBytes && compressedBytes) {
            const originalMB = (originalBytes / 1024 / 1024).toFixed(2);
            const compressedMB = (compressedBytes / 1024 / 1024).toFixed(2);
            const savings = ((1 - compressedBytes / originalBytes) * 100).toFixed(1);
            
            toast({
              title: 'File compressed successfully',
              description: `Reduced from ${originalMB} MB to ${compressedMB} MB (${savings}% smaller)`,
            });
          } else {
            toast({
              title: 'File compressed successfully',
              description: message || 'File has been compressed and is ready to upload.',
            });
          }
        } catch (err) {
          // If size parsing fails, just show a simple success message
          toast({
            title: 'File compressed successfully',
            description: message || 'File has been compressed and is ready to upload.',
          });
        }

        // If it's a work order PDF, re-run extraction
        if (fileType === 'work_order_file' && isPdf(compressedFile)) {
          runExtractAndPreview(compressedFile);
        }
      } else {
        throw new Error(result.error || 'Compression failed');
      }
    } catch (error) {
      console.error('Compression error:', error);
      toast({
        title: 'Compression failed',
        description: error.message || 'Failed to compress file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCompressing(prev => ({ ...prev, [fileType]: false }));
    }
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      // Revoke all blob URLs when component unmounts
      Object.values(filePreviews).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  const applyPreviewToForm = () => {
    setFormData((prev) => {
      const next = { ...prev };
      if (!prev.project_name && extractedPreview.project_name) next.project_name = extractedPreview.project_name;
      if (!prev.client_name && extractedPreview.client_name) next.client_name = extractedPreview.client_name;
      if (!prev.product_duration && extractedPreview.product_duration) next.product_duration = extractedPreview.product_duration;
      if (!prev.work_order_information && extractedPreview.work_order_information) next.work_order_information = extractedPreview.work_order_information;
      return next;
    });
    setPreviewOpen(false);
    toast({ title: 'Applied', description: 'Extracted values filled into empty fields.' });
  };

  const updatePreview = (field, value) => {
    setExtractedPreview((p) => ({ ...p, [field]: value }));
  };

  const addPrPo = () => {
    if (prPoInput.trim()) {
      setFormData(prev => ({
        ...prev,
        pr_po_tracking: [...prev.pr_po_tracking, prPoInput.trim()]
      }));
      setPrPoInput('');
    }
  };

  const removePrPo = (index) => {
    setFormData(prev => ({
      ...prev,
      pr_po_tracking: prev.pr_po_tracking.filter((_, i) => i !== index)
    }));
  };

  const addSample = () => {
    if (sampleInput.trim()) {
      setFormData(prev => ({
        ...prev,
        samples: [...prev.samples, sampleInput.trim()]
      }));
      setSampleInput('');
    }
  };

  const removeSample = (index) => {
    setFormData(prev => ({
      ...prev,
      samples: prev.samples.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Ensure all fields are included, even if empty
      const submitData = {
        project_name: formData.project_name || '',
        product_duration: formData.product_duration || '',
        client_name: formData.client_name || '',
        location: formData.location || '',
        floor: formData.floor || '',
        estimate_value: formData.estimate_value || '',
        number_of_flats: formData.number_of_flats || '',
        refuse_per_flat: formData.refuse_per_flat || '',
        toilets_per_flat: formData.toilets_per_flat || '',
        work_order_information: formData.work_order_information || '',
        wo_number: formData.wo_number || '',
        pr_po_tracking: formData.pr_po_tracking || [],
        samples: formData.samples || [],
        ml_management: formData.ml_management || { ml_task: '' },
        work_order_file: files.work_order_file,
        work_order_file_path: '',
        mas_file: files.mas_file
      };

      // Fast path: upload directly unless file exceeds backend hard limit.
      if (submitData.work_order_file && submitData.work_order_file.size > MAX_BACKEND_UPLOAD_SIZE) {
        const original = submitData.work_order_file;

        if (original.size > MAX_COMPRESSION_API_SIZE) {
          const msg = `Selected file is ${(original.size / 1024 / 1024).toFixed(1)} MB which exceeds the maximum compression limit of ${(MAX_COMPRESSION_API_SIZE / 1024 / 1024).toFixed(0)} MB. Please compress the file manually and try again.`;
          toast({ title: 'File too large', description: msg, variant: 'destructive' });
          setError(msg);
          setLoading(false);
          return;
        }

        setCompressing(prev => ({ ...prev, work_order_file: true }));
        toast({ title: 'Compressing', description: 'Compressing work order before creating project…' });

        try {
          const compResult = await api.compressFile(original);
          if (!compResult || !compResult.success || !compResult.data || !compResult.data.url) {
            throw new Error((compResult && compResult.error) || 'Compression failed to return a downloadable file URL');
          }

          let fileUrl = api.getApiFileUrl(compResult.data.url);
          if (fileUrl.startsWith('http://')) {
            fileUrl = fileUrl.replace(/^http:\/\//i, 'https://');
          }
          fileUrl = api.getCompressedFileFetchUrl(fileUrl);

          let response;
          const token = localStorage.getItem('inventory_user');
          if (token) {
            try {
              const user = JSON.parse(token);
              response = await fetch(fileUrl, {
                headers: { Authorization: `Bearer ${user.token}` }
              });
            } catch {
              response = await fetch(fileUrl);
            }
          } else {
            response = await fetch(fileUrl);
          }

          if (!response.ok) {
            throw new Error(`Failed to download compressed file: ${response.status} ${response.statusText}`);
          }

          const blob = await response.blob();
          if (!blob || blob.size === 0) throw new Error('Compressed file is empty');

          const compressedFile = new File([blob], original.name, { type: original.type || blob.type });
          submitData.work_order_file = compressedFile;
          submitData.work_order_file_path = String(compResult.data.url);
          setFiles(prev => ({ ...prev, work_order_file: compressedFile }));

          // Show compression stats if provided
          try {
            const originalBytes = typeof compResult.data.original_size === 'string' ? parseInt(compResult.data.original_size) : compResult.data.original_size;
            const compressedBytes = typeof compResult.data.compressed_size === 'string' ? parseInt(compResult.data.compressed_size) : compResult.data.compressed_size;
            if (originalBytes && compressedBytes) {
              const originalMB = (originalBytes / 1024 / 1024).toFixed(2);
              const compressedMB = (compressedBytes / 1024 / 1024).toFixed(2);
              const savings = ((1 - compressedBytes / originalBytes) * 100).toFixed(1);
              toast({ title: 'File compressed', description: `Reduced from ${originalMB} MB to ${compressedMB} MB (${savings}% smaller)` });
            } else {
              toast({ title: 'File compressed', description: compResult.data.message || 'File compressed and attached.' });
            }
          } catch (err) {
            toast({ title: 'File compressed', description: compResult.data.message || 'File compressed and attached.' });
          }
        } catch (err) {
          console.error('Compression before create failed:', err);
          const msg = err?.message || 'Compression failed before project creation.';
          toast({ title: 'Compression failed', description: msg, variant: 'destructive' });
          setError(msg);
          setCompressing(prev => ({ ...prev, work_order_file: false }));
          setLoading(false);
          return;
        } finally {
          setCompressing(prev => ({ ...prev, work_order_file: false }));
        }
      }

      let result;
      if (project?.project_id) {
        result = await api.updateProject(project.project_id, submitData);
      } else {
        result = await api.createProject(submitData);
      }

      const shouldRetryWithCompressedPath =
        !project?.project_id &&
        !result?.success &&
        !!submitData.work_order_file &&
        /file size too large|max limit is 100mb/i.test(String(result?.error || ''));

      if (shouldRetryWithCompressedPath) {
        try {
          setCompressing(prev => ({ ...prev, work_order_file: true }));
          toast({
            title: 'Retrying upload',
            description: 'Server rejected file size. Trying compressed upload path...',
          });

          const compResult = await api.compressFile(submitData.work_order_file);
          if (!compResult?.success || !compResult?.data?.url) {
            throw new Error(compResult?.error || 'Compression retry failed.');
          }

          const retryData = {
            ...submitData,
            work_order_file: null,
            work_order_file_path: String(compResult.data.url),
          };
          result = await api.createProject(retryData);
        } catch (retryError) {
          result = {
            success: false,
            error: retryError?.message || 'Compressed retry failed.',
          };
        } finally {
          setCompressing(prev => ({ ...prev, work_order_file: false }));
        }
      }

      const shouldCreateWithoutFile =
        !project?.project_id &&
        !result?.success &&
        !!submitData.work_order_file &&
        /file size too large|max limit is 100mb|gateway time-out|timeout|failed to fetch/i.test(String(result?.error || ''));

      if (shouldCreateWithoutFile) {
        const finalRetryData = {
          ...submitData,
          work_order_file: null,
          work_order_file_path: '',
        };
        const finalRetryResult = await api.createProject(finalRetryData);
        if (finalRetryResult?.success) {
          result = finalRetryResult;
          toast({
            title: 'Project created without file',
            description: 'Work order upload failed on server. Project is created; attach file later.',
          });
        }
      }

      if (result.success) {
        onSuccess?.(result.data);
        toast({
          title: 'Success',
          description: project ? 'Project updated successfully' : 'Project created successfully',
        });
      } else {
        const errorMsg = result.error || 'Failed to save project';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 px-2 sm:px-0">
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="project_name">Project Name *</Label>
          <Input
            id="project_name"
            name="project_name"
            value={formData.project_name}
            onChange={handleInputChange}
            required
            placeholder="Enter project name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product_duration">Product Duration *</Label>
          <Input
            id="product_duration"
            name="product_duration"
            type="date"
            value={formData.product_duration}
            onChange={handleInputChange}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="client_name">Client Name *</Label>
        <Input
          id="client_name"
          name="client_name"
          value={formData.client_name}
          onChange={handleInputChange}
          required
          placeholder="Enter client name"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="Enter project location"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="floor">Floor</Label>
          <Input
            id="floor"
            name="floor"
            value={formData.floor}
            onChange={handleInputChange}
            placeholder="Enter floor information"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estimate_value">Estimate Value</Label>
          <Input
            id="estimate_value"
            name="estimate_value"
            value={formData.estimate_value}
            onChange={handleInputChange}
            placeholder="Enter estimate value"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wo_number">Work Order Number</Label>
          <Input
            id="wo_number"
            name="wo_number"
            value={formData.wo_number}
            onChange={handleInputChange}
            placeholder="Enter work order number"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number_of_flats">Number of Flats</Label>
          <Input
            id="number_of_flats"
            name="number_of_flats"
            type="number"
            min="0"
            value={formData.number_of_flats}
            onChange={handleInputChange}
            placeholder="Enter number of flats"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="refuse_per_flat">Refuse per Flat</Label>
          <Input
            id="refuse_per_flat"
            name="refuse_per_flat"
            type="number"
            min="0"
            step="0.01"
            value={formData.refuse_per_flat}
            onChange={handleInputChange}
            placeholder="Enter refuse per flat"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="toilets_per_flat">Toilets per Flat</Label>
          <Input
            id="toilets_per_flat"
            name="toilets_per_flat"
            type="number"
            min="0"
            step="0.01"
            value={formData.toilets_per_flat}
            onChange={handleInputChange}
            placeholder="Enter toilets per flat"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Work Order File {!project && '*'}</Label>
        <div
          className="border-2 border-dashed rounded-lg p-4 text-center transition-colors hover:bg-muted/50"
          onDragOver={handleDragOver}
          onDrop={handleWorkOrderDrop}
        >
          <input
            ref={workOrderInputRef}
            id="work_order_file"
            type="file"
            accept={ACCEPT_WO}
            onChange={(e) => handleFileChange(e, 'work_order_file')}
            className="sr-only"
            disabled={compressing.work_order_file}
          />
          {compressing.work_order_file && !files.work_order_file ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="font-medium">Compressing file…</span>
              <span className="text-sm text-muted-foreground">This may take a moment for large files</span>
            </div>
          ) : files.work_order_file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              <span className="font-medium">{files.work_order_file.name}</span>
              <span className="text-sm text-muted-foreground">
                {files.work_order_file.size > 1024 * 1024 
                  ? `${(files.work_order_file.size / 1024 / 1024).toFixed(2)} MB`
                  : `${(files.work_order_file.size / 1024).toFixed(1)} KB`}
                {isPdf(files.work_order_file) && (extracting ? ' · Extracting…' : ' · PDF ready')}
              </span>
              {extractError && <span className="text-sm text-destructive">{extractError}</span>}
              <div className="flex gap-2 flex-wrap justify-center">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleCompressFile('work_order_file')}
                  disabled={compressing.work_order_file}
                >
                  {compressing.work_order_file ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Compressing...
                    </>
                  ) : (
                    <>
                      <Shrink className="h-4 w-4 mr-1" />
                      Compress
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => workOrderInputRef.current?.click()}>
                  Replace
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFile('work_order_file')}>
                  Remove
                </Button>
              </div>
            </div>
          ) : filePreviews.work_order_file ? (
            <div className="flex flex-col items-center gap-2">
              <a
                href={filePreviews.work_order_file}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                View existing
              </a>
              <Button type="button" variant="outline" size="sm" onClick={() => workOrderInputRef.current?.click()}>
                Replace
              </Button>
            </div>
          ) : (
            <label htmlFor="work_order_file" className="flex flex-col items-center gap-2 cursor-pointer">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Drag and drop or click to upload</span>
              <span className="text-xs text-muted-foreground">PDF, CSV, Excel, Word</span>
            </label>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PDF: we’ll try to extract project details for preview. Other formats: attach only.
        </p>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Preview extracted from work order
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Review and edit below. Apply will fill only <strong>empty</strong> form fields.
          </p>
          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="pf_preview_project_name">Project name</Label>
                <Input
                  id="pf_preview_project_name"
                  value={extractedPreview.project_name}
                  onChange={(e) => updatePreview('project_name', e.target.value)}
                  placeholder="e.g. Oakwood Kalyan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pf_preview_client_name">Client name</Label>
                <Input
                  id="pf_preview_client_name"
                  value={extractedPreview.client_name}
                  onChange={(e) => updatePreview('client_name', e.target.value)}
                  placeholder="e.g. Golden Mile Builders"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pf_preview_product_duration">Product duration (date)</Label>
                <Input
                  id="pf_preview_product_duration"
                  type="date"
                  value={extractedPreview.product_duration}
                  onChange={(e) => updatePreview('product_duration', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pf_preview_wo_info">Work order information</Label>
                <Textarea
                  id="pf_preview_wo_info"
                  value={extractedPreview.work_order_information}
                  onChange={(e) => updatePreview('work_order_information', e.target.value)}
                  placeholder="WO #, description…"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyPreviewToForm}>
              Apply to form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <Label htmlFor="work_order_information">Work Order Information</Label>
        <Textarea
          id="work_order_information"
          name="work_order_information"
          value={formData.work_order_information}
          onChange={handleInputChange}
          placeholder="Enter work order details"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>PR/PO Tracking</Label>
        <div className="flex gap-2">
          <Input
            value={prPoInput}
            onChange={(e) => setPrPoInput(e.target.value)}
            placeholder="Enter PR/PO number"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPrPo();
              }
            }}
          />
          <Button type="button" onClick={addPrPo} variant="outline">
            Add
          </Button>
        </div>
        {formData.pr_po_tracking.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.pr_po_tracking.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removePrPo(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Samples</Label>
        <div className="flex gap-2">
          <Input
            value={sampleInput}
            onChange={(e) => setSampleInput(e.target.value)}
            placeholder="Enter sample name"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSample();
              }
            }}
          />
          <Button type="button" onClick={addSample} variant="outline">
            Add
          </Button>
        </div>
        {formData.samples.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.samples.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeSample(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="mas_file">MAS File</Label>
        <div className="flex items-center gap-2">
          <Input
            id="mas_file"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => handleFileChange(e, 'mas_file')}
            className="flex-1"
            disabled={(!!filePreviews.mas_file && !files.mas_file) || compressing.mas_file}
          />
          {filePreviews.mas_file && (
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={filePreviews.mas_file}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                View
              </a>
              {files.mas_file && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCompressFile('mas_file')}
                    disabled={compressing.mas_file}
                  >
                    {compressing.mas_file ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Compressing...
                      </>
                    ) : (
                      <>
                        <Shrink className="h-4 w-4 mr-1" />
                        Compress
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile('mas_file')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ml_task">ML Management - Task</Label>
        <Textarea
          id="ml_task"
          name="ml_task"
          value={formData.ml_management.ml_task}
          onChange={handleInputChange}
          placeholder="Enter ML task details"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
