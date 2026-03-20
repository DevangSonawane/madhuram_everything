class AccessControlFunction {
  final String key;
  final String label;
  final String description;

  const AccessControlFunction({
    required this.key,
    required this.label,
    required this.description,
  });
}

class AccessControlPage {
  final String pagePath;
  final String pageTitle;
  final String category;
  final String description;
  final List<AccessControlFunction> functions;

  const AccessControlPage({
    required this.pagePath,
    required this.pageTitle,
    required this.category,
    required this.description,
    required this.functions,
  });
}

const accessControlCatalog = <AccessControlPage>[
  AccessControlPage(
    pagePath: '/dashboard',
    pageTitle: 'Dashboard',
    category: 'Main',
    description: 'Project overview, status snapshots, and quick actions.',
    functions: [
      AccessControlFunction(
        key: 'dashboard.view',
        label: 'View Dashboard',
        description: 'Open dashboard and read summary widgets.',
      ),
      AccessControlFunction(
        key: 'dashboard.view_metrics',
        label: 'View Metrics',
        description: 'See KPI cards and high-level project metrics.',
      ),
      AccessControlFunction(
        key: 'dashboard.quick_actions',
        label: 'Use Quick Actions',
        description: 'Access dashboard shortcut actions.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/attendance',
    pageTitle: 'Attendance',
    category: 'Main',
    description: 'Capture attendance using selfie, site image, and location.',
    functions: [
      AccessControlFunction(
        key: 'attendance.view',
        label: 'View Attendance',
        description: 'Open attendance module.',
      ),
      AccessControlFunction(
        key: 'attendance.mark',
        label: 'Mark Attendance',
        description: 'Capture selfie, site image, and location for attendance.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/projects',
    pageTitle: 'Projects',
    category: 'Project Management',
    description: 'Manage project list and core project details.',
    functions: [
      AccessControlFunction(
        key: 'projects.view',
        label: 'View Projects',
        description: 'See project list and project information.',
      ),
      AccessControlFunction(
        key: 'projects.create',
        label: 'Create Project',
        description: 'Create a new project entry.',
      ),
      AccessControlFunction(
        key: 'projects.edit',
        label: 'Edit Project',
        description: 'Edit existing project details.',
      ),
      AccessControlFunction(
        key: 'projects.delete',
        label: 'Delete Project',
        description: 'Delete a project record.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/purchase-requests',
    pageTitle: 'Purchase Requests',
    category: 'Procurement',
    description: 'Create, edit, and track purchase requisitions.',
    functions: [
      AccessControlFunction(
        key: 'purchase_requests.view',
        label: 'View PRs',
        description: 'Open purchase request list and details.',
      ),
      AccessControlFunction(
        key: 'purchase_requests.create',
        label: 'Create PR',
        description: 'Create new purchase requests.',
      ),
      AccessControlFunction(
        key: 'purchase_requests.edit',
        label: 'Edit PR',
        description: 'Update existing purchase requests.',
      ),
      AccessControlFunction(
        key: 'purchase_requests.delete',
        label: 'Delete PR',
        description: 'Delete purchase requests.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/boq',
    pageTitle: 'BOQ Management',
    category: 'Project Management',
    description: 'Handle bill of quantities and related items.',
    functions: [
      AccessControlFunction(
        key: 'boq.view',
        label: 'View BOQ',
        description: 'Open and review BOQ data.',
      ),
      AccessControlFunction(
        key: 'boq.create',
        label: 'Create BOQ',
        description: 'Add new BOQ entries.',
      ),
      AccessControlFunction(
        key: 'boq.edit',
        label: 'Edit BOQ',
        description: 'Update BOQ entries.',
      ),
      AccessControlFunction(
        key: 'boq.approve',
        label: 'Approve BOQ',
        description: 'Approve or finalize BOQ items.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/mas',
    pageTitle: 'MAS',
    category: 'Project Management',
    description: 'Material approval and status workflows.',
    functions: [
      AccessControlFunction(
        key: 'mas.view',
        label: 'View MAS',
        description: 'Read MAS records and statuses.',
      ),
      AccessControlFunction(
        key: 'mas.create',
        label: 'Create MAS',
        description: 'Create MAS records.',
      ),
      AccessControlFunction(
        key: 'mas.edit',
        label: 'Edit MAS',
        description: 'Edit MAS details.',
      ),
      AccessControlFunction(
        key: 'mas.approve',
        label: 'Approve MAS',
        description: 'Approve MAS workflow items.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/samples',
    pageTitle: 'Sample Management',
    category: 'Procurement',
    description: 'Track samples from request to approval.',
    functions: [
      AccessControlFunction(
        key: 'samples.view',
        label: 'View Samples',
        description: 'View sample list and records.',
      ),
      AccessControlFunction(
        key: 'samples.create',
        label: 'Create Sample',
        description: 'Add a new sample entry.',
      ),
      AccessControlFunction(
        key: 'samples.edit',
        label: 'Edit Sample',
        description: 'Modify sample details.',
      ),
      AccessControlFunction(
        key: 'samples.approve',
        label: 'Approve Sample',
        description: 'Approve or reject sample items.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/purchase-orders',
    pageTitle: 'Purchase Orders',
    category: 'Procurement',
    description: 'Create, manage, and track purchase orders.',
    functions: [
      AccessControlFunction(
        key: 'purchase_orders.view',
        label: 'View POs',
        description: 'Open purchase order list and details.',
      ),
      AccessControlFunction(
        key: 'purchase_orders.create',
        label: 'Create PO',
        description: 'Create new purchase orders.',
      ),
      AccessControlFunction(
        key: 'purchase_orders.edit',
        label: 'Edit PO',
        description: 'Update purchase order details.',
      ),
      AccessControlFunction(
        key: 'purchase_orders.approve',
        label: 'Approve PO',
        description: 'Approve or release purchase orders.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/vendors',
    pageTitle: 'Vendors',
    category: 'Procurement',
    description: 'Maintain vendor records and comparisons.',
    functions: [
      AccessControlFunction(
        key: 'vendors.view',
        label: 'View Vendors',
        description: 'View vendor list and profiles.',
      ),
      AccessControlFunction(
        key: 'vendors.create',
        label: 'Create Vendor',
        description: 'Add vendor records.',
      ),
      AccessControlFunction(
        key: 'vendors.edit',
        label: 'Edit Vendor',
        description: 'Update vendor details.',
      ),
      AccessControlFunction(
        key: 'vendors.delete',
        label: 'Delete Vendor',
        description: 'Remove vendor records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/vendor-comparison',
    pageTitle: 'Vendor Comparison',
    category: 'Procurement',
    description: 'Compare price list items across vendors.',
    functions: [
      AccessControlFunction(
        key: 'vendor_comparison.view',
        label: 'View Vendor Comparison',
        description: 'Open vendor comparison and review grouped offers.',
      ),
      AccessControlFunction(
        key: 'vendor_comparison.search',
        label: 'Search Comparison',
        description: 'Search price list items to load comparison results.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/challans',
    pageTitle: 'Delivery Challans',
    category: 'Delivery & Inspection',
    description: 'Manage delivery challans and incoming records.',
    functions: [
      AccessControlFunction(
        key: 'challans.view',
        label: 'View Challans',
        description: 'View challan list and details.',
      ),
      AccessControlFunction(
        key: 'challans.create',
        label: 'Create Challan',
        description: 'Create delivery challans.',
      ),
      AccessControlFunction(
        key: 'challans.edit',
        label: 'Edit Challan',
        description: 'Update challan details.',
      ),
      AccessControlFunction(
        key: 'challans.verify',
        label: 'Verify Challan',
        description: 'Verify received challans.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/mer',
    pageTitle: 'MER',
    category: 'Delivery & Inspection',
    description: 'Manage material entry records and review captured entries.',
    functions: [
      AccessControlFunction(
        key: 'mer.view',
        label: 'View MER',
        description: 'Open MER page and review records.',
      ),
      AccessControlFunction(
        key: 'mer.create',
        label: 'Create MER',
        description: 'Create new MER records.',
      ),
      AccessControlFunction(
        key: 'mer.edit',
        label: 'Edit MER',
        description: 'Edit existing MER records.',
      ),
      AccessControlFunction(
        key: 'mer.delete',
        label: 'Delete MER',
        description: 'Delete MER records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/mir',
    pageTitle: 'MIR',
    category: 'Delivery & Inspection',
    description: 'Create and manage material inspection request records.',
    functions: [
      AccessControlFunction(
        key: 'mir.view',
        label: 'View MIR',
        description: 'Open MIR list and view MIR records.',
      ),
      AccessControlFunction(
        key: 'mir.create',
        label: 'Create MIR',
        description: 'Create new MIR entries.',
      ),
      AccessControlFunction(
        key: 'mir.edit',
        label: 'Edit MIR',
        description: 'Edit existing MIR records.',
      ),
      AccessControlFunction(
        key: 'mir.delete',
        label: 'Delete MIR',
        description: 'Delete MIR records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/itr',
    pageTitle: 'ITR',
    category: 'Delivery & Inspection',
    description: 'Create, review, and manage installation test reports.',
    functions: [
      AccessControlFunction(
        key: 'itr.view',
        label: 'View ITR',
        description: 'Open ITR page and view existing reports.',
      ),
      AccessControlFunction(
        key: 'itr.create',
        label: 'Create ITR',
        description: 'Create or submit a new installation test report.',
      ),
      AccessControlFunction(
        key: 'itr.edit',
        label: 'Edit ITR',
        description: 'Edit an existing installation test report.',
      ),
      AccessControlFunction(
        key: 'itr.delete',
        label: 'Delete ITR',
        description: 'Delete an installation test report.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/billing',
    pageTitle: 'Billing & Invoices',
    category: 'Billing',
    description: 'Manage billing records, invoice tracking, and workflows.',
    functions: [
      AccessControlFunction(
        key: 'billing.view',
        label: 'View Billing',
        description: 'Open billing page and view invoice data.',
      ),
      AccessControlFunction(
        key: 'billing.create',
        label: 'Create Invoice',
        description: 'Create new invoices and billing records.',
      ),
      AccessControlFunction(
        key: 'billing.edit',
        label: 'Edit Billing',
        description: 'Edit billing or invoice details.',
      ),
      AccessControlFunction(
        key: 'billing.delete',
        label: 'Delete Billing Record',
        description: 'Delete billing or invoice records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/inventory',
    pageTitle: 'Inventory',
    category: 'Inventory',
    description: 'Access project inventory module and stock summaries.',
    functions: [
      AccessControlFunction(
        key: 'inventory.view',
        label: 'View Inventory',
        description: 'Open inventory dashboard and stock information.',
      ),
      AccessControlFunction(
        key: 'inventory.add',
        label: 'Add Inventory',
        description: 'Add new inventory entries.',
      ),
      AccessControlFunction(
        key: 'inventory.edit',
        label: 'Edit Inventory',
        description: 'Update existing inventory records.',
      ),
      AccessControlFunction(
        key: 'inventory.delete',
        label: 'Delete Inventory',
        description: 'Delete inventory records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/stock-areas',
    pageTitle: 'Stock Overview',
    category: 'Inventory',
    description: 'Review stock by area and monitor stock distribution.',
    functions: [
      AccessControlFunction(
        key: 'stock_areas.view',
        label: 'View Stock Areas',
        description: 'Open stock overview by area.',
      ),
      AccessControlFunction(
        key: 'stock_areas.create',
        label: 'Create Stock Area',
        description: 'Create new stock area records.',
      ),
      AccessControlFunction(
        key: 'stock_areas.edit',
        label: 'Edit Stock Area',
        description: 'Edit stock area details.',
      ),
      AccessControlFunction(
        key: 'stock_areas.delete',
        label: 'Delete Stock Area',
        description: 'Delete stock area records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/materials',
    pageTitle: 'Product Master',
    category: 'Inventory',
    description: 'Manage product master records and material definitions.',
    functions: [
      AccessControlFunction(
        key: 'materials.view',
        label: 'View Materials',
        description: 'View product master and materials.',
      ),
      AccessControlFunction(
        key: 'materials.create',
        label: 'Create Material',
        description: 'Create material or product entries.',
      ),
      AccessControlFunction(
        key: 'materials.edit',
        label: 'Edit Material',
        description: 'Edit material or product details.',
      ),
      AccessControlFunction(
        key: 'materials.delete',
        label: 'Delete Material',
        description: 'Delete material or product entries.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/stock-transfers',
    pageTitle: 'Stock Transfers',
    category: 'Inventory',
    description: 'Track inter-location stock movement and transfer history.',
    functions: [
      AccessControlFunction(
        key: 'stock_transfers.view',
        label: 'View Transfers',
        description: 'Open stock transfer list and details.',
      ),
      AccessControlFunction(
        key: 'stock_transfers.create',
        label: 'Create Transfer',
        description: 'Create a stock transfer entry.',
      ),
      AccessControlFunction(
        key: 'stock_transfers.edit',
        label: 'Edit Transfer',
        description: 'Edit an existing stock transfer.',
      ),
      AccessControlFunction(
        key: 'stock_transfers.cancel',
        label: 'Cancel Transfer',
        description: 'Cancel or void stock transfer records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/consumption',
    pageTitle: 'Consumption',
    category: 'Inventory',
    description: 'Track material consumption and usage records.',
    functions: [
      AccessControlFunction(
        key: 'consumption.view',
        label: 'View Consumption',
        description: 'Open and review consumption records.',
      ),
      AccessControlFunction(
        key: 'consumption.create',
        label: 'Create Consumption Entry',
        description: 'Create new consumption entries.',
      ),
      AccessControlFunction(
        key: 'consumption.edit',
        label: 'Edit Consumption Entry',
        description: 'Update consumption records.',
      ),
      AccessControlFunction(
        key: 'consumption.delete',
        label: 'Delete Consumption Entry',
        description: 'Delete consumption records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/returns',
    pageTitle: 'Returns',
    category: 'Inventory',
    description: 'Manage returned material records and return lifecycle.',
    functions: [
      AccessControlFunction(
        key: 'returns.view',
        label: 'View Returns',
        description: 'Open returns page and view records.',
      ),
      AccessControlFunction(
        key: 'returns.create',
        label: 'Create Return',
        description: 'Create a new return entry.',
      ),
      AccessControlFunction(
        key: 'returns.edit',
        label: 'Edit Return',
        description: 'Edit return records.',
      ),
      AccessControlFunction(
        key: 'returns.delete',
        label: 'Delete Return',
        description: 'Delete return records.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/documents',
    pageTitle: 'Repository',
    category: 'Documents',
    description: 'Access project document repository and actions.',
    functions: [
      AccessControlFunction(
        key: 'documents.view',
        label: 'View Documents',
        description: 'Open repository and view documents.',
      ),
      AccessControlFunction(
        key: 'documents.upload',
        label: 'Upload Document',
        description: 'Upload documents to repository.',
      ),
      AccessControlFunction(
        key: 'documents.edit',
        label: 'Edit Document',
        description: 'Edit document metadata or properties.',
      ),
      AccessControlFunction(
        key: 'documents.delete',
        label: 'Delete Document',
        description: 'Delete documents from repository.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/reports',
    pageTitle: 'Reports',
    category: 'Analytics',
    description: 'Review project and operational reports.',
    functions: [
      AccessControlFunction(
        key: 'reports.view',
        label: 'View Reports',
        description: 'Open reports dashboard and read reports.',
      ),
      AccessControlFunction(
        key: 'reports.generate',
        label: 'Generate Reports',
        description: 'Generate reports from current data.',
      ),
      AccessControlFunction(
        key: 'reports.export',
        label: 'Export Reports',
        description: 'Export reports for external use.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/audit-logs',
    pageTitle: 'Audit Logs',
    category: 'Analytics',
    description: 'Review audit trails and system activity logs.',
    functions: [
      AccessControlFunction(
        key: 'audit_logs.view',
        label: 'View Audit Logs',
        description: 'Open and read audit logs.',
      ),
      AccessControlFunction(
        key: 'audit_logs.filter',
        label: 'Filter Audit Logs',
        description: 'Filter logs by user, date, or action.',
      ),
      AccessControlFunction(
        key: 'audit_logs.export',
        label: 'Export Audit Logs',
        description: 'Export audit logs for compliance checks.',
      ),
    ],
  ),
  AccessControlPage(
    pagePath: '/settings',
    pageTitle: 'Settings',
    category: 'Administration',
    description:
        'Manage settings tabs such as user management and access control.',
    functions: [
      AccessControlFunction(
        key: 'settings.user_management',
        label: 'User Management Tab',
        description: 'View and use the User Management tab in settings.',
      ),
      AccessControlFunction(
        key: 'settings.access_control',
        label: 'Access Control Tab',
        description: 'View and use the Access Control tab in settings.',
      ),
    ],
  ),
];

final accessControlPagePaths = accessControlCatalog
    .map((page) => page.pagePath)
    .toList();

final accessControlFunctionKeys = accessControlCatalog
    .expand((page) => page.functions.map((fn) => fn.key))
    .toList();
