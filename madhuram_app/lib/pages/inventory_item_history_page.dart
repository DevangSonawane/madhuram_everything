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

class InventoryItemHistoryPage extends StatefulWidget {
  final String inventoryId;

  const InventoryItemHistoryPage({super.key, required this.inventoryId});

  @override
  State<InventoryItemHistoryPage> createState() => _InventoryItemHistoryPageState();
}

class _InventoryItemHistoryPageState extends State<InventoryItemHistoryPage> {
  final _fromController = TextEditingController();
  final _toController = TextEditingController();
  final _dateFormat = DateFormat('yyyy-MM-dd');

  Timer? _debounce;

  Map<String, dynamic>? _item;
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
  int _page = 1;
  String _changeType = '';

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  @override
  void dispose() {
    _fromController.dispose();
    _toController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _fetchHistory() async {
    if (widget.inventoryId.isEmpty) return;
    setState(() => _loading = true);
    try {
      final res = await ApiClient.getInventoryHistoryByItem(
        widget.inventoryId,
        filters: {
          'from': _fromController.text.trim(),
          'to': _toController.text.trim(),
          'change_type': _changeType,
          'page': _page,
          'limit': 50,
          'sort': 'desc',
        },
      );
      if (!mounted) return;
      if (res['success'] != true) {
        setState(() => _history = []);
        showToast(context, res['error']?.toString() ?? 'Failed to load item history.');
        return;
      }
      final payload = res['data'] as Map<String, dynamic>? ?? {};
      final rowsRaw = payload['history'] is List ? payload['history'] as List : const [];

      final Map<String, Map<String, dynamic>> deduped = {};
      for (var i = 0; i < rowsRaw.length; i++) {
        final row = rowsRaw[i];
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

      final pagination = payload['pagination'] as Map<String, dynamic>? ?? {};

      setState(() {
        _item = payload['item'] as Map<String, dynamic>?;
        _summary = payload['summary'] as Map<String, dynamic>?;
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
      if (key == 'change_type') {
        _changeType = value;
      }
      _page = 1;
    });
    _fetchHistory();
  }

  void _resetFilters() {
    setState(() {
      _fromController.clear();
      _toController.clear();
      _changeType = '';
      _page = 1;
    });
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

  num _toNum(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value;
    return num.tryParse(value.toString()) ?? 0;
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

    return ProtectedRoute(
      title: 'Inventory Item History',
      route: '/projects/inventory/item-history',
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
                        'Inventory Item History',
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
                        'Full movement log for this item.',
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
            if (responsive.isMobile)
              Column(
                children: [
                  _buildItemCard(isDark),
                  const SizedBox(height: 12),
                  _buildSummaryCard(isDark),
                ],
              )
            else
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: _buildItemCard(isDark)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildSummaryCard(isDark)),
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
                        MadButton(
                          text: 'Reset',
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
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const Text(
                          'History Log',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          _pageLabel,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark
                                ? AppTheme.darkMutedForeground
                                : AppTheme.lightMutedForeground,
                          ),
                        ),
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
                            DataColumn(label: Text('Type')),
                            DataColumn(label: Text('In')),
                            DataColumn(label: Text('Out')),
                            DataColumn(label: Text('Before')),
                            DataColumn(label: Text('After')),
                            DataColumn(label: Text('Source')),
                            DataColumn(label: Text('By')),
                            DataColumn(label: Text('Notes')),
                          ],
                          rows: _history.map((row) {
                            final sourceLabel = row['source_ref'] ??
                                row['source_type_label'] ??
                                row['source_type'] ??
                                '-';
                            return DataRow(
                              cells: [
                                DataCell(Text(
                                  _formatDateTime(row['created_at']),
                                  style: const TextStyle(fontSize: 12),
                                )),
                                DataCell(
                                  _changeTypeBadge(
                                    row['change_type']?.toString(),
                                  ),
                                ),
                                DataCell(Text(row['stock_in']?.toString() ?? '-')),
                                DataCell(Text(row['stock_out']?.toString() ?? '-')),
                                DataCell(Text(row['balance_before']?.toString() ?? '-')),
                                DataCell(Text(row['balance_after']?.toString() ?? '-')),
                                DataCell(Text(
                                  sourceLabel.toString(),
                                  style: const TextStyle(fontSize: 12),
                                )),
                                DataCell(Text(
                                  row['performed_by_name']?.toString() ??
                                      row['performed_by']?.toString() ??
                                      '-',
                                  style: const TextStyle(fontSize: 12),
                                )),
                                DataCell(Text(
                                  row['notes']?.toString() ?? '-',
                                  style: const TextStyle(fontSize: 12),
                                )),
                              ],
                            );
                          }).toList(),
                        ),
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

  Widget _detailRow(String label, dynamic value) {
    return Row(
      children: [
        Expanded(
          child: Text(
            '$label:',
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value?.toString() ?? '-',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }

  Widget _buildItemCard(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Item Details',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            if (_item == null)
              Text(
                'Loading item details...',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                ),
              )
            else
              Wrap(
                runSpacing: 6,
                children: [
                  _detailRow('Inventory ID', _item!['inventory_id']),
                  _detailRow('Name', _item!['name']),
                  _detailRow('Brand', _item!['brand']),
                  _detailRow('Unit', _item!['units']),
                  _detailRow(
                    'Price',
                    Formatters.currency(_toNum(_item!['price'])),
                  ),
                  _detailRow(
                    'Current Qty',
                    _item!['current_quantity'] ?? _item!['quantity'],
                  ),
                  _detailRow(
                    'Stock Status',
                    _item!['stockin'] == true ? 'In' : 'Out',
                  ),
                  _detailRow(
                    'Billing',
                    _item!['billing'] == true ? 'Billing' : 'Non Billings',
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Summary',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            _summaryRow('Total Events', _summary?['total_events'] ?? 0),
            _summaryRow('Stock In', _summary?['total_stock_in'] ?? 0),
            _summaryRow('Stock Out', _summary?['total_stock_out'] ?? 0),
            _summaryRow('Unique Users', _summary?['unique_users'] ?? 0),
            _summaryRow(
              'First Event',
              _formatDateTime(_summary?['first_event_at']),
            ),
            _summaryRow(
              'Last Event',
              _formatDateTime(_summary?['last_event_at']),
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryRow(String label, dynamic value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
          ),
          Text(
            value?.toString() ?? '-',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ],
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
