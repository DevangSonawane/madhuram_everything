import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../utils/access_control.dart';

/// Menu item model matching React's menuItems.js exactly
class MenuItem {
  final String title;
  final String route;
  final String category;
  final IconData icon;
  final bool hidden;

  const MenuItem({
    required this.title,
    required this.route,
    required this.category,
    required this.icon,
    this.hidden = false,
  });
}

/// Menu category model
class MenuCategory {
  final String name;
  final List<MenuItem> items;

  const MenuCategory({required this.name, required this.items});
}

// Category constants matching React
const _main = 'Main';
const _projectManagement = 'Project Management';
const _procurement = 'Procurement';
const _deliveryInspection = 'Delivery & Inspection';
const _billing = 'Billing';
const _inventory = 'Inventory';
const _documents = 'Documents';
const _analytics = 'Analytics';

/// Menu items matching React's menuItems.js exactly with same icons
const menuItems = <MenuItem>[
  // Main
  MenuItem(
    title: 'Dashboard',
    route: '/dashboard',
    category: _main,
    icon: LucideIcons.layoutDashboard,
  ),
  MenuItem(
    title: 'Attendance',
    route: '/attendance',
    category: _main,
    icon: LucideIcons.userCheck,
  ),

  // Project Management
  MenuItem(
    title: 'Projects',
    route: '/projects',
    category: _projectManagement,
    icon: LucideIcons.briefcase,
  ),
  // MenuItem(
  //   title: 'BOQ Management',
  //   route: '/boq',
  //   category: _projectManagement,
  //   icon: LucideIcons.clipboardList,
  // ),
  // MenuItem(
  //   title: 'MAS',
  //   route: '/mas',
  //   category: _projectManagement,
  //   icon: Icons.check_box_outlined,
  // ),

  // Procurement
  MenuItem(
    title: 'Sample Management',
    route: '/samples',
    category: _procurement,
    icon: LucideIcons.layers,
  ),
  MenuItem(
    title: 'Purchase Requests',
    route: '/purchase-requests',
    category: _procurement,
    icon: LucideIcons.shoppingCart,
    hidden: false,
  ),
  MenuItem(
    title: 'Vendor Comparison',
    route: '/vendor-comparison',
    category: _procurement,
    icon: LucideIcons.arrowRightLeft,
  ),
  MenuItem(
    title: 'Purchase Orders',
    route: '/purchase-orders',
    category: _procurement,
    icon: LucideIcons.fileText,
  ),
  MenuItem(
    title: 'Vendors',
    route: '/vendors',
    category: _procurement,
    icon: LucideIcons.users,
  ),

  // Delivery & Inspection
  MenuItem(
    title: 'Delivery Challans',
    route: '/challans',
    category: _deliveryInspection,
    icon: LucideIcons.truck,
  ),
  MenuItem(
    title: 'MER',
    route: '/mer',
    category: _deliveryInspection,
    icon: LucideIcons.fileCheck,
    hidden: true,
  ),
  MenuItem(
    title: 'MIR',
    route: '/mir',
    category: _deliveryInspection,
    icon: LucideIcons.eye,
    hidden: false,
  ),
  MenuItem(
    title: 'ITR',
    route: '/itr',
    category: _deliveryInspection,
    icon: LucideIcons.hammer,
    hidden: false,
  ),

  // Billing
  MenuItem(
    title: 'Billing & Invoices',
    route: '/billing',
    category: _billing,
    icon: LucideIcons.receipt,
    hidden: true,
  ),

  // Inventory
  MenuItem(
    title: 'Inventory',
    route: '/inventory',
    category: _inventory,
    icon: LucideIcons.warehouse,
    hidden: true,
  ),
  MenuItem(
    title: 'Stock Overview',
    route: '/stock-areas',
    category: _inventory,
    icon: LucideIcons.warehouse,
    hidden: true,
  ),
  MenuItem(
    title: 'Product Master',
    route: '/materials',
    category: _inventory,
    icon: LucideIcons.package,
    hidden: true,
  ),
  MenuItem(
    title: 'Stock Transfers',
    route: '/stock-transfers',
    category: _inventory,
    icon: LucideIcons.arrowRightLeft,
    hidden: true,
  ),
  MenuItem(
    title: 'Consumption',
    route: '/consumption',
    category: _inventory,
    icon: LucideIcons.trendingDown,
    hidden: true,
  ),
  MenuItem(
    title: 'Returns',
    route: '/returns',
    category: _inventory,
    icon: LucideIcons.undo2,
    hidden: true,
  ),

  // Documents
  MenuItem(
    title: 'Repository',
    route: '/documents',
    category: _documents,
    icon: LucideIcons.folderOpen,
    hidden: true,
  ),

  // Analytics
  MenuItem(
    title: 'Reports',
    route: '/reports',
    category: _analytics,
    icon: Icons.bar_chart,
    hidden: true,
  ),
  MenuItem(
    title: 'Audit Logs',
    route: '/audit-logs',
    category: _analytics,
    icon: LucideIcons.history,
    hidden: true,
  ),
];

/// Get menu items grouped by category
List<MenuCategory> getMenuCategories({Map<String, dynamic>? user}) {
  final categories = <String, List<MenuItem>>{};
  for (final item in menuItems) {
    if (item.hidden || !hasRouteAccess(user, item.route)) {
      continue;
    }
    categories.putIfAbsent(item.category, () => []).add(item);
  }
  return categories.entries
      .map((e) => MenuCategory(name: e.key, items: e.value))
      .toList();
}
