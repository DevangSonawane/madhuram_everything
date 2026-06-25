import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../services/api_client.dart';
import '../models/stock_area.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';
import '../utils/riverpod_context.dart';

/// Returns management page matching React's Returns page
class ReturnsPage extends StatefulWidget {
  const ReturnsPage({super.key});

  @override
  State<ReturnsPage> createState() => _ReturnsPageState();
}

class _ReturnsPageState extends State<ReturnsPage> {
  bool _isLoading = false;
  String? _error;
  List<Return> _returns = [];
  String _searchQuery = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;
  final _searchController = TextEditingController();
  String? _statusFilter;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadReturns();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadReturns() async {
    final projectId = context.appProject.selectedProjectId ?? '';

    if (projectId.isEmpty) {
      setState(() {
        _returns = [];
        _isLoading = false;
        _error = 'No project selected';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ApiClient.getReturns(projectId);

      if (!mounted) return;

      if (result['success'] == true) {
        final data = result['data'] as List;
        final loaded = data.map((e) => Return.fromJson(e)).toList();
        setState(() {
          _returns = loaded;
          _isLoading = false;
        });
      } else {
        setState(() {
          _returns = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load returns';
        });
      }
    } catch (e) {
      debugPrint('[Returns] API error: $e');
      if (!mounted) return;
      setState(() {
        _returns = [];
        _isLoading = false;
        _error = 'Failed to load returns';
      });
    }
  }

  List<Return> get _filteredReturns {
    List<Return> result = _returns;

    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result.where((r) {
        return r.material.toLowerCase().contains(query) ||
            r.reason.toLowerCase().contains(query);
      }).toList();
    }

    if (_statusFilter != null) {
      result = result.where((r) => r.status == _statusFilter).toList();
    }

    return result;
  }

  List<Return> get _paginatedReturns {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final filtered = _filteredReturns;
    if (start >= filtered.length) return [];
    return filtered.sublist(start, end > filtered.length ? filtered.length : end);
  }

  int get _totalPages => (_filteredReturns.length / _itemsPerPage).ceil();

  static const _warehouses = ['Main Warehouse', 'Secondary Store', 'Overflow Storage'];
  static const _zonesByWarehouse = <String, List<String>>{
    'Main Warehouse': ['Zone A', 'Zone B'],
    'Secondary Store': ['Zone C'],
    'Overflow Storage': ['Zone D'],
  };

  int get _processedTodayCount {
    final today = DateTime.now();
    final todayStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    return _returns.where((r) => r.status == 'Approved' && r.date == todayStr).length;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Returns',
      route: '/returns',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Returns',
                      style: TextStyle(
                        fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Manage material returns and refunds',
                      style: TextStyle(
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isMobile)
                MadButton(
                  text: 'New Return',
                  icon: LucideIcons.packageX,
                  onPressed: () => _showReturnDialog(),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // Stats cards: Pending Inspection, Processed Today, Rejected Returns
          if (!isMobile)
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Pending Inspection',
                    value: _returns.where((r) => r.status == 'Pending').length.toString(),
                    icon: LucideIcons.clock,
                    iconColor: const Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Processed Today',
                    value: _processedTodayCount.toString(),
                    icon: LucideIcons.circleCheck,
                    iconColor: const Color(0xFF22C55E),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Rejected Returns',
                    value: _returns.where((r) => r.status == 'Rejected').length.toString(),
                    icon: LucideIcons.circleX,
                    iconColor: AppTheme.lightDestructive,
                  ),
                ),
              ],
            ),
          if (!isMobile) const SizedBox(height: 24),

          // Search and filters
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              SizedBox(
                width: isMobile ? double.infinity : 320,
                child: MadSearchInput(
                  controller: _searchController,
                  hintText: 'Search returns...',
                  onChanged: (value) => setState(() {
                    _searchQuery = value;
                    _currentPage = 1;
                  }),
                  onClear: () => setState(() {
                    _searchQuery = '';
                    _currentPage = 1;
                  }),
                ),
              ),
              SizedBox(
                width: isMobile ? double.infinity : 150,
                child: MadSelect<String>(
                  value: _statusFilter,
                  placeholder: 'All Status',
                  clearable: true,
                  options: const [
                    MadSelectOption(value: 'Pending', label: 'Pending'),
                    MadSelectOption(value: 'Approved', label: 'Approved'),
                    MadSelectOption(value: 'Rejected', label: 'Rejected'),
                  ],
                  onChanged: (value) => setState(() {
                    _statusFilter = value;
                    _currentPage = 1;
                  }),
                ),
              ),
              if (isMobile)
                MadButton(
                  icon: LucideIcons.packageX,
                  text: 'Return',
                  onPressed: () => _showReturnDialog(),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // Data table
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? _buildErrorState(isDark, _error!)
                    : _filteredReturns.isEmpty
                        ? _buildEmptyState(isDark)
                        : MadCard(
                            child: Column(
                              children: [
                            // Table header
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                              decoration: BoxDecoration(
                                color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(0.3),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                              ),
                              child: Row(
                                children: [
                                  _buildHeaderCell('Date', flex: 1, isDark: isDark),
                                  _buildHeaderCell('Material', flex: 2, isDark: isDark),
                                  if (!isMobile) ...[
                                    _buildHeaderCell('Quantity', flex: 1, isDark: isDark),
                                    _buildHeaderCell('Reason', flex: 2, isDark: isDark),
                                  ],
                                  _buildHeaderCell('Status', flex: 1, isDark: isDark),
                                  const SizedBox(width: 48),
                                ],
                              ),
                            ),
                            // Table rows
                            Expanded(
                              child: ListView.separated(
                                itemCount: _paginatedReturns.length,
                                separatorBuilder: (_, __) => Divider(
                                  height: 1,
                                  color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5),
                                ),
                                itemBuilder: (context, index) {
                                  return _buildTableRow(_paginatedReturns[index], isDark, isMobile);
                                },
                              ),
                            ),
                            // Pagination
                            if (_totalPages > 1)
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  border: Border(
                                    top: BorderSide(
                                      color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5),
                                    ),
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Showing ${(_currentPage - 1) * _itemsPerPage + 1}-${_currentPage * _itemsPerPage > _filteredReturns.length ? _filteredReturns.length : _currentPage * _itemsPerPage} of ${_filteredReturns.length}',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                                      ),
                                    ),
                                    Row(
                                      children: [
                                        MadButton(
                                          icon: LucideIcons.chevronLeft,
                                          variant: ButtonVariant.outline,
                                          size: ButtonSize.sm,
                                          disabled: _currentPage == 1,
                                          onPressed: () => setState(() => _currentPage--),
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 12),
                                          child: Text('$_currentPage of $_totalPages'),
                                        ),
                                        MadButton(
                                          icon: LucideIcons.chevronRight,
                                          variant: ButtonVariant.outline,
                                          size: ButtonSize.sm,
                                          disabled: _currentPage >= _totalPages,
                                          onPressed: () => setState(() => _currentPage++),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCell(String text, {required int flex, required bool isDark}) {
    return Expanded(
      flex: flex,
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
        ),
      ),
    );
  }

  Widget _buildTableRow(Return returnItem, bool isDark, bool isMobile) {
    BadgeVariant statusVariant;
    switch (returnItem.status) {
      case 'Approved':
        statusVariant = BadgeVariant.default_;
        break;
      case 'Pending':
        statusVariant = BadgeVariant.secondary;
        break;
      case 'Rejected':
        statusVariant = BadgeVariant.destructive;
        break;
      default:
        statusVariant = BadgeVariant.outline;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          Expanded(
            flex: 1,
            child: Text(
              returnItem.date ?? '-',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(returnItem.material, style: const TextStyle(fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis),
                if (isMobile)
                  Text(
                    '${returnItem.quantity.toStringAsFixed(0)} - ${returnItem.reason}',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          if (!isMobile) ...[
            Expanded(
              flex: 1,
              child: Text(
                returnItem.quantity.toStringAsFixed(0),
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Expanded(
              flex: 2,
              child: Text(
                returnItem.reason,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
          Expanded(
            flex: 1,
            child: MadBadge(text: returnItem.status, variant: statusVariant),
          ),
          MadDropdownMenuButton(
            items: [
              MadMenuItem(label: 'View Details', icon: LucideIcons.eye, onTap: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Return: ${returnItem.material}')))),
              if (returnItem.status == 'Pending')
                MadMenuItem(label: 'Process Return', icon: LucideIcons.circleCheck, onTap: () => _showInspectionDialog(returnItem)),
              MadMenuItem(label: 'Delete', icon: LucideIcons.trash2, destructive: true, onTap: () => _confirmDeleteReturn(returnItem)),
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
            Icon(
              LucideIcons.packageX,
              size: 64,
              color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withOpacity(0.3),
            ),
            const SizedBox(height: 24),
            Text(
              _searchQuery.isEmpty ? 'No returns yet' : 'No returns found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchQuery.isEmpty
                  ? 'Create a return request for damaged or excess materials'
                  : 'Try a different search term',
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
            if (_searchQuery.isEmpty) ...[
              const SizedBox(height: 24),
              MadButton(
                text: 'New Return',
                icon: LucideIcons.packageX,
                onPressed: () => _showReturnDialog(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(bool isDark, String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red.withOpacity(0.5),
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load returns',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            MadButton(
              text: 'Retry',
              icon: LucideIcons.refreshCw,
              onPressed: _loadReturns,
            ),
          ],
        ),
      ),
    );
  }

  void _showInspectionDialog(Return returnItem) {
    final notesController = TextEditingController();
    bool approved = true;
    String? selectedWarehouse;
    String? selectedZone;

    MadFormDialog.show(
      context: context,
      title: 'Inspection',
      maxWidth: 520,
      content: StatefulBuilder(
        builder: (context, setDialogState) {
          final zoneOptions = selectedWarehouse != null
              ? (_zonesByWarehouse[selectedWarehouse] ?? [])
                  .map((z) => MadSelectOption(value: z, label: z))
                  .toList()
              : <MadSelectOption<String>>[];
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MadTextarea(
                controller: notesController,
                labelText: 'Inspection Notes',
                hintText: 'Enter inspection notes...',
                minLines: 3,
              ),
              const SizedBox(height: 20),
              Text(
                'Decision',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppTheme.darkForeground
                      : AppTheme.lightForeground,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: MadButton(
                      text: 'Approve',
                      variant: approved ? ButtonVariant.primary : ButtonVariant.outline,
                      onPressed: () => setDialogState(() => approved = true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: MadButton(
                      text: 'Reject',
                      variant: !approved ? ButtonVariant.destructive : ButtonVariant.outline,
                      onPressed: () => setDialogState(() => approved = false),
                    ),
                  ),
                ],
              ),
              if (approved) ...[
                const SizedBox(height: 20),
                MadSelect<String>(
                  labelText: 'Target Warehouse',
                  value: selectedWarehouse,
                  placeholder: 'Select warehouse',
                  options: _warehouses.map((w) => MadSelectOption(value: w, label: w)).toList(),
                  onChanged: (value) => setDialogState(() {
                    selectedWarehouse = value;
                    selectedZone = null;
                  }),
                ),
                const SizedBox(height: 16),
                MadSelect<String>(
                  labelText: 'Target Zone',
                  value: selectedZone,
                  placeholder: 'Select zone',
                  options: zoneOptions,
                  onChanged: (value) => setDialogState(() => selectedZone = value),
                ),
              ],
            ],
          );
        },
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () => Navigator.pop(context),
        ),
        MadButton(
          text: 'Complete Inspection',
          onPressed: () {
            final notes = notesController.text.trim();
            final i = _returns.indexWhere((r) => r.id == returnItem.id);
            if (i >= 0) {
              final r = _returns[i];
              final todayStr = '${DateTime.now().year}-${DateTime.now().month.toString().padLeft(2, '0')}-${DateTime.now().day.toString().padLeft(2, '0')}';
              setState(() {
                _returns[i] = r.copyWith(
                  status: approved ? 'Approved' : 'Rejected',
                  date: todayStr,
                  inspectionNotes: notes.isEmpty ? null : notes,
                  targetWarehouse: approved ? selectedWarehouse : null,
                  targetZone: approved ? selectedZone : null,
                );
              });
            }
            Navigator.pop(context);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(approved ? 'Return approved' : 'Return rejected')),
              );
            }
          },
        ),
      ],
    );
  }

  void _confirmDeleteReturn(Return returnItem) {
    MadDialog.confirm(
      context: context,
      title: 'Delete Return',
      description: 'Are you sure you want to delete this return (${returnItem.material})? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    ).then((confirmed) {
      if (confirmed != true || !mounted) return;
      setState(() => _returns.removeWhere((r) => r.id == returnItem.id));
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Return deleted')));
    });
  }

  void _showReturnDialog() {
    MadFormDialog.show(
      context: context,
      title: 'New Return Request',
      maxWidth: 500,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MadSelect<String>(
            labelText: 'Material',
            placeholder: 'Select material',
            searchable: true,
            options: const [
              MadSelectOption(value: 'cement', label: 'Cement OPC 53'),
              MadSelectOption(value: 'pvc', label: 'PVC Pipe 4"'),
              MadSelectOption(value: 'sand', label: 'River Sand'),
            ],
            onChanged: (value) {},
          ),
          const SizedBox(height: 16),
          MadInput(
            labelText: 'Quantity',
            hintText: 'Enter quantity to return',
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),
          MadSelect<String>(
            labelText: 'Reason',
            placeholder: 'Select reason',
            options: const [
              MadSelectOption(value: 'damaged', label: 'Damaged'),
              MadSelectOption(value: 'defective', label: 'Defective'),
              MadSelectOption(value: 'excess', label: 'Excess Quantity'),
              MadSelectOption(value: 'wrong', label: 'Wrong Material'),
              MadSelectOption(value: 'other', label: 'Other'),
            ],
            onChanged: (value) {},
          ),
          const SizedBox(height: 16),
          MadTextarea(
            labelText: 'Additional Details',
            hintText: 'Provide more details about the return...',
            minLines: 3,
          ),
        ],
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () => Navigator.pop(context),
        ),
        MadButton(
          text: 'Submit Return',
          onPressed: () {
            Navigator.pop(context);
            _loadReturns();
          },
        ),
      ],
    );
  }
}
