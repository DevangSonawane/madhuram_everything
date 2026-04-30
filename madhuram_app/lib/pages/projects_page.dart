import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../services/api_client.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';

/// Projects list page with full CRUD - matches React Projects.jsx
class ProjectsPage extends StatefulWidget {
  const ProjectsPage({super.key});

  @override
  State<ProjectsPage> createState() => _ProjectsPageState();
}

class _ProjectsPageState extends State<ProjectsPage> {
  List<Map<String, dynamic>> _projects = [];
  bool _isLoading = true;
  String? _error;
  String _searchQuery = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }


  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProjects() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ApiClient.getProjects();
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final list = (data is List) ? data : <dynamic>[];
        final loaded = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        setState(() {
          _projects = loaded;
          _isLoading = false;
          _error = null;
        });
      } else {
        debugPrint('[Projects] API returned failure');
        if (!mounted) return;
        setState(() {
          _projects = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load projects';
        });
      }
    } catch (e) {
      debugPrint('[Projects] API error: $e');
      if (!mounted) return;
      setState(() {
        _projects = [];
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  List<Map<String, dynamic>> get _filteredProjects {
    if (_searchQuery.trim().isEmpty) return _projects;
    final q = _searchQuery.toLowerCase().trim();
    return _projects.where((p) {
      final name = (p['project_name'] ?? p['name'] ?? '').toString().toLowerCase();
      final client = (p['client_name'] ?? p['client'] ?? '').toString().toLowerCase();
      final location = (p['location'] ?? '').toString().toLowerCase();
      return name.contains(q) || client.contains(q) || location.contains(q);
    }).toList();
  }

  int get _totalProjects => _projects.length;
  int get _uniqueClients {
    final set = <String>{};
    for (final p in _projects) {
      final c = (p['client_name'] ?? p['client'] ?? '').toString();
      if (c.isNotEmpty) set.add(c);
    }
    return set.length;
  }

  int get _withWorkOrders =>
      _projects.where((p) => (p['work_order_file'] ?? p['work_order_file_url']) != null && (p['work_order_file'] ?? p['work_order_file_url']).toString().isNotEmpty).length;

  int get _withMasFiles =>
      _projects.where((p) => (p['mas_file'] ?? p['mas_file_url']) != null && (p['mas_file'] ?? p['mas_file_url']).toString().isNotEmpty).length;

  int _prPoCount(Map<String, dynamic> p) {
    final v = p['pr_po_tracking'];
    if (v is List) return v.length;
    if (v is int) return v;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return StoreConnector<AppState, _ProjectsViewModel>(
      distinct: true,
      converter: (store) => _ProjectsViewModel(
        isAdmin: store.state.auth.isAdmin,
        userRole: store.state.auth.userRole,
      ),
      builder: (context, vm) {
        return ProtectedRoute(
          title: 'Projects',
          route: '/projects',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Projects',
                          style: TextStyle(
                            fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                            fontWeight: FontWeight.bold,
                            color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Manage projects and view work orders',
                          style: TextStyle(
                            color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (!isMobile)
                    SizedBox(
                      width: 320,
                      child: MadSearchInput(
                        controller: _searchController,
                        hintText: 'Search projects...',
                        onChanged: (v) => setState(() => _searchQuery = v),
                        onClear: () {
                          setState(() {
                            _searchQuery = '';
                            _searchController.clear();
                          });
                        },
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              if (_isLoading)
                const Expanded(child: Center(child: CircularProgressIndicator()))
              else if (_error != null)
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
                        const SizedBox(height: 16),
                        Text(_error!, style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadProjects, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              else ...[
                // Stats cards
                LayoutBuilder(
                  builder: (context, constraints) {
                    final count = constraints.maxWidth > 900 ? 4 : (constraints.maxWidth > 600 ? 2 : 1);
                    return GridView.count(
                      crossAxisCount: count,
                      shrinkWrap: true,
                      mainAxisSpacing: 16,
                      crossAxisSpacing: 16,
                      childAspectRatio: count == 1 ? 3 : 2.2,
                      children: [
                        StatCard(
                          title: 'Total Projects',
                          value: '$_totalProjects',
                          icon: LucideIcons.briefcase,
                          iconColor: AppTheme.primaryColor,
                        ),
                        StatCard(
                          title: 'Clients',
                          value: '$_uniqueClients',
                          icon: LucideIcons.building2,
                          iconColor: const Color(0xFF22C55E),
                        ),
                        StatCard(
                          title: 'With Work Orders',
                          value: '$_withWorkOrders',
                          icon: LucideIcons.fileText,
                          iconColor: const Color(0xFFF59E0B),
                        ),
                        StatCard(
                          title: 'With MAS Files',
                          value: '$_withMasFiles',
                          icon: LucideIcons.fileCheck,
                          iconColor: const Color(0xFF8B5CF6),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 24),
                if (isMobile)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: MadSearchInput(
                      controller: _searchController,
                      hintText: 'Search projects...',
                      width: double.infinity,
                      onChanged: (v) => setState(() => _searchQuery = v),
                      onClear: () {
                        setState(() {
                          _searchQuery = '';
                          _searchController.clear();
                        });
                      },
                    ),
                  ),
                Expanded(
                  child: MadCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(20),
                          child: Text(
                            'All Projects',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                            ),
                          ),
                        ),
                        Divider(height: 1, color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                        Expanded(
                          child: isMobile
                              ? _buildMobileList(isDark, vm)
                              : _buildTable(isDark, vm),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildMobileList(bool isDark, _ProjectsViewModel vm) {
    final list = _filteredProjects;
    if (list.isEmpty) {
      return Center(
        child: Text(
          _searchQuery.isEmpty ? 'No projects' : 'No projects match your search',
          style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final p = list[index];
        return _buildMobileCard(p, isDark, vm);
      },
    );
  }

  Widget _buildMobileCard(Map<String, dynamic> p, bool isDark, _ProjectsViewModel vm) {
    final name = (p['project_name'] ?? p['name'] ?? 'Unnamed').toString();
    final client = (p['client_name'] ?? p['client'] ?? '').toString();
    final productDuration = (p['product_duration'] ?? p['start_date'] ?? '').toString();
    final hasWo = (p['work_order_file'] ?? p['work_order_file_url']) != null &&
        (p['work_order_file'] ?? p['work_order_file_url']).toString().isNotEmpty;
    final prPo = _prPoCount(p);
    final created = (p['created_at'] ?? p['start_date'] ?? '').toString();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
                PopupMenuButton<String>(
                  onSelected: (value) {
                    if (value == 'edit') _showEditDialog(p);
                    if (value == 'delete' && vm.canDelete) _showDeleteConfirm(p);
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    if (vm.canDelete) const PopupMenuItem(value: 'delete', child: Text('Delete')),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(client, style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground), overflow: TextOverflow.ellipsis),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (hasWo)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.fileText, size: 16, color: AppTheme.primaryColor),
                      const SizedBox(width: 4),
                    ],
                  ),
                if (prPo > 0) MadBadge(text: 'PR/PO $prPo', variant: BadgeVariant.secondary),
                if (productDuration.isNotEmpty)
                  Text(
                    'Duration: $productDuration',
                    style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                  ),
              ],
            ),
            if (created.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text('Created: $created', style: TextStyle(fontSize: 11, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTable(bool isDark, _ProjectsViewModel vm) {
    final list = _filteredProjects;
    if (list.isEmpty) {
      return Center(
        child: Text(
          _searchQuery.isEmpty ? 'No projects' : 'No projects match your search',
          style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
        ),
      );
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SingleChildScrollView(
        child: DataTable(
          columnSpacing: 24,
          columns: const [
            DataColumn(label: Text('Project Name')),
            DataColumn(label: Text('Client')),
            DataColumn(label: Text('Product Duration')),
            DataColumn(label: Text('Work Order')),
            DataColumn(label: Text('PR/PO Tracking')),
            DataColumn(label: Text('Created')),
            DataColumn(label: Text('Actions')),
          ],
          rows: list.map((p) {
            final name = (p['project_name'] ?? p['name'] ?? 'Unnamed').toString();
            final client = (p['client_name'] ?? p['client'] ?? '').toString();
            final productDuration = (p['product_duration'] ?? p['start_date'] ?? '-').toString();
            final hasWo = (p['work_order_file'] ?? p['work_order_file_url']) != null &&
                (p['work_order_file'] ?? p['work_order_file_url']).toString().isNotEmpty;
            final prPo = _prPoCount(p);
            final created = (p['created_at'] ?? p['start_date'] ?? '-').toString();

            return DataRow(
              cells: [
                DataCell(Text(name, overflow: TextOverflow.ellipsis)),
                DataCell(Text(client, overflow: TextOverflow.ellipsis)),
                DataCell(Text(productDuration, overflow: TextOverflow.ellipsis)),
                DataCell(
                  hasWo
                      ? InkWell(
                          onTap: () => showToast(context, 'Work order file available'),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(LucideIcons.fileText, size: 18, color: AppTheme.primaryColor),
                              const SizedBox(width: 6),
                              const Text('View', style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        )
                      : const Text('-'),
                ),
                DataCell(
                  prPo > 0
                      ? MadBadge(text: '$prPo', variant: BadgeVariant.secondary)
                      : const Text('0'),
                ),
                DataCell(Text(created, overflow: TextOverflow.ellipsis)),
                DataCell(
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      MadButton(
                        variant: ButtonVariant.outline,
                        size: ButtonSize.sm,
                        text: 'Edit',
                        onPressed: () => _showEditDialog(p),
                      ),
                      if (vm.canDelete) ...[
                        const SizedBox(width: 8),
                        MadButton(
                          variant: ButtonVariant.outline,
                          size: ButtonSize.sm,
                          text: 'Delete',
                          onPressed: () => _showDeleteConfirm(p),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  void _showEditDialog(Map<String, dynamic> p) {
    final projectId = (p['project_id'] ?? p['id'] ?? '').toString();
    final nameController = TextEditingController(text: (p['project_name'] ?? p['name'] ?? '').toString());
    final clientController = TextEditingController(text: (p['client_name'] ?? p['client'] ?? '').toString());
    final locationController = TextEditingController(text: (p['location'] ?? '').toString());
    final floorController = TextEditingController(text: (p['floor'] ?? '').toString());
    final estimateController = TextEditingController(text: (p['estimate_value'] ?? '').toString());
    final woNumberController = TextEditingController(text: (p['wo_number'] ?? '').toString());
    final productDurationController = TextEditingController(
      text: (p['product_duration'] ?? p['start_date'] ?? '').toString(),
    );

    MadFormDialog.show(
      context: context,
      title: 'Edit Project',
      maxWidth: 520,
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            MadInput(controller: nameController, labelText: 'Project Name', hintText: 'Project name'),
            const SizedBox(height: 16),
            MadInput(controller: clientController, labelText: 'Client Name', hintText: 'Client'),
            const SizedBox(height: 16),
            MadInput(controller: locationController, labelText: 'Location', hintText: 'Location'),
            const SizedBox(height: 16),
            MadInput(controller: floorController, labelText: 'Floor', hintText: 'Floor'),
            const SizedBox(height: 16),
            MadInput(controller: estimateController, labelText: 'Estimate Value', hintText: 'e.g. ₹1.2 Cr'),
            const SizedBox(height: 16),
            MadInput(controller: woNumberController, labelText: 'WO Number', hintText: 'Work order number'),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now(),
                  firstDate: DateTime(2000),
                  lastDate: DateTime(2030),
                );
                if (date != null && context.mounted) {
                  productDurationController.text = DateFormat('yyyy-MM-dd').format(date);
                }
              },
              child: AbsorbPointer(
                child: MadInput(
                  controller: productDurationController,
                  labelText: 'Product Duration',
                  hintText: 'Tap to select date',
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: () => Navigator.of(context).pop()),
        MadButton(
          text: 'Save',
          onPressed: () async {
            final data = {
              'project_name': nameController.text.trim(),
              'client_name': clientController.text.trim(),
              'location': locationController.text.trim(),
              'floor': floorController.text.trim(),
              'estimate_value': estimateController.text.trim(),
              'wo_number': woNumberController.text.trim(),
              'product_duration': productDurationController.text.trim(),
            };
            Navigator.of(context).pop();
            final result = await ApiClient.updateProject(projectId, data);
            if (!mounted) return;
            if (result['success'] == true) {
              showToast(context, 'Project updated');
              _loadProjects();
            } else {
              showToast(context, (result['error'] ?? 'Update failed').toString(), variant: ToastVariant.error);
            }
          },
        ),
      ],
    );
  }

  void _showDeleteConfirm(Map<String, dynamic> p) {
    final projectId = (p['project_id'] ?? p['id'] ?? '').toString();
    final name = (p['project_name'] ?? p['name'] ?? 'Project').toString();

    MadDialog.confirm(
      context: context,
      title: 'Delete Project',
      description: 'Are you sure you want to delete "$name"? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    ).then((confirmed) async {
      if (!confirmed || !mounted) return;
      final result = await ApiClient.deleteProject(projectId);
      if (!mounted) return;
      if (result['success'] == true) {
        showToast(context, 'Project deleted');
        _loadProjects();
      } else {
        showToast(context, (result['error'] ?? 'Delete failed').toString(), variant: ToastVariant.error);
      }
    });
  }
}

class _ProjectsViewModel {
  final bool isAdmin;
  final String? userRole;

  _ProjectsViewModel({required this.isAdmin, this.userRole});

  bool get canDelete => isAdmin || userRole == 'project_manager';

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is _ProjectsViewModel &&
            isAdmin == other.isAdmin &&
            userRole == other.userRole;
  }

  @override
  int get hashCode => Object.hash(isAdmin, userRole);
}
