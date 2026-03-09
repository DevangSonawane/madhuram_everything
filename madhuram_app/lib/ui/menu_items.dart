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

/// Menu items matching React's menuItems.js exactly with same icons
const menuItems = <MenuItem>[
  // Main
  MenuItem(
    title: 'Dashboard',
    route: '/dashboard',
    category: _main,
    icon: LucideIcons.layoutDashboard,
  ),

  // Project Management
  MenuItem(
    title: 'Projects',
    route: '/projects',
    category: _projectManagement,
    icon: LucideIcons.briefcase,
  ),
  MenuItem(
    title: 'BOQ Management',
    route: '/boq',
    category: _projectManagement,
    icon: LucideIcons.clipboardList,
  ),
  MenuItem(
    title: 'MAS',
    route: '/mas',
    category: _projectManagement,
    icon: Icons.check_box_outlined,
  ),

  // Procurement
  MenuItem(
    title: 'Sample Management',
    route: '/samples',
    category: _procurement,
    icon: LucideIcons.layers,
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
];

/// Get menu items grouped by category
List<MenuCategory> getMenuCategories({Map<String, dynamic>? user}) {
  final categories = <String, List<MenuItem>>{};
  for (final item in menuItems) {
    if (item.hidden || !hasPageAccess(user, item.route)) {
      continue;
    }
    categories.putIfAbsent(item.category, () => []).add(item);
  }
  return categories.entries
      .map((e) => MenuCategory(name: e.key, items: e.value))
      .toList();
}
