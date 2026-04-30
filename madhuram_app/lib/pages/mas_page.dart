import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter_redux/flutter_redux.dart';
import '../theme/app_theme.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';
import '../store/app_state.dart';

/// Material Approval Sheet item (client approval workflow)
class MASItem {
  final String id;
  final String itemCode;
  final String itemName;
  final String proposedBrand;
  final String modelSpec;
  final String status; // Approved, Pending, Rejected
  final String clientRemarks;

  const MASItem({
    required this.id,
    required this.itemCode,
    required this.itemName,
    required this.proposedBrand,
    required this.modelSpec,
    required this.status,
    this.clientRemarks = '',
  });

  MASItem copyWith({
    String? id,
    String? itemCode,
    String? itemName,
    String? proposedBrand,
    String? modelSpec,
    String? status,
    String? clientRemarks,
  }) {
    return MASItem(
      id: id ?? this.id,
      itemCode: itemCode ?? this.itemCode,
      itemName: itemName ?? this.itemName,
      proposedBrand: proposedBrand ?? this.proposedBrand,
      modelSpec: modelSpec ?? this.modelSpec,
      status: status ?? this.status,
      clientRemarks: clientRemarks ?? this.clientRemarks,
    );
  }
}

/// Material Approval Sheet page - client approval workflow (matches React MAS.jsx)
class MASPageFull extends StatefulWidget {
  const MASPageFull({super.key});
  @override
  State<MASPageFull> createState() => _MASPageFullState();
}

class _MASPageFullState extends State<MASPageFull> {
  final List<MASItem> _items = [];
  String? _selectedProject;
  String _statusTab = 'all';

  List<MASItem> get _filteredItems {
    if (_statusTab == 'all') return _items;
    return _items.where((i) => i.status.toLowerCase() == _statusTab).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return StoreConnector<AppState, _MASViewModel>(
      distinct: true,
      converter: (store) => _MASViewModel(
        projects: store.state.project.projects,
        selectedProjectId: store.state.project.selectedProjectId,
      ),
      builder: (context, vm) {
        _selectedProject ??= vm.selectedProjectId;
        final projectOptions = vm.projects.map((p) {
          final id = p['id']?.toString() ?? p['project_id']?.toString() ?? '';
          final name = p['name']?.toString() ?? p['project_name']?.toString() ?? 'Project $id';
          return MadSelectOption<String>(value: id, label: name);
        }).toList();

        return ProtectedRoute(
          title: 'Material Approval Sheet',
          route: '/mas',
          child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Material Approval Sheet',
                      style: TextStyle(
                        fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Manage material specifications and client approvals.',
                      style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                    ),
                  ],
                ),
              ),
              if (!isMobile)
                MadButton(
                  text: 'Submit to Client',
                  icon: LucideIcons.send,
                  onPressed: null,
                ),
            ],
          ),
          const SizedBox(height: 24),

          MadCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Text('Select Project:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                  const SizedBox(width: 12),
                  if (isMobile)
                    Expanded(
                      child: MadSelect<String>(
                        value: _selectedProject,
                        options: projectOptions,
                        onChanged: (v) => setState(() => _selectedProject = v),
                      ),
                    )
                  else
                    SizedBox(
                      width: 280,
                      child: MadSelect<String>(
                        value: _selectedProject,
                        options: projectOptions,
                        onChanged: (v) => setState(() => _selectedProject = v),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          MadTabsList(
            tabs: const ['All Items', 'Approved', 'Pending', 'Rejected'],
            selectedTab: _statusTab == 'all' ? 'All Items' : _statusTab == 'approved' ? 'Approved' : _statusTab == 'pending' ? 'Pending' : 'Rejected',
            onTabChanged: (tab) {
              setState(() {
                _statusTab = tab == 'All Items' ? 'all' : tab.toLowerCase();
              });
            },
          ),
          const SizedBox(height: 16),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (isMobile)
                MadButton(
                  text: 'Submit to Client',
                  icon: LucideIcons.send,
                  onPressed: null,
                ),
              MadButton(
                text: 'Add Item',
                icon: LucideIcons.plus,
                variant: ButtonVariant.outline,
                onPressed: null,
              ),
            ],
          ),
          const SizedBox(height: 16),

          Expanded(
            child: _filteredItems.isEmpty
                ? _buildEmptyState(isDark)
                : MadCard(
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(0.3),
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                          ),
                          child: Row(
                            children: [
                              _buildHeaderCell('Item Code', flex: 1, isDark: isDark),
                              _buildHeaderCell('Item Name', flex: 1, isDark: isDark),
                              if (!isMobile) ...[
                                _buildHeaderCell('Proposed Brand', flex: 1, isDark: isDark),
                                _buildHeaderCell('Model/Spec', flex: 1, isDark: isDark),
                              ],
                              _buildHeaderCell('Status', flex: 1, isDark: isDark),
                              if (!isMobile) _buildHeaderCell('Client Remarks', flex: 1, isDark: isDark),
                              const SizedBox(width: 48),
                            ],
                          ),
                        ),
                        Expanded(
                          child: ListView.separated(
                            itemCount: _filteredItems.length,
                            separatorBuilder: (_, _) => Divider(height: 1, color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5)),
                            itemBuilder: (context, index) => _buildTableRow(_filteredItems[index], isDark, isMobile),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
        );
      },
    );
  }

  Widget _buildHeaderCell(String text, {required int flex, required bool isDark}) {
    return Expanded(
      flex: flex,
      child: Text(
        text,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
      ),
    );
  }

  Widget _buildStatusBadge(String status, bool isDark) {
    BadgeVariant variant;
    IconData? icon;
    switch (status) {
      case 'Approved':
        variant = BadgeVariant.success;
        icon = LucideIcons.circleCheck;
        break;
      case 'Pending':
        variant = BadgeVariant.warning;
        icon = LucideIcons.clock;
        break;
      case 'Rejected':
        variant = BadgeVariant.destructive;
        icon = LucideIcons.circleX;
        break;
      default:
        variant = BadgeVariant.outline;
    }
    return MadBadge(
      text: status,
      variant: variant,
      icon: icon != null ? Icon(icon, size: 14) : null,
    );
  }

  Widget _buildTableRow(MASItem item, bool isDark, bool isMobile) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(flex: 1, child: Text(item.itemCode, style: const TextStyle(fontSize: 12, fontFamily: 'monospace', fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis)),
          Expanded(flex: 1, child: Text(item.itemName, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13), overflow: TextOverflow.ellipsis)),
          if (!isMobile) ...[
            Expanded(flex: 1, child: Text(item.proposedBrand, style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
            Expanded(flex: 1, child: Text(item.modelSpec, style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground), overflow: TextOverflow.ellipsis)),
          ],
          Expanded(flex: 1, child: _buildStatusBadge(item.status, isDark)),
          if (!isMobile) Expanded(flex: 1, child: Text(item.clientRemarks.isEmpty ? '-' : item.clientRemarks, style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground), overflow: TextOverflow.ellipsis)),
          MadDropdownMenuButton(
            items: [
              MadMenuItem(label: 'View Details', icon: LucideIcons.eye, onTap: () => _showViewDetails(item)),
              MadMenuItem(label: 'Edit', icon: LucideIcons.pencil, onTap: () => _showEditItemDialog(item)),
              MadMenuItem(label: 'Delete', icon: LucideIcons.trash2, destructive: true, onTap: () => _confirmDelete(item)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.fileCheck, size: 64, color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withOpacity(0.3)),
            const SizedBox(height: 24),
            Text(
              'No items in this tab',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
            ),
            const SizedBox(height: 8),
            Text(
              'Add items or switch to another status tab',
              style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddItemDialog() {
    String itemCode = '';
    String itemName = '';
    String proposedBrand = '';
    String modelSpec = '';
    String status = 'Pending';

    MadFormDialog.show(
      context: context,
      title: 'Add Item',
      maxWidth: 500,
      content: StatefulBuilder(
        builder: (context, setDialogState) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MadInput(
                labelText: 'Item Code',
                hintText: 'e.g. CPVC-001',
                onChanged: (v) => itemCode = v,
              ),
              const SizedBox(height: 16),
              MadInput(
                labelText: 'Item Name',
                hintText: 'e.g. CPVC Pipe',
                onChanged: (v) => itemName = v,
              ),
              const SizedBox(height: 16),
              MadInput(
                labelText: 'Proposed Brand',
                hintText: 'e.g. Astral',
                onChanged: (v) => proposedBrand = v,
              ),
              const SizedBox(height: 16),
              MadInput(
                labelText: 'Model/Specification',
                hintText: 'e.g. 20mm SDR-11',
                onChanged: (v) => modelSpec = v,
              ),
              const SizedBox(height: 16),
              MadSelect<String>(
                labelText: 'Status',
                value: status,
                options: const [
                  MadSelectOption(value: 'Pending', label: 'Pending'),
                  MadSelectOption(value: 'Approved', label: 'Approved'),
                  MadSelectOption(value: 'Rejected', label: 'Rejected'),
                ],
                onChanged: (v) => setDialogState(() => status = v ?? 'Pending'),
              ),
            ],
          );
        },
      ),
      actions: [
        MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
        MadButton(
          text: 'Add',
          onPressed: () {
            final maxId = _items.isEmpty ? 0 : _items.map((e) => int.tryParse(e.id) ?? 0).reduce((a, b) => a > b ? a : b);
            setState(() {
              _items.add(MASItem(
                id: (maxId + 1).toString(),
                itemCode: itemCode.isEmpty ? 'ITEM-${maxId + 1}' : itemCode,
                itemName: itemName.isEmpty ? 'New Item' : itemName,
                proposedBrand: proposedBrand,
                modelSpec: modelSpec,
                status: status,
              ));
            });
            Navigator.pop(context);
          },
        ),
      ],
    );
  }

  void _showEditItemDialog(MASItem item) {
    final codeCtrl = TextEditingController(text: item.itemCode);
    final nameCtrl = TextEditingController(text: item.itemName);
    final brandCtrl = TextEditingController(text: item.proposedBrand);
    final specCtrl = TextEditingController(text: item.modelSpec);
    final remarksCtrl = TextEditingController(text: item.clientRemarks);
    String status = item.status;

    MadFormDialog.show(
      context: context,
      title: 'Edit Item',
      maxWidth: 500,
      content: StatefulBuilder(
        builder: (context, setDialogState) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MadInput(
                labelText: 'Item Code',
                controller: codeCtrl,
                onChanged: (v) {},
              ),
              const SizedBox(height: 16),
              MadInput(
                labelText: 'Item Name',
                controller: nameCtrl,
                onChanged: (v) {},
              ),
              const SizedBox(height: 16),
              MadInput(
                labelText: 'Proposed Brand',
                controller: brandCtrl,
                onChanged: (v) {},
              ),
              const SizedBox(height: 16),
              MadInput(
                labelText: 'Model/Specification',
                controller: specCtrl,
                onChanged: (v) {},
              ),
              const SizedBox(height: 16),
              MadSelect<String>(
                labelText: 'Status',
                value: status,
                options: const [
                  MadSelectOption(value: 'Pending', label: 'Pending'),
                  MadSelectOption(value: 'Approved', label: 'Approved'),
                  MadSelectOption(value: 'Rejected', label: 'Rejected'),
                ],
                onChanged: (v) => setDialogState(() => status = v ?? status),
              ),
              const SizedBox(height: 16),
              MadTextarea(
                labelText: 'Client Remarks',
                controller: remarksCtrl,
                minLines: 2,
                onChanged: (v) {},
              ),
            ],
          );
        },
      ),
      actions: [
        MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
        MadButton(
          text: 'Save',
          onPressed: () {
            setState(() {
              final idx = _items.indexWhere((e) => e.id == item.id);
              if (idx >= 0) {
                _items[idx] = item.copyWith(
                  itemCode: codeCtrl.text,
                  itemName: nameCtrl.text,
                  proposedBrand: brandCtrl.text,
                  modelSpec: specCtrl.text,
                  status: status,
                  clientRemarks: remarksCtrl.text,
                );
              }
            });
            Navigator.pop(context);
          },
        ),
      ],
    );
  }

  void _showViewDetails(MASItem item) {
    MadDialog.show(
      context: context,
      title: 'Item Details',
      description: '${item.itemName} (${item.itemCode})',
      content: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _detailRow('Item Code', item.itemCode),
            _detailRow('Item Name', item.itemName),
            _detailRow('Proposed Brand', item.proposedBrand),
            _detailRow('Model/Spec', item.modelSpec),
            _detailRow('Status', item.status),
            _detailRow('Client Remarks', item.clientRemarks.isEmpty ? '-' : item.clientRemarks),
          ],
        ),
      ),
      actions: [MadButton(text: 'Close', onPressed: () => Navigator.pop(context))],
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 120, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }

  void _confirmDelete(MASItem item) {
    MadDialog.confirm(
      context: context,
      title: 'Delete Item',
      description: 'Remove "${item.itemName}" from the approval sheet?',
      confirmText: 'Delete',
      destructive: true,
    ).then((ok) {
      if (ok == true && mounted) setState(() => _items.removeWhere((e) => e.id == item.id));
    });
  }
}

class _MASViewModel {
  final List<Map<String, dynamic>> projects;
  final String? selectedProjectId;

  _MASViewModel({
    required this.projects,
    required this.selectedProjectId,
  });

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is _MASViewModel &&
            projects == other.projects &&
            selectedProjectId == other.selectedProjectId;
  }

  @override
  int get hashCode => Object.hash(projects, selectedProjectId);
}
