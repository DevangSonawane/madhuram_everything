import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/mir.dart';
import '../pages/mir_create_page.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

/// MIR list page aligned with React MIR list flow.
class MIRPageFull extends StatefulWidget {
  const MIRPageFull({super.key});

  @override
  State<MIRPageFull> createState() => _MIRPageFullState();
}

class _MIRPageFullState extends State<MIRPageFull> {
  bool _isLoading = true;
  String? _error;
  List<MIR> _mirs = [];

  final _searchController = TextEditingController();
  String _searchQuery = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;
  String? _deletingMirId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadMIRs();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadMIRs() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final store = StoreProvider.of<AppState>(context);
    final projectId =
        store.state.project.selectedProject?['project_id']?.toString() ??
        store.state.project.selectedProjectId ??
        '';

    if (projectId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _mirs = [];
        _error = 'No project selected';
      });
      return;
    }

    try {
      final result = await ApiClient.getMIRsByProject(projectId);
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'] as List? ?? const [];
        setState(() {
          _mirs = data
              .whereType<Map>()
              .map((e) => MIR.fromJson(Map<String, dynamic>.from(e)))
              .toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _mirs = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load MIRs';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _mirs = [];
        _isLoading = false;
        _error = 'Failed to load MIRs';
      });
    }
  }

  List<MIR> get _filteredMIRs {
    if (_searchQuery.trim().isEmpty) return _mirs;
    final query = _searchQuery.trim().toLowerCase();
    return _mirs.where((m) {
      return m.mirReferenceNo.toLowerCase().contains(query) ||
          (m.projectName?.toLowerCase().contains(query) ?? false) ||
          (m.materialCode?.toLowerCase().contains(query) ?? false) ||
          (m.contractor?.toLowerCase().contains(query) ?? false);
    }).toList();
  }

  List<MIR> get _paginatedMIRs {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final rows = _filteredMIRs;
    if (start >= rows.length) return [];
    return rows.sublist(start, end > rows.length ? rows.length : end);
  }

  int get _totalPages {
    final pages = (_filteredMIRs.length / _itemsPerPage).ceil();
    return pages < 1 ? 1 : pages;
  }

  String _statusLabel(MIR mir) {
    if (mir.mirSubmitted == true) return 'Submitted';
    if ((mir.status ?? '').trim().isNotEmpty) return mir.status!;
    return 'Draft';
  }

  BadgeVariant _statusVariant(MIR mir) {
    final status = _statusLabel(mir).toLowerCase();
    if (status == 'submitted' || status == 'approved') {
      return BadgeVariant.default_;
    }
    if (status == 'rejected') {
      return BadgeVariant.destructive;
    }
    return BadgeVariant.secondary;
  }

  String _inspectionDate(MIR mir) {
    final value = mir.inspectionDateTime ?? mir.clientSubmissionDate;
    if (value == null || value.trim().isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return DateFormat('dd MMM yyyy').format(parsed);
  }

  Future<void> _handleDelete(MIR mir) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete MIR'),
        content: Text('Delete "${mir.mirReferenceNo}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              'Delete',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _deletingMirId = mir.id);
    final result = await ApiClient.deleteMIR(mir.id);
    if (!mounted) return;
    setState(() => _deletingMirId = null);

    if (result['success'] == true) {
      showToast(context, 'MIR deleted');
      await _loadMIRs();
      return;
    }
    showToast(context, result['error']?.toString() ?? 'Failed to delete MIR');
  }

  void _showPreview(MIR mir) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Widget row(String label, String value) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 150,
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  color: isDark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                ),
              ),
            ),
            Expanded(
              child: Text(
                value.isEmpty ? '-' : value,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      );
    }

    showDialog(
      context: context,
      builder: (context) => Dialog(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 620, maxHeight: 700),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'MIR Preview',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        row('MIR Reference No', mir.mirReferenceNo),
                        row('Project Name', mir.projectName ?? ''),
                        row('Project Code', mir.projectCode ?? ''),
                        row('Client Name', mir.clientName ?? ''),
                        row('PMC', mir.pmc ?? ''),
                        row('Contractor', mir.contractor ?? ''),
                        row('Vendor Code', mir.vendorCode ?? ''),
                        row('Material Code', mir.materialCode ?? ''),
                        row('Inspection Date', _inspectionDate(mir)),
                        row('Client Submission Date', mir.clientSubmissionDate ?? ''),
                        row('Status', _statusLabel(mir)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showEditDialog(MIR mir) {
    final mirRefController = TextEditingController(text: mir.mirRefNo);
    final materialCodeController = TextEditingController(text: mir.materialCode ?? '');
    final clientNameController = TextEditingController(text: mir.clientName ?? '');
    String? selectedStatus = mir.status;

    MadFormDialog.show(
      context: context,
      title: 'Edit MIR',
      maxWidth: 500,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MadInput(
            controller: mirRefController,
            labelText: 'MIR Reference No',
            hintText: 'MIR-XXX',
          ),
          const SizedBox(height: 16),
          MadInput(
            controller: materialCodeController,
            labelText: 'Material Code',
            hintText: 'Material code',
          ),
          const SizedBox(height: 16),
          MadInput(
            controller: clientNameController,
            labelText: 'Client Name',
            hintText: 'Client name',
          ),
          const SizedBox(height: 16),
          MadSelect<String>(
            labelText: 'Status',
            value: selectedStatus,
            placeholder: 'Select status',
            options: const [
              MadSelectOption(value: 'Pending', label: 'Pending'),
              MadSelectOption(value: 'Approved', label: 'Approved'),
              MadSelectOption(value: 'Rejected', label: 'Rejected'),
            ],
            onChanged: (value) => selectedStatus = value,
          ),
        ],
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () {
            mirRefController.dispose();
            materialCodeController.dispose();
            clientNameController.dispose();
            Navigator.pop(context);
          },
        ),
        MadButton(
          text: 'Save',
          onPressed: () async {
            final data = <String, dynamic>{
              'mir_refrence_no': mirRefController.text.trim(),
              'material_code': materialCodeController.text.trim().isEmpty
                  ? null
                  : materialCodeController.text.trim(),
              'client_name': clientNameController.text.trim().isEmpty
                  ? null
                  : clientNameController.text.trim(),
              'status': selectedStatus ?? mir.status,
            };
            mirRefController.dispose();
            materialCodeController.dispose();
            clientNameController.dispose();
            Navigator.pop(context);

            final result = await ApiClient.updateMIR(mir.id, data);
            if (!mounted) return;
            if (result['success'] == true) {
              showToast(context, 'MIR updated');
              await _loadMIRs();
            } else {
              showToast(context, result['error']?.toString() ?? 'Failed to update MIR');
            }
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Material Inspection Request',
      route: '/mir',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.all(isMobile ? 16 : 24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
              ),
              gradient: LinearGradient(
                colors: isDark
                    ? const [Color(0xFF0F172A), Color(0xFF111827), Color(0xFF1E293B)]
                    : const [Color(0xFFECFEFF), Color(0xFFE0F2FE), Colors.white],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
            ),
            child: Flex(
              direction: isMobile ? Axis.vertical : Axis.horizontal,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: isMobile ? CrossAxisAlignment.start : CrossAxisAlignment.end,
              children: [
                Expanded(
                  flex: isMobile ? 0 : 1,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Create MIR',
                        style: TextStyle(
                          fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Create and manage material inspection reports.',
                        style: TextStyle(
                          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
                if (isMobile) const SizedBox(height: 12),
                MadButton(
                  text: 'Create MIR',
                  icon: LucideIcons.plus,
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const MIRCreatePage(),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: MadCard(
              child: Column(
                children: [
                  Container(
                    padding: EdgeInsets.fromLTRB(isMobile ? 16 : 20, 18, isMobile ? 16 : 20, 14),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withValues(alpha: 0.55),
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'MIR List',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                              ),
                            ),
                            Text(
                              '${_filteredMIRs.length} records',
                              style: TextStyle(
                                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _buildMetricPill(
                              isDark: isDark,
                              icon: LucideIcons.fileSearch,
                              label: 'Total',
                              value: _mirs.length.toString(),
                            ),
                            _buildMetricPill(
                              isDark: isDark,
                              icon: LucideIcons.send,
                              label: 'Submitted',
                              value: _mirs.where((m) => _statusLabel(m) == 'Submitted').length.toString(),
                            ),
                            _buildMetricPill(
                              isDark: isDark,
                              icon: LucideIcons.filePenLine,
                              label: 'Draft',
                              value: _mirs.where((m) => _statusLabel(m) == 'Draft').length.toString(),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            SizedBox(
                              width: isMobile ? double.infinity : 360,
                              child: MadSearchInput(
                                controller: _searchController,
                                hintText: 'Search by MIR no, project, material, contractor...',
                                onChanged: (v) => setState(() {
                                  _searchQuery = v;
                                  _currentPage = 1;
                                }),
                                onClear: () => setState(() {
                                  _searchQuery = '';
                                  _currentPage = 1;
                                }),
                              ),
                            ),
                            MadButton(
                              text: 'Refresh',
                              icon: LucideIcons.refreshCw,
                              variant: ButtonVariant.outline,
                              onPressed: _loadMIRs,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: _isLoading
                        ? const Center(child: CircularProgressIndicator())
                        : _error != null
                            ? _buildErrorState(isDark, _error!)
                            : _filteredMIRs.isEmpty
                                ? _buildEmptyState(isDark)
                                : Column(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                                        decoration: BoxDecoration(
                                          color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                                              .withValues(alpha: 0.3),
                                        ),
                                        child: Row(
                                          children: [
                                            _buildHeaderCell('MIR No', flex: 2, isDark: isDark),
                                            if (!isMobile) _buildHeaderCell('Project', flex: 2, isDark: isDark),
                                            _buildHeaderCell('Material', flex: 2, isDark: isDark),
                                            if (!isMobile) _buildHeaderCell('Inspection Date', flex: 2, isDark: isDark),
                                            _buildHeaderCell('Status', flex: 1, isDark: isDark),
                                            SizedBox(width: isMobile ? 48 : 260),
                                          ],
                                        ),
                                      ),
                                      Expanded(
                                        child: ListView.separated(
                                          itemCount: _paginatedMIRs.length,
                                          separatorBuilder: (_, index) => Divider(
                                            height: 1,
                                            color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                                                .withValues(alpha: 0.5),
                                          ),
                                          itemBuilder: (context, index) {
                                            final mir = _paginatedMIRs[index];
                                            final statusText = _statusLabel(mir);
                                            final statusVariant = _statusVariant(mir);
                                            final isDeleting = _deletingMirId == mir.id;

                                            return Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                                              child: Row(
                                                children: [
                                                  Expanded(
                                                    flex: 2,
                                                    child: Text(
                                                      mir.mirReferenceNo.isEmpty ? 'MIR-${mir.id}' : mir.mirReferenceNo,
                                                      style: const TextStyle(
                                                        fontWeight: FontWeight.w600,
                                                        fontFamily: 'monospace',
                                                      ),
                                                      overflow: TextOverflow.ellipsis,
                                                      maxLines: 1,
                                                    ),
                                                  ),
                                                  if (!isMobile)
                                                    Expanded(
                                                      flex: 2,
                                                      child: Text(
                                                        mir.projectName?.isNotEmpty == true ? mir.projectName! : '-',
                                                        overflow: TextOverflow.ellipsis,
                                                        maxLines: 1,
                                                      ),
                                                    ),
                                                  Expanded(
                                                    flex: 2,
                                                    child: Text(
                                                      mir.materialCode ?? '-',
                                                      style: const TextStyle(fontWeight: FontWeight.w500),
                                                      overflow: TextOverflow.ellipsis,
                                                      maxLines: 1,
                                                    ),
                                                  ),
                                                  if (!isMobile)
                                                    Expanded(
                                                      flex: 2,
                                                      child: Text(
                                                        _inspectionDate(mir),
                                                        overflow: TextOverflow.ellipsis,
                                                        maxLines: 1,
                                                      ),
                                                    ),
                                                  Expanded(
                                                    flex: 1,
                                                    child: MadBadge(text: statusText, variant: statusVariant),
                                                  ),
                                                  if (isMobile)
                                                    MadDropdownMenuButton(
                                                      items: [
                                                        MadMenuItem(
                                                          label: 'Preview',
                                                          icon: LucideIcons.eye,
                                                          onTap: () => _showPreview(mir),
                                                        ),
                                                        MadMenuItem(
                                                          label: 'Edit',
                                                          icon: LucideIcons.pencil,
                                                          onTap: () => _showEditDialog(mir),
                                                        ),
                                                        MadMenuItem(
                                                          label: isDeleting ? 'Deleting...' : 'Delete',
                                                          icon: LucideIcons.trash2,
                                                          destructive: true,
                                                          disabled: isDeleting,
                                                          onTap: () => _handleDelete(mir),
                                                        ),
                                                      ],
                                                    )
                                                  else
                                                    Row(
                                                      children: [
                                                        MadButton(
                                                          text: 'Preview',
                                                          icon: LucideIcons.eye,
                                                          size: ButtonSize.sm,
                                                          variant: ButtonVariant.outline,
                                                          onPressed: () => _showPreview(mir),
                                                        ),
                                                        const SizedBox(width: 8),
                                                        MadButton(
                                                          text: 'Edit',
                                                          icon: LucideIcons.pencil,
                                                          size: ButtonSize.sm,
                                                          variant: ButtonVariant.outline,
                                                          onPressed: () => _showEditDialog(mir),
                                                        ),
                                                        const SizedBox(width: 8),
                                                        MadButton(
                                                          text: isDeleting ? 'Deleting...' : 'Delete',
                                                          icon: LucideIcons.trash2,
                                                          size: ButtonSize.sm,
                                                          variant: ButtonVariant.destructive,
                                                          loading: isDeleting,
                                                          disabled: isDeleting,
                                                          onPressed: () => _handleDelete(mir),
                                                        ),
                                                      ],
                                                    ),
                                                ],
                                              ),
                                            );
                                          },
                                        ),
                                      ),
                                      if (_totalPages > 1) _buildPagination(isDark),
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

  Widget _buildMetricPill({
    required bool isDark,
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.55),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withValues(alpha: 0.7),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
          ),
          const SizedBox(width: 6),
          Text(
            '$label: $value',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
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

  Widget _buildPagination(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withValues(alpha: 0.5),
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Page $_currentPage of $_totalPages',
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
              const SizedBox(width: 8),
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
              LucideIcons.fileSearch,
              size: 64,
              color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withValues(alpha: 0.3),
            ),
            const SizedBox(height: 24),
            Text(
              'No MIR records found.',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 16),
            MadButton(
              text: 'Create MIR',
              icon: LucideIcons.plus,
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const MIRCreatePage(),
                ),
              ),
            ),
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
              color: Colors.red.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load MIRs',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 24),
            MadButton(
              text: 'Retry',
              icon: LucideIcons.refreshCw,
              onPressed: _loadMIRs,
            ),
          ],
        ),
      ),
    );
  }
}
