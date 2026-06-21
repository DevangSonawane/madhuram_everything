import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class SampleCreatePage extends StatefulWidget {
  final String initialProjectId;

  const SampleCreatePage({super.key, this.initialProjectId = ''});

  @override
  State<SampleCreatePage> createState() => _SampleCreatePageState();
}

class _SampleCreatePageState extends State<SampleCreatePage> {
  bool _saving = false;
  String _projectId = '';
  final TextEditingController _projectIdController = TextEditingController();
  List<String> _uploadFilePaths = [];
  String _selectedUploadedFile = '';
  bool _loadingProjectBoqItems = false;
  String _boqSearch = '';
  String _activeBoqClient = '';
  String? _addingBoqKey;
  List<Map<String, dynamic>> _projectBoqItems = [];
  final Map<String, String> _pendingBoqQty = {};
  String _itemFieldKey = '';
  String _itemFieldValue = '';
  int? _itemFieldRowIndex;

  final Map<String, dynamic> _createForm = {
    'sample_id': '',
    'building_name': '',
    'site_name': '',
    'work_done': '',
    'sample_file': '',
    'location': {'floor': '', 'block': '', 'wing': '', 'coordinates': ''},
    'item_description': [
      {
        'sr_no': '',
        'description': '',
        'quantity': '',
        'value': '',
        'add_fields': [],
      },
    ],
    'add_fields': [],
  };

  @override
  void initState() {
    super.initState();
    _projectId = widget.initialProjectId;
    _projectIdController.text = _projectId;
  }

  @override
  void dispose() {
    _projectIdController.dispose();
    super.dispose();
  }

  Future<void> _uploadSampleFiles() async {
    final files = await FileService.pickMultipleFilesWithSource(context: context);
    if (files.isEmpty) return;

    final res = await ApiClient.uploadSampleFiles(files);
    if (!mounted) return;
    if (res['success'] == true) {
      final data = res['data'] as Map?;
      final filePaths =
          (data?['filePaths'] as List?)?.map((e) => e.toString()).toList() ??
          [];
      setState(() {
        _uploadFilePaths = filePaths;
        if (filePaths.isNotEmpty) {
          _selectedUploadedFile = filePaths.first;
          _createForm['sample_file'] = filePaths.first;
        }
      });
      showToast(context, 'Uploaded ${filePaths.length} file(s)');
    } else {
      showToast(
        context,
        res['error']?.toString() ?? 'Upload failed',
        variant: ToastVariant.error,
      );
    }
  }

  String _fileNameFromPath(String path) {
    final parts = path.split(RegExp(r'[/\\]'));
    if (parts.isEmpty) return path;
    return parts.last.isEmpty ? path : parts.last;
  }

  String _cleanToken(dynamic value) {
    final text = value?.toString().trim() ?? '';
    if (text.isEmpty) return '';
    final lower = text.toLowerCase();
    if (lower == '-' || lower == '_' || lower == 'na' || lower == 'n/a' || lower == 'null' || lower == 'undefined') {
      return '';
    }
    return text;
  }

  Map<String, dynamic> _deriveBoqFields(Map<String, dynamic> item) {
    final raw = Map<String, dynamic>.from(item);
    final qtyRaw = raw['quantity'] ?? raw['qty'] ?? raw['order_qty'] ?? raw['orderQty'];
    final rateRaw = raw['rate'] ?? raw['unit_price'] ?? raw['unitPrice'];
    final amountRaw = raw['amount'] ?? raw['value'];
    return {
      'id': raw['boq_id'] ?? raw['id'] ?? '',
      'item_no': raw['item_no'] ?? raw['itemNo'] ?? '',
      'item_code': raw['item_code'] ?? raw['itemCode'] ?? raw['code'] ?? '',
      'section': raw['category'] ?? raw['section'] ?? raw['section_name'] ?? raw['sectionName'] ?? '',
      'description': raw['description'] ?? raw['item_description'] ?? raw['service_description'] ?? '',
      'unit': raw['unit'] ?? raw['uom'] ?? raw['UOM'] ?? '',
      'qty': qtyRaw ?? '',
      'rate': rateRaw ?? '',
      'amount': amountRaw ?? '',
      'hsn': raw['hsn'] ?? raw['hsn_sac_code'] ?? '',
      'sac_code': raw['sac_code'] ?? '',
      'client': raw['client'] ?? raw['client_format'] ?? raw['boq_client'] ?? '',
    };
  }

  String _boqItemKey(Map<String, dynamic> item) {
    final derived = _deriveBoqFields(item);
    final id = derived['id'].toString().trim();
    if (id.isNotEmpty) return id;
    final itemNo = derived['item_no'].toString().trim();
    if (itemNo.isNotEmpty) return itemNo;
    final code = derived['item_code'].toString().trim();
    if (code.isNotEmpty) return code;
    return '${derived['description']}_${derived['section']}';
  }

  bool _matchesBoqClient(Map<String, dynamic> item, String client) {
    final c = client.trim().toLowerCase();
    if (c.isEmpty) return true;
    final derived = _deriveBoqFields(item);
    final explicit = derived['client'].toString().trim().toLowerCase();
    if (explicit.isNotEmpty && explicit == c) return true;
    final itemNo = derived['item_no'].toString().trim();
    final hasHsn = derived['hsn'].toString().trim().isNotEmpty;
    final hasSac = derived['sac_code'].toString().trim().isNotEmpty;
    final isLodhaNo = RegExp(r'^\d+(\.\d+){1,3}$').hasMatch(itemNo);
    final isHiraNo = RegExp(r'^\(\d+\)$').hasMatch(itemNo);
    final hasAnySignal = hasHsn || hasSac || isLodhaNo || isHiraNo;
    if (c == 'lodha') {
      if (hasHsn || isLodhaNo) return true;
      if (!hasAnySignal) return true;
      if (hasSac || isHiraNo) return false;
      return true;
    }
    if (c == 'hiranandani') {
      if (hasSac || isHiraNo) return true;
      if (!hasAnySignal) return true;
      if (hasHsn || isLodhaNo) return false;
      return true;
    }
    return true;
  }

  double _toFiniteNumber(dynamic value) {
    final cleaned = value == null ? '' : value.toString().replaceAll(',', '').trim();
    return double.tryParse(cleaned) ?? 0;
  }

  double _getBoqRemainingQty(Map<String, dynamic> item) {
    final derived = _deriveBoqFields(item);
    return _toFiniteNumber(derived['qty']);
  }

  Future<List<Map<String, dynamic>>> _refreshProjectBoqItems() async {
    if (_projectId.trim().isEmpty) {
      setState(() {
        _projectBoqItems = [];
        _activeBoqClient = '';
      });
      return [];
    }

    final res = await ApiClient.getBOQsByProject(_projectId.trim());
    if (!mounted) return [];
    if (res['success'] != true) {
      setState(() {
        _projectBoqItems = [];
        _activeBoqClient = '';
      });
      return [];
    }

    final payload = res['data'];
    final items = payload is List
        ? payload
        : payload is Map && payload['boqs'] is List
            ? payload['boqs'] as List
            : payload is Map && payload['items'] is List
                ? payload['items'] as List
                : payload is Map && payload['data'] is List
                    ? payload['data'] as List
                    : const [];

    final rows = items.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    String client = '';
    final storedClient = _cleanToken((payload is Map) ? payload['client'] ?? payload['boq_client'] : '');
    if (storedClient.isNotEmpty) {
      client = storedClient.toLowerCase();
    } else {
      final hasLodha = rows.any((row) {
        final derived = _deriveBoqFields(row);
        return derived['hsn'].toString().trim().isNotEmpty ||
            RegExp(r'^\d+(\.\d+){1,3}$').hasMatch(derived['item_no'].toString().trim());
      });
      final hasHira = rows.any((row) {
        final derived = _deriveBoqFields(row);
        return derived['sac_code'].toString().trim().isNotEmpty ||
            RegExp(r'^\(\d+\)$').hasMatch(derived['item_no'].toString().trim());
      });
      if (hasHira && !hasLodha) client = 'hiranandani';
      if (hasLodha && !hasHira) client = 'lodha';
    }

    final filtered = rows.where((row) => _matchesBoqClient(row, client)).toList();
    setState(() {
      _activeBoqClient = client;
      _projectBoqItems = filtered;
    });
    return filtered;
  }

  void _addManualSampleItemRow() {
    final items = List<Map<String, dynamic>>.from(_createForm['item_description'] as List);
    items.add({
      '_row_type': 'manual',
      'sr_no': '',
      'description': '',
      'quantity': '',
      'value': '',
      'unit': '',
      'add_fields': [],
    });
    setState(() => _createForm['item_description'] = items);
  }

  void _clearItemTable() {
    setState(() => _createForm['item_description'] = []);
  }

  void _openBoqDescriptionPreview(Map<String, dynamic> item) {
    final derived = _deriveBoqFields(item);
    MadDialog.show(
      context: context,
      title: 'BOQ Item Description',
      content: SizedBox(
        width: 520,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _boqInfoRow('Item Code', derived['item_code'].toString()),
            _boqInfoRow('Item No', derived['item_no'].toString()),
            _boqInfoRow('Section', derived['section'].toString()),
            if (_activeBoqClient == 'lodha') _boqInfoRow('HSN', derived['hsn'].toString()),
            if (_activeBoqClient == 'hiranandani') _boqInfoRow('SAC Code', derived['sac_code'].toString()),
            _boqInfoRow('Unit', derived['unit'].toString()),
            _boqInfoRow('Qty', derived['qty'].toString()),
            _boqInfoRow('Rate', derived['rate'].toString()),
            _boqInfoRow('Amount', derived['amount'].toString()),
            const SizedBox(height: 12),
            Text(
              derived['description'].toString(),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
      actions: [
        MadButton(text: 'Close', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
      ],
    );
  }

  Widget _boqInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ),
          Expanded(
            child: Text(value.isEmpty ? '-' : value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildBoqPickerHeader(bool isDark) {
    final client = _activeBoqClient;
    final itemCodeLabel = client == 'hiranandani' ? 'Item No' : 'Item Code';
    final auxLabel = client == 'lodha'
        ? 'HSN'
        : client == 'hiranandani'
            ? 'SAC Code'
            : 'Floor';

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

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.5),
        border: Border(
          bottom: BorderSide(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
          ),
        ),
      ),
      child: Row(
        children: [
          headerCell('Section', 140),
          headerCell(itemCodeLabel, 120),
          headerCell('Description', 320),
          headerCell(auxLabel, 120),
          headerCell('Unit', 90),
          headerCell('Qty', 100, align: TextAlign.right),
          headerCell(client == 'hiranandani' ? 'Unit Price' : 'Rate', 120, align: TextAlign.right),
          headerCell(client == 'hiranandani' ? 'Value' : 'Amount', 130, align: TextAlign.right),
          headerCell('Action', 220, align: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildBoqPickerRow(
    Map<String, dynamic> item,
    bool isDark,
    StateSetter dialogSetState,
  ) {
    final derived = _deriveBoqFields(item);
    final key = _boqItemKey(item);
    final availableQty = _getBoqRemainingQty(item);
    final isAdding = _addingBoqKey == key;
    final pendingQty = _pendingBoqQty[key];
    final client = _activeBoqClient;
    final itemCode = client == 'hiranandani'
        ? (derived['item_no'].toString().isNotEmpty ? derived['item_no'].toString() : '-')
        : (derived['item_code'].toString().isNotEmpty ? derived['item_code'].toString() : '-');
    final auxValue = client == 'lodha'
        ? (derived['hsn'].toString().isNotEmpty ? derived['hsn'].toString() : '-')
        : client == 'hiranandani'
            ? (derived['sac_code'].toString().isNotEmpty ? derived['sac_code'].toString() : '-')
            : (derived['section'].toString().isNotEmpty ? derived['section'].toString() : '-');
    final rate = _toFiniteNumber(derived['rate']);
    final amount = _toFiniteNumber(derived['amount']);

    Widget cell(String value, double width, {int maxLines = 1, TextAlign align = TextAlign.left}) {
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

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: MadBadge(
              text: derived['section'].toString().isEmpty ? 'General' : derived['section'].toString(),
              variant: BadgeVariant.outline,
            ),
          ),
          cell(itemCode, 120),
          SizedBox(
            width: 320,
            child: InkWell(
              onTap: () => _openBoqDescriptionPreview(item),
              child: Text(
                derived['description'].toString().isEmpty ? '-' : derived['description'].toString(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          cell(auxValue, 120),
          cell(derived['unit'].toString(), 90),
          cell(availableQty.toString(), 100, align: TextAlign.right),
          cell(rate > 0 ? '₹${rate.toStringAsFixed(2)}' : '–', 120, align: TextAlign.right),
          cell(amount > 0 ? '₹${amount.toStringAsFixed(2)}' : '–', 130, align: TextAlign.right),
          SizedBox(
            width: 220,
            child: Align(
              alignment: Alignment.centerRight,
              child: isAdding
                  ? Wrap(
                      alignment: WrapAlignment.end,
                      runSpacing: 8,
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        MadButton(
                          icon: LucideIcons.minus,
                          size: ButtonSize.icon,
                          variant: ButtonVariant.outline,
                          onPressed: () {
                            final current = int.tryParse(_pendingBoqQty[key] ?? '1') ?? 1;
                            dialogSetState(() => _pendingBoqQty[key] = (current - 1).clamp(1, 999999).toString());
                          },
                        ),
                        SizedBox(
                          width: 72,
                          child: MadInput(
                            labelText: '',
                            controller: TextEditingController(text: pendingQty ?? '1'),
                            onChanged: (v) => dialogSetState(() => _pendingBoqQty[key] = v),
                          ),
                        ),
                        MadButton(
                          icon: LucideIcons.plus,
                          size: ButtonSize.icon,
                          variant: ButtonVariant.outline,
                          onPressed: () {
                            final current = int.tryParse(_pendingBoqQty[key] ?? '1') ?? 1;
                            dialogSetState(() => _pendingBoqQty[key] = (current + 1).toString());
                          },
                        ),
                        MadButton(
                          text: 'Apply',
                          onPressed: () {
                            final qty = int.tryParse(_pendingBoqQty[key] ?? '') ?? 0;
                            if (qty <= 0) return;
                            _addBoqItemToSampleItems(item, qty);
                            dialogSetState(() {
                              _addingBoqKey = null;
                              _pendingBoqQty.remove(key);
                            });
                            Navigator.of(context, rootNavigator: true).maybePop();
                          },
                        ),
                        MadButton(
                          text: 'Cancel',
                          variant: ButtonVariant.outline,
                          onPressed: () {
                            dialogSetState(() {
                              _addingBoqKey = null;
                              _pendingBoqQty.remove(key);
                            });
                          },
                        ),
                      ],
                    )
                  : MadButton(
                      text: 'Add',
                      onPressed: availableQty <= 0
                          ? null
                          : () {
                              dialogSetState(() {
                                _addingBoqKey = key;
                                _pendingBoqQty[key] = '1';
                              });
                            },
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openBoqPicker() async {
    if (_projectId.trim().isEmpty) {
      showToast(context, 'Select a project first', variant: ToastVariant.error);
      return;
    }
    setState(() => _loadingProjectBoqItems = true);
    try {
      final items = await _refreshProjectBoqItems();
      if (!mounted) return;
      if (items.isEmpty) {
        showToast(context, 'No BOQ items found for this project.');
      }
      _showBoqPickerDialog();
    } finally {
      if (mounted) setState(() => _loadingProjectBoqItems = false);
    }
  }

  void _closeBoqPicker() {
    if (!mounted) return;
    setState(() {
      _boqSearch = '';
      _addingBoqKey = null;
      _pendingBoqQty.clear();
    });
    Navigator.of(context, rootNavigator: true).maybePop();
  }

  void _showBoqPickerDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    MadDialog.show(
      context: context,
      title: 'BOQ Items',
      maxWidth: 1200,
      content: StatefulBuilder(
        builder: (context, dialogSetState) {
          final filtered = _filteredBoqItems;
          final tableWidth = 140.0 + 120.0 + 320.0 + 120.0 + 90.0 + 100.0 + 120.0 + 130.0 + 220.0 + 24.0;
          return SizedBox(
            width: double.maxFinite,
            height: 600,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        labelText: 'Search',
                        hintText: 'Search by item no, section, unit, or description',
                        onChanged: (v) => dialogSetState(() => _boqSearch = v),
                      ),
                    ),
                    const SizedBox(width: 12),
                    MadButton(
                      text: 'Refresh',
                      variant: ButtonVariant.outline,
                      icon: _loadingProjectBoqItems ? null : LucideIcons.refreshCw,
                      loading: _loadingProjectBoqItems,
                      onPressed: _loadingProjectBoqItems
                          ? null
                          : () async {
                              setState(() => _loadingProjectBoqItems = true);
                              try {
                                await _refreshProjectBoqItems();
                                dialogSetState(() {});
                              } finally {
                                if (mounted) setState(() => _loadingProjectBoqItems = false);
                              }
                            },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.35),
                    border: Border(
                      bottom: BorderSide(
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        LucideIcons.moveHorizontal,
                        size: 16,
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Swipe horizontally to view all columns',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: filtered.isEmpty
                      ? const Center(child: Text('No BOQ items found.'))
                      : SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: SizedBox(
                            width: tableWidth,
                            height: 520,
                            child: Column(
                              children: [
                                _buildBoqPickerHeader(isDark),
                                Expanded(
                                  child: ListView.separated(
                                    itemCount: filtered.length,
                                    separatorBuilder: (context, _) => Divider(
                                      height: 1,
                                      color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.06),
                                    ),
                                    itemBuilder: (context, index) => _buildBoqPickerRow(
                                      filtered[index],
                                      isDark,
                                      dialogSetState,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                ),
              ],
            ),
          );
        },
      ),
      actions: [
        MadButton(text: 'Close', variant: ButtonVariant.outline, onPressed: _closeBoqPicker),
      ],
    );
  }

  List<Map<String, dynamic>> get _filteredBoqItems {
    final q = _boqSearch.trim().toLowerCase();
    if (q.isEmpty) return _projectBoqItems;
    return _projectBoqItems.where((item) {
      final derived = _deriveBoqFields(item);
      final blob = [
        derived['item_no'],
        derived['item_code'],
        derived['section'],
        derived['description'],
        derived['unit'],
        derived['hsn'],
        derived['sac_code'],
      ].join(' ').toLowerCase();
      return blob.contains(q);
    }).toList();
  }

  void _addBoqItemToSampleItems(Map<String, dynamic> boqItem, int selectedQty) {
    final derived = _deriveBoqFields(boqItem);
    final key = _boqItemKey(boqItem);
    final rate = _toFiniteNumber(derived['rate']);
    final amount = rate > 0 ? rate * selectedQty : _toFiniteNumber(derived['amount']);
    final row = <String, dynamic>{
      '_row_type': 'boq',
      'sr_no': _createForm['item_description'].length.toString(),
      'description': derived['description'].toString(),
      'unit': derived['unit'].toString(),
      'quantity': selectedQty.toString(),
      'value': amount > 0 ? amount.toString() : '',
      'add_fields': [
        {'key': 'boq_id', 'value': derived['id'].toString()},
        {'key': 'boq_key', 'value': key},
        {'key': 'item_code', 'value': derived['item_code'].toString()},
        {'key': 'item_no', 'value': derived['item_no'].toString()},
        {'key': 'section', 'value': derived['section'].toString()},
        {'key': 'description', 'value': derived['description'].toString()},
        {'key': 'unit', 'value': derived['unit'].toString()},
        {'key': 'qty', 'value': selectedQty.toString()},
        {'key': 'rate', 'value': derived['rate'].toString()},
        {'key': 'amount', 'value': amount > 0 ? amount.toString() : ''},
        {'key': 'hsn', 'value': derived['hsn'].toString()},
        {'key': 'sac_code', 'value': derived['sac_code'].toString()},
        {'key': 'selected_qty', 'value': selectedQty.toString()},
        {'key': 'project_id', 'value': _projectId.trim()},
      ],
    };

    setState(() {
      final items = List<Map<String, dynamic>>.from(_createForm['item_description'] as List);
      final existingIndex = items.indexWhere((existing) {
        final fields = List<Map<String, dynamic>>.from(existing['add_fields'] as List? ?? []);
        final existingKey = fields.firstWhere(
          (f) => (f['key'] ?? '').toString().trim() == 'boq_key',
          orElse: () => <String, dynamic>{'value': ''},
        )['value']
            .toString();
        return existingKey == key;
      });
      if (existingIndex < 0) {
        items.add(row);
      } else {
        final existing = Map<String, dynamic>.from(items[existingIndex]);
        final existingQty = _toFiniteNumber(existing['quantity']);
        final nextQty = existingQty + selectedQty;
        existing['quantity'] = nextQty.toString();
        existing['value'] = (rate > 0 ? rate * nextQty : amount).toString();
        final fields = List<Map<String, dynamic>>.from(existing['add_fields'] as List? ?? []);
        for (var i = 0; i < fields.length; i++) {
          if ((fields[i]['key'] ?? '').toString() == 'qty' || (fields[i]['key'] ?? '').toString() == 'selected_qty' || (fields[i]['key'] ?? '').toString() == 'amount') {
            if ((fields[i]['key'] ?? '').toString() == 'qty' || (fields[i]['key'] ?? '').toString() == 'selected_qty') {
              fields[i] = {'key': fields[i]['key'], 'value': nextQty.toString()};
            } else {
              fields[i] = {'key': fields[i]['key'], 'value': (rate > 0 ? rate * nextQty : amount).toString()};
            }
          }
        }
        existing['add_fields'] = fields;
        items[existingIndex] = existing;
      }
      _createForm['item_description'] = items;
    });
    showToast(context, 'BOQ item added.');
  }

  Future<void> _saveSample() async {
    final projectId = _projectIdController.text.trim();
    if (projectId.isEmpty) {
      showToast(context, 'Select a project first', variant: ToastVariant.error);
      return;
    }
    setState(() => _saving = true);
    final payload = Map<String, dynamic>.from(_createForm);
    payload['project_id'] = projectId;
    final res = await ApiClient.createSample(payload);
    if (!mounted) return;
    setState(() => _saving = false);
    if (res['success'] == true) {
      showToast(context, 'Sample created');
      Navigator.pop(context, true);
    } else {
      showToast(
        context,
        res['error']?.toString() ?? 'Create failed',
        variant: ToastVariant.error,
      );
    }
  }

  void _removeItemField(int rowIndex, int fieldIndex) {
    final items = List<Map<String, dynamic>>.from(
      _createForm['item_description'] as List,
    );
    if (rowIndex < 0 || rowIndex >= items.length) return;
    final item = Map<String, dynamic>.from(items[rowIndex]);
    final fields = List<Map<String, dynamic>>.from(
      item['add_fields'] as List? ?? [],
    );
    if (fieldIndex < 0 || fieldIndex >= fields.length) return;
    fields.removeAt(fieldIndex);
    item['add_fields'] = fields;
    items[rowIndex] = item;
    setState(() => _createForm['item_description'] = items);
  }

  Future<void> _openAttachmentPreview() async {
    if (_selectedUploadedFile.trim().isEmpty) return;
    final uri = Uri.parse(
      ApiClient.getApiFileUrl(_selectedUploadedFile.trim()),
    );
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        mounted) {
      showToast(
        context,
        'Could not open attachment',
        variant: ToastVariant.error,
      );
    }
  }

  void _openItemFieldDialog(int rowIndex) {
    _itemFieldRowIndex = rowIndex;
    _itemFieldKey = '';
    _itemFieldValue = '';
    MadFormDialog.show(
      context: context,
      title: 'Add Item Field',
      maxWidth: 420,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MadInput(labelText: 'Key', onChanged: (v) => _itemFieldKey = v),
          const SizedBox(height: 12),
          MadInput(labelText: 'Value', onChanged: (v) => _itemFieldValue = v),
        ],
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () => Navigator.pop(context),
        ),
        MadButton(
          text: 'Add',
          onPressed: () {
            final key = _itemFieldKey.trim();
            final value = _itemFieldValue.trim();
            if (key.isEmpty || value.isEmpty || _itemFieldRowIndex == null) {
              showToast(
                context,
                'Enter both key and value',
                variant: ToastVariant.error,
              );
              return;
            }
            final items = List<Map<String, dynamic>>.from(
              _createForm['item_description'] as List,
            );
            final item = Map<String, dynamic>.from(items[_itemFieldRowIndex!]);
            final fields = List<Map<String, dynamic>>.from(
              item['add_fields'] as List? ?? [],
            );
            fields.add({'key': key, 'value': value});
            item['add_fields'] = fields;
            items[_itemFieldRowIndex!] = item;
            setState(() => _createForm['item_description'] = items);
            Navigator.pop(context);
          },
        ),
      ],
    );
  }

  Widget _buildSampleItemSection(bool isDark, bool isMobile) {
    final items = List<Map<String, dynamic>>.from(_createForm['item_description'] as List);

    Widget buildRow(Map<String, dynamic> row, int index) {
      final isBoqRow = (row['_row_type'] ?? '').toString().toLowerCase() == 'boq';
      final fields = List<Map<String, dynamic>>.from(row['add_fields'] as List? ?? []);
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: MadCard(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: MadTextarea(
                        labelText: 'Description',
                        minLines: 2,
                        controller: TextEditingController(text: row['description']?.toString() ?? ''),
                        onChanged: (v) {
                          row['description'] = v;
                          _createForm['item_description'] = items;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        crossAxisAlignment: WrapCrossAlignment.end,
                        children: [
                          SizedBox(
                            width: 110,
                            child: MadInput(
                              labelText: 'Unit',
                              controller: TextEditingController(text: row['unit']?.toString() ?? ''),
                              onChanged: (v) {
                                row['unit'] = v;
                                _createForm['item_description'] = items;
                              },
                            ),
                          ),
                          SizedBox(
                            width: 110,
                            child: MadInput(
                              labelText: 'Qty',
                              controller: TextEditingController(text: row['quantity']?.toString() ?? ''),
                              onChanged: (v) {
                                row['quantity'] = v;
                                _createForm['item_description'] = items;
                              },
                            ),
                          ),
                          SizedBox(
                            width: 110,
                            child: MadInput(
                              labelText: 'Value',
                              controller: TextEditingController(text: row['value']?.toString() ?? ''),
                              onChanged: (v) {
                                row['value'] = v;
                                _createForm['item_description'] = items;
                              },
                            ),
                          ),
                          MadButton(
                            icon: LucideIcons.plus,
                            size: ButtonSize.sm,
                            variant: ButtonVariant.outline,
                            onPressed: () => _openItemFieldDialog(index),
                          ),
                          if (items.length > 1)
                            MadButton(
                              icon: LucideIcons.trash2,
                              variant: ButtonVariant.outline,
                              size: ButtonSize.sm,
                              onPressed: () {
                                setState(() {
                                  items.removeAt(index);
                                  _createForm['item_description'] = items;
                                });
                              },
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (fields.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (int fieldIndex = 0; fieldIndex < fields.length; fieldIndex++)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            MadBadge(
                              text: '${fields[fieldIndex]['key'] ?? ''}: ${fields[fieldIndex]['value'] ?? ''}',
                              variant: BadgeVariant.outline,
                            ),
                            const SizedBox(width: 4),
                            MadButton(
                              icon: LucideIcons.x,
                              size: ButtonSize.sm,
                              variant: ButtonVariant.outline,
                              onPressed: () => _removeItemField(index, fieldIndex),
                            ),
                          ],
                        ),
                    ],
                  ),
                ],
                if (isBoqRow) ...[
                  const SizedBox(height: 8),
                  Text(
                    'BOQ curated row',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Item Description',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            MadBadge(text: '${items.length} row(s)', variant: BadgeVariant.outline),
            MadButton(
              text: 'View Items in BOQ',
              icon: LucideIcons.layers,
              variant: ButtonVariant.primary,
              onPressed: _loadingProjectBoqItems ? null : _openBoqPicker,
            ),
            MadButton(
              text: 'Add Item',
              icon: LucideIcons.plus,
              variant: ButtonVariant.outline,
              onPressed: _addManualSampleItemRow,
            ),
            MadButton(
              text: 'Clear Table',
              icon: LucideIcons.trash2,
              variant: ButtonVariant.outline,
              onPressed: items.isEmpty ? null : _clearItemTable,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (items.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
              color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.25),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  'No items added yet. Use View Items in BOQ or add a manual row here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                  ),
                ),
                const SizedBox(height: 12),
                MadButton(
                  text: 'Add Item',
                  icon: LucideIcons.plus,
                  onPressed: _addManualSampleItemRow,
                ),
              ],
            ),
          )
        else
          Column(
            children: [
              for (int i = 0; i < items.length; i++) buildRow(items[i], i),
            ],
          ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            MadButton(
              text: 'Add Item',
              icon: LucideIcons.plus,
              variant: ButtonVariant.outline,
              onPressed: _addManualSampleItemRow,
            ),
            MadButton(
              text: 'Clear Table',
              icon: LucideIcons.trash2,
              variant: ButtonVariant.outline,
              onPressed: items.isEmpty ? null : _clearItemTable,
            ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;
    final location = Map<String, dynamic>.from(_createForm['location'] as Map);
    final additional = List<Map<String, dynamic>>.from(
      _createForm['add_fields'] as List,
    );

    return ProtectedRoute(
      title: 'Create Sample',
      route: '/samples/create',
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Create Sample',
                  style: TextStyle(
                    fontSize: responsive.value(
                      mobile: 22,
                      tablet: 26,
                      desktop: 28,
                    ),
                    fontWeight: FontWeight.bold,
                    color: isDark
                        ? AppTheme.darkForeground
                        : AppTheme.lightForeground,
                  ),
                ),
                MadButton(
                  text: 'Back',
                  icon: LucideIcons.arrowLeft,
                  variant: ButtonVariant.outline,
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 12),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isMobile) ...[
                      MadInput(
                        labelText: 'Project ID',
                        hintText: 'Enter project id',
                        controller: _projectIdController,
                        enabled: widget.initialProjectId.isEmpty,
                        onChanged: (v) => _projectId = v,
                      ),
                      const SizedBox(height: 12),
                      MadInput(
                        labelText: 'Sample ID',
                        hintText: 'Enter sample ID (e.g. SAMPLE-001)',
                        onChanged: (v) => _createForm['sample_id'] = v,
                      ),
                      const SizedBox(height: 12),
                      MadInput(
                        labelText: 'Building name',
                        hintText: 'Building A',
                        onChanged: (v) => _createForm['building_name'] = v,
                      ),
                      const SizedBox(height: 12),
                      MadInput(
                        labelText: 'Site name',
                        hintText: 'Site 1',
                        onChanged: (v) => _createForm['site_name'] = v,
                      ),
                      const SizedBox(height: 12),
                      MadInput(
                        labelText: 'Work done',
                        hintText: 'CPVC',
                        onChanged: (v) => _createForm['work_done'] = v,
                      ),
                    ] else
                      Row(
                        children: [
                          Expanded(
                            child: MadInput(
                              labelText: 'Project ID',
                              hintText: 'Enter project id',
                              controller: _projectIdController,
                              enabled: widget.initialProjectId.isEmpty,
                              onChanged: (v) => _projectId = v,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: MadInput(
                              labelText: 'Sample ID',
                              hintText: 'Enter sample ID (e.g. SAMPLE-001)',
                              onChanged: (v) => _createForm['sample_id'] = v,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: MadInput(
                              labelText: 'Building name',
                              hintText: 'Building A',
                              onChanged: (v) =>
                                  _createForm['building_name'] = v,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: MadInput(
                              labelText: 'Site name',
                              hintText: 'Site 1',
                              onChanged: (v) => _createForm['site_name'] = v,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: MadInput(
                              labelText: 'Work done',
                              hintText: 'CPVC',
                              onChanged: (v) => _createForm['work_done'] = v,
                            ),
                          ),
                        ],
                      ),
                    const SizedBox(height: 16),
                    if (isMobile) ...[
                      MadInput(
                        labelText: 'Floor',
                        onChanged: (v) {
                          location['floor'] = v;
                          _createForm['location'] = location;
                        },
                      ),
                      const SizedBox(height: 12),
                      MadInput(
                        labelText: 'Block',
                        onChanged: (v) {
                          location['block'] = v;
                          _createForm['location'] = location;
                        },
                      ),
                      const SizedBox(height: 12),
                      MadInput(
                        labelText: 'Wing',
                        onChanged: (v) {
                          location['wing'] = v;
                          _createForm['location'] = location;
                        },
                      ),
                      const SizedBox(height: 12),
                      MadInput(
                        labelText: 'Coordinates',
                        onChanged: (v) {
                          location['coordinates'] = v;
                          _createForm['location'] = location;
                        },
                      ),
                    ] else
                      Row(
                        children: [
                          Expanded(
                            child: MadInput(
                              labelText: 'Floor',
                              onChanged: (v) {
                                location['floor'] = v;
                                _createForm['location'] = location;
                              },
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: MadInput(
                              labelText: 'Block',
                              onChanged: (v) {
                                location['block'] = v;
                                _createForm['location'] = location;
                              },
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: MadInput(
                              labelText: 'Wing',
                              onChanged: (v) {
                                location['wing'] = v;
                                _createForm['location'] = location;
                              },
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: MadInput(
                              labelText: 'Coordinates',
                              onChanged: (v) {
                                location['coordinates'] = v;
                                _createForm['location'] = location;
                              },
                            ),
                          ),
                        ],
                      ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: MadSelect<String>(
                            value: _selectedUploadedFile.isEmpty
                                ? null
                                : _selectedUploadedFile,
                            placeholder: _uploadFilePaths.isEmpty
                                ? 'Upload files first'
                                : 'Select uploaded file',
                            options: _uploadFilePaths
                                .map((e) => MadSelectOption(value: e, label: _fileNameFromPath(e)))
                                .toList(),
                            onChanged: (v) {
                              setState(() {
                                _selectedUploadedFile = v ?? '';
                                _createForm['sample_file'] =
                                    _selectedUploadedFile;
                              });
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        MadButton(
                          text: 'Upload',
                          icon: LucideIcons.upload,
                          variant: ButtonVariant.outline,
                          onPressed: _uploadSampleFiles,
                        ),
                        const SizedBox(width: 8),
                        MadButton(
                          text: 'Preview',
                          icon: LucideIcons.eye,
                          variant: ButtonVariant.outline,
                          onPressed: _selectedUploadedFile.isEmpty
                              ? null
                              : _openAttachmentPreview,
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    _buildSampleItemSection(isDark, isMobile),
                    const SizedBox(height: 16),
                    Text(
                      'Additional Fields',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isDark
                            ? AppTheme.darkForeground
                            : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (int i = 0; i < additional.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: MadInput(
                                labelText: 'Key',
                                onChanged: (v) {
                                  additional[i]['key'] = v;
                                  _createForm['add_fields'] = additional;
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: MadInput(
                                labelText: 'Value',
                                onChanged: (v) {
                                  additional[i]['value'] = v;
                                  _createForm['add_fields'] = additional;
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            MadButton(
                              icon: LucideIcons.trash2,
                              size: ButtonSize.sm,
                              variant: ButtonVariant.outline,
                              onPressed: () {
                                setState(() {
                                  additional.removeAt(i);
                                  _createForm['add_fields'] = additional;
                                });
                              },
                            ),
                          ],
                        ),
                      ),
                    MadButton(
                      text: 'Add Field',
                      icon: LucideIcons.plus,
                      variant: ButtonVariant.outline,
                      onPressed: () {
                        setState(() {
                          additional.add({'key': '', 'value': ''});
                          _createForm['add_fields'] = additional;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        MadButton(
                          text: _saving ? 'Saving...' : 'Save Sample',
                          icon: LucideIcons.save,
                          onPressed: _saving ? null : _saveSample,
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
}
