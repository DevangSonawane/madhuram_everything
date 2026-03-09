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
];

final accessControlPagePaths = accessControlCatalog
    .map((page) => page.pagePath)
    .toList();

final accessControlFunctionKeys = accessControlCatalog
    .expand((page) => page.functions.map((fn) => fn.key))
    .toList();
