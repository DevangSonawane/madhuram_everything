import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../services/api_client.dart';
import '../models/stock_area.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';

/// Stock Transfers page matching React's StockTransfers page
class StockTransfersPage extends StatefulWidget {
  const StockTransfersPage({super.key});

  @override
  State<StockTransfersPage> createState() => _StockTransfersPageState();
}

class _StockTransfersPageState extends State<StockTransfersPage> {
  bool _isLoading = false;
  String? _error;
  List<StockTransfer> _transfers = [];
  String _searchQuery = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;
  final _searchController = TextEditingController();
  String? _statusFilter;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadTransfers();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadTransfers() async {
    final store = StoreProvider.of<AppState>(context);
    final projectId = store.state.project.selectedProjectId ?? '';

    if (projectId.isEmpty) {
      setState(() {
        _transfers = [];
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
      final result = await ApiClient.getStockTransfers(projectId);

      if (!mounted) return;

      if (result['success'] == true) {
        final data = result['data'] as List;
        final loaded = data.map((e) => StockTransfer.fromJson(e)).toList();
        setState(() {
          _transfers = loaded;
          _isLoading = false;
        });
      } else {
        setState(() {
          _transfers = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load transfers';
        });
      }
    } catch (e) {
      debugPrint('[StockTransfers] API error: $e');
      if (!mounted) return;
      setState(() {
        _transfers = [];
        _isLoading = false;
        _error = 'Failed to load transfers';
      });
    }
  }

  List<StockTransfer> get _filteredTransfers {
    List<StockTransfer> result = _transfers;

    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result.where((t) {
        return t.fromArea.toLowerCase().contains(query) ||
            t.toArea.toLowerCase().contains(query) ||
            t.material.toLowerCase().contains(query);
      }).toList();
    }

    if (_statusFilter != null) {
      result = result.where((t) => t.status == _statusFilter).toList();
    }

    return result;
  }

  List<StockTransfer> get _paginatedTransfers {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final filtered = _filteredTransfers;
    if (start >= filtered.length) return [];
    return filtered.sublist(start, end > filtered.length ? filtered.length : end);
  }

  int get _totalPages => (_filteredTransfers.length / _itemsPerPage).ceil();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 768;

    return ProtectedRoute(
      title: 'Stock Transfers',
      route: '/stock-transfers',
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
                      'Stock Transfers',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Transfer materials between stock areas',
                      style: TextStyle(
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isMobile)
                MadButton(
                  text: 'New Transfer',
                  icon: LucideIcons.arrowLeftRight,
                  onPressed: () => _showTransferDialog(),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // Stats cards
          if (!isMobile)
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Total Transfers',
                    value: _transfers.length.toString(),
                    icon: LucideIcons.arrowLeftRight,
                    iconColor: AppTheme.primaryColor,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Pending',
                    value: _transfers.where((t) => t.status == 'Pending').length.toString(),
                    icon: LucideIcons.clock,
                    iconColor: const Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Completed',
                    value: _transfers.where((t) => t.status == 'Completed').length.toString(),
                    icon: LucideIcons.circleCheck,
                    iconColor: const Color(0xFF22C55E),
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
                  hintText: 'Search transfers...',
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
                    MadSelectOption(value: 'In Transit', label: 'In Transit'),
                    MadSelectOption(value: 'Completed', label: 'Completed'),
                  ],
                  onChanged: (value) => setState(() {
                    _statusFilter = value;
                    _currentPage = 1;
                  }),
                ),
              ),
              if (isMobile)
                MadButton(
                  icon: LucideIcons.arrowLeftRight,
                  text: 'Transfer',
                  onPressed: () => _showTransferDialog(),
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
                    : _filteredTransfers.isEmpty
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
                                    _buildHeaderCell('From', flex: 1, isDark: isDark),
                                    _buildHeaderCell('To', flex: 1, isDark: isDark),
                                    _buildHeaderCell('Quantity', flex: 1, isDark: isDark),
                                  ],
                                  _buildHeaderCell('Status', flex: 1, isDark: isDark),
                                  const SizedBox(width: 48),
                                ],
                              ),
                            ),
                            // Table rows
                            Expanded(
                              child: ListView.separated(
                                itemCount: _paginatedTransfers.length,
                                separatorBuilder: (_, __) => Divider(
                                  height: 1,
                                  color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5),
                                ),
                                itemBuilder: (context, index) {
                                  return _buildTableRow(_paginatedTransfers[index], isDark, isMobile);
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
                                      'Showing ${(_currentPage - 1) * _itemsPerPage + 1}-${_currentPage * _itemsPerPage > _filteredTransfers.length ? _filteredTransfers.length : _currentPage * _itemsPerPage} of ${_filteredTransfers.length}',
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

  Widget _buildTableRow(StockTransfer transfer, bool isDark, bool isMobile) {
    BadgeVariant statusVariant;
    switch (transfer.status) {
      case 'Completed':
        statusVariant = BadgeVariant.default_;
        break;
      case 'Pending':
        statusVariant = BadgeVariant.secondary;
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
              transfer.date ?? '-',
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(transfer.material, style: const TextStyle(fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis),
                if (isMobile)
                  Text(
                    '${transfer.fromArea} → ${transfer.toArea}',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                  ),
              ],
            ),
          ),
          if (!isMobile) ...[
            Expanded(
              flex: 1,
              child: Row(
                children: [
                  Icon(LucideIcons.arrowUp, size: 14, color: AppTheme.lightDestructive),
                  const SizedBox(width: 4),
                  Flexible(child: Text(transfer.fromArea, overflow: TextOverflow.ellipsis)),
                ],
              ),
            ),
            Expanded(
              flex: 1,
              child: Row(
                children: [
                  Icon(LucideIcons.arrowDown, size: 14, color: const Color(0xFF22C55E)),
                  const SizedBox(width: 4),
                  Flexible(child: Text(transfer.toArea, overflow: TextOverflow.ellipsis)),
                ],
              ),
            ),
            Expanded(
              flex: 1,
              child: Text(
                transfer.quantity.toStringAsFixed(0),
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
            ),
          ],
          Expanded(
            flex: 1,
            child: MadBadge(text: transfer.status, variant: statusVariant),
          ),
          MadDropdownMenuButton(
            items: [
              MadMenuItem(label: 'View Details', icon: LucideIcons.eye, onTap: () {}),
              MadMenuItem(label: 'Download Slip', icon: LucideIcons.download, onTap: () => _downloadSlip(transfer)),
              if (transfer.status != 'Completed')
                MadMenuItem(label: 'Complete Transfer', icon: LucideIcons.circleCheck, onTap: () => _completeTransfer(transfer)),
              MadMenuItem(label: 'Delete', icon: LucideIcons.trash2, destructive: true, onTap: () => _confirmDeleteTransfer(transfer)),
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
              LucideIcons.arrowLeftRight,
              size: 64,
              color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withOpacity(0.3),
            ),
            const SizedBox(height: 24),
            Text(
              _searchQuery.isEmpty ? 'No transfers yet' : 'No transfers found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchQuery.isEmpty
                  ? 'Create a transfer to move materials between areas'
                  : 'Try a different search term',
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
            if (_searchQuery.isEmpty) ...[
              const SizedBox(height: 24),
              MadButton(
                text: 'New Transfer',
                icon: LucideIcons.arrowLeftRight,
                onPressed: () => _showTransferDialog(),
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
              'Failed to load transfers',
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
              onPressed: _loadTransfers,
            ),
          ],
        ),
      ),
    );
  }

  void _completeTransfer(StockTransfer transfer) {
    setState(() {
      final i = _transfers.indexWhere((t) => t.id == transfer.id);
      if (i >= 0) {
        final t = _transfers[i];
        _transfers[i] = StockTransfer(
          id: t.id,
          fromArea: t.fromArea,
          toArea: t.toArea,
          material: t.material,
          quantity: t.quantity,
          date: t.date,
          status: 'Completed',
        );
      }
    });
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transfer completed')));
  }

  void _downloadSlip(StockTransfer transfer) {
    showToast(context, 'Transfer slip would be generated');
  }

  void _confirmDeleteTransfer(StockTransfer transfer) {
    MadDialog.confirm(
      context: context,
      title: 'Delete Transfer',
      description: 'Are you sure you want to delete this transfer (${transfer.material})? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    ).then((confirmed) {
      if (confirmed != true || !mounted) return;
      setState(() => _transfers.removeWhere((t) => t.id == transfer.id));
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transfer deleted')));
    });
  }

  void _showTransferDialog() {
    MadFormDialog.show(
      context: context,
      title: 'New Stock Transfer',
      maxWidth: 600,
      content: _StockTransferWizardContent(
        onSubmitted: (newTransfers) {
          Navigator.of(context).pop();
          setState(() => _transfers.insertAll(0, newTransfers));
          _loadTransfers();
        },
        onCancel: () => Navigator.of(context).pop(),
      ),
      actions: const [],
    );
  }
}

/// One line item for transfer wizard Step 2
class _TransferWizardItem {
  String material = '';
  String quantity = '';
  String unit = 'Nos';

  _TransferWizardItem();
}

/// One editable row for Items step in transfer wizard
class _TransferItemRow extends StatefulWidget {
  final _TransferWizardItem item;
  final int index;
  final bool canRemove;
  final VoidCallback onRemove;

  const _TransferItemRow({
    super.key,
    required this.item,
    required this.index,
    required this.canRemove,
    required this.onRemove,
  });

  @override
  State<_TransferItemRow> createState() => _TransferItemRowState();
}

class _TransferItemRowState extends State<_TransferItemRow> {
  late TextEditingController _materialController;
  late TextEditingController _qtyController;
  String _currentUnit = 'Nos';

  static const Map<String, double> _lengthUnitToMm = {
    'mm': 1.0,
    'cm': 10.0,
    'm': 1000.0,
    'inch': 25.4,
    'ft': 304.8,
  };

  bool _isLengthUnit(String unit) => _lengthUnitToMm.containsKey(unit);

  String _formatQuantity(double value) {
    final fixed = value.toStringAsFixed(3);
    return fixed.replaceFirst(RegExp(r'\.?0+$'), '');
  }

  @override
  void initState() {
    super.initState();
    _materialController = TextEditingController(text: widget.item.material);
    _qtyController = TextEditingController(text: widget.item.quantity);
    _currentUnit = widget.item.unit;
  }

  @override
  void dispose() {
    _materialController.dispose();
    _qtyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Item ${widget.index + 1}', style: const TextStyle(fontWeight: FontWeight.w600)),
                IconButton(
                  icon: const Icon(LucideIcons.trash2, size: 18),
                  onPressed: widget.canRemove ? widget.onRemove : null,
                ),
              ],
            ),
            const SizedBox(height: 12),
            MadInput(
              labelText: 'Material',
              hintText: 'Material name',
              controller: _materialController,
              onChanged: (v) => item.material = v,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MadInput(
                    labelText: 'Quantity',
                    hintText: '0',
                    keyboardType: TextInputType.number,
                    controller: _qtyController,
                    onChanged: (v) => item.quantity = v,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MadSelect<String>(
                    labelText: 'Unit',
                    placeholder: 'Unit',
                    value: item.unit,
                    options: const [
                      MadSelectOption(value: 'mm', label: 'mm'),
                      MadSelectOption(value: 'cm', label: 'cm'),
                      MadSelectOption(value: 'm', label: 'm'),
                      MadSelectOption(value: 'inch', label: 'inch'),
                      MadSelectOption(value: 'ft', label: 'ft'),
                      MadSelectOption(value: 'Nos', label: 'Nos'),
                      MadSelectOption(value: 'Bags', label: 'Bags'),
                      MadSelectOption(value: 'Meters', label: 'Meters'),
                      MadSelectOption(value: 'KG', label: 'KG'),
                    ],
                    onChanged: (v) {
                      final nextUnit = v ?? 'Nos';
                      final qty = double.tryParse(_qtyController.text.trim());
                      if (qty != null &&
                          _isLengthUnit(_currentUnit) &&
                          _isLengthUnit(nextUnit)) {
                        final inMm = qty * _lengthUnitToMm[_currentUnit]!;
                        final nextQty = inMm / _lengthUnitToMm[nextUnit]!;
                        final formatted = _formatQuantity(nextQty);
                        _qtyController.text = formatted;
                        item.quantity = formatted;
                      }
                      setState(() {
                        item.unit = nextUnit;
                        _currentUnit = nextUnit;
                      });
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 3-step wizard content for New Stock Transfer
class _StockTransferWizardContent extends StatefulWidget {
  final void Function(List<StockTransfer> newTransfers) onSubmitted;
  final VoidCallback onCancel;

  const _StockTransferWizardContent({
    required this.onSubmitted,
    required this.onCancel,
  });

  @override
  State<_StockTransferWizardContent> createState() => _StockTransferWizardContentState();
}

class _StockTransferWizardContentState extends State<_StockTransferWizardContent> {
  int _step = 0;
  String? _sourceLocation;
  String? _destinationLocation;
  final _dateController = TextEditingController();
  final _reasonController = TextEditingController();
  final List<_TransferWizardItem> _items = [_TransferWizardItem()];

  static const List<MadSelectOption<String>> _locationOptions = [
    MadSelectOption(value: 'main', label: 'Main Warehouse'),
    MadSelectOption(value: 'secondary', label: 'Secondary Store'),
    MadSelectOption(value: 'site-a', label: 'Site A'),
    MadSelectOption(value: 'site-b', label: 'Site B'),
  ];

  @override
  void dispose() {
    _dateController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2030),
    );
    if (date != null) _dateController.text = DateFormat('yyyy-MM-dd').format(date);
  }

  Widget _buildStepIndicator() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        _stepChip(0, 'Source & Destination', isDark),
        const SizedBox(width: 8),
        _stepChip(1, 'Items', isDark),
        const SizedBox(width: 8),
        _stepChip(2, 'Review', isDark),
      ],
    );
  }

  Widget _stepChip(int step, String label, bool isDark) {
    final active = _step == step;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: active ? AppTheme.primaryColor : (isDark ? AppTheme.darkMuted : AppTheme.lightMuted),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: active ? FontWeight.w600 : FontWeight.w500,
          color: active ? Colors.white : (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
        ),
      ),
    );
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MadSelect<String>(
          labelText: 'Source Location / Warehouse',
          value: _sourceLocation,
          placeholder: 'Select source',
          options: _locationOptions,
          onChanged: (v) => setState(() => _sourceLocation = v),
        ),
        const SizedBox(height: 16),
        MadSelect<String>(
          labelText: 'Destination Location / Warehouse',
          value: _destinationLocation,
          placeholder: 'Select destination',
          options: _locationOptions,
          onChanged: (v) => setState(() => _destinationLocation = v),
        ),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: _pickDate,
          child: AbsorbPointer(
            child: MadInput(
              controller: _dateController,
              labelText: 'Transfer Date',
              hintText: 'Select date',
            ),
          ),
        ),
        const SizedBox(height: 16),
        MadTextarea(
          controller: _reasonController,
          labelText: 'Reason / Notes',
          hintText: 'Optional reason or notes...',
          minLines: 2,
        ),
      ],
    );
  }

  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        ...List.generate(_items.length, (i) {
          final item = _items[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _TransferItemRow(
              key: ObjectKey(item),
              item: item,
              index: i,
              canRemove: _items.length > 1,
              onRemove: () => setState(() => _items.removeAt(i)),
            ),
          );
        }),
        MadButton(
          text: 'Add Item',
          icon: LucideIcons.plus,
          variant: ButtonVariant.outline,
          onPressed: () => setState(() => _items.add(_TransferWizardItem())),
        ),
      ],
    );
  }

  Widget _buildStep3() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sourceLabel = _locationOptions.where((o) => o.value == _sourceLocation).map((o) => o.label).firstOrNull ?? _sourceLocation ?? '-';
    final destLabel = _locationOptions.where((o) => o.value == _destinationLocation).map((o) => o.label).firstOrNull ?? _destinationLocation ?? '-';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MadCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Summary', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                const SizedBox(height: 12),
                _summaryRow('Source', sourceLabel),
                _summaryRow('Destination', destLabel),
                _summaryRow('Transfer Date', _dateController.text.isEmpty ? '-' : _dateController.text),
                if (_reasonController.text.trim().isNotEmpty) _summaryRow('Reason / Notes', _reasonController.text.trim()),
                const SizedBox(height: 12),
                const Text('Items', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                ..._items.asMap().entries.map((e) {
                  final i = e.key + 1;
                  final item = e.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text('$i. ${item.material.isNotEmpty ? item.material : "(No material)"} - ${item.quantity} ${item.unit}'),
                  );
                }),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 120, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500))),
          Expanded(child: Text(value.isEmpty ? '-' : value)),
        ],
      ),
    );
  }

  void _submit() {
    final fromArea = _sourceLocation ?? 'main';
    final toArea = _destinationLocation ?? 'secondary';
    final dateStr = _dateController.text.trim().isEmpty ? DateFormat('yyyy-MM-dd').format(DateTime.now()) : _dateController.text.trim();
    final baseId = 'st-${DateTime.now().millisecondsSinceEpoch}';
    final newTransfers = <StockTransfer>[];
    for (var i = 0; i < _items.length; i++) {
      final item = _items[i];
      final mat = item.material.trim().isEmpty ? 'Item ${i + 1}' : item.material;
      final qty = (double.tryParse(item.quantity) ?? 0);
      newTransfers.add(StockTransfer(
        id: '$baseId-$i',
        fromArea: fromArea,
        toArea: toArea,
        material: mat,
        quantity: qty,
        date: dateStr,
        status: 'Pending',
      ));
    }
    if (newTransfers.isEmpty) {
      newTransfers.add(StockTransfer(
        id: baseId,
        fromArea: fromArea,
        toArea: toArea,
        material: 'Draft',
        quantity: 0,
        date: dateStr,
        status: 'Pending',
      ));
    }
    widget.onSubmitted(newTransfers);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildStepIndicator(),
        const SizedBox(height: 24),
        Flexible(
          child: SingleChildScrollView(
            child: _step == 0 ? _buildStep1() : _step == 1 ? _buildStep2() : _buildStep3(),
          ),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: widget.onCancel),
            const SizedBox(width: 12),
            if (_step > 0)
              MadButton(
                text: 'Back',
                variant: ButtonVariant.outline,
                onPressed: () => setState(() => _step--),
              ),
            if (_step > 0) const SizedBox(width: 12),
            if (_step == 2)
              MadButton(text: 'Submit Transfer', onPressed: _submit)
            else
              MadButton(
                text: 'Next',
                onPressed: () => setState(() => _step++),
              ),
          ],
        ),
      ],
    );
  }
}
