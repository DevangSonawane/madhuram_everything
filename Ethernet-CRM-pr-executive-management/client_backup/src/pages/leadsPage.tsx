import React, { useEffect, useState } from 'react';
import { Table, Select, Input, Space, Typography, message, Tag, Button, Tooltip, Dropdown, MenuProps, Modal, Form, Checkbox, Upload } from 'antd';
import { useNavigate } from 'react-router-dom';
import { apiClient } from "../utils/apiClient.ts";
import { useAuth } from '../contexts/AuthContext.tsx';
import type { TableColumnsType } from 'antd';
import { EyeOutlined, EnvironmentOutlined, SendOutlined, MoreOutlined, EditOutlined, FileTextOutlined, CopyOutlined, MailOutlined, MessageOutlined, UserAddOutlined, UploadOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const { TextArea } = Input;

const { Title } = Typography;
const { Search } = Input;

// Lead status options from leadHelpers.js
const leadStatusOptions = {
    CONTACTED: "CONTACTED",
    QUALIFIED: "QUALIFIED",
    UNQUALIFIED: "UNQUALIFIED",
    ASSIGNED_TO_GIS: "ASSIGNED_TO_GIS",
    PENDING_WITH_REASON: "PENDING_WITH_REASON",
    CALL_BACK: "CALL_BACK",
    SUSPEND_LEAD: "SUSPEND_LEAD",
    NOT_CLOSED: "NOT_CLOSED",
    CUSTOMER_DETAILS_CAPTURED: "CUSTOMER_DETAILS_CAPTURED",
    PENDING_PAYMENT: "PENDING_PAYMENT",
    PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
    KYC_PENDING: "KYC_PENDING",
    OPEN: "OPEN",
    KYC_COMPLETED: "KYC_COMPLETED",
    KYC_UPDATED: "KYC_UPDATED",
    LINK_SHARED: "LINK_SHARED",
}

// GIS status options
const gisStatusOptions = {
    FEASIBLE: "FEASIBLE",
    NOT_FEASIBLE: "NOT_FEASIBLE",
    INCORRECT_LOCATION: "INCORRECT_LOCATION",
}

// GIS reason options
const gisReasonOptions = [
    "Partner area",
    "Distance too long",
    "Out of jurisdiction"
];

interface Lead {
    id: number;
    unique_id: string;
    name: string;
    phone_number: string;
    address: string;
    source: string;
    service_type: string;
    status: string;
    sales_executive: number;
    salesExecutive?: {
        id: number;
        name: string;
        employeCode: string;
        phoneNumber: string;
        email: string;
    };
    gis_status?: string;
    distance?: number;
    optical_type?: string;
    gis_reason?: string;
    gis_remark?: string;
    createdAt: string;
    updatedAt: string;
}

interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
}

const LeadsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState<string>('');
    const [pagination, setPagination] = useState<PaginationInfo>({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 10,
    });
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('');
    const [filterValue, setFilterValue] = useState<string>('');
    const [serviceType, setServiceType] = useState<string>('');
    const [leadType, setLeadType] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [gisStatusFilter, setGisStatusFilter] = useState<string>('');
    const [capturedByMe, setCapturedByMe] = useState<boolean>(false);
    const [assignedToMe, setAssignedToMe] = useState<boolean>(false);
    const [allAssigned, setAllAssigned] = useState<boolean>(false);
    const [gisModalVisible, setGisModalVisible] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [form] = Form.useForm();
    const [planModalVisible, setPlanModalVisible] = useState(false);
    const [planForm] = Form.useForm();
    const [kycLink, setKycLink] = useState<string>('');
    const [selectedPlanLead, setSelectedPlanLead] = useState<Lead | null>(null);
    const [locationModalVisible, setLocationModalVisible] = useState(false);
    const [locationForm] = Form.useForm();
    const [selectedLocationLead, setSelectedLocationLead] = useState<Lead | null>(null);
    const [customerDetails, setCustomerDetails] = useState<any>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [createLeadModalVisible, setCreateLeadModalVisible] = useState(false);
    const [createLeadForm] = Form.useForm();

    // Fetch leads with pagination and all filters
    const fetchLeadsWithFilters = async (
        page: number = 1,
        limit: number = 10,
        searchValue?: string,
        serviceTypeValue?: string,
        leadTypeValue?: string,
        statusFilterValue?: string,
        gisStatusFilterValue?: string,
        capturedByMeValue?: boolean,
        assignedToMeValue?: boolean,
        allAssignedValue?: boolean
    ) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            const searchParam = searchValue !== undefined ? searchValue : search;
            const serviceTypeParam = serviceTypeValue !== undefined ? serviceTypeValue : serviceType;
            const leadTypeParam = leadTypeValue !== undefined ? leadTypeValue : leadType;
            const statusFilterParam = statusFilterValue !== undefined ? statusFilterValue : statusFilter;
            const gisStatusFilterParam = gisStatusFilterValue !== undefined ? gisStatusFilterValue : gisStatusFilter;
            const capturedByMeParam = capturedByMeValue !== undefined ? capturedByMeValue : capturedByMe;
            const assignedToMeParam = assignedToMeValue !== undefined ? assignedToMeValue : assignedToMe;
            const allAssignedParam = allAssignedValue !== undefined ? allAssignedValue : allAssigned;

            if (searchParam) {
                params.append('search', searchParam);
            }

            if (serviceTypeParam) {
                params.append('service_type', serviceTypeParam);
            }

            if (leadTypeParam) {
                params.append('source', leadTypeParam);
            }

            if (statusFilterParam) {
                params.append('status', statusFilterParam);
            }

            if (gisStatusFilterParam) {
                params.append('gis_status', gisStatusFilterParam);
            }

            if (capturedByMeParam) {
                params.append('captured_by_me', 'true');
            }

            if (assignedToMeParam) {
                params.append('assigned_to_me', 'true');
            }

            const response = await apiClient(
                "GET",
                `/api/v1/leads?${params.toString()}`
            );

            if (response.success && response.data) {
                setLeads(response.data.leads || []);
                setPagination(response.data.pagination || {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 0,
                    itemsPerPage: 10,
                });
            }
        } catch (error: any) {
            console.error("Error fetching leads", error);
            message.error(error?.message || "Failed to load leads");
        } finally {
            setLoading(false);
        }
    };

    // Fetch leads with pagination (wrapper for backward compatibility)
    const fetchLeads = async (page: number = 1, limit: number = 10, searchValue?: string, serviceTypeValue?: string) => {
        fetchLeadsWithFilters(page, limit, searchValue, serviceTypeValue);
    };

    // Update lead status
    const handleStatusChange = async (uniqueId: string, newStatus: string) => {
        try {
            const response = await apiClient(
                "PATCH",
                `/api/v1/leads/${uniqueId}/status`,
                { status: newStatus }
            );

            if (response.success) {
                message.success("Lead status updated successfully");
                // Refresh the current page
                fetchLeads(pagination.currentPage, pagination.itemsPerPage);
            }
        } catch (error: any) {
            console.error("Error updating lead status", error);
            message.error(error?.message || "Failed to update lead status");
        }
    };

    // Handle pagination change
    const handleTableChange = (page: number, pageSize: number) => {
        fetchLeads(page, pageSize);
    };

    // Handle search
    const handleSearch = (value: string) => {
        setSearch(value);
        // Reset to page 1 when searching
        fetchLeads(1, pagination.itemsPerPage, value, serviceType);
    };

    // Handle filter type change
    const handleFilterTypeChange = (value: string) => {
        const newFilterType = value || '';
        const previousFilterType = filterType;
        setFilterType(newFilterType);

        if (!newFilterType) {
            // Clear all individual filter states when filter type is cleared
            setFilterValue('');
            setServiceType('');
            setLeadType('');
            setStatusFilter('');
            setGisStatusFilter('');
            setCapturedByMe(false);
            setAssignedToMe(false);
            setAllAssigned(false);
            // Fetch with all filters cleared
            fetchLeadsWithFilters(1, pagination.itemsPerPage, search, '', '', '', '', false, false, false);
        } else {
            // Reset filter value when switching types
            setFilterValue('');
            // Clear only the previous filter type's value, keep others
            if (previousFilterType) {
                switch (previousFilterType) {
                    case 'service_type':
                        setServiceType('');
                        break;
                    case 'source':
                        setLeadType('');
                        break;
                    case 'status':
                        setStatusFilter('');
                        break;
                    case 'gis_status':
                        setGisStatusFilter('');
                        break;
                    case 'captured_by_me':
                        setCapturedByMe(false);
                        break;
                    case 'assigned_to_me':
                        setAssignedToMe(false);
                        break;
                }
            }
        }
    };

    // Handle filter value change
    const handleFilterValueChange = (value: string | boolean) => {
        const stringValue = typeof value === 'boolean' ? (value ? 'true' : '') : (value || '');
        setFilterValue(stringValue);

        // Update the appropriate filter state based on filter type
        // Start with current state values
        let newServiceType = '';
        let newLeadType = '';
        let newStatusFilter = '';
        let newGisStatusFilter = '';
        let newCapturedByMe = false;
        let newAssignedToMe = false;
        let newAllAssigned = false;

        // Only set the active filter, clear others
        switch (filterType) {
            case 'service_type':
                newServiceType = stringValue;
                setServiceType(stringValue);
                break;
            case 'source':
                newLeadType = stringValue;
                setLeadType(stringValue);
                break;
            case 'status':
                newStatusFilter = stringValue;
                setStatusFilter(stringValue);
                break;
            case 'gis_status':
                newGisStatusFilter = stringValue;
                setGisStatusFilter(stringValue);
                break;
            case 'captured_by_me':
                newCapturedByMe = stringValue === 'true';
                setCapturedByMe(newCapturedByMe);
                if (newCapturedByMe) {
                    setAssignedToMe(false);
                    setAllAssigned(false);
                }
                break;
            case 'assigned_to_me':
                newAssignedToMe = stringValue === 'true';
                setAssignedToMe(newAssignedToMe);
                if (newAssignedToMe) {
                    setCapturedByMe(false);
                    setAllAssigned(false);
                }
                break;
        }

        // Fetch leads with updated filter values immediately
        fetchLeadsWithFilters(1, pagination.itemsPerPage, search, newServiceType, newLeadType, newStatusFilter, newGisStatusFilter, newCapturedByMe, newAssignedToMe, newAllAssigned);
    };

    // Handle service type filter (kept for backward compatibility)
    const handleServiceTypeChange = (value: string) => {
        setServiceType(value);
        fetchLeads(1, pagination.itemsPerPage, search, value);
    };

    // Handle view details
    const handleViewDetails = (leadId: number) => {
        // Find the lead by ID
        const lead = leads.find(l => l.id === leadId);
        if (lead) {
            navigate(`/lead/customer-details/${lead.unique_id}`);
        }
    };

    // Handle edit location
    const handleEditLocation = async (leadId: number) => {
        // Find the lead by ID
        const lead = leads.find(l => l.id === leadId);
        if (lead) {
            setSelectedLocationLead(lead);

            // Fetch customer details to get all location data
            try {
                const response = await apiClient(
                    "GET",
                    `/api/v1/leads/customer-details/${lead.unique_id}`
                );

                if (response.success && response.data) {
                    setCustomerDetails(response.data);
                    // Populate form with current data
                    locationForm.setFieldsValue({
                        address: lead.address,
                        present_address_line1: response.data.present_address_line1 || undefined,
                        present_address_line2: response.data.present_address_line2 || undefined,
                        present_city: response.data.present_city || undefined,
                        present_state: response.data.present_state || undefined,
                        present_pincode: response.data.present_pincode || undefined,
                        present_country: response.data.present_country || 'India',
                        payment_address_same_as_present: response.data.payment_address_same_as_present || false,
                        payment_address_line1: response.data.payment_address_line1 || undefined,
                        payment_address_line2: response.data.payment_address_line2 || undefined,
                        payment_city: response.data.payment_city || undefined,
                        payment_state: response.data.payment_state || undefined,
                        payment_pincode: response.data.payment_pincode || undefined,
                        payment_country: response.data.payment_country || 'India',
                        latitude: response.data.latitude || undefined,
                        longitude: response.data.longitude || undefined,
                    });
                } else {
                    // If no customer details, just use lead address
                    locationForm.setFieldsValue({
                        address: lead.address,
                        present_address_line1: undefined,
                        present_address_line2: undefined,
                        present_city: undefined,
                        present_state: undefined,
                        present_pincode: undefined,
                        present_country: 'India',
                        payment_address_same_as_present: false,
                        payment_address_line1: undefined,
                        payment_address_line2: undefined,
                        payment_city: undefined,
                        payment_state: undefined,
                        payment_pincode: undefined,
                        payment_country: 'India',
                        latitude: undefined,
                        longitude: undefined,
                    });
                }
            } catch (error) {
                // If error, just use lead address
                locationForm.setFieldsValue({
                    address: lead.address,
                    present_address_line1: undefined,
                    present_address_line2: undefined,
                    present_city: undefined,
                    present_state: undefined,
                    present_pincode: undefined,
                    present_country: 'India',
                    payment_address_same_as_present: false,
                    payment_address_line1: undefined,
                    payment_address_line2: undefined,
                    payment_city: undefined,
                    payment_state: undefined,
                    payment_pincode: undefined,
                    payment_country: 'India',
                    latitude: undefined,
                    longitude: undefined,
                });
            }

            setLocationModalVisible(true);
        }
    };

    // Handle close location modal
    const handleCloseLocationModal = () => {
        setLocationModalVisible(false);
        setSelectedLocationLead(null);
        setCustomerDetails(null);
        locationForm.resetFields();
    };

    // Handle submit location update
    const handleSubmitLocationUpdate = async () => {
        try {
            const values = await locationForm.validateFields();
            if (!selectedLocationLead) return;

            setLoading(true);

            // Update lead address using POST endpoint with id (supports update)
            const leadUpdateResponse = await apiClient(
                "POST",
                `/api/v1/leads`,
                {
                    id: selectedLocationLead.id,
                    name: selectedLocationLead.name,
                    phone_number: selectedLocationLead.phone_number,
                    address: values.address,
                    source: selectedLocationLead.source,
                    service_type: selectedLocationLead.service_type,
                    sales_executive: selectedLocationLead.sales_executive,
                }
            );

            if (!leadUpdateResponse.success) {
                throw new Error(leadUpdateResponse.message || 'Failed to update lead address');
            }

            // Update customer details with all location fields
            // Check if we need to update customer details (if any field is provided or customer details exist)
            const hasLocationData = values.present_address_line1 || values.present_address_line2 ||
                values.present_city || values.present_state || values.present_pincode ||
                values.payment_address_line1 || values.payment_address_line2 ||
                values.payment_city || values.payment_state || values.payment_pincode ||
                (values.latitude !== undefined && values.latitude !== null) ||
                (values.longitude !== undefined && values.longitude !== null);

            if (customerDetails || hasLocationData) {
                // Helper function to convert empty strings to null
                const toNullIfEmpty = (value: any) => {
                    if (value === undefined || value === '' || value === null) return null;
                    return value;
                };

                // Prepare customer details data - use form values, fallback to existing data if not provided
                const customerDetailsData: any = {
                    // Include id if customer details exist to update the existing record
                    ...(customerDetails?.id && { id: customerDetails.id }),
                    // Use first_name and last_name from existing customer details or lead name
                    first_name: customerDetails?.first_name || selectedLocationLead.name.split(' ')[0] || selectedLocationLead.name,
                    last_name: toNullIfEmpty(customerDetails?.last_name || selectedLocationLead.name.split(' ').slice(1).join(' ')),
                    // Preserve other existing fields - convert empty strings to null
                    email: toNullIfEmpty(customerDetails?.email),
                    alternate_phone: toNullIfEmpty(customerDetails?.alternate_phone),
                    date_of_birth: toNullIfEmpty(customerDetails?.date_of_birth),
                    gender: toNullIfEmpty(customerDetails?.gender),
                    contact_phone: toNullIfEmpty(customerDetails?.contact_phone),
                    contact_email: toNullIfEmpty(customerDetails?.contact_email),
                    // Use form values for address fields - convert empty strings to null
                    present_address_line1: toNullIfEmpty(values.present_address_line1 || customerDetails?.present_address_line1),
                    present_address_line2: toNullIfEmpty(values.present_address_line2 || customerDetails?.present_address_line2),
                    present_city: toNullIfEmpty(values.present_city || customerDetails?.present_city),
                    present_state: toNullIfEmpty(values.present_state || customerDetails?.present_state),
                    present_pincode: toNullIfEmpty(values.present_pincode || customerDetails?.present_pincode),
                    present_country: values.present_country || customerDetails?.present_country || 'India',
                    payment_address_same_as_present: values.payment_address_same_as_present !== undefined ? values.payment_address_same_as_present : (customerDetails?.payment_address_same_as_present || false),
                    payment_address_line1: toNullIfEmpty(values.payment_address_line1 || customerDetails?.payment_address_line1),
                    payment_address_line2: toNullIfEmpty(values.payment_address_line2 || customerDetails?.payment_address_line2),
                    payment_city: toNullIfEmpty(values.payment_city || customerDetails?.payment_city),
                    payment_state: toNullIfEmpty(values.payment_state || customerDetails?.payment_state),
                    payment_pincode: toNullIfEmpty(values.payment_pincode || customerDetails?.payment_pincode),
                    payment_country: values.payment_country || customerDetails?.payment_country || 'India',
                    latitude: values.latitude !== undefined && values.latitude !== null ? parseFloat(values.latitude.toString()) : (customerDetails?.latitude || null),
                    longitude: values.longitude !== undefined && values.longitude !== null ? parseFloat(values.longitude.toString()) : (customerDetails?.longitude || null),
                    // Preserve plan and requirements
                    plan_id: customerDetails?.plan_id || null,
                    static_ip_required: customerDetails?.static_ip_required || false,
                    telephone_line_required: customerDetails?.telephone_line_required || false,
                };

                const customerDetailsResponse = await apiClient(
                    "POST",
                    `/api/v1/leads/${selectedLocationLead.unique_id}/customer-details`,
                    customerDetailsData
                );

                if (!customerDetailsResponse.success) {
                    // If customer details update fails but lead update succeeded, show warning
                    message.warning('Lead address updated, but failed to update GPS coordinates');
                    console.error("Error updating customer details", customerDetailsResponse);
                }
            }

            message.success('Location updated successfully');
            handleCloseLocationModal();
            fetchLeads(pagination.currentPage, pagination.itemsPerPage);
        } catch (error: any) {
            console.error("Error updating location", error);
            if (error.errorFields) {
                // Form validation errors
                return;
            }
            message.error(error?.message || "Failed to update location");
        } finally {
            setLoading(false);
        }
    };

    // Handle send customer information form (single lead)
    const handleSendCustomerForm = async (leadId: number) => {
        // Find the lead by ID
        const lead = leads.find(l => l.id === leadId);
        if (!lead) {
            message.error('Lead not found');
            return;
        }

        try {
            setLoading(true);
            const response = await apiClient(
                "GET",
                `/api/v1/leads/sendCustomerDetailsFrom/${leadId}`
            );

            if (response.success && response.link) {
                // Construct full URL
                const fullLink = `${window.location.origin}/${response.link}`;
                message.success(`Customer details link generated: ${fullLink}`);
                console.log('Customer details link:', fullLink);
                // TODO: Implement SMS sending with the link
                // You can use the fullLink to send via SMS
                // Refresh leads to show updated status
                fetchLeads(pagination.currentPage, pagination.itemsPerPage);
            } else {
                message.error(response.message || 'Failed to generate customer details link');
            }
        } catch (error: any) {
            console.error("Error sending customer details link", error);
            message.error(error?.message || "Failed to send customer details link");
        } finally {
            setLoading(false);
        }
    };

    // Handle download template
    const handleDownloadTemplate = () => {
        try {
            // Create template data with headers and one example row
            const templateData = [
                {
                    'Source': 'Example Source',
                    'Customer Name': 'John Doe',
                    'Customer Phone': '9876543210',
                    'Area': 'Example Area'
                }
            ];

            // Create workbook and worksheet
            const ws = XLSX.utils.json_to_sheet(templateData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Leads');

            // Generate Excel file
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // Save file
            const fileName = `leads_import_template.xlsx`;
            saveAs(blob, fileName);

            message.success('Template downloaded successfully');
        } catch (error: any) {
            console.error('Error downloading template:', error);
            message.error('Failed to download template');
        }
    };

    // Handle import from Excel
    const handleImportFromExcel = async (file: File) => {
        try {
            setLoading(true);

            // // Validate file format
            // if (!file.name.endsWith('.xlsx')) {
            //     message.error('Only .xlsx format is allowed');
            //     setLoading(false);
            //     return;
            // }

            // Read Excel file
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (!jsonData || jsonData.length === 0) {
                message.error('Excel file is empty or has no data');
                setLoading(false);
                return;
            }

            // Validate columns - exact match required
            const requiredColumns = ['Source', 'Customer Name', 'Customer Phone', 'Area'];
            const firstRow = jsonData[0] as any;
            const rowKeys = Object.keys(firstRow);
            const missingColumns = requiredColumns.filter(col => !rowKeys.includes(col));

            if (missingColumns.length > 0) {
                message.error(`Missing required columns: ${missingColumns.join(', ')}. Please download the template and use it.`);
                setLoading(false);
                return;
            }

            // Check for extra columns (optional - can be removed if not needed)
            const extraColumns = rowKeys.filter(key => !requiredColumns.includes(key));
            if (extraColumns.length > 0) {
                message.warning(`Extra columns found: ${extraColumns.join(', ')}. Only required columns will be processed.`);
            }

            // Validate and transform data
            const leadsData = [];
            const errors = [];

            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i] as any;
                const source = row['Source']?.toString().trim();
                const customerName = row['Customer Name']?.toString().trim();
                const customerPhone = row['Customer Phone']?.toString().trim();
                const area = row['Area']?.toString().trim();

                // Validate all fields are filled
                if (!source || !customerName || !customerPhone || !area) {
                    errors.push(`Row ${i + 2}: All columns must be filled`);
                    continue;
                }

                leadsData.push({
                    source,
                    customerName,
                    customerPhone,
                    area
                });
            }

            if (errors.length > 0) {
                message.warning(`${errors.length} row(s) skipped due to missing data. Check console for details.`);
                console.log('Import errors:', errors);
            }

            if (leadsData.length === 0) {
                message.error('No valid data found in Excel file');
                setLoading(false);
                return;
            }

            // Call bulk upload API
            const response = await apiClient(
                "POST",
                "/api/v1/leads/bulk",
                { leads: leadsData }
            );

            if (response.success) {
                const { results } = response;
                const successCount = results.success.length;
                const failCount = results.failed.length;

                if (successCount > 0) {
                    message.success(`Successfully imported ${successCount} lead(s)`);
                }
                if (failCount > 0) {
                    message.warning(`${failCount} lead(s) failed to import. Check console for details.`);
                    console.log('Failed imports:', results.failed);
                }

                // Refresh leads list
                fetchLeadsWithFilters(1, pagination.itemsPerPage);
            } else {
                throw new Error(response.message || 'Failed to import leads');
            }
        } catch (error: any) {
            console.error('Error importing from Excel:', error);
            message.error(error?.message || 'Failed to import leads from Excel');
        } finally {
            setLoading(false);
        }
    };

    // Handle send customer form links to multiple selected leads
    const handleSendCustomerFormToSelected = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('Please select at least one lead');
            return;
        }

        // Filter selected leads that have OPEN status
        const selectedLeads = leads.filter(lead =>
            selectedRowKeys.includes(lead.id) && lead.status === leadStatusOptions.OPEN
        );

        if (selectedLeads.length === 0) {
            message.warning('No leads with OPEN status selected');
            return;
        }

        try {
            setLoading(true);

            let successCount = 0;
            let failCount = 0;

            // Send links one by one sequentially
            for (const lead of selectedLeads) {
                try {
                    const response = await apiClient(
                        "GET",
                        `/api/v1/leads/sendCustomerDetailsFrom/${lead.id}`
                    );

                    if (response.success) {
                        successCount++;
                    } else {
                        failCount++;
                        console.error(`Failed to send link for lead ${lead.name}:`, response);
                    }
                } catch (error: any) {
                    failCount++;
                    console.error(`Error sending link for lead ${lead.name}:`, error);
                }
            }

            if (successCount > 0) {
                message.success(`Customer details links sent to ${successCount} lead(s)`);
            }
            if (failCount > 0) {
                message.warning(`Failed to send links to ${failCount} lead(s)`);
            }

            // Clear selection and refresh leads
            setSelectedRowKeys([]);
            fetchLeads(pagination.currentPage, pagination.itemsPerPage);
        } catch (error: any) {
            console.error("Error sending customer details links", error);
            message.error(error?.message || "Failed to send customer details links");
        } finally {
            setLoading(false);
        }
    };

    // Handle open GIS status modal
    const handleOpenGisModal = (leadId: number) => {
        const lead = leads.find(l => l.id === leadId);
        if (lead) {
            setSelectedLead(lead);
            form.setFieldsValue({
                gis_status: lead.gis_status || undefined,
                distance: lead.distance || undefined,
                optical_type: lead.optical_type || undefined,
                gis_reason: lead.gis_reason || undefined,
                gis_remark: lead.gis_remark || undefined,
            });
            setGisModalVisible(true);
        }
    };

    // Handle close GIS modal
    const handleCloseGisModal = () => {
        setGisModalVisible(false);
        setSelectedLead(null);
        form.resetFields();
    };

    // Handle submit GIS status
    const handleSubmitGisStatus = async () => {
        try {
            const values = await form.validateFields();
            if (!selectedLead) return;

            setLoading(true);

            // Prepare data for API call
            const gisData: any = {
                status: values.gis_status,
                lead_id: selectedLead.unique_id,
                remark: values.gis_remark || null,
            };

            // Add distance and optical_type only if status is FEASIBLE
            if (values.gis_status === gisStatusOptions.FEASIBLE) {
                if (values.distance !== undefined && values.distance !== null) {
                    gisData.distance = parseFloat(values.distance.toString());
                }
                if (values.optical_type) {
                    gisData.optical_type = values.optical_type;
                }
            }

            const response = await apiClient(
                "POST",
                `/api/v1/leads/gisStatusChange`,
                gisData
            );

            if (response.success) {
                message.success('GIS status updated successfully');
                handleCloseGisModal();
                fetchLeads(pagination.currentPage, pagination.itemsPerPage);
            } else {
                throw new Error(response.message || 'Failed to update GIS status');
            }
        } catch (error: any) {
            console.error("Error updating GIS status", error);
            if (error.errorFields) {
                // Form validation errors
                return;
            }
            message.error(error?.message || "Failed to update GIS status");
        } finally {
            setLoading(false);
        }
    };

    // Handle open plan select modal
    const handleOpenPlanModal = (leadId: number) => {
        const lead = leads.find(l => l.id === leadId);
        if (lead) {
            setSelectedPlanLead(lead);
            planForm.resetFields();
            setKycLink('');
            setPlanModalVisible(true);
        }
    };

    // Handle close plan modal
    const handleClosePlanModal = () => {
        setPlanModalVisible(false);
        setSelectedPlanLead(null);
        planForm.resetFields();
        setKycLink('');
    };

    // Handle create KYC link
    const handleCreateKycLink = async () => {
        try {
            await planForm.validateFields();
            if (!selectedPlanLead) return;

            // Update lead status to KYC_PENDING
            try {
                const statusResponse = await apiClient(
                    "PATCH",
                    `/api/v1/leads/${selectedPlanLead.unique_id}/status`,
                    { status: leadStatusOptions.KYC_PENDING }
                );

                if (!statusResponse.success) {
                    message.warning('KYC link generated, but failed to update lead status');
                }
            } catch (statusError) {
                console.error('Error updating lead status:', statusError);
                message.warning('KYC link generated, but failed to update lead status');
            }

            const link = `/customer/kyc/${selectedPlanLead.unique_id}`;
            setKycLink(link);
            message.success('KYC link generated successfully');

            // Refresh leads list to show updated status
            fetchLeads(pagination.currentPage, pagination.itemsPerPage);
        } catch (error) {
            console.error('Form validation failed:', error);
        }
    };

    // Handle copy link
    const handleCopyLink = () => {
        if (kycLink) {
            navigator.clipboard.writeText(`${window.location.origin}${kycLink}`);
            message.success('Link copied to clipboard');
        }
    };

    // Handle send via SMS
    const handleSendViaSMS = () => {
        if (!kycLink || !selectedPlanLead) return;
        message.info(`Sending KYC link via SMS to ${selectedPlanLead.phone_number}`);
        // TODO: Implement SMS sending
    };

    // Handle send via Email
    const handleSendViaEmail = () => {
        if (!kycLink || !selectedPlanLead) return;
        message.info('Sending KYC link via Email');
        // TODO: Implement Email sending
    };

    // Fetch user role
    useEffect(() => {
        const fetchUserRole = async () => {
            try {
                const response = await apiClient("GET", "/api/v1/auth/profile");
                if (response.success && response.data) {
                    const roleName = response.data.Role?.name || '';
                    setUserRole(roleName.toLowerCase());
                }
            } catch (error) {
                console.error("Error fetching user role", error);
            }
        };
        fetchUserRole();
    }, []);

    useEffect(() => {
        fetchLeadsWithFilters(1, pagination.itemsPerPage, search, serviceType, leadType, statusFilter, gisStatusFilter, capturedByMe, assignedToMe, allAssigned);
    }, []);

    // Check if user is admin or accountant
    const isAdminOrAccountant = () => {
        return userRole === 'admin' || userRole === 'accountant';
    };

    // Handle create subscriber
    const handleCreateSubscriber = (leadId: number) => {
        const lead = leads.find(l => l.id === leadId);
        if (lead) {
            message.info(`Creating subscriber for lead: ${lead.name}`);
            // TODO: Implement API call to create subscriber
            console.log('Creating subscriber for lead:', lead);
        }
    };

    // Handle open create lead modal
    const handleOpenCreateLeadModal = () => {
        createLeadForm.resetFields();
        setCreateLeadModalVisible(true);
    };

    // Handle close create lead modal
    const handleCloseCreateLeadModal = () => {
        setCreateLeadModalVisible(false);
        createLeadForm.resetFields();
    };

    // Handle submit create lead
    const handleSubmitCreateLead = async () => {
        try {
            const values = await createLeadForm.validateFields();
            setLoading(true);

            // Prepare lead data
            const leadData = {
                name: values.name,
                phone_number: values.phone_number,
                address: values.area, // Using area as address
                source: values.source,
                service_type: values.service_type,
                // sales_executive will be automatically set from the authenticated user
            };

            const response = await apiClient(
                "POST",
                "/api/v1/leads",
                leadData
            );

            if (response.success) {
                message.success('Lead created successfully');
                handleCloseCreateLeadModal();
                // Refresh leads list
                fetchLeadsWithFilters(1, pagination.itemsPerPage, search, serviceType, leadType, statusFilter, gisStatusFilter, capturedByMe, assignedToMe, allAssigned);
            } else {
                throw new Error(response.message || 'Failed to create lead');
            }
        } catch (error: any) {
            console.error("Error creating lead", error);
            if (error.errorFields) {
                // Form validation errors
                return;
            }
            message.error(error?.message || "Failed to create lead");
        } finally {
            setLoading(false);
        }
    };

    // Get status color based on status value
    const getStatusColor = (status: string): string => {
        const statusColorMap: Record<string, string> = {
            [leadStatusOptions.OPEN]: 'green',
            [leadStatusOptions.KYC_PENDING]: 'red',
            [leadStatusOptions.SUSPEND_LEAD]: 'red',
            [leadStatusOptions.PENDING_PAYMENT]: 'red',
            [leadStatusOptions.PAYMENT_COMPLETED]: 'green',
            [leadStatusOptions.KYC_COMPLETED]: 'green',
            [leadStatusOptions.CUSTOMER_DETAILS_CAPTURED]: 'blue',
            [leadStatusOptions.ASSIGNED_TO_GIS]: 'yellow',
            [leadStatusOptions.LINK_SHARED]: 'cyan',
        };
        return statusColorMap[status] || 'default';
    };

    // Table columns
    const columns: TableColumnsType<Lead> = [
        {
            title: "No.",
            dataIndex: "index",
            key: "index",
            width: 20,
            render: (_: any, x: any, index) => index + 1,
        },
        {
            title: "Name",
            dataIndex: "source",
            key: "source",
            ellipsis: true,
            width: 50,
            render: (_: any, record: Lead) => (
                <div>
                    <div>{record?.name || 'N/A'}</div>
                    {record?.phone_number && (
                        <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                            {record.phone_number}
                        </Typography.Text>
                    )}
                </div>
            ),
        },
        {
            title: "Lead Type",
            dataIndex: "source",
            key: "source",
            ellipsis: true,
            width: 40,
        },
        {
            title: "Address",
            dataIndex: "address",
            key: "address",
            width: 80,
            ellipsis: true,
        },
        {
            title: "Service Type",
            dataIndex: "service_type",
            key: "service_type",
            width: 40,
            render: (type: string) => {
                const colorMap: Record<string, string> = {
                    SME: 'blue',
                    BROADBAND: 'green',
                    LEASEDLINE: 'orange',
                };
                return (
                    <Tag color={colorMap[type] || 'default'}>
                        {type}
                    </Tag>
                );
            },
        },
        {
            title: "Captured By",
            dataIndex: ["salesExecutive", "name"],
            key: "sales_executive",
            width: 40,
            render: (_: any, record: Lead) => (
                <div>
                    <div>{record.salesExecutive?.name || 'N/A'}</div>
                    {record.salesExecutive?.employeCode && (
                        <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                            {record.salesExecutive.employeCode}
                        </Typography.Text>
                    )}
                </div>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 60,
            ellipsis: true,
            render: (status: string, record: Lead) => {
                const currentStatus = status || leadStatusOptions.OPEN;
                return (
                    <Tag color={getStatusColor(currentStatus)}>
                        {currentStatus.replace(/_/g, ' ')}
                    </Tag>
                );
            },
        },
        {
            title: "GIS Team's Status",
            dataIndex: "gisRecord",
            key: "gisRecord",
            width: 50,
            render: (gisRecord: any) => {
                if (!gisRecord?.status) return '--';
                let gisStatusCapturedBy: any = gisRecord?.gisStatusCapturedBy, gisStatusCapturedAt: any = gisRecord?.gis_status_captured_at;
                return <div>
                    <Tag color={gisRecord?.status === gisStatusOptions.FEASIBLE ? 'green' : 'red'}>
                        {gisRecord?.status?.replace(/_/g, ' ')}
                    </Tag>
                    {gisStatusCapturedBy && (
                        <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                            {gisStatusCapturedBy?.name && (
                                <>
                                    <br />
                                    <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                                        By: <b> {gisStatusCapturedBy?.name || 'N/A'}</b>
                                    </Typography.Text>
                                </>
                            )}
                            <br />
                            {gisStatusCapturedAt && (
                                <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                                    {new Date(gisStatusCapturedAt).toLocaleDateString()}
                                </Typography.Text>
                            )}
                        </Typography.Text>
                    )}
                </div>
            },
        },
        {
            title: "Actions",
            key: "actions",
            width: 50,
            render: (_: any, record: Lead) => {
                const currentStatus = record.status || leadStatusOptions.OPEN;

                // If status is OPEN, show send icon
                if (currentStatus === leadStatusOptions.OPEN) {
                    return (
                        <Tooltip title="Send customer information form">
                            <Button
                                type="text"
                                icon={<SendOutlined />}
                                style={{ fontSize: '18px', color: '#1890ff' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendCustomerForm(record.id);
                                }}
                            />
                        </Tooltip>
                    );
                }

                // If status is PAYMENT_COMPLETED and user is admin or accountant, show create subscriber button
                if (currentStatus === leadStatusOptions.PAYMENT_COMPLETED || (currentStatus === leadStatusOptions.PENDING_PAYMENT && isAdminOrAccountant())) {
                    return (
                        <Tooltip title="Create Subscriber">
                            <Button
                                type="text"
                                icon={<UserAddOutlined />}
                                style={{ fontSize: '18px', color: '#52c41a' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateSubscriber(record.id);
                                }}
                            />
                        </Tooltip>
                    );
                }


                // For all other statuses, show three-dot menu with View Details and Edit Location
                const menuItems: MenuProps['items'] = [
                    {
                        key: 'view-details',
                        label: 'View Details',
                        icon: <EyeOutlined />,
                        onClick: () => handleViewDetails(record.id),
                    },
                    ...(currentStatus === leadStatusOptions.CUSTOMER_DETAILS_CAPTURED || currentStatus === leadStatusOptions.ASSIGNED_TO_GIS ? [{
                        key: 'edit-location',
                        label: 'Edit Location',
                        icon: <EnvironmentOutlined />,
                        onClick: () => handleEditLocation(record.id),
                    }] : []),
                    ...(currentStatus === leadStatusOptions.ASSIGNED_TO_GIS ? [
                        {
                            key: 'update-gis-status',
                            label: 'Update GIS Status',
                            icon: <EnvironmentOutlined />,
                            onClick: () => handleOpenGisModal(record.id),
                        }
                    ] : []),
                    ...(currentStatus === leadStatusOptions.QUALIFIED ? [
                        {
                            key: 'plan-select',
                            label: 'Plan Select',
                            icon: <FileTextOutlined />,
                            onClick: () => handleOpenPlanModal(record.id),
                        }
                    ] : []),
                    ...(currentStatus === leadStatusOptions.KYC_UPDATED || currentStatus === leadStatusOptions.KYC_COMPLETED ? [
                        {
                            key: 'view-kyc-details',
                            label: 'View KYC Details',
                            icon: <EyeOutlined />,
                            onClick: () => {
                                const lead = leads.find(l => l.id === record.id);
                                if (lead) {
                                    navigate(`/kyc-details/${lead.unique_id}`);
                                }
                            },
                        }
                    ] : [])
                ];

                return (
                    <Dropdown
                        menu={{ items: menuItems }}
                        trigger={['click']}
                        placement="bottomRight"
                    >
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            style={{ fontSize: '18px' }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </Dropdown>
                );
            },
        },

    ];

    // Row selection configuration
    const rowSelection = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
        getCheckboxProps: (record: Lead) => ({
            disabled: record.status !== leadStatusOptions.OPEN,
        }),
        columnWidth: 15,
        fixed: 'left' as const,
    };

    return (
        <div style={{ padding: '20px', minHeight: '100vh', width: '100%' }}>
            <div style={{ marginBottom: '20px', width: '100%' }}>
                <Space style={{ marginBottom: '16px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} size="middle" wrap>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '5px' }}>
                        <Search
                            placeholder="Search all fields (name, phone, address, source, status, executive, GIS status, etc.)"
                            allowClear
                            enterButton="Search"
                            size="large"
                            style={{ width: 400 }}
                            onSearch={handleSearch}
                            onChange={(e) => {
                                if (!e.target.value) {
                                    setSearch('');
                                    // Reset to page 1 when clearing search
                                    fetchLeads(1, pagination.itemsPerPage, '', serviceType);
                                }
                            }}
                        />


                        <Select
                            placeholder="Filter Type"
                            allowClear
                            size="large"
                            style={{ width: 180 }}
                            onChange={handleFilterTypeChange}
                            value={filterType || undefined}
                            options={[
                                { label: 'Service Type', value: 'service_type' },
                                { label: 'Lead Type', value: 'source' },
                                { label: 'Status', value: 'status' },
                                { label: 'GIS Team Status', value: 'gis_status' },
                                { label: 'Captured By Me', value: 'captured_by_me' },
                                { label: 'Assigned To Me', value: 'assigned_to_me' },
                            ]}
                        />

                        {filterType && (
                            <>
                                {filterType === 'service_type' && (
                                    <Select
                                        placeholder="Select Service Type"
                                        allowClear
                                        size="large"
                                        style={{ width: 180 }}
                                        onChange={(value) => {
                                            if (value === null || value === undefined) {
                                                handleFilterValueChange('');
                                            } else {
                                                handleFilterValueChange(value);
                                            }
                                        }}
                                        value={filterValue || undefined}
                                        options={[
                                            { label: 'SME', value: 'SME' },
                                            { label: 'BROADBAND', value: 'BROADBAND' },
                                            { label: 'LEASEDLINE', value: 'LEASEDLINE' },
                                        ]}
                                    />
                                )}

                                {filterType === 'source' && (
                                    <Select
                                        placeholder="Select Lead Type"
                                        allowClear
                                        size="large"
                                        style={{ width: 180 }}
                                        onChange={(value) => {
                                            if (value === null || value === undefined) {
                                                handleFilterValueChange('');
                                            } else {
                                                handleFilterValueChange(value);
                                            }
                                        }}
                                        value={filterValue || undefined}
                                        options={[
                                            { label: 'Field Visit', value: 'Field Visit' },
                                            { label: 'Events', value: 'Events' },
                                            { label: 'Personal', value: 'Personal' },
                                            { label: 'Others', value: 'Others' },
                                        ]}
                                    />
                                )}

                                {filterType === 'status' && (
                                    <Select
                                        placeholder="Select Status"
                                        allowClear
                                        size="large"
                                        style={{ width: 200 }}
                                        onChange={(value) => {
                                            if (value === null || value === undefined) {
                                                handleFilterValueChange('');
                                            } else {
                                                handleFilterValueChange(value);
                                            }
                                        }}
                                        value={filterValue || undefined}
                                        options={Object.entries(leadStatusOptions).map(([key, value]) => ({
                                            label: value.replace(/_/g, ' '),
                                            value: value
                                        }))}
                                    />
                                )}

                                {filterType === 'gis_status' && (
                                    <Select
                                        placeholder="Select GIS Team Status"
                                        allowClear
                                        size="large"
                                        style={{ width: 200 }}
                                        onChange={(value) => {
                                            if (value === null || value === undefined) {
                                                handleFilterValueChange('');
                                            } else {
                                                handleFilterValueChange(value);
                                            }
                                        }}
                                        value={filterValue || undefined}
                                        options={Object.entries(gisStatusOptions).map(([key, value]) => ({
                                            label: value.replace(/_/g, ' '),
                                            value: value
                                        }))}
                                    />
                                )}

                                {(filterType === 'captured_by_me' || filterType === 'assigned_to_me') && (
                                    <Checkbox
                                        checked={filterValue === 'true'}
                                        onChange={(e) => handleFilterValueChange(e.target.checked)}
                                        style={{ paddingTop: '8px', height: '40px', display: 'flex', alignItems: 'center' }}
                                    >
                                        {filterType === 'captured_by_me' && 'Captured By Me'}
                                        {filterType === 'assigned_to_me' && 'Assigned To Me'}
                                    </Checkbox>
                                )}
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '5px' }}>
                        <Tooltip title="Create Lead">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                size="large"
                                title="Create Lead"
                                onClick={handleOpenCreateLeadModal}
                            >
                            </Button>
                        </Tooltip>
                        {selectedRowKeys.length > 0 && (
                            <Tooltip title="Send customer form links to selected leads">
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    size="large"
                                    onClick={handleSendCustomerFormToSelected}
                                    loading={loading}
                                >
                                    Send Link ({selectedRowKeys.length})
                                </Button>
                            </Tooltip>
                        )}
                        <Upload
                            showUploadList={false}
                            beforeUpload={(file) => {
                                // Validate file type
                                const isValidFormat = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                                    file.name.endsWith('.xlsx');

                                // if (!isValidFormat) {
                                //     message.error('Only .xlsx format is allowed');
                                //     return false;
                                // }

                                handleImportFromExcel(file);
                                return false; // Prevent auto upload
                            }}
                        >
                            <Button
                                icon={<UploadOutlined />}
                                size="large"
                            >
                                Import from Excel
                            </Button>
                        </Upload>
                        <Tooltip title="Use template to import leads">
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleDownloadTemplate}
                            >
                                Template
                            </Button>
                        </Tooltip>
                    </div>
                </Space>
            </div>

            <Table
                style={{ margin: 10, backgroundColor: "white", borderRadius: "8px", overflow: "hidden" }}
                columns={columns}
                dataSource={leads}
                rowKey="id"
                loading={loading}
                bordered
                scroll={{ x: 1400 }}
                className="executive-table"
                rowSelection={rowSelection}
                pagination={{
                    current: pagination.currentPage,
                    pageSize: pagination.itemsPerPage,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} leads`,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    onChange: handleTableChange,
                    onShowSizeChange: handleTableChange,
                }}
            />

            {/* GIS Status Modal */}
            <Modal
                title="Update GIS Status"
                open={gisModalVisible}
                onOk={handleSubmitGisStatus}
                onCancel={handleCloseGisModal}
                width={600}
                okText="Update"
                cancelText="Cancel"
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        gis_status: undefined,
                    }}
                >
                    <Form.Item
                        name="gis_status"
                        label="GIS Status"
                        rules={[{ required: true, message: 'Please select GIS status' }]}
                    >
                        <Select
                            placeholder="Select GIS Status"
                            onChange={(value) => {
                                // Reset dependent fields when status changes
                                if (value === gisStatusOptions.FEASIBLE) {
                                    form.setFieldsValue({ gis_reason: undefined });
                                } else {
                                    form.setFieldsValue({ distance: undefined, optical_type: undefined });
                                }
                            }}
                        >
                            {Object.entries(gisStatusOptions).map(([key, value]) => (
                                <Select.Option key={key} value={value}>
                                    {value.replace(/_/g, ' ')}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.gis_status !== currentValues.gis_status}
                    >
                        {({ getFieldValue }) => {
                            const gisStatus = getFieldValue('gis_status');

                            if (gisStatus === gisStatusOptions.FEASIBLE) {
                                return (
                                    <>
                                        <Form.Item
                                            name="distance"
                                            label="Distance (in meters)"
                                            rules={[{ required: true, message: 'Please enter distance' }]}
                                        >
                                            <Input type="number" placeholder="Enter distance in meters" min={0} />
                                        </Form.Item>
                                        <Form.Item
                                            name="optical_type"
                                            label="Optical Type"
                                            rules={[{ required: true, message: 'Please select optical type' }]}
                                        >
                                            <Select placeholder="Select Optical Type">
                                                <Select.Option value="GPON">GPON</Select.Option>
                                                <Select.Option value="EPON">EPON</Select.Option>
                                                <Select.Option value="Media convertor">Media convertor</Select.Option>
                                            </Select>
                                        </Form.Item>
                                        <Form.Item
                                            name="gis_remark"
                                            label="Remark (Optional)"
                                        >
                                            <TextArea rows={3} placeholder="Enter remarks" />
                                        </Form.Item>
                                    </>
                                );
                            }

                            if (gisStatus === gisStatusOptions.NOT_FEASIBLE || gisStatus === gisStatusOptions.INCORRECT_LOCATION) {
                                return (
                                    <>
                                        <Form.Item
                                            name="gis_reason"
                                            label="Reason"
                                            rules={[{ required: true, message: 'Please select reason' }]}
                                        >
                                            <Select placeholder="Select Reason">
                                                {gisReasonOptions.map((reason) => (
                                                    <Select.Option key={reason} value={reason}>
                                                        {reason}
                                                    </Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                        <Form.Item
                                            name="gis_remark"
                                            label="Remark (Optional)"
                                        >
                                            <TextArea rows={3} placeholder="Enter remarks" />
                                        </Form.Item>
                                    </>
                                );
                            }

                            return null;
                        }}
                    </Form.Item>
                </Form>
            </Modal>

            {/* Plan Select Modal */}
            <Modal
                title="Plan Select"
                open={planModalVisible}
                onCancel={handleClosePlanModal}
                footer={null}
                width={600}
            >
                <Form
                    form={planForm}
                    layout="vertical"
                >
                    <Form.Item
                        name="plan"
                        label="Select Plan"
                        rules={[{ required: true, message: 'Please select a plan' }]}
                    >
                        <Select placeholder="Select Plan">
                            <Select.Option value="plan1">Plan 1 - Basic (₹1000)</Select.Option>
                            <Select.Option value="plan2">Plan 2 - Standard (₹2000)</Select.Option>
                            <Select.Option value="plan3">Plan 3 - Premium (₹3000)</Select.Option>
                            <Select.Option value="plan4">Plan 4 - Enterprise (₹4000)</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="Additional Charge"
                        label="Additional Charge"
                    >
                        <Input type="number" placeholder="Enter additional charge amount" prefix="₹" />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            onClick={handleCreateKycLink}
                            block
                        >
                            Create Link for KYC
                        </Button>
                    </Form.Item>

                    {kycLink && (
                        <Form.Item label="KYC Link">
                            <Space.Compact style={{ width: '100%' }}>
                                <Input
                                    value={`${window.location.origin}${kycLink}`}
                                    readOnly
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    icon={<CopyOutlined />}
                                    onClick={handleCopyLink}
                                >
                                    Copy
                                </Button>
                            </Space.Compact>
                            <Space style={{ marginTop: '12px', width: '100%' }} size="middle">
                                <Button
                                    icon={<MessageOutlined />}
                                    onClick={handleSendViaSMS}
                                    style={{ flex: 1 }}
                                >
                                    Send via SMS
                                </Button>
                                <Button
                                    icon={<MailOutlined />}
                                    onClick={handleSendViaEmail}
                                    style={{ flex: 1 }}
                                >
                                    Send via Email
                                </Button>
                            </Space>
                        </Form.Item>
                    )}
                </Form>
            </Modal>

            {/* Edit Location Modal */}
            <Modal
                title="Edit Location"
                open={locationModalVisible}
                onOk={handleSubmitLocationUpdate}
                onCancel={handleCloseLocationModal}
                width={800}
                okText="Update"
                cancelText="Cancel"
                style={{ top: 20 }}
            >
                <Form
                    form={locationForm}
                    layout="vertical"
                >
                    <Form.Item
                        name="address"
                        label="Lead Address"
                        rules={[{ required: true, message: 'Please enter address' }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="Enter address"
                        />
                    </Form.Item>

                    <Title level={5} style={{ marginTop: '16px', marginBottom: '12px' }}>Present Address</Title>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                            prevValues.payment_address_same_as_present !== currentValues.payment_address_same_as_present ||
                            prevValues.present_address_line1 !== currentValues.present_address_line1 ||
                            prevValues.present_address_line2 !== currentValues.present_address_line2 ||
                            prevValues.present_city !== currentValues.present_city ||
                            prevValues.present_state !== currentValues.present_state ||
                            prevValues.present_pincode !== currentValues.present_pincode ||
                            prevValues.present_country !== currentValues.present_country
                        }
                    >
                        {({ getFieldValue }) => {
                            const sameAsPresent = getFieldValue('payment_address_same_as_present');

                            const handlePresentAddressChange = () => {
                                if (sameAsPresent) {
                                    const presentValues = locationForm.getFieldsValue([
                                        'present_address_line1',
                                        'present_address_line2',
                                        'present_city',
                                        'present_state',
                                        'present_pincode',
                                        'present_country'
                                    ]);
                                    locationForm.setFieldsValue({
                                        payment_address_line1: presentValues.present_address_line1,
                                        payment_address_line2: presentValues.present_address_line2,
                                        payment_city: presentValues.present_city,
                                        payment_state: presentValues.present_state,
                                        payment_pincode: presentValues.present_pincode,
                                        payment_country: presentValues.present_country,
                                    });
                                }
                            };

                            return (
                                <>
                                    <Form.Item
                                        name="present_address_line1"
                                        label="Address Line 1"
                                    >
                                        <Input
                                            placeholder="Enter address line 1"
                                            onChange={handlePresentAddressChange}
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="present_address_line2"
                                        label="Address Line 2"
                                    >
                                        <Input
                                            placeholder="Enter address line 2"
                                            onChange={handlePresentAddressChange}
                                        />
                                    </Form.Item>

                                    <Space.Compact style={{ width: '100%' }}>
                                        <Form.Item
                                            name="present_city"
                                            label="City"
                                            style={{ flex: 1, marginRight: '8px' }}
                                        >
                                            <Input
                                                placeholder="Enter city"
                                                onChange={handlePresentAddressChange}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="present_state"
                                            label="State"
                                            style={{ flex: 1, marginRight: '8px' }}
                                        >
                                            <Input
                                                placeholder="Enter state"
                                                onChange={handlePresentAddressChange}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="present_pincode"
                                            label="Pincode"
                                            style={{ flex: 1 }}
                                        >
                                            <Input
                                                placeholder="Enter pincode"
                                                onChange={handlePresentAddressChange}
                                            />
                                        </Form.Item>
                                    </Space.Compact>

                                    <Form.Item
                                        name="present_country"
                                        label="Country"
                                    >
                                        <Input
                                            placeholder="Enter country"
                                            onChange={handlePresentAddressChange}
                                        />
                                    </Form.Item>
                                </>
                            );
                        }}
                    </Form.Item>

                    <Title level={5} style={{ marginTop: '16px', marginBottom: '12px' }}>Payment Address</Title>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                            prevValues.payment_address_same_as_present !== currentValues.payment_address_same_as_present
                        }
                    >
                        {({ getFieldValue }) => {
                            const sameAsPresent = getFieldValue('payment_address_same_as_present');

                            return (
                                <>
                                    <Form.Item
                                        name="payment_address_same_as_present"
                                        valuePropName="checked"
                                    >
                                        <Checkbox
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    const presentValues = locationForm.getFieldsValue([
                                                        'present_address_line1',
                                                        'present_address_line2',
                                                        'present_city',
                                                        'present_state',
                                                        'present_pincode',
                                                        'present_country'
                                                    ]);
                                                    locationForm.setFieldsValue({
                                                        payment_address_line1: presentValues.present_address_line1,
                                                        payment_address_line2: presentValues.present_address_line2,
                                                        payment_city: presentValues.present_city,
                                                        payment_state: presentValues.present_state,
                                                        payment_pincode: presentValues.present_pincode,
                                                        payment_country: presentValues.present_country,
                                                    });
                                                }
                                            }}
                                        >
                                            Same as Present Address
                                        </Checkbox>
                                    </Form.Item>

                                    <Form.Item
                                        name="payment_address_line1"
                                        label="Address Line 1"
                                    >
                                        <Input
                                            placeholder="Enter address line 1"
                                            disabled={sameAsPresent}
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="payment_address_line2"
                                        label="Address Line 2"
                                    >
                                        <Input
                                            placeholder="Enter address line 2"
                                            disabled={sameAsPresent}
                                        />
                                    </Form.Item>

                                    <Space.Compact style={{ width: '100%' }}>
                                        <Form.Item
                                            name="payment_city"
                                            label="City"
                                            style={{ flex: 1, marginRight: '8px' }}
                                        >
                                            <Input
                                                placeholder="Enter city"
                                                disabled={sameAsPresent}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="payment_state"
                                            label="State"
                                            style={{ flex: 1, marginRight: '8px' }}
                                        >
                                            <Input
                                                placeholder="Enter state"
                                                disabled={sameAsPresent}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="payment_pincode"
                                            label="Pincode"
                                            style={{ flex: 1 }}
                                        >
                                            <Input
                                                placeholder="Enter pincode"
                                                disabled={sameAsPresent}
                                            />
                                        </Form.Item>
                                    </Space.Compact>

                                    <Form.Item
                                        name="payment_country"
                                        label="Country"
                                    >
                                        <Input
                                            placeholder="Enter country"
                                            disabled={sameAsPresent}
                                        />
                                    </Form.Item>
                                </>
                            );
                        }}
                    </Form.Item>

                    <Title level={5} style={{ marginTop: '16px', marginBottom: '12px' }}>GPS Coordinates</Title>

                    <Space.Compact style={{ width: '100%' }}>
                        <Form.Item
                            name="latitude"
                            label="Latitude"
                            style={{ flex: 1, marginBottom: 0, marginRight: '8px' }}
                            rules={[
                                { required: false },
                                {
                                    type: 'number',
                                    min: -90,
                                    max: 90,
                                    message: 'Latitude must be between -90 and 90',
                                    transform: (value) => value ? Number(value) : undefined,
                                }
                            ]}
                        >
                            <Input
                                type="number"
                                placeholder="Latitude (-90 to 90)"
                                step="any"
                            />
                        </Form.Item>
                        <Form.Item
                            name="longitude"
                            label="Longitude"
                            style={{ flex: 1, marginBottom: 0 }}
                            rules={[
                                { required: false },
                                {
                                    type: 'number',
                                    min: -180,
                                    max: 180,
                                    message: 'Longitude must be between -180 and 180',
                                    transform: (value) => value ? Number(value) : undefined,
                                }
                            ]}
                        >
                            <Input
                                type="number"
                                placeholder="Longitude (-180 to 180)"
                                step="any"
                            />
                        </Form.Item>
                    </Space.Compact>
                </Form>
            </Modal>

            {/* Create Lead Modal */}
            <Modal
                title="Create New Lead"
                open={createLeadModalVisible}
                onOk={handleSubmitCreateLead}
                onCancel={handleCloseCreateLeadModal}
                okText="Create"
                cancelText="Cancel"
                width={500}
                confirmLoading={loading}
            >
                <Form
                    form={createLeadForm}
                    layout="vertical"
                >
                    <Form.Item
                        name="name"
                        label="Name"
                        rules={[{ required: true, message: 'Please enter name' }]}
                    >
                        <Input placeholder="Enter name" />
                    </Form.Item>

                    <Form.Item
                        name="phone_number"
                        label="Phone Number"
                        rules={[
                            { required: true, message: 'Please enter phone number' },
                            { pattern: /^[0-9]{10,15}$/, message: 'Phone number must be 10-15 digits' }
                        ]}
                    >
                        <Input placeholder="Enter phone number" maxLength={15} />
                    </Form.Item>

                    <Form.Item
                        name="source"
                        label="Source"
                        rules={[{ required: true, message: 'Please select source' }]}
                    >
                        <Select placeholder="Select source">
                            <Select.Option value="Events">Events</Select.Option>
                            <Select.Option value="Field Visit">Field Visit</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="area"
                        label="Area"
                        rules={[{ required: true, message: 'Please enter area' }]}
                    >
                        <Input placeholder="Enter area" />
                    </Form.Item>

                    <Form.Item
                        name="service_type"
                        label="Service Type"
                        rules={[{ required: true, message: 'Please select service type' }]}
                    >
                        <Select placeholder="Select service type">
                            <Select.Option value="SME">SME</Select.Option>
                            <Select.Option value="BROADBAND">BROADBAND</Select.Option>
                            <Select.Option value="LEASEDLINE">LEASEDLINE</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default LeadsPage;

