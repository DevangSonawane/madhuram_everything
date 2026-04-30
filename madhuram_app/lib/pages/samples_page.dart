import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:redux/redux.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_theme.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';
import '../store/app_state.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';

/// Floor-wise configuration row (matches React Samples floor config)
class FloorConfig {
  final String floor;
  String config;
  int qty;
  final String unit;
  String status; // Locked | Draft

  FloorConfig({
    required this.floor,
    required this.config,
    required this.qty,
    required this.unit,
    required this.status,
  });

  Map<String, dynamic> toJson() => {
        'floor': floor,
        'config': config,
        'qty': qty,
        'unit': unit,
        'status': status,
      };

  static FloorConfig fromJson(Map<String, dynamic> json) {
    return FloorConfig(
      floor: json['floor'] as String? ?? '',
      config: json['config'] as String? ?? '',
      qty: (json['qty'] is int) ? json['qty'] as int : int.tryParse(json['qty']?.toString() ?? '0') ?? 0,
      unit: json['unit'] as String? ?? 'Points',
      status: json['status'] as String? ?? 'Draft',
    );
  }
}

/// Samples & Configuration page - floor plan upload, floor-wise config (matches React Samples.jsx)
class SamplesPageFull extends StatefulWidget {
  const SamplesPageFull({super.key});

  @override
  State<SamplesPageFull> createState() => _SamplesPageFullState();
}

class _SamplesPageFullState extends State<SamplesPageFull> {
  static const String _prefKey = 'samples_floor_config';

  static final List<FloorConfig> _initialFloorData = [
    FloorConfig(floor: 'Ground', config: 'CPVC 20mm - 5 points', qty: 5, unit: 'Points', status: 'Locked'),
    FloorConfig(floor: '1st', config: 'CPVC 25mm - 8 points', qty: 8, unit: 'Points', status: 'Draft'),
    FloorConfig(floor: '2nd', config: 'CPVC 20mm - 6 points', qty: 6, unit: 'Points', status: 'Draft'),
    FloorConfig(floor: '3rd', config: 'CPVC 32mm - 4 points', qty: 4, unit: 'Points', status: 'Locked'),
  ];

  String _workTypeFilter = 'CPVC'; // CPVC | Suspended
  List<FloorConfig> _floorConfigs = List.from(_initialFloorData);
  File? _uploadedFile;
  bool _isExtracting = false;
  bool _loadingServer = false;
  List<Map<String, dynamic>> _serverSamples = [];
  List<Map<String, dynamic>> _inventoryItems = [];
  bool _loadingInventory = false;
  String _inventorySearch = '';
  final Map<String, String> _pendingInventoryQty = {};
  List<String> _uploadFilePaths = [];
  String _selectedUploadedFile = '';
  String _searchQuery = '';
  String _projectId = '';
  String _itemFieldKey = '';
  String _itemFieldValue = '';
  int? _itemFieldRowIndex;
  int _createFormVersion = 0;
  Map<String, dynamic> _createForm = {
    'building_name': '',
    'site_name': '',
    'work_done': '',
    'sample_file': '',
    'location': {'floor': '', 'block': '', 'wing': '', 'coordinates': ''},
    'item_description': [
      {'sr_no': '', 'description': '', 'quantity': '', 'value': '', 'add_fields': []}
    ],
    'add_fields': [],
  };

  List<FloorConfig> get _filteredConfigs {
    // Filter by work type if needed (both types show same floor config in simplified version)
    return _floorConfigs;
  }

  List<Map<String, dynamic>> get _filteredServerSamples {
    final query = _searchQuery.trim().toLowerCase();
    return _serverSamples.where((sample) {
      if (query.isEmpty) return true;
      final work = (sample['work_done'] ?? '').toString().toLowerCase();
      final building = (sample['building_name'] ?? '').toString().toLowerCase();
      final site = (sample['site_name'] ?? '').toString().toLowerCase();
      final items = (sample['item_description'] as List? ?? [])
          .map((e) => (e as Map?)?['description']?.toString() ?? '')
          .join(' ')
          .toLowerCase();

      return building.contains(query) || site.contains(query) || work.contains(query) || items.contains(query);
    }).toList();
  }

  List<Map<String, dynamic>> get _filteredInventoryItems {
    final query = _inventorySearch.trim().toLowerCase();
    if (query.isEmpty) return _inventoryItems;
    return _inventoryItems.where((item) {
      final id = (item['inventory_id'] ?? item['id'] ?? '').toString();
      final brand = (item['brand'] ?? '').toString().toLowerCase();
      final name = (item['name'] ?? '').toString().toLowerCase();
      return id.contains(query) || brand.contains(query) || name.contains(query);
    }).toList();
  }

  String _inventoryId(Map<String, dynamic> item) =>
      (item['inventory_id'] ?? item['id'] ?? '').toString();

  int _inventoryQty(Map<String, dynamic> item) {
    final raw = item['quantity'];
    if (raw is int) return raw;
    if (raw is num) return raw.toInt();
    return int.tryParse(raw?.toString() ?? '') ?? 0;
  }

  Future<void> _pickFile() async {
    final file = await FileService.pickFileWithSource(
      context: context,
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg'],
    );
    if (file == null) return;
    setState(() {
      _uploadedFile = file;
    });
  }

  void _extractPlaceholder() {
    setState(() => _isExtracting = true);
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) {
        setState(() => _isExtracting = false);
        showToast(context, 'Extraction placeholder – PDF extraction would run here');
      }
    });
  }

  void _toggleLock(FloorConfig row) {
    setState(() {
      final idx = _floorConfigs.indexWhere((e) => e.floor == row.floor);
      if (idx >= 0) {
        _floorConfigs[idx].status = _floorConfigs[idx].status == 'Locked' ? 'Draft' : 'Locked';
      }
    });
  }

  void _editRow(FloorConfig row) {
    final configCtrl = TextEditingController(text: row.config);
    final qtyCtrl = TextEditingController(text: row.qty.toString());

    MadFormDialog.show(
      context: context,
      title: 'Edit Configuration',
      maxWidth: 420,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MadInput(labelText: 'Floor', controller: TextEditingController(text: row.floor), enabled: false),
          const SizedBox(height: 16),
          MadInput(
            labelText: 'Configuration',
            controller: configCtrl,
          ),
          const SizedBox(height: 16),
          MadInput(
            labelText: 'Qty',
            controller: qtyCtrl,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),
          MadInput(labelText: 'Unit', controller: TextEditingController(text: row.unit), enabled: false),
        ],
      ),
      actions: [
        MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
        MadButton(
          text: 'Save',
          onPressed: () {
            setState(() {
              final idx = _floorConfigs.indexWhere((e) => e.floor == row.floor);
              if (idx >= 0) {
                _floorConfigs[idx].config = configCtrl.text;
                _floorConfigs[idx].qty = int.tryParse(qtyCtrl.text) ?? _floorConfigs[idx].qty;
              }
            });
            Navigator.pop(context);
          },
        ),
      ],
    );
  }

  void _exportToExcel() {
    showToast(context, 'Export to Excel – placeholder (data would be exported here)');
  }

  Future<void> _saveConfiguration() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = _floorConfigs.map((e) => e.toJson()).toList();
      await prefs.setString(_prefKey, jsonEncode(list));
      if (mounted) showToast(context, 'Configuration saved successfully');
    } catch (_) {
      if (mounted) showToast(context, 'Failed to save configuration', variant: ToastVariant.error);
    }
  }

  Future<void> _loadConfiguration() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefKey);
      if (raw != null) {
        final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
        setState(() {
          _floorConfigs = list.map((e) => FloorConfig.fromJson(e)).toList();
        });
        if (mounted) showToast(context, 'Configuration loaded');
      } else {
        if (mounted) showToast(context, 'No saved configuration found');
      }
    } catch (_) {
      if (mounted) showToast(context, 'Failed to load configuration', variant: ToastVariant.error);
    }
  }

  void _showDiagramViewer() {
    MadDialog.show(
      context: context,
      title: 'Diagram Viewer',
      description: 'Extracted data would appear here',
      content: Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Text(
            'Diagram viewer – extracted data would appear here',
            style: TextStyle(
              color: Theme.of(context).brightness == Brightness.dark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
            ),
          ),
        ),
      ),
      actions: [MadButton(text: 'Close', onPressed: () => Navigator.pop(context))],
    );
  }

  List<Map<String, dynamic>> _normalizeSamples(List data) {
    return data.map((e) {
      final raw = Map<String, dynamic>.from(e as Map);
      for (final key in ['location', 'item_description', 'add_fields']) {
        final value = raw[key];
        if (value is String && value.isNotEmpty) {
          try {
            raw[key] = jsonDecode(value);
          } catch (_) {}
        }
      }
      if (raw['location'] is! Map) {
        raw['location'] = {'floor': '', 'block': '', 'wing': '', 'coordinates': ''};
      }
      if (raw['item_description'] is! List) {
        raw['item_description'] = [];
      }
      if (raw['add_fields'] is! List) {
        raw['add_fields'] = [];
      }
      return raw;
    }).toList();
  }

  void _safeSetState(VoidCallback fn) {
    if (!mounted) return;
    if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(fn);
      });
      return;
    }
    setState(fn);
  }

  Future<void> _loadServerSamples() async {
    if (!mounted) return;
    if (_projectId.isEmpty) {
      _safeSetState(() {
        _serverSamples = [];
        _loadingServer = false;
      });
      return;
    }
    _safeSetState(() => _loadingServer = true);
    try {
      final result = await ApiClient.getSamplesByProject(_projectId);
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final list = data is List ? data : [];
        _safeSetState(() {
          _serverSamples = _normalizeSamples(list);
          _loadingServer = false;
        });
      } else {
        _safeSetState(() {
          _serverSamples = [];
          _loadingServer = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      _safeSetState(() {
        _serverSamples = [];
        _loadingServer = false;
      });
    }
  }

  Future<void> _loadInventoryItems() async {
    if (_loadingInventory) return;
    setState(() => _loadingInventory = true);
    try {
      final res = await ApiClient.getInventories();
      if (!mounted) return;
      if (res['success'] == true && res['data'] is List) {
        final rows = (res['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map((row) => Map<String, dynamic>.from(row))
            .toList();
        setState(() => _inventoryItems = rows);
      } else {
        setState(() => _inventoryItems = []);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _inventoryItems = []);
      showToast(
        context,
        'Failed to load inventory items.',
        variant: ToastVariant.error,
      );
    } finally {
      if (mounted) setState(() => _loadingInventory = false);
    }
  }

  bool _isInventoryAlreadyAdded(String inventoryId) {
    final items = List<Map<String, dynamic>>.from(
      _createForm['item_description'] as List,
    );
    return items.any((row) {
      final fields = (row['add_fields'] as List? ?? []);
      return fields.any((field) {
        if (field is! Map) return false;
        return (field['key'] ?? '').toString() == 'inventory_id' &&
            (field['value'] ?? '').toString() == inventoryId;
      });
    });
  }

  Future<void> _addInventoryToSample(
    Map<String, dynamic> item,
    int selectedQty,
  ) async {
    final inventoryId = _inventoryId(item);
    if (inventoryId.isEmpty) return;
    final available = _inventoryQty(item);

    if (selectedQty <= 0) {
      showToast(
        context,
        'Select a valid quantity.',
        variant: ToastVariant.error,
      );
      return;
    }

    if (selectedQty > available) {
      showToast(
        context,
        'Selected quantity exceeds available stock.',
        variant: ToastVariant.error,
      );
      return;
    }

    if (_isInventoryAlreadyAdded(inventoryId)) {
      showToast(context, 'This inventory item is already added.');
      return;
    }

    final remaining = available - selectedQty;
    final update = await ApiClient.updateInventory(inventoryId, {
      'quantity': remaining,
    });

    if (!mounted) return;
    if (update['success'] != true) {
      showToast(
        context,
        (update['error'] ?? 'Could not update inventory quantity').toString(),
        variant: ToastVariant.error,
      );
      return;
    }

    setState(() {
      _inventoryItems = _inventoryItems.map((row) {
        if (_inventoryId(row) == inventoryId) {
          final next = Map<String, dynamic>.from(row);
          next['quantity'] = remaining;
          return next;
        }
        return row;
      }).toList();

      final items = List<Map<String, dynamic>>.from(
        _createForm['item_description'] as List,
      );
      items.add({
        'sr_no': (items.length + 1).toString(),
        'description':
            '${(item['brand'] ?? '').toString().trim().isEmpty ? '' : '${item['brand']} - '}${item['name'] ?? ''}',
        'quantity': selectedQty.toString(),
        'value': (item['price'] ?? '').toString(),
        'add_fields': [
          {'key': 'inventory_id', 'value': inventoryId},
          {'key': 'brand', 'value': (item['brand'] ?? '').toString()},
          {'key': 'name', 'value': (item['name'] ?? '').toString()},
          {'key': 'quantity', 'value': selectedQty.toString()},
          {'key': 'price', 'value': (item['price'] ?? '').toString()},
          {'key': 'stockin', 'value': (item['stockin'] ?? false).toString()},
          {'key': 'billing', 'value': (item['billing'] ?? false).toString()},
        ],
      });
      _createForm['item_description'] = items;
      _pendingInventoryQty.remove(inventoryId);
    });

    showToast(context, 'Item added and inventory updated.');
  }

  Future<void> _uploadSampleFiles() async {
    final files = await FileService.pickMultipleFilesWithSource(context: context);
    if (files.isEmpty) return;
    final res = await ApiClient.uploadSampleFiles(files);
    if (!mounted) return;
    if (res['success'] == true) {
      final data = res['data'] as Map?;
      final filePaths = (data?['filePaths'] as List?)?.map((e) => e.toString()).toList() ?? [];
      setState(() {
        _uploadFilePaths = filePaths;
        if (filePaths.isNotEmpty) {
          _selectedUploadedFile = filePaths.first;
          _createForm['sample_file'] = filePaths.first;
        }
      });
      showToast(context, 'Uploaded ${filePaths.length} file(s)');
    } else {
      showToast(context, res['error']?.toString() ?? 'Upload failed', variant: ToastVariant.error);
    }
  }

  String _fileNameFromPath(String path) {
    final parts = path.split(RegExp(r'[/\\]'));
    if (parts.isEmpty) return path;
    return parts.last.isEmpty ? path : parts.last;
  }

  Future<void> _openUploadedFile(String path) async {
    final uri = Uri.parse(ApiClient.getApiFileUrl(path));
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && mounted) {
      showToast(context, 'Could not open file', variant: ToastVariant.error);
    }
  }

  Future<void> _saveSample() async {
    if (_projectId.isEmpty) {
      showToast(context, 'Select a project first', variant: ToastVariant.error);
      return;
    }
    final payload = Map<String, dynamic>.from(_createForm);
    payload['project_id'] = _projectId;
    final res = await ApiClient.createSample(payload);
    if (!mounted) return;
    if (res['success'] == true) {
      showToast(context, 'Sample created');
      setState(() {
        _createForm = {
          'building_name': '',
          'site_name': '',
          'work_done': '',
          'sample_file': '',
          'location': {'floor': '', 'block': '', 'wing': '', 'coordinates': ''},
          'item_description': [
            {'sr_no': '', 'description': '', 'quantity': '', 'value': '', 'add_fields': []}
          ],
          'add_fields': [],
        };
        _selectedUploadedFile = '';
        _createFormVersion++;
      });
      _loadServerSamples();
    } else {
      showToast(context, res['error']?.toString() ?? 'Create failed', variant: ToastVariant.error);
    }
  }

  Future<void> _deleteSample(Map<String, dynamic> sample) async {
    final id = sample['sample_id'] ?? sample['id'];
    if (id == null) return;
    final res = await ApiClient.deleteSample(id.toString());
    if (!mounted) return;
    if (res['success'] == true) {
      showToast(context, 'Sample deleted');
      _loadServerSamples();
    } else {
      showToast(context, res['error']?.toString() ?? 'Delete failed', variant: ToastVariant.error);
    }
  }

  void _navigateToPreview(Map<String, dynamic> sample) {
    final id = sample['sample_id'] ?? sample['id'];
    if (id == null) return;
    Navigator.pushNamed(context, '/samples/preview', arguments: id.toString());
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
        MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
        MadButton(
          text: 'Add',
          onPressed: () {
            final key = _itemFieldKey.trim();
            final value = _itemFieldValue.trim();
            if (key.isEmpty || value.isEmpty || _itemFieldRowIndex == null) {
              showToast(context, 'Enter both key and value', variant: ToastVariant.error);
              return;
            }
            final items = List<Map<String, dynamic>>.from(_createForm['item_description'] as List);
            final item = Map<String, dynamic>.from(items[_itemFieldRowIndex!]);
            final fields = List<Map<String, dynamic>>.from(item['add_fields'] as List? ?? []);
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

  void _removeItemField(int rowIndex, int fieldIndex) {
    final items = List<Map<String, dynamic>>.from(_createForm['item_description'] as List);
    if (rowIndex < 0 || rowIndex >= items.length) return;
    final item = Map<String, dynamic>.from(items[rowIndex]);
    final fields = List<Map<String, dynamic>>.from(item['add_fields'] as List? ?? []);
    if (fieldIndex < 0 || fieldIndex >= fields.length) return;
    fields.removeAt(fieldIndex);
    item['add_fields'] = fields;
    items[rowIndex] = item;
    setState(() => _createForm['item_description'] = items);
  }

  @override
  Widget build(BuildContext context) {
    return StoreConnector<AppState, _SamplesViewModel>(
      distinct: true,
      converter: (store) => _SamplesViewModel.fromStore(store),
      onInit: (store) {
        final vm = _SamplesViewModel.fromStore(store);
        _projectId = vm.projectId;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _loadServerSamples();
          if (mounted) _loadInventoryItems();
        });
      },
      onWillChange: (prev, next) {
        if (prev?.projectId != next.projectId) {
          _projectId = next.projectId;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadServerSamples();
          });
        }
      },
      builder: (context, _) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final responsive = Responsive(context);
        final isMobile = responsive.isMobile;

        return ProtectedRoute(
          title: 'Samples & Configuration',
          route: '/samples',
          child: SingleChildScrollView(
            padding: EdgeInsets.zero,
            child: _buildServerSamplesSection(isDark, isMobile),
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

  Widget _buildMetricChip(String label, String value, IconData icon, bool isDark, Responsive responsive) {
    final chipWidth = responsive.value(mobile: 160.0, tablet: 180.0, desktop: 200.0);
    return SizedBox(
      width: chipWidth,
      child: MadCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(icon, size: 16, color: AppTheme.primaryColor),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: TextStyle(fontSize: 11, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
                    Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWorkTypeCard(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Work Type',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            MadTabsList(
              tabs: const ['CPVC', 'Suspended'],
              selectedTab: _workTypeFilter,
              onTabChanged: (v) => setState(() => _workTypeFilter = v),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUploadCard(bool isDark, bool isMobile) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Floor Plan Upload',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Upload PDF or image reference. Extract parses supported files.',
              style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
            ),
            const SizedBox(height: 12),
            if (isMobile) ...[
              SizedBox(
                width: double.infinity,
                child: MadButton(
                  text: 'Upload File',
                  icon: LucideIcons.upload,
                  variant: ButtonVariant.outline,
                  onPressed: _pickFile,
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: MadButton(
                  text: 'Extract',
                  icon: _isExtracting ? null : LucideIcons.fileSearch,
                  onPressed: _uploadedFile != null && !_isExtracting ? _extractPlaceholder : null,
                  loading: _isExtracting,
                ),
              ),
            ] else
              Row(
                children: [
                  MadButton(
                    text: 'Upload File',
                    icon: LucideIcons.upload,
                    variant: ButtonVariant.outline,
                    onPressed: _pickFile,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _uploadedFile?.path.split(RegExp(r'[/\\]')).last ?? 'No file selected',
                      style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 10),
                  MadButton(
                    text: 'Extract',
                    icon: _isExtracting ? null : LucideIcons.fileSearch,
                    onPressed: _uploadedFile != null && !_isExtracting ? _extractPlaceholder : null,
                    loading: _isExtracting,
                  ),
                ],
              ),
            if (isMobile && _uploadedFile != null) ...[
              const SizedBox(height: 8),
              Text(
                _uploadedFile!.path.split(RegExp(r'[/\\]')).last,
                style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildConfigRow(FloorConfig row, bool isDark, bool isMobile) {
    final isLocked = row.status == 'Locked';
    if (isMobile) {
      return Padding(
        padding: const EdgeInsets.all(12),
        child: MadCard(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        row.floor,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                        ),
                      ),
                    ),
                    MadBadge(
                      text: row.status,
                      variant: isLocked ? BadgeVariant.default_ : BadgeVariant.outline,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  row.config,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: Text('Qty: ${row.qty}', style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground))),
                    Expanded(child: Text('Unit: ${row.unit}', style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground))),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: MadButton(
                        text: isLocked ? 'Unlock' : 'Lock',
                        icon: isLocked ? LucideIcons.lockOpen : LucideIcons.lock,
                        variant: ButtonVariant.outline,
                        size: ButtonSize.sm,
                        onPressed: () => _toggleLock(row),
                      ),
                    ),
                    const SizedBox(width: 8),
                    MadButton(
                      size: ButtonSize.sm,
                      variant: ButtonVariant.outline,
                      icon: LucideIcons.pencil,
                      onPressed: () => _editRow(row),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(flex: 1, child: Text(row.floor, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13), overflow: TextOverflow.ellipsis)),
          Expanded(flex: 2, child: Text(row.config, style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground), overflow: TextOverflow.ellipsis)),
          Expanded(flex: 1, child: Text('${row.qty}', style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
          Expanded(flex: 1, child: Text(row.unit, style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground), overflow: TextOverflow.ellipsis)),
          Expanded(
            flex: 1,
            child: MadBadge(
              text: row.status,
              variant: isLocked ? BadgeVariant.default_ : BadgeVariant.outline,
            ),
          ),
          if (!isMobile)
            Expanded(
              flex: 1,
              child: MadSwitch(
                value: isLocked,
                onChanged: (v) => _toggleLock(row),
              ),
            ),
          MadButton(
            size: ButtonSize.sm,
            variant: ButtonVariant.outline,
            icon: LucideIcons.pencil,
            onPressed: () => _editRow(row),
          ),
        ],
      ),
    );
  }

  Widget _buildServerSamplesSection(bool isDark, bool isMobile) {
    final visibleSamples = _filteredServerSamples;
    final totalSamples = _serverSamples.length;
    final hiddenCount = (totalSamples - visibleSamples.length).clamp(0, totalSamples);
    final availableUploadedFiles = <String>{
      ..._uploadFilePaths,
      ..._serverSamples
          .map((sample) => (sample['sample_file'] ?? '').toString().trim())
          .where((path) => path.isNotEmpty),
    }.toList();
    final surfaceColor = isDark ? AppTheme.darkCard : AppTheme.lightCard;
    final mutedSurface = (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.35);
    final borderColor = (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withValues(alpha: 0.65);

    Widget buildStateBody() {
      if (_loadingServer) {
        return const Padding(
          padding: EdgeInsets.all(24),
          child: MadTableSkeleton(rows: 6, columns: 6),
        );
      }
      if (_projectId.isEmpty) {
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Select a project to view samples.',
            style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
          ),
        );
      }
      if (visibleSamples.isEmpty) {
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No samples match the current filters.',
            style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
          ),
        );
      }

      if (isMobile) {
        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          itemCount: visibleSamples.length,
          separatorBuilder: (context, index) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final sample = visibleSamples[index];
            final items = sample['item_description'] as List? ?? [];
            final sampleId = (sample['sample_id'] ?? sample['id'] ?? '-').toString();
            return Container(
              decoration: BoxDecoration(
                color: surfaceColor,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: borderColor),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            (sample['building_name'] ?? '-').toString(),
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: mutedSurface,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '#$sampleId',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _buildSampleInfoLine('Site', (sample['site_name'] ?? '-').toString(), isDark, icon: LucideIcons.mapPin),
                    const SizedBox(height: 6),
                    _buildSampleInfoLine('Work', (sample['work_done'] ?? '-').toString(), isDark, icon: LucideIcons.briefcaseBusiness),
                    const SizedBox(height: 6),
                    _buildSampleInfoLine('Items', '${items.length}', isDark, icon: LucideIcons.boxes),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: MadButton(
                            text: 'Preview',
                            icon: LucideIcons.fileText,
                            size: ButtonSize.sm,
                            variant: ButtonVariant.outline,
                            onPressed: () => _navigateToPreview(sample),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: MadButton(
                            text: 'Delete',
                            icon: LucideIcons.trash2,
                            size: ButtonSize.sm,
                            variant: ButtonVariant.destructive,
                            onPressed: () => _confirmDeleteSample(sample),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      }

      return Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: mutedSurface,
              border: Border(bottom: BorderSide(color: borderColor)),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            ),
            child: Row(
              children: [
                _buildHeaderCell('ID', flex: 1, isDark: isDark),
                _buildHeaderCell('Building', flex: 2, isDark: isDark),
                _buildHeaderCell('Site', flex: 2, isDark: isDark),
                _buildHeaderCell('Work', flex: 2, isDark: isDark),
                const SizedBox(width: 56),
              ],
            ),
          ),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: visibleSamples.length,
            separatorBuilder: (context, index) => Divider(
              height: 1,
              color: borderColor,
            ),
            itemBuilder: (context, index) {
              final sample = visibleSamples[index];
              final sampleId = (sample['sample_id'] ?? sample['id'] ?? '-').toString();
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                color: index.isEven ? surfaceColor : mutedSurface.withValues(alpha: 0.45),
                child: Row(
                  children: [
                    Expanded(
                      flex: 1,
                      child: Text(
                        sampleId,
                        style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text(
                        (sample['building_name'] ?? '-').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text(
                        (sample['site_name'] ?? '-').toString(),
                        style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text(
                        (sample['work_done'] ?? '-').toString(),
                        style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    MadDropdownMenuButton(
                      items: [
                        MadMenuItem(
                          label: 'Preview',
                          icon: LucideIcons.fileText,
                          onTap: () => _navigateToPreview(sample),
                        ),
                        MadMenuItem(
                          label: 'Delete',
                          icon: LucideIcons.trash2,
                          destructive: true,
                          onTap: () => _confirmDeleteSample(sample),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor),
          ),
          child: Padding(
            padding: EdgeInsets.all(isMobile ? 12 : 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isMobile) ...[
                  Text(
                    'Server Samples',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Manage project-linked sample records and previews.',
                    style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: MadButton(
                      text: 'Create Sample',
                      icon: LucideIcons.plus,
                      variant: ButtonVariant.outline,
                      size: ButtonSize.sm,
                      onPressed: () async {
                        final created = await Navigator.pushNamed(context, '/samples/create', arguments: _projectId);
                        if (created == true && mounted) {
                          _loadServerSamples();
                        }
                      },
                    ),
                  ),
                ] else
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Server Samples',
                              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Manage project-linked sample records and previews.',
                              style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                            ),
                          ],
                        ),
                      ),
                      MadButton(
                        text: 'Create Sample',
                        icon: LucideIcons.plus,
                        variant: ButtonVariant.outline,
                        size: ButtonSize.sm,
                        onPressed: () async {
                          final created = await Navigator.pushNamed(context, '/samples/create', arguments: _projectId);
                          if (created == true && mounted) {
                            _loadServerSamples();
                          }
                        },
                      ),
                    ],
                  ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _buildSamplesQuickStat('Total', '$totalSamples', LucideIcons.database, isDark),
                    _buildSamplesQuickStat('Visible', '${visibleSamples.length}', LucideIcons.search, isDark),
                    _buildSamplesQuickStat('Hidden', '$hiddenCount', LucideIcons.eyeOff, isDark),
                  ],
                ),
                const SizedBox(height: 12),
                if (isMobile) ...[
                  MadSelect<String>(
                    value: _selectedUploadedFile.isEmpty ? null : _selectedUploadedFile,
                    placeholder: 'Select uploaded file',
                    options: availableUploadedFiles
                        .map((path) => MadSelectOption(value: path, label: _fileNameFromPath(path)))
                        .toList(),
                    onChanged: (value) => setState(() => _selectedUploadedFile = value ?? ''),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: MadButton(
                      text: 'Preview Uploaded File',
                      icon: LucideIcons.eye,
                      variant: ButtonVariant.outline,
                      size: ButtonSize.sm,
                      onPressed: _selectedUploadedFile.isEmpty ? null : () => _openUploadedFile(_selectedUploadedFile),
                    ),
                  ),
                ] else
                  Row(
                    children: [
                      SizedBox(
                        width: 320,
                        child: MadSelect<String>(
                          value: _selectedUploadedFile.isEmpty ? null : _selectedUploadedFile,
                          placeholder: 'Select uploaded file',
                          options: availableUploadedFiles
                              .map((path) => MadSelectOption(value: path, label: _fileNameFromPath(path)))
                              .toList(),
                          onChanged: (value) => setState(() => _selectedUploadedFile = value ?? ''),
                        ),
                      ),
                      const SizedBox(width: 8),
                      MadButton(
                        text: 'Preview Uploaded File',
                        icon: LucideIcons.eye,
                        variant: ButtonVariant.outline,
                        size: ButtonSize.sm,
                        onPressed: _selectedUploadedFile.isEmpty ? null : () => _openUploadedFile(_selectedUploadedFile),
                      ),
                    ],
                  ),
                if (_projectId.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  MadInput(
                    labelText: 'Search samples',
                    hintText: 'Building, site, work...',
                    onChanged: (v) => setState(() => _searchQuery = v),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${visibleSamples.length} of $totalSamples sample(s)',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Container(
                  decoration: BoxDecoration(
                    color: mutedSurface.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: borderColor),
                  ),
                  child: buildStateBody(),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildSamplesQuickStat(String label, String value, IconData icon, bool isDark) {
    final mutedColor = isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground;
    return Container(
      constraints: const BoxConstraints(minWidth: 108),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withValues(alpha: 0.6),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppTheme.primaryColor),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(fontSize: 11, color: mutedColor)),
              Text(
                value,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSampleInfoLine(String label, String value, bool isDark, {required IconData icon}) {
    return Row(
      children: [
        Icon(icon, size: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
        const SizedBox(width: 6),
        Text(
          '$label: ',
          style: TextStyle(
            fontSize: 12,
            color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildCreateForm(bool isDark, bool isMobile) {
    final location = Map<String, dynamic>.from(_createForm['location'] as Map);
    final items = List<Map<String, dynamic>>.from(_createForm['item_description'] as List);
    final additional = List<Map<String, dynamic>>.from(_createForm['add_fields'] as List);
    return MadCard(
      key: ValueKey('create-form-$_createFormVersion'),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Create Sample',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
            ),
            const SizedBox(height: 12),
            if (isMobile) ...[
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
                      labelText: 'Building name',
                      hintText: 'Building A',
                      onChanged: (v) => _createForm['building_name'] = v,
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
            Text(
              'Sample file',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: MadSelect<String>(
                    value: _selectedUploadedFile.isEmpty ? null : _selectedUploadedFile,
                    placeholder: _uploadFilePaths.isEmpty ? 'Upload files first' : 'Select uploaded file',
                    options: _uploadFilePaths.map((e) => MadSelectOption(value: e, label: e)).toList(),
                    onChanged: (v) {
                      setState(() {
                        _selectedUploadedFile = v ?? '';
                        _createForm['sample_file'] = _selectedUploadedFile;
                      });
                    },
                  ),
                ),
                const SizedBox(width: 12),
                MadButton(
                  text: 'Pick File',
                  icon: LucideIcons.upload,
                  variant: ButtonVariant.outline,
                  onPressed: _uploadSampleFiles,
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              'Inventory Items',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            MadInput(
              labelText: 'Search inventory',
              hintText: 'Name, brand, or ID...',
              onChanged: (v) => setState(() => _inventorySearch = v),
            ),
            const SizedBox(height: 8),
            Container(
              constraints: const BoxConstraints(maxHeight: 260),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                      .withValues(alpha: 0.6),
                ),
                color:
                    (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(
                  alpha: 0.35,
                ),
              ),
              child: _loadingInventory
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : _filteredInventoryItems.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            'No inventory items found.',
                            style: TextStyle(
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          itemCount: _filteredInventoryItems.length,
                          separatorBuilder: (_, __) => Divider(
                            height: 1,
                            color: (isDark ? Colors.white : Colors.black)
                                .withValues(alpha: 0.06),
                          ),
                          itemBuilder: (context, index) {
                            final item = _filteredInventoryItems[index];
                            final id = _inventoryId(item);
                            final qty = _inventoryQty(item);
                            final selectedQty =
                                int.tryParse(_pendingInventoryQty[id] ?? '') ??
                                1;
                            return Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    (item['name'] ?? '-').toString(),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: isDark
                                          ? AppTheme.darkForeground
                                          : AppTheme.lightForeground,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${(item['brand'] ?? '-')} • #$id • Qty $qty',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isDark
                                          ? AppTheme.darkMutedForeground
                                          : AppTheme.lightMutedForeground,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      MadButton(
                                        icon: LucideIcons.minus,
                                        size: ButtonSize.icon,
                                        variant: ButtonVariant.outline,
                                        onPressed: () {
                                          final current =
                                              int.tryParse(_pendingInventoryQty[id] ?? '1') ?? 1;
                                          final next =
                                              (current - 1).clamp(1, qty);
                                          setState(() {
                                            _pendingInventoryQty[id] = next.toString();
                                          });
                                        },
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        selectedQty.toString(),
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: isDark
                                              ? AppTheme.darkForeground
                                              : AppTheme.lightForeground,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      MadButton(
                                        icon: LucideIcons.plus,
                                        size: ButtonSize.icon,
                                        variant: ButtonVariant.outline,
                                        onPressed: () {
                                          final current =
                                              int.tryParse(_pendingInventoryQty[id] ?? '1') ?? 1;
                                          final next =
                                              (current + 1).clamp(1, qty);
                                          setState(() {
                                            _pendingInventoryQty[id] = next.toString();
                                          });
                                        },
                                      ),
                                      const SizedBox(width: 12),
                                      MadButton(
                                        text: 'Add',
                                        size: ButtonSize.sm,
                                        onPressed: qty <= 0
                                            ? null
                                            : () => _addInventoryToSample(
                                                  item,
                                                  selectedQty,
                                                ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
            const SizedBox(height: 20),
            Text(
              'Item Description',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
            ),
            const SizedBox(height: 12),
            Column(
              children: [
                for (int i = 0; i < items.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: MadCard(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: isMobile
                                  ? [
                                      Expanded(
                                        child: Column(
                                          children: [
                                            MadInput(
                                              labelText: 'Sr No',
                                              onChanged: (v) {
                                                items[i]['sr_no'] = v;
                                                _createForm['item_description'] = items;
                                              },
                                            ),
                                            const SizedBox(height: 10),
                                            MadInput(
                                              labelText: 'Qty',
                                              onChanged: (v) {
                                                items[i]['quantity'] = v;
                                                _createForm['item_description'] = items;
                                              },
                                            ),
                                            const SizedBox(height: 10),
                                            MadInput(
                                              labelText: 'Value',
                                              onChanged: (v) {
                                                items[i]['value'] = v;
                                                _createForm['item_description'] = items;
                                              },
                                            ),
                                            if (items.length > 1) ...[
                                              const SizedBox(height: 10),
                                              Align(
                                                alignment: Alignment.centerRight,
                                                child: MadButton(
                                                  icon: LucideIcons.trash2,
                                                  variant: ButtonVariant.outline,
                                                  size: ButtonSize.sm,
                                                  onPressed: () {
                                                    setState(() {
                                                      items.removeAt(i);
                                                      _createForm['item_description'] = items;
                                                    });
                                                  },
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ]
                                  : [
                                      Expanded(
                                        child: MadInput(
                                          labelText: 'Sr No',
                                          onChanged: (v) {
                                            items[i]['sr_no'] = v;
                                            _createForm['item_description'] = items;
                                          },
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: MadInput(
                                          labelText: 'Qty',
                                          onChanged: (v) {
                                            items[i]['quantity'] = v;
                                            _createForm['item_description'] = items;
                                          },
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: MadInput(
                                          labelText: 'Value',
                                          onChanged: (v) {
                                            items[i]['value'] = v;
                                            _createForm['item_description'] = items;
                                          },
                                        ),
                                      ),
                                      if (items.length > 1) ...[
                                        const SizedBox(width: 12),
                                        MadButton(
                                          icon: LucideIcons.trash2,
                                          variant: ButtonVariant.outline,
                                          size: ButtonSize.sm,
                                          onPressed: () {
                                            setState(() {
                                              items.removeAt(i);
                                              _createForm['item_description'] = items;
                                            });
                                          },
                                        ),
                                      ],
                                    ],
                            ),
                            const SizedBox(height: 12),
                            MadTextarea(
                              labelText: 'Description',
                              minLines: 2,
                              onChanged: (v) {
                                items[i]['description'] = v;
                                _createForm['item_description'] = items;
                              },
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                MadButton(
                                  text: 'Add Field',
                                  icon: LucideIcons.plus,
                                  size: ButtonSize.sm,
                                  variant: ButtonVariant.outline,
                                  onPressed: () => _openItemFieldDialog(i),
                                ),
                                for (int fieldIndex = 0; fieldIndex < (items[i]['add_fields'] as List? ?? []).length; fieldIndex++)
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      MadBadge(
                                        text: '${(items[i]['add_fields'] as List)[fieldIndex]['key'] ?? ''}: ${(items[i]['add_fields'] as List)[fieldIndex]['value'] ?? ''}',
                                        variant: BadgeVariant.outline,
                                      ),
                                      const SizedBox(width: 4),
                                      MadButton(
                                        icon: LucideIcons.x,
                                        size: ButtonSize.sm,
                                        variant: ButtonVariant.outline,
                                        onPressed: () => _removeItemField(i, fieldIndex),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: MadButton(
                    text: 'Add Item',
                    icon: LucideIcons.plus,
                    variant: ButtonVariant.outline,
                    onPressed: () {
                      setState(() {
                        items.add({'sr_no': '', 'description': '', 'quantity': '', 'value': '', 'add_fields': []});
                        _createForm['item_description'] = items;
                      });
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Additional Fields',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
            ),
            const SizedBox(height: 8),
            Column(
              children: [
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
                Align(
                  alignment: Alignment.centerLeft,
                  child: MadButton(
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
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                MadButton(text: 'Save Sample', icon: LucideIcons.save, onPressed: _saveSample),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDeleteSample(Map<String, dynamic> sample) {
    MadDialog.show(
      context: context,
      title: 'Delete Sample',
      description: 'This action cannot be undone.',
      actions: [
        MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
        MadButton(
          text: 'Delete',
          variant: ButtonVariant.destructive,
          onPressed: () {
            Navigator.pop(context);
            _deleteSample(sample);
          },
        ),
      ],
    );
  }

}

class _SamplesViewModel {
  final String projectId;

  const _SamplesViewModel({required this.projectId});

  factory _SamplesViewModel.fromStore(Store<AppState> store) {
    final projectId = store.state.project.selectedProjectId ??
        store.state.project.selectedProject?['project_id']?.toString() ??
        '';
    return _SamplesViewModel(projectId: projectId);
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is _SamplesViewModel && projectId == other.projectId;
  }

  @override
  int get hashCode => projectId.hashCode;
}
