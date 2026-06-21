import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../services/excel_service.dart';
import '../services/boq_extractor.dart';
import '../models/boq.dart';
import '../components/ui/mad_card.dart';
import '../components/ui/mad_button.dart';
import '../components/ui/mad_badge.dart';
import '../components/ui/mad_input.dart';
import '../components/layout/main_layout.dart';
import '../utils/error_handler.dart';
import '../components/ui/mad_skeleton.dart';
import '../utils/responsive.dart';
import '../utils/formatters.dart';

/// BOQ Management page matching React's BOQ.jsx
class BOQPage extends StatefulWidget {
  const BOQPage({super.key});

  @override
  State<BOQPage> createState() => _BOQPageState();
}

class _AddBOQItemPage extends StatefulWidget {
  final String projectId;
  final String activeClient;

  const _AddBOQItemPage({
    required this.projectId,
    this.activeClient = '',
  });

  @override
  State<_AddBOQItemPage> createState() => _AddBOQItemPageState();
}

class _AddBOQItemPageState extends State<_AddBOQItemPage> {
  final _itemCodeController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _categoryController = TextEditingController();
  final _quantityController = TextEditingController();
  final _unitController = TextEditingController();
  final _rateController = TextEditingController();
  final _floorController = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _itemCodeController.dispose();
    _descriptionController.dispose();
    _categoryController.dispose();
    _quantityController.dispose();
    _unitController.dispose();
    _rateController.dispose();
    _floorController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    final quantity = double.tryParse(_quantityController.text.trim()) ?? 0;
    final rate = double.tryParse(_rateController.text.trim()) ?? 0;
    final amount = quantity * rate;
    final client = widget.activeClient.trim().toLowerCase();

    final data = {
      'project_id': widget.projectId,
      'item_code': _itemCodeController.text.trim(),
      'description': _descriptionController.text.trim(),
      'category': _categoryController.text.trim(),
      'floor': _floorController.text.trim(),
      'quantity': quantity.toString(),
      'unit': _unitController.text.trim(),
      'rate': rate.toString(),
      'amount': amount.toString(),
    };

    late final Map<String, dynamic> result;
    if (client == 'lodha') {
      result = await ApiClient.createBOQLodha({
        ...data,
        'description': data['description'],
        'section': data['category'],
        'item_no': data['item_code'],
        'hsn': data['item_code'],
        'qty': data['quantity'],
      });
    } else if (client == 'hiranandani') {
      result = await ApiClient.createBOQHiranandani({
        ...data,
        'description': data['description'],
        'section': data['category'],
        'item_no': data['item_code'],
        'sac_code': data['item_code'],
        'order_qty': data['quantity'],
        'uom': data['unit'],
        'unit_price': data['rate'],
        'value': data['amount'],
      });
    } else {
      result = await ApiClient.createBOQ(data);
    }
    if (!mounted) return;
    setState(() => _saving = false);
    if (result['success'] == true) {
      Navigator.of(context).pop(true);
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ErrorHandler.getMessage(result['error'] ?? 'Failed to add item'))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final responsive = Responsive(context);
    final client = widget.activeClient.trim().toLowerCase();
    return Scaffold(
      appBar: AppBar(
        title: Text(
          client == 'lodha'
              ? 'Add Lodha BOQ Item'
              : client == 'hiranandani'
                  ? 'Add Hiranandani BOQ Item'
                  : 'Add BOQ Item',
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: SingleChildScrollView(
            padding: EdgeInsets.all(responsive.value(mobile: 16, tablet: 20, desktop: 24)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        MadInput(
                          controller: _itemCodeController,
                          labelText: client == 'lodha'
                              ? 'HSN/SAC Code'
                              : client == 'hiranandani'
                                  ? 'SAC Code'
                                  : 'Item Code',
                          hintText: client.isNotEmpty ? 'e.g. 995462' : 'Enter item code',
                        ),
                        const SizedBox(height: 16),
                        MadInput(
                          controller: _descriptionController,
                          labelText: client == 'hiranandani'
                              ? 'Service Description'
                              : 'Item Description',
                          hintText: 'Enter description',
                        ),
                        const SizedBox(height: 16),
                        MadInput(
                          controller: _categoryController,
                          labelText: 'Section',
                          hintText: 'Enter section',
                        ),
                        const SizedBox(height: 16),
                        MadInput(
                          controller: _floorController,
                          labelText: 'Floor',
                          hintText: 'Enter floor',
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: MadInput(
                                controller: _quantityController,
                                labelText: client == 'hiranandani' ? 'Order Qty' : 'Qty',
                                hintText: '0',
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: MadInput(
                                controller: _unitController,
                                labelText: client == 'hiranandani' ? 'UOM' : 'Unit',
                                hintText: 'e.g. KG',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        MadInput(
                          controller: _rateController,
                          labelText: client == 'hiranandani' ? 'Unit Price' : 'Rate',
                          hintText: '0.00',
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: MadButton(
                        text: 'Cancel',
                        variant: ButtonVariant.outline,
                        onPressed: _saving ? null : () => Navigator.of(context).pop(false),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MadButton(
                        text: _saving ? 'Saving...' : 'Add Item',
                        icon: LucideIcons.plus,
                        disabled: _saving,
                        onPressed: _save,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BOQPageState extends State<BOQPage> {
  static const String _lodhaFormat = 'lodha';
  static const String _hiranandaniFormat = 'hiranandani';

  bool _isLoading = true;
  String? _error;
  List<BOQItem> _items = [];
  String _searchQuery = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;
  final _searchController = TextEditingController();
  final Set<String> _selectedIds = {};
  bool _bulkDeleting = false;
  String _activeClient = '';
  File? _selectedFile;
  bool _extracting = false;
  bool _savingImport = false;
  List<Map<String, dynamic>> _extractedItems = [];
  String? _extractError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _restoreClientSelection();
      _loadBOQItems();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _clientStorageKey(String projectId) => 'boqClient:$projectId';

  String _selectedFileLabel() => _selectedFile?.path.split(Platform.pathSeparator).last ?? '';

  String _clientDisplayName(String client) {
    switch (client) {
      case _lodhaFormat:
        return 'Lodha Format';
      case _hiranandaniFormat:
        return 'Hiranandani Format';
      default:
        return '';
    }
  }

  Future<void> _restoreClientSelection() async {
    final store = StoreProvider.of<AppState>(context);
    final projectId = store.state.project.selectedProjectId ?? '';
    if (projectId.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_clientStorageKey(projectId))?.trim().toLowerCase() ?? '';
    if (!mounted) return;
    setState(() {
      _activeClient = stored;
    });
  }

  Future<void> _persistClientSelection(String client) async {
    final store = StoreProvider.of<AppState>(context);
    final projectId = store.state.project.selectedProjectId ?? '';
    if (projectId.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    if (client.isEmpty) {
      await prefs.remove(_clientStorageKey(projectId));
    } else {
      await prefs.setString(_clientStorageKey(projectId), client);
    }
  }

  bool _matchesActiveClient(BOQItem item) {
    final client = item.client?.trim().toLowerCase() ?? '';
    if (client.isNotEmpty && client == _activeClient) return true;
    if (_activeClient.isEmpty) return true;

    final code = (item.code ?? item.itemNo ?? item.itemCode ?? '').trim();
    final hasHsn = (item.hsn ?? '').trim().isNotEmpty;
    final hasSac = (item.sacCode ?? '').trim().isNotEmpty;

    if (_activeClient == _lodhaFormat) {
      if (hasHsn) return true;
      if (RegExp(r'^\d+(\.\d+){1,3}$').hasMatch(code)) return true;
      return false;
    }

    if (_activeClient == _hiranandaniFormat) {
      if (hasSac) return true;
      if (RegExp(r'^\(\d+\)$').hasMatch(code)) return true;
      return false;
    }

    return true;
  }

  bool get _canImportPdf => _currentProjectId.isNotEmpty && _activeClient.isNotEmpty;

  String get _currentProjectId {
    final store = StoreProvider.of<AppState>(context);
    return store.state.project.selectedProjectId ?? '';
  }

  Future<void> _loadBOQItems() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    final projectId = _currentProjectId;
    
    if (projectId.isEmpty) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _items = [];
          _error = 'No project selected';
        });
      }
      return;
    }
    
    try {
      final result = await ApiClient.getBOQsByProject(projectId);
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final List<dynamic> rows;
        if (data is List) {
          rows = data;
        } else if (data is Map && data['boqs'] is List) {
          rows = List<dynamic>.from(data['boqs'] as List);
        } else {
          rows = const [];
        }
        final loaded = rows
            .whereType<Map>()
            .map((e) => BOQItem.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        setState(() {
          _items = loaded;
          _isLoading = false;
          _selectedIds.removeWhere(
            (id) => !_items.any((item) => item.id == id),
          );
          if (_currentPage > _totalPages && _totalPages > 0) {
            _currentPage = 1;
          }
        });
      } else {
        setState(() {
          _items = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load BOQ items';
        });
      }
    } catch (e) {
      debugPrint('[BOQ] API error: $e');
      if (!mounted) return;
      setState(() {
        _items = [];
        _isLoading = false;
        _error = 'Failed to load BOQ items';
      });
    }
  }

  List<BOQItem> get _scopedItems {
    final byFile = _items;
    if (_activeClient.isEmpty) return byFile;
    final matched = byFile.where(_matchesActiveClient).toList();
    return matched.isNotEmpty ? matched : byFile;
  }

  List<BOQItem> get _filteredItems {
    if (_searchQuery.isEmpty) return _scopedItems;
    final query = _searchQuery.toLowerCase();
    return _scopedItems.where((item) {
      return item.description.toLowerCase().contains(query) ||
          (item.itemCode?.toLowerCase().contains(query) ?? false) ||
          (item.code?.toLowerCase().contains(query) ?? false) ||
          (item.itemNo?.toLowerCase().contains(query) ?? false) ||
          (item.hsn?.toLowerCase().contains(query) ?? false) ||
          (item.sacCode?.toLowerCase().contains(query) ?? false) ||
          item.category.toLowerCase().contains(query);
    }).toList();
  }

  List<BOQItem> get _paginatedItems {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final filtered = _filteredItems;
    if (start >= filtered.length) return [];
    return filtered.sublist(start, end > filtered.length ? filtered.length : end);
  }

  int get _totalPages => (_filteredItems.length / _itemsPerPage).ceil();

  double get _totalAmount => _filteredItems.fold<double>(
        0,
        (sum, item) => sum + (item.amount ?? (item.quantity * (item.rate ?? 0))),
      );

  bool get _hasSelection => _selectedIds.isNotEmpty;

  bool get _isPageFullySelected {
    if (_paginatedItems.isEmpty) return false;
    return _paginatedItems.every((item) => _selectedIds.contains(item.id));
  }

  bool get _isPagePartiallySelected {
    if (_paginatedItems.isEmpty) return false;
    final anySelected = _paginatedItems.any((item) => _selectedIds.contains(item.id));
    return anySelected && !_isPageFullySelected;
  }

  void _toggleItemSelection(String id, bool selected) {
    setState(() {
      if (selected) {
        _selectedIds.add(id);
      } else {
        _selectedIds.remove(id);
      }
    });
  }

  void _togglePageSelection(bool selected) {
    setState(() {
      if (selected) {
        _selectedIds.addAll(_paginatedItems.map((item) => item.id));
      } else {
        for (final item in _paginatedItems) {
          _selectedIds.remove(item.id);
        }
      }
    });
  }

  Future<void> _confirmDeleteSelected() async {
    if (_selectedIds.isEmpty) return;
    final count = _selectedIds.length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete selected BOQ items'),
        content: Text(
          'Delete $count selected item(s)? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _deleteSelected();
  }

  Future<void> _deleteSelected() async {
    if (_bulkDeleting || _selectedIds.isEmpty) return;
    setState(() => _bulkDeleting = true);
    int deleted = 0;
    int failed = 0;
    final ids = _selectedIds.toList();

    for (final id in ids) {
      final result = await ApiClient.deleteBOQ(id);
      if (result['success'] == true) {
        deleted++;
      } else {
        failed++;
      }
    }

    if (!mounted) return;
    setState(() {
      _bulkDeleting = false;
      _selectedIds.clear();
    });
    await _loadBOQItems();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          failed > 0
              ? '$deleted deleted, $failed failed.'
              : '$deleted item(s) deleted.',
        ),
        backgroundColor: failed > 0 ? Colors.red : null,
      ),
    );
  }


  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final selectedProjectId = _currentProjectId;
    final hasProjectSelected = selectedProjectId.isNotEmpty;
    final activeClientLabel = _clientDisplayName(_activeClient);

    return ProtectedRoute(
      title: 'BOQ Management',
      route: '/boq',
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            'BOQ',
                            style: TextStyle(
                              fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                              fontWeight: FontWeight.bold,
                              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                            ),
                          ),
                          if (activeClientLabel.isNotEmpty)
                            MadBadge(
                              text: activeClientLabel,
                              variant: _activeClient == _lodhaFormat ? BadgeVariant.primary : BadgeVariant.secondary,
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        selectedProjectId.isNotEmpty
                            ? 'Manage BOQ items for the selected project.'
                            : 'Select a project to view and manage BOQ items.',
                        style: TextStyle(
                          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                        ),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 2,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _buildQuickActions(isDark, responsive, hasProjectSelected),
            const SizedBox(height: 16),
            _isLoading
                ? MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: MadTableSkeleton(rows: 8, columns: 8),
                    ),
                  )
                : _error != null
                    ? _buildErrorState(isDark, _error!)
                    : _filteredItems.isEmpty
                        ? _buildEmptyState(isDark, hasProjectSelected)
                        : _buildResponsiveTable(isDark, responsive),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions(bool isDark, Responsive responsive, bool hasProjectSelected) {
    final isMobile = responsive.isMobile;
    final formatButtonLabel = _activeClient.isEmpty
        ? 'Select BOQ Format'
        : _clientDisplayName(_activeClient);
    final fileLabel = !_canImportPdf
        ? (!hasProjectSelected
            ? 'Select project first'
            : 'Select BOQ format first')
        : _selectedFile != null
            ? (_extracting ? 'Extracting…' : _selectedFileLabel())
            : 'No file chosen';

    final actions = <Widget>[
      MadButton(
        text: formatButtonLabel,
        icon: _activeClient.isEmpty ? LucideIcons.plus : LucideIcons.pencil,
        variant: _activeClient.isEmpty ? ButtonVariant.primary : ButtonVariant.outline,
        disabled: !hasProjectSelected,
        onPressed: hasProjectSelected ? _showFormatDialog : null,
      ),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: _canImportPdf ? _pickPdfFile : null,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              constraints: const BoxConstraints(minHeight: 40),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                ),
                color: _canImportPdf
                    ? (isDark ? AppTheme.darkMuted.withValues(alpha: 0.25) : AppTheme.lightMuted.withValues(alpha: 0.35))
                    : (isDark ? AppTheme.darkMuted.withValues(alpha: 0.12) : AppTheme.lightMuted.withValues(alpha: 0.2)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.max,
                children: [
                  if (_extracting)
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    Icon(
                      LucideIcons.upload,
                      size: 16,
                      color: _canImportPdf
                          ? (isDark ? AppTheme.darkForeground : AppTheme.lightForeground)
                          : (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                    ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      fileLabel,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: _canImportPdf
                            ? (isDark ? AppTheme.darkForeground : AppTheme.lightForeground)
                            : (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_extractError != null) ...[
            const SizedBox(height: 4),
            Text(
              _extractError!,
              style: const TextStyle(fontSize: 12, color: Colors.red),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
      MadButton(
        text: 'Add Item',
        icon: LucideIcons.plus,
        disabled: !hasProjectSelected,
        onPressed: hasProjectSelected ? _openAddItemPage : null,
      ),
      MadButton(
        text: _isLoading ? 'Loading…' : 'Refresh',
        icon: LucideIcons.refreshCw,
        variant: ButtonVariant.outline,
        disabled: _isLoading,
        onPressed: _loadBOQItems,
      ),
      if (_hasSelection)
        MadButton(
          text: 'Delete Selected (${_selectedIds.length})',
          icon: LucideIcons.trash2,
          variant: ButtonVariant.destructive,
          disabled: !hasProjectSelected || _bulkDeleting,
          onPressed: _confirmDeleteSelected,
        ),
    ];

    return MadCard(
      child: Padding(
        padding: EdgeInsets.all(isMobile ? 12 : 14),
        child: isMobile
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final action in actions) ...[
                    SizedBox(width: double.infinity, child: action),
                    const SizedBox(height: 8),
                  ],
                ],
              )
            : Wrap(
                spacing: 10,
                runSpacing: 10,
                children: actions,
              ),
      ),
    );
  }

  

  Future<void> _showFormatDialog() async {
    if (_currentProjectId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a project first')),
      );
      return;
    }

    final client = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) {
        final isDark = Theme.of(sheetContext).brightness == Brightness.dark;
        final options = const [
          ('Lodha', _lodhaFormat, 'Lodha BOQ format'),
          ('Hiranandani', _hiranandaniFormat, 'Hiranandani BOQ format'),
        ];
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Select BOQ Format',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Choose the client format before creating the BOQ.',
                    style: TextStyle(
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                for (final option in options) ...[
                  InkWell(
                    onTap: () => Navigator.of(sheetContext).pop(option.$2),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            option.$1,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            option.$3,
                            style: TextStyle(
                              fontSize: 13,
                              color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                            ),
                          ),
                          if (_activeClient == option.$2) ...[
                            const SizedBox(height: 10),
                            const MadBadge(text: 'Selected', variant: BadgeVariant.secondary),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );

    if (client == null || client.isEmpty) return;
    setState(() {
      _activeClient = client;
      _selectedFile = null;
      _extractedItems = [];
      _extractError = null;
    });
    await _persistClientSelection(client);
  }

  Future<void> _pickPdfFile() async {
    if (_currentProjectId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a project first')),
      );
      return;
    }
    if (_activeClient.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select BOQ format first')),
      );
      return;
    }

    final file = await FileService.pickPdfFile();
    if (file == null) return;
    setState(() {
      _selectedFile = file;
      _extractError = null;
    });
    await _startPdfImport(file);
  }

  Future<void> _startPdfImport(File file) async {
    setState(() {
      _extracting = true;
      _extractError = null;
    });

    try {
      final result = await BOQExtractor.extractFromFile(
        file,
        client: _activeClient,
        projectId: _currentProjectId,
      );
      if (!mounted) return;
      if (result.error != null) {
        setState(() {
          _extracting = false;
          _extractError = result.error;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.error!), backgroundColor: Colors.red),
        );
        return;
      }

      final mapped = _mapExtractedItems(result.items);
      setState(() {
        _extracting = false;
        _extractedItems = mapped;
      });
      _showPdfImportPreview(result.projectName);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _extracting = false;
        _extractError = e.toString();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorHandler.getMessage(e)), backgroundColor: Colors.red),
      );
    }
  }

  List<Map<String, dynamic>> _mapExtractedItems(List<ExtractedBOQItem> items) {
    return items.asMap().entries.map((entry) {
      final item = entry.value;
      final quantity = double.tryParse(item.quantity.replaceAll(',', '')) ?? 0;
      final code = item.itemNo.isNotEmpty ? item.itemNo : 'BOQ-${entry.key + 1}';
      final base = <String, dynamic>{
        'id': entry.key + 1,
        'category': item.category.isNotEmpty ? item.category : 'General',
        'code': code,
        'item_no': code,
        'description': item.description,
        'unit': item.unit.isNotEmpty ? item.unit : 'Nos',
        'quantity': quantity,
        'rate': item.rate ?? 0.0,
        'amount': item.amount ?? 0.0,
        'floor': 'All',
        'rate_text': item.rateText,
        'amount_text': item.amountText,
        'qty_text': item.qtyText,
      };

      if (_activeClient == _lodhaFormat) {
        return {
          ...base,
          'item_code': item.hsn ?? '',
          'hsn': item.hsn ?? '',
        };
      }

      if (_activeClient == _hiranandaniFormat) {
        return {
          ...base,
          'item_code': item.sacCode ?? '',
          'sac_code': item.sacCode ?? '',
        };
      }

      return {
        ...base,
        'item_code': item.hsn ?? item.sacCode ?? '',
      };
    }).toList();
  }

  Widget _buildResponsiveTable(bool isDark, Responsive responsive) {
    final isMobile = responsive.isMobile;
    const checkboxWidth = 48.0;
    const categoryWidth = 140.0;
    const itemCodeWidth = 120.0;
    const descriptionWidth = 320.0;
    const floorWidth = 110.0;
    const unitWidth = 90.0;
    const qtyWidth = 110.0;
    const rateWidth = 130.0;
    const amountWidth = 140.0;
    const actionsWidth = 80.0;
    const horizontalCellPadding = 24.0; // 12 left + 12 right in header/rows/total rows
    const tableWidth = checkboxWidth +
        categoryWidth +
        itemCodeWidth +
        descriptionWidth +
        floorWidth +
        unitWidth +
        qtyWidth +
        rateWidth +
        amountWidth +
        actionsWidth +
        horizontalCellPadding;

    return MadCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isMobile) ...[
                  Text(
                    'BOQ Items',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: isDark
                          ? AppTheme.darkForeground
                          : AppTheme.lightForeground,
                    ),
                  ),
                  const SizedBox(height: 10),
                  MadSearchInput(
                    controller: _searchController,
                    hintText: 'Search by section, code, description...',
                    onChanged: (value) => setState(() {
                      _searchQuery = value;
                      _currentPage = 1;
                    }),
                    onClear: () => setState(() {
                      _searchQuery = '';
                      _currentPage = 1;
                    }),
                  ),
                ] else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          'BOQ Items',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground,
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 280,
                        child: MadSearchInput(
                          controller: _searchController,
                          hintText: 'Search by section, code, description...',
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
                    ],
                  ),
                if (_searchQuery.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Showing ${_filteredItems.length} of ${_items.length} item(s)',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (isMobile)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                    .withOpacity(0.35),
                border: Border(
                  bottom: BorderSide(
                    color:
                        (isDark ? Colors.white : Colors.black).withOpacity(0.08),
                  ),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.swipe,
                    size: 16,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Swipe horizontally to view all columns',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          SizedBox(
            height: responsive.value(
              mobile: 420.0,
              tablet: 470.0,
              desktop: 520.0,
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: tableWidth,
                child: Column(
                  children: [
                    _buildTableHeader(isDark),
                    Expanded(
                      child: ListView.separated(
                        itemCount: _paginatedItems.length,
                        separatorBuilder: (context, _) => Divider(
                          height: 1,
                          color: (isDark ? Colors.white : Colors.black)
                              .withOpacity(0.06),
                        ),
                        itemBuilder: (context, index) =>
                            _buildTableDataRow(_paginatedItems[index], isDark),
                      ),
                    ),
                    _buildTableTotalRow(isDark),
                  ],
                ),
              ),
            ),
          ),
          if (_totalPages > 1) _buildTablePagination(isDark, isMobile),
        ],
      ),
    );
  }


  Widget _buildTableHeader(bool isDark) {
    final isHiranandani = _activeClient == _hiranandaniFormat;
    final isLodha = _activeClient == _lodhaFormat;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(0.5),
        border: Border(
          bottom: BorderSide(
            color: (isDark ? Colors.white : Colors.black).withOpacity(0.1),
          ),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Checkbox(
              value: _isPageFullySelected
                  ? true
                  : _isPagePartiallySelected
                      ? null
                      : false,
              tristate: true,
              onChanged: _paginatedItems.isEmpty
                  ? null
                  : (value) => _togglePageSelection(value == true),
            ),
          ),
          _buildSizedHeaderCell('Section', 140, isDark),
          _buildSizedHeaderCell(isHiranandani || isLodha ? 'Item No' : 'Item Code', 120, isDark),
          _buildSizedHeaderCell('Description', 320, isDark),
          _buildSizedHeaderCell(isHiranandani ? 'SAC Code' : isLodha ? 'HSN' : 'Floor', 110, isDark),
          _buildSizedHeaderCell(isHiranandani ? 'UOM' : 'Unit', 90, isDark),
          _buildSizedHeaderCell(isHiranandani ? 'Order Qty' : 'Quantity', 110, isDark, align: TextAlign.right),
          _buildSizedHeaderCell(isHiranandani ? 'Unit Price' : 'Rate (Est.)', 130, isDark, align: TextAlign.right),
          _buildSizedHeaderCell(isHiranandani ? 'Value' : 'Amount', 140, isDark, align: TextAlign.right),
          _buildSizedHeaderCell('Action', 80, isDark, align: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildSizedHeaderCell(String label, double width, bool isDark, {TextAlign align = TextAlign.left}) {
    return SizedBox(
      width: width,
      child: Text(
        label,
        textAlign: align,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
        ),
      ),
    );
  }

  Widget _buildTableDataRow(BOQItem item, bool isDark) {
    final isHiranandani = _activeClient == _hiranandaniFormat;
    final isLodha = _activeClient == _lodhaFormat;
    final itemNo = item.itemNo ?? item.code ?? item.itemCode ?? '-';
    final auxCode = isHiranandani
        ? (item.sacCode ?? item.itemCode ?? '-')
        : isLodha
            ? (item.hsn ?? item.itemCode ?? '-')
            : (item.floor?.isNotEmpty == true ? item.floor! : '-');
    final rateText = (item.rate == null || item.rate == 0) ? null : Formatters.currency(item.rate);
    final amountText = (item.amount == null || item.amount == 0) ? null : Formatters.currency(item.amount);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Checkbox(
              value: _selectedIds.contains(item.id),
              onChanged: (value) =>
                  _toggleItemSelection(item.id, value == true),
            ),
          ),
          SizedBox(
            width: 140,
            child: Align(
              alignment: Alignment.centerLeft,
              child: MadBadge(text: item.category, variant: BadgeVariant.secondary),
            ),
          ),
          _buildSizedValueCell(itemNo, 120),
          _buildSizedValueCell(item.description, 320, maxLines: 2),
          _buildSizedValueCell(auxCode, 110),
          _buildSizedValueCell(item.unit, 90),
          _buildSizedValueCell(item.quantity.toString(), 110, align: TextAlign.right),
          _buildSizedValueCell(rateText ?? '–', 130, align: TextAlign.right),
          _buildSizedValueCell(amountText ?? '–', 140, align: TextAlign.right),
          SizedBox(
            width: 80,
            child: Align(
              alignment: Alignment.center,
              child: PopupMenuButton<String>(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                icon: Icon(
                  Icons.more_vert,
                  size: 18,
                  color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                ),
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text('Delete', style: TextStyle(color: Colors.red)),
                  ),
                ],
                onSelected: (value) {
                  if (value == 'edit') {
                    _showEditItemDialog(item);
                  } else if (value == 'delete') {
                    _showDeleteConfirmDialog(item);
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSizedValueCell(String value, double width, {int maxLines = 1, TextAlign align = TextAlign.left}) {
    return SizedBox(
      width: width,
      child: Text(
        value,
        textAlign: align,
        maxLines: maxLines,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  Widget _buildTableTotalRow(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: (isDark ? Colors.white : Colors.black).withOpacity(0.12),
          ),
        ),
        color: (isDark ? Colors.white : Colors.black).withOpacity(0.03),
      ),
      child: Row(
        children: [
          const SizedBox(width: 48),
          const SizedBox(width: 140),
          const SizedBox(width: 120),
          SizedBox(
            width: 320,
            child: Text(
              'Total',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
          ),
          const SizedBox(width: 110 + 90 + 110 + 130),
          SizedBox(
            width: 140,
            child: Text(
              '₹${_totalAmount.toStringAsFixed(2)}',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
          ),
          const SizedBox(width: 80),
        ],
      ),
    );
  }

  Widget _buildTablePagination(bool isDark, bool isMobile) {
    final summary = 'Showing ${(_currentPage - 1) * _itemsPerPage + 1}-'
        '${_currentPage * _itemsPerPage > _filteredItems.length ? _filteredItems.length : _currentPage * _itemsPerPage} '
        'of ${_filteredItems.length}';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: (isDark ? Colors.white : Colors.black).withOpacity(0.1),
          ),
        ),
      ),
      child: isMobile
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  summary,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    MadButton(
                      icon: LucideIcons.chevronLeft,
                      variant: ButtonVariant.outline,
                      size: ButtonSize.icon,
                      disabled: _currentPage == 1,
                      onPressed: () => setState(() => _currentPage--),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('$_currentPage / $_totalPages', style: const TextStyle(fontSize: 14)),
                    ),
                    MadButton(
                      icon: LucideIcons.chevronRight,
                      variant: ButtonVariant.outline,
                      size: ButtonSize.icon,
                      disabled: _currentPage == _totalPages,
                      onPressed: () => setState(() => _currentPage++),
                    ),
                  ],
                ),
              ],
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  summary,
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
                      size: ButtonSize.icon,
                      disabled: _currentPage == 1,
                      onPressed: () => setState(() => _currentPage--),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('$_currentPage of $_totalPages', style: const TextStyle(fontSize: 14)),
                    ),
                    MadButton(
                      icon: LucideIcons.chevronRight,
                      variant: ButtonVariant.outline,
                      size: ButtonSize.icon,
                      disabled: _currentPage == _totalPages,
                      onPressed: () => setState(() => _currentPage++),
                    ),
                  ],
                ),
              ],
            ),
    );
  }

  Widget _buildEmptyState(bool isDark, bool hasProjectSelected) {
    String title;
    String subtitle;

    if (!hasProjectSelected) {
      title = 'Select a project to load BOQ items.';
      subtitle = 'Choose a project to view and manage BOQ items.';
    } else if (_searchQuery.isNotEmpty) {
      title = 'No items found matching your search.';
      subtitle = 'Try a different search term.';
    } else {
      title = 'No BOQ items. Import a PDF or add items manually.';
      subtitle = 'Start by importing a BOQ PDF or adding a new item.';
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              LucideIcons.clipboardList,
              size: 64,
              color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withOpacity(0.3),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
              textAlign: TextAlign.center,
            ),
            if (_searchQuery.isEmpty && hasProjectSelected) ...[
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  MadButton(
                    text: 'Import PDF',
                    icon: LucideIcons.fileUp,
                    variant: ButtonVariant.outline,
                    onPressed: () => _showImportDialog(),
                  ),
                  const SizedBox(width: 12),
                  MadButton(
                    text: 'Add Item',
                    icon: LucideIcons.plus,
                    onPressed: _openAddItemPage,
                  ),
                ],
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
              'Failed to load BOQ items',
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
              onPressed: _loadBOQItems,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _importFromExcel() async {
    try {
      final excel = await ExcelService.importExcel();
      if (excel == null) return;

      final items = ExcelService.parseBOQFromExcel(excel);
      if (items == null || items.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No valid BOQ items found in file')),
        );
        return;
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Imported ${items.length} items')),
      );
      _loadBOQItems();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorHandler.getMessage(e))),
      );
    }
  }

  void _showImportDialog() {
    showDialog(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return AlertDialog(
          title: const Text('Import BOQ'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Select a file to import BOQ items',
                style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.pop(context);
                        _importFromExcel();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          children: [
                            Icon(LucideIcons.fileSpreadsheet, size: 32, color: const Color(0xFF22C55E)),
                            const SizedBox(height: 8),
                            const Text('Excel File', style: TextStyle(fontWeight: FontWeight.w500)),
                            const SizedBox(height: 4),
                            Text('.xlsx, .xls', style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.pop(context);
                        _importFromPdf();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          children: [
                            Icon(LucideIcons.fileText, size: 32, color: const Color(0xFFEF4444)),
                            const SizedBox(height: 8),
                            const Text('PDF File', style: TextStyle(fontWeight: FontWeight.w500)),
                            const SizedBox(height: 4),
                            Text('.pdf', style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _importFromPdf() async {
    await _pickPdfFile();
  }

  void _showPdfImportPreview(String projectName) {
    final items = _extractedItems;
    final codeLabel = _activeClient == _hiranandaniFormat ? 'Item No' : 'Code';
    final qtyLabel = _activeClient == _hiranandaniFormat ? 'Order Qty' : 'Qty';
    final valueLabel = _activeClient == _hiranandaniFormat ? 'Value' : 'Amount';
    final totalAmount = items.fold<double>(
      0,
      (sum, item) => sum + ((item['amount'] as num?)?.toDouble() ?? 0),
    );
    
    showDialog(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        Widget headerCell(String label, double width, {TextAlign align = TextAlign.left}) {
          return SizedBox(
            width: width,
            child: Text(
              label,
              textAlign: align,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
          );
        }

        Widget valueCell(String value, double width, {int maxLines = 1, TextAlign align = TextAlign.left}) {
          return SizedBox(
            width: width,
            child: Text(
              value.isEmpty ? '-' : value,
              textAlign: align,
              maxLines: maxLines,
              overflow: TextOverflow.ellipsis,
            ),
          );
        }

        Widget buildPreviewHeader() {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.5),
              border: Border(
                bottom: BorderSide(
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                ),
              ),
            ),
            child: Row(
              children: [
                headerCell('Section', 140),
                headerCell(codeLabel, 120),
                headerCell('Description', 320),
                headerCell(_activeClient == _hiranandaniFormat ? 'UOM' : 'Unit', 90),
                headerCell(qtyLabel, 110, align: TextAlign.right),
                headerCell(_activeClient == _hiranandaniFormat ? 'Unit Price' : 'Rate', 130, align: TextAlign.right),
                headerCell(valueLabel, 140, align: TextAlign.right),
              ],
            ),
          );
        }

        Widget buildPreviewRow(Map<String, dynamic> item) {
          final code = item['item_no']?.toString().trim().isNotEmpty == true
              ? item['item_no'].toString()
              : item['code']?.toString() ?? '-';
          final rate = item['rate'] == null || (item['rate'] as num?) == 0
              ? null
              : Formatters.currency(item['rate'] as num?);
          final amount = item['amount'] == null || (item['amount'] as num?) == 0
              ? null
              : Formatters.currency(item['amount'] as num?);
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                SizedBox(
                  width: 140,
                  child: MadBadge(
                    text: item['category']?.toString().isEmpty == true ? 'General' : item['category'].toString(),
                    variant: BadgeVariant.outline,
                  ),
                ),
                valueCell(code, 120),
                valueCell(item['description']?.toString() ?? '-', 320, maxLines: 2),
                valueCell(item['unit']?.toString() ?? '-', 90),
                valueCell(item['quantity']?.toString() ?? '0', 110, align: TextAlign.right),
                valueCell(rate ?? '–', 130, align: TextAlign.right),
                valueCell(amount ?? '–', 140, align: TextAlign.right),
              ],
            ),
          );
        }

        Widget buildTotalRow() {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
              border: Border(
                top: BorderSide(
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.12),
                ),
              ),
            ),
            child: Row(
              children: [
                const SizedBox(width: 140),
                const SizedBox(width: 120),
                SizedBox(
                  width: 320,
                  child: Text(
                    'Total',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                    ),
                  ),
                ),
                const SizedBox(width: 90 + 110 + 130),
                SizedBox(
                  width: 140,
                  child: Text(
                    Formatters.currency(totalAmount),
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        return Dialog(
          backgroundColor: isDark ? AppTheme.darkCard : Colors.white,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 900, maxHeight: 600),
            child: Column(
              children: [
                // Header
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Import Preview',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${items.length} items found${projectName.isNotEmpty ? ' • Project: $projectName' : ''}',
                            style: TextStyle(
                              fontSize: 13,
                              color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),
                // Table
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final tableWidth = 140.0 + 120.0 + 320.0 + 90.0 + 110.0 + 130.0 + 140.0 + 24.0;
                      return SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: SizedBox(
                          width: tableWidth,
                          height: constraints.maxHeight,
                          child: Column(
                            children: [
                              buildPreviewHeader(),
                              Expanded(
                                child: items.isEmpty
                                    ? Center(
                                        child: Text(
                                          'No items found.',
                                          style: TextStyle(
                                            color: isDark
                                                ? AppTheme.darkMutedForeground
                                                : AppTheme.lightMutedForeground,
                                          ),
                                        ),
                                      )
                                    : ListView.separated(
                                        itemCount: items.take(50).length,
                                        separatorBuilder: (context, _) => Divider(
                                          height: 1,
                                          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.06),
                                        ),
                                        itemBuilder: (context, index) => buildPreviewRow(items[index]),
                                      ),
                              ),
                              if (items.isNotEmpty) buildTotalRow(),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (items.length > 50)
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Text(
                      'Showing first 50 of ${items.length} items',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ),
                // Footer
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      MadButton(
                        text: 'Cancel',
                        variant: ButtonVariant.outline,
                        onPressed: () => Navigator.pop(context),
                      ),
                      const SizedBox(width: 12),
                      MadButton(
                        text: _savingImport ? 'Replacing...' : 'Replace Existing',
                        variant: ButtonVariant.outline,
                        disabled: _savingImport,
                        onPressed: () {
                          Navigator.pop(context);
                          _savePdfImport(items, replace: true);
                        },
                      ),
                      const SizedBox(width: 12),
                      MadButton(
                        text: _savingImport ? 'Saving...' : 'Add to BOQ',
                        disabled: _savingImport,
                        onPressed: () {
                          Navigator.pop(context);
                          _savePdfImport(items, replace: false);
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _savePdfImport(List<Map<String, dynamic>> items, {required bool replace}) async {
    final projectId = _currentProjectId;

    if (projectId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a project first')),
      );
      return;
    }

    setState(() => _savingImport = true);
    try {
      if (replace && _scopedItems.isNotEmpty) {
        for (final item in _scopedItems) {
          await ApiClient.deleteBOQ(item.id);
        }
      }

      int successCount = 0;
      for (final item in items) {
        final result = _activeClient == _lodhaFormat
            ? await ApiClient.createBOQLodha({
                'project_id': projectId,
                'description': item['description'] ?? '',
                'section': item['category'] ?? 'General',
                'item_no': item['item_no'] ?? item['code'] ?? '',
                'hsn': item['hsn'] ?? '',
                'unit': item['unit'] ?? 'Nos',
                'qty': item['quantity'] ?? 0,
                'rate': item['rate'] ?? 0,
                'amount': item['amount'] ?? 0,
                'floor': item['floor'] ?? 'All',
              })
            : _activeClient == _hiranandaniFormat
                ? await ApiClient.createBOQHiranandani({
                    'project_id': projectId,
                    'description': item['description'] ?? '',
                    'section': item['category'] ?? 'General',
                    'item_no': item['item_no'] ?? item['code'] ?? '',
                    'sac_code': item['sac_code'] ?? '',
                    'uom': item['unit'] ?? 'Nos',
                    'order_qty': item['quantity'] ?? 0,
                    'unit_price': item['rate'] ?? 0,
                    'value': item['amount'] ?? 0,
                    'floor': item['floor'] ?? 'All',
                  })
                : await ApiClient.createBOQ({
                    'project_id': projectId,
                    'item_code': item['item_code'] ?? '',
                    'description': item['description'] ?? '',
                    'category': item['category'] ?? 'General',
                    'floor': item['floor'] ?? 'All',
                    'quantity': (item['quantity'] ?? 0).toString(),
                    'unit': item['unit'] ?? 'Nos',
                    'rate': (item['rate'] ?? 0).toString(),
                    'amount': (item['amount'] ?? 0).toString(),
                  });
        if (result['success'] == true) {
          successCount++;
        }
      }

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Successfully imported $successCount of ${items.length} items'),
          backgroundColor: Colors.green,
        ),
      );

      await _loadBOQItems();
      setState(() {
        _selectedFile = null;
        _extractedItems = [];
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorHandler.getMessage(e)), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) {
        setState(() => _savingImport = false);
      }
    }
  }

  Future<void> _openAddItemPage() async {
    final projectId = _currentProjectId;
    if (projectId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a project first')),
      );
      return;
    }

    final added = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _AddBOQItemPage(
          projectId: projectId,
          activeClient: _activeClient,
        ),
      ),
    );

    if (added == true && mounted) {
      _loadBOQItems();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('BOQ item added successfully')),
      );
    }
  }

  void _showEditItemDialog(BOQItem item) {
    final itemCodeController = TextEditingController(
      text: item.itemCode ?? item.hsn ?? item.sacCode ?? item.code ?? '',
    );
    final descriptionController = TextEditingController(text: item.description);
    final categoryController = TextEditingController(text: item.category);
    final quantityController = TextEditingController(text: item.quantity.toString());
    final unitController = TextEditingController(text: item.unit);
    final rateController = TextEditingController(text: item.rate?.toString() ?? '');
    final floorController = TextEditingController(text: item.floor ?? '');
    final client = _activeClient;

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          client == _lodhaFormat
              ? 'Edit Lodha BOQ Item'
              : client == _hiranandaniFormat
                  ? 'Edit Hiranandani BOQ Item'
                  : 'Edit BOQ Item',
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              MadInput(
                controller: itemCodeController,
                labelText: client == _lodhaFormat
                    ? 'HSN/SAC Code'
                    : client == _hiranandaniFormat
                        ? 'SAC Code'
                        : 'Item Code',
                hintText: 'Enter code',
              ),
              const SizedBox(height: 16),
              MadInput(
                controller: descriptionController,
                labelText: client == _hiranandaniFormat ? 'Service Description' : 'Item Description',
                hintText: 'Enter description',
              ),
              const SizedBox(height: 16),
              MadInput(
                controller: categoryController,
                labelText: 'Section',
                hintText: 'Enter section',
              ),
              const SizedBox(height: 16),
              MadInput(
                controller: floorController,
                labelText: 'Floor',
                hintText: 'Enter floor',
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: MadInput(
                      controller: quantityController,
                      labelText: client == _hiranandaniFormat ? 'Order Qty' : 'Qty',
                      hintText: '0',
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: MadInput(
                      controller: unitController,
                      labelText: client == _hiranandaniFormat ? 'UOM' : 'Unit',
                      hintText: 'e.g. KG',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: MadInput(
                      controller: rateController,
                      labelText: client == _hiranandaniFormat ? 'Unit Price' : 'Rate',
                      hintText: '0.00',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final quantity = double.tryParse(quantityController.text) ?? 0;
              final rate = double.tryParse(rateController.text) ?? 0;
              final amount = quantity * rate;

              final data = {
                'project_id': item.projectId ?? _currentProjectId,
                'item_code': itemCodeController.text,
                'description': descriptionController.text,
                'category': categoryController.text,
                'floor': floorController.text,
                'quantity': quantity.toString(),
                'unit': unitController.text,
                'rate': rate.toString(),
                'amount': amount.toString(),
              };

              Navigator.pop(dialogContext);

              final result = client == _lodhaFormat
                  ? await ApiClient.updateBOQ(item.id, {
                      ...data,
                      'section': data['category'],
                      'item_no': itemCodeController.text,
                      'hsn': itemCodeController.text,
                      'qty': data['quantity'],
                    })
                  : client == _hiranandaniFormat
                      ? await ApiClient.updateBOQ(item.id, {
                          ...data,
                          'section': data['category'],
                          'item_no': itemCodeController.text,
                          'sac_code': itemCodeController.text,
                          'order_qty': data['quantity'],
                          'uom': data['unit'],
                          'unit_price': data['rate'],
                          'value': data['amount'],
                        })
                      : await ApiClient.updateBOQ(item.id, data);
              if (!mounted) return;

              if (result['success'] == true) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('BOQ item updated successfully')),
                );
                _loadBOQItems();
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(ErrorHandler.getMessage(result['error'] ?? 'Failed to update item'))),
                );
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirmDialog(BOQItem item) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete BOQ Item'),
        content: Text(
          'Are you sure you want to delete "${item.description}"? This action cannot be undone.',
          style: TextStyle(
            color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              final result = await ApiClient.deleteBOQ(item.id);
              if (!mounted) return;
              if (result['success'] == true) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('BOQ item deleted')),
                );
                _loadBOQItems();
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(ErrorHandler.getMessage(result['error'] ?? 'Failed to delete'))),
                );
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
