import 'dart:async';

import 'package:flutter/material.dart' hide Material;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../utils/formatters.dart';
import '../utils/responsive.dart';

class InventoryHistoryPage extends StatefulWidget {
  const InventoryHistoryPage({super.key});

  @override
  State<InventoryHistoryPage> createState() => _InventoryHistoryPageState();
}

class _InventoryHistoryPageState extends State<InventoryHistoryPage> {
  final _fromController = TextEditingController();
  final _toController = TextEditingController();
  final _inventoryIdController = TextEditingController();
  final _userIdController = TextEditingController();

  final _dateFormat = DateFormat('yyyy-MM-dd');

  Timer? _debounce;

  Map<String, dynamic>? _summary;
  List<Map<String, dynamic>> _history = [];
  Map<String, dynamic> _pagination = {
    'total': 0,
    'total_pages': 1,
    'current_page': 1,
    'has_next': false,
    'has_prev': false,
  };
  bool _loading = false;
  bool _loadingSummary = false;
  List<Map<String, dynamic>> _projects = [];
  int _page = 1;

  String _changeType = '';
  String _sourceType = '';
  String _projectId = '';

  @override
  void initState() {
    super.initState();
    _fetchProjects();
    _fetchSummary();
    _fetchHistory();
  }

  @override
  void dispose() {
    _fromController.dispose();
    _toController.dispose();
    _inventoryIdController.dispose();
    _userIdController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _fetchProjects() async {
    final res = await ApiClient.getProjects();
    if (!mounted) return;
    if (res['success'] == true && res['data'] is List) {
      setState(() {
        _projects = (res['data'] as List)
            .whereType<Map<String, dynamic>>()
            .toList();
      });
    }
  }

  Future<void> _fetchSummary() async {
    setState(() => _loadingSummary = true);
    try {
      final res = await ApiClient.getInventoryHistorySummary(
        from: _fromController.text.trim().isEmpty
            ? null
            : _fromController.text.trim(),
        to: _toController.text.trim().isEmpty
            ? null
            : _toController.text.trim(),
      );
      if (!mounted) return;
      if (res['success'] == true) {
        setState(() => _summary = res['data'] as Map<String, dynamic>?);
      }
    } finally {
      if (mounted) setState(() => _loadingSummary = false);
    }
  }

  Future<void> _fetchHistory() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.getInventoryHistory({
        'from': _fromController.text.trim(),
        'to': _toController.text.trim(),
        'change_type': _changeType,
        'source_type': _sourceType,
        'project_id': _projectId,
        'inventory_id': _inventoryIdController.text.trim(),
        'user_id': _userIdController.text.trim(),
        'page': _page,
        'limit': 20,
        'sort': 'desc',
      });
      if (!mounted) return;
      if (res['success'] != true) {
        setState(() => _history = []);
        showToast(context, res['error']?.toString() ?? 'Failed to load history.');
        return;
      }
      final payload = res['data'];
      final raw = payload is Map
          ? (payload['data'] is List ? payload['data'] as List : const [])
          : (payload is List ? payload : const []);

      final Map<String, Map<String, dynamic>> deduped = {};
      for (var i = 0; i < raw.length; i++) {
        final row = raw[i];
        if (row is! Map) continue;
        final map = Map<String, dynamic>.from(row);
        final keyParts = [
          map['inventory_id'],
          map['change_type'],
          map['stock_in'],
          map['stock_out'],
          map['balance_before'],
          map['balance_after'],
          map['source_type'],
          map['source_ref'],
          map['performed_by'],
          map['created_at'],
        ];
        final compositeKey = keyParts.map((e) => e?.toString() ?? '').join('|');
        final fallback = map['history_id']?.toString() ?? i.toString();
        final key = compositeKey.replaceAll('|', '').isNotEmpty
            ? compositeKey
            : fallback;
        deduped[key] = map;
      }

      final pagination = payload is Map
          ? (payload['pagination'] as Map<String, dynamic>? ?? {})
          : <String, dynamic>{};

      setState(() {
        _history = deduped.values.toList();
        _pagination = {
          'total': pagination['total'] ?? _history.length,
          'total_pages': pagination['total_pages'] ?? 1,
          'current_page': pagination['current_page'] ?? _page,
          'has_next': pagination['has_next'] ?? false,
          'has_prev': pagination['has_prev'] ?? _page > 1,
        };
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _updateFilter(String key, String value, {bool debounce = false}) {
    if (debounce) {
      _debounce?.cancel();
      _debounce = Timer(const Duration(milliseconds: 400), () {
        _applyFilter(key, value);
      });
      return;
    }
    _applyFilter(key, value);
  }

  void _applyFilter(String key, String value) {
    setState(() {
      switch (key) {
        case 'change_type':
          _changeType = value;
          break;
        case 'source_type':
          _sourceType = value;
          break;
        case 'project_id':
          _projectId = value;
          break;
      }
      _page = 1;
    });
    _fetchSummary();
    _fetchHistory();
  }

  void _resetFilters() {
    setState(() {
      _fromController.clear();
      _toController.clear();
      _inventoryIdController.clear();
      _userIdController.clear();
      _changeType = '';
      _sourceType = '';
      _projectId = '';
      _page = 1;
    });
    _fetchSummary();
    _fetchHistory();
  }

  Future<void> _pickDate(TextEditingController controller) async {
    final initial = _parseDate(controller.text) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    controller.text = _dateFormat.format(picked);
    _updateFilter('date', '', debounce: true);
  }

  DateTime? _parseDate(String value) {
    if (value.trim().isEmpty) return null;
    return DateTime.tryParse(value.trim());
  }

  String _formatDateTime(dynamic value) {
    if (value == null) return '-';
    if (value is DateTime) return Formatters.dateTime(value);
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    return Formatters.dateTime(parsed);
  }

  MadBadge _changeTypeBadge(String? type) {
    final key = type?.toLowerCase().trim() ?? '';
    switch (key) {
      case 'stock_in':
        return const MadBadge(text: 'Stock In', variant: BadgeVariant.success);
      case 'stock_out':
        return const MadBadge(text: 'Stock Out', variant: BadgeVariant.destructive);
      case 'adjustment':
        return const MadBadge(text: 'Adjustment', variant: BadgeVariant.warning);
      case 'created':
        return const MadBadge(text: 'Created', variant: BadgeVariant.primary);
      case 'updated':
        return const MadBadge(text: 'Updated', variant: BadgeVariant.secondary);
      case 'deleted':
        return const MadBadge(text: 'Deleted', variant: BadgeVariant.destructive);
      default:
        return MadBadge(text: type?.isNotEmpty == true ? type! : '-', variant: BadgeVariant.outline);
    }
  }

  String get _pageLabel {
    final totalPages = (_pagination['total_pages'] ?? 1).toString();
    final apiTotal = _pagination['total'] ?? _history.length;
    final totalRecords = _history.isNotEmpty && _history.length < apiTotal
        ? _history.length
        : apiTotal;
    final current = _pagination['current_page'] ?? _page;
    return 'Page $current of $totalPages | Total $totalRecords records';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final overall = (_summary?['overall'] as Map?) ?? _summary ?? {};

    return ProtectedRoute(
      title: 'Inventory History',
      route: '/projects/inventory/history',
      headerLeadingIcon: LucideIcons.arrowLeft,
      onHeaderLeadingPressed: () => Navigator.pop(context),
      requireProject: false,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Inventory History',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: isDark
                              ? AppTheme.darkForeground
                              : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Audit trail of inventory movements, updates, and adjustments.',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(
              height: responsive.value(mobile: 14, tablet: 16, desktop: 20),
            ),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: responsive.value(mobile: 2, tablet: 2, desktop: 5),
              crossAxisSpacing: responsive.value(mobile: 8, tablet: 10, desktop: 14),
              mainAxisSpacing: responsive.value(mobile: 8, tablet: 10, desktop: 14),
              childAspectRatio: responsive.value(mobile: 1.8, tablet: 2.0, desktop: 2.2),
              children: _loadingSummary
                  ? [
                      MadCard(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text(
                            'Loading summary...',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                        ),
                      ),
                    ]
                  : [
                      _summaryTile(
                        title: 'Total Events',
                        value: overall['total_events'] ?? 0,
                        isDark: isDark,
                      ),
                      _summaryTile(
                        title: 'Stock In',
                        value: overall['total_stock_in'] ?? 0,
                        isDark: isDark,
                      ),
                      _summaryTile(
                        title: 'Stock Out',
                        value: overall['total_stock_out'] ?? 0,
                        isDark: isDark,
                      ),
                      _summaryTile(
                        title: 'Items Affected',
                        value: overall['unique_items'] ?? overall['items_affected'] ?? 0,
                        isDark: isDark,
                      ),
                      _summaryTile(
                        title: 'Active Users',
                        value: overall['unique_users'] ?? 0,
                        isDark: isDark,
                      ),
                    ],
            ),
            SizedBox(
              height: responsive.value(mobile: 14, tablet: 16, desktop: 20),
            ),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Filters',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            _DateField(
                              controller: _fromController,
                              label: 'From',
                              onTap: () => _pickDate(_fromController),
                            ),
                            Text(
                              'to',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark
                                    ? AppTheme.darkMutedForeground
                                    : AppTheme.lightMutedForeground,
                              ),
                            ),
                            _DateField(
                              controller: _toController,
                              label: 'To',
                              onTap: () => _pickDate(_toController),
                            ),
                          ],
                        ),
                        SizedBox(
                          width: 160,
                          child: MadInput(
                            controller: _inventoryIdController,
                            hintText: 'Inventory ID',
                            onChanged: (value) =>
                                _updateFilter('inventory_id', value),
                          ),
                        ),
                        SizedBox(
                          width: 200,
                          child: MadInput(
                            controller: _userIdController,
                            hintText: 'User ID',
                            onChanged: (value) =>
                                _updateFilter('user_id', value),
                          ),
                        ),
                        SizedBox(
                          width: 180,
                          child: MadSelect<String>(
                            value: _changeType.isEmpty ? 'all' : _changeType,
                            options: const [
                              MadSelectOption(value: 'all', label: 'All'),
                              MadSelectOption(value: 'stock_in', label: 'Stock In'),
                              MadSelectOption(value: 'stock_out', label: 'Stock Out'),
                              MadSelectOption(value: 'adjustment', label: 'Adjustment'),
                              MadSelectOption(value: 'created', label: 'Created'),
                              MadSelectOption(value: 'updated', label: 'Updated'),
                              MadSelectOption(value: 'deleted', label: 'Deleted'),
                            ],
                            onChanged: (value) => _updateFilter(
                              'change_type',
                              value == 'all' ? '' : (value ?? ''),
                            ),
                          ),
                        ),
                        SizedBox(
                          width: 180,
                          child: MadSelect<String>(
                            value: _sourceType.isEmpty ? 'all' : _sourceType,
                            options: const [
                              MadSelectOption(value: 'all', label: 'All'),
                              MadSelectOption(value: 'dc', label: 'DC'),
                              MadSelectOption(value: 'po', label: 'PO'),
                              MadSelectOption(value: 'pr', label: 'PR'),
                              MadSelectOption(value: 'sample', label: 'Sample'),
                              MadSelectOption(value: 'mir', label: 'MIR'),
                              MadSelectOption(value: 'manual', label: 'Manual'),
                            ],
                            onChanged: (value) => _updateFilter(
                              'source_type',
                              value == 'all' ? '' : (value ?? ''),
                            ),
                          ),
                        ),
                        SizedBox(
                          width: 210,
                          child: MadSelect<String>(
                            value: _projectId.isEmpty ? 'all' : _projectId,
                            options: [
                              const MadSelectOption(
                                value: 'all',
                                label: 'All Projects',
                              ),
                              ..._projects.map(
                                (project) => MadSelectOption(
                                  value: (project['project_id'] ?? project['id'])
                                      .toString(),
                                  label: project['project_name']?.toString() ??
                                      project['name']?.toString() ??
                                      'Project ${project['project_id'] ?? project['id']}',
                                ),
                              ),
                            ],
                            onChanged: (value) => _updateFilter(
                              'project_id',
                              value == 'all' ? '' : (value ?? ''),
                            ),
                          ),
                        ),
                        MadButton(
                          text: 'Reset Filters',
                          variant: ButtonVariant.outline,
                          onPressed: _resetFilters,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(
              height: responsive.value(mobile: 14, tablet: 16, desktop: 20),
            ),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'History',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 12),
                    if (_loading)
                      _emptyMessage('Loading history...', isDark)
                    else if (_history.isEmpty)
                      _emptyMessage('No history records found.', isDark)
                    else
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: DataTable(
                          columns: const [
                            DataColumn(label: Text('Date')),
                            DataColumn(label: Text('Item')),
                            DataColumn(label: Text('Type')),
                            DataColumn(label: Text('Stock In')),
                            DataColumn(label: Text('Stock Out')),
                            DataColumn(label: Text('Balance After')),
                            DataColumn(label: Text('Source')),
                            DataColumn(label: Text('Performed By')),
                          ],
                          rows: _history.map((row) {
                            final itemName =
                                row['item_name'] ?? row['name'] ?? '-';
                            final itemBrand =
                                row['item_brand'] ?? row['brand'] ?? '-';
                            final sourceType = row['source_type']?.toString();
                            final sourceRef = row['source_ref']?.toString();
                            final sourceLabel = sourceType == null
                                ? '-'
                                : '${sourceType.toUpperCase()}: ${sourceRef ?? '-'}';
                            return DataRow(
                              cells: [
                                DataCell(Text(
                                  _formatDateTime(row['created_at']),
                                  style: const TextStyle(fontSize: 12),
                                )),
                                DataCell(
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        itemName.toString(),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      Text(
                                        itemBrand.toString(),
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: isDark
                                              ? AppTheme.darkMutedForeground
                                              : AppTheme.lightMutedForeground,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                DataCell(_changeTypeBadge(
                                  row['change_type']?.toString(),
                                )),
                                DataCell(Text(
                                  (row['stock_in'] == null ||
                                          row['stock_in'].toString() == '0')
                                      ? '-'
                                      : row['stock_in'].toString(),
                                )),
                                DataCell(Text(
                                  (row['stock_out'] == null ||
                                          row['stock_out'].toString() == '0')
                                      ? '-'
                                      : row['stock_out'].toString(),
                                )),
                                DataCell(Text(
                                  row['balance_after']?.toString() ?? '-',
                                )),
                                DataCell(Text(
                                  sourceLabel,
                                  style: const TextStyle(fontSize: 12),
                                )),
                                DataCell(Text(
                                  row['performed_by_name']?.toString() ?? '-',
                                  style: const TextStyle(fontSize: 12),
                                )),
                              ],
                            );
                          }).toList(),
                        ),
                      ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Text(
                          _pageLabel,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark
                                ? AppTheme.darkMutedForeground
                                : AppTheme.lightMutedForeground,
                          ),
                        ),
                        const Spacer(),
                        MadButton(
                          text: 'Previous',
                          size: ButtonSize.sm,
                          variant: ButtonVariant.outline,
                          disabled:
                              !(_pagination['has_prev'] == true) || _page <= 1,
                          onPressed: () {
                            setState(() => _page = (_page - 1).clamp(1, 9999));
                            _fetchHistory();
                          },
                        ),
                        const SizedBox(width: 8),
                        MadButton(
                          text: 'Next',
                          size: ButtonSize.sm,
                          variant: ButtonVariant.outline,
                          disabled: !(_pagination['has_next'] == true),
                          onPressed: () {
                            setState(() => _page += 1);
                            _fetchHistory();
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryTile({
    required String title,
    required dynamic value,
    required bool isDark,
  }) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value.toString(),
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyMessage(String message, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Center(
        child: Text(
          message,
          style: TextStyle(
            fontSize: 13,
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final VoidCallback onTap;

  const _DateField({
    required this.controller,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: GestureDetector(
        onTap: onTap,
        child: AbsorbPointer(
          child: MadInput(
            controller: controller,
            hintText: label,
          ),
        ),
      ),
    );
  }
}
