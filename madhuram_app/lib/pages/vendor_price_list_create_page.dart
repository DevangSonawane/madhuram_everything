import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';

class VendorPriceListCreatePage extends StatefulWidget {
  final String vendorId;
  final String? projectId;

  const VendorPriceListCreatePage({
    super.key,
    required this.vendorId,
    this.projectId,
  });

  @override
  State<VendorPriceListCreatePage> createState() =>
      _VendorPriceListCreatePageState();
}

class _VendorPriceListCreatePageState extends State<VendorPriceListCreatePage> {
  String _uploadedFilename = '';
  String _uploadedFilePath = '';
  String _versionName = '';

  bool _uploading = false;
  bool _creating = false;
  bool _editUploaded = false;
  File? _selectedFile;

  List<Map<String, String>> _items = [_emptyItem()];
  List<Map<String, dynamic>> _uploadedItems = [];

  static Map<String, String> _emptyItem() => {
    'name': '',
    'brand': '',
    'quantity': '',
    'units': '',
    'price': '',
    'discount_percent': '',
    'width': '',
    'height': '',
    'stockin': '',
    'billing': '',
    'project_id': '',
    'notes': '',
  };

  @override
  void dispose() {
    super.dispose();
  }

  String _makeVersionPrefix(String vendorName) {
    final cleaned = vendorName
        .trim()
        .replaceAll(RegExp(r'\s+'), '-')
        .replaceAll(RegExp(r'[^a-zA-Z0-9-_]'), '')
        .replaceAll(RegExp(r'-+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    final datePart = DateTime.now().toIso8601String().split('T').first;
    final prefix = cleaned.isEmpty ? 'vendor-${widget.vendorId}' : cleaned;
    return '$prefix-$datePart';
  }

  Future<String> _buildAutoVersionName() async {
    final vendorId = widget.vendorId;
    final vendorResult = await ApiClient.getVendorById(vendorId);
    final listResult = await ApiClient.getVendorPriceLists(vendorId);

    final vendorName = vendorResult['success'] == true
        ? (vendorResult['data']?['vendor_name']?.toString() ?? '')
        : '';
    final prefix = _makeVersionPrefix(vendorName);

    final apiLists = listResult['success'] == true && listResult['data'] is List
        ? listResult['data'] as List
        : const [];
    final pattern = RegExp('^${RegExp.escape(prefix)}-(\\d{3})\$');
    var maxSeq = 0;
    for (final row in apiLists.whereType<Map>()) {
      final versionName = row['version_name']?.toString() ?? '';
      final match = pattern.firstMatch(versionName);
      if (match != null) {
        final value = int.tryParse(match.group(1) ?? '');
        if (value != null && value > maxSeq) maxSeq = value;
      }
    }
    final nextSeq = (maxSeq + 1).toString().padLeft(3, '0');
    return '$prefix-$nextSeq';
  }

  String? _resolveFilePath(Map<String, dynamic>? data) {
    if (data == null) return null;
    final direct = data['file_path'] ?? data['path'] ?? data['url'];
    if (direct != null && direct.toString().trim().isNotEmpty) {
      return direct.toString();
    }
    final nested = data['data'];
    if (nested is Map<String, dynamic>) {
      final nestedPath =
          nested['file_path'] ??
          nested['path'] ??
          nested['url'] ??
          nested['filePath'];
      if (nestedPath != null && nestedPath.toString().trim().isNotEmpty) {
        return nestedPath.toString();
      }
    }
    return null;
  }

  Future<void> _pickAndUploadFile() async {
    final file = await FileService.pickFileWithSource(context: context);
    if (file == null) return;
    setState(() {
      _selectedFile = file;
      _uploading = true;
    });
    final store = StoreProvider.of<AppState>(context);
    final user = store.state.auth.user;
    final projectId =
        widget.projectId ??
        store.state.project.selectedProjectId ??
        store.state.project.selectedProject?['project_id']?.toString();
    final uploadResult = await ApiClient.uploadVendorPriceListFile(
      file,
      fields: {
        'vendor_id': widget.vendorId,
        if (projectId != null && projectId.toString().isNotEmpty)
          'project_id': projectId.toString(),
        if (user?['id'] != null) 'user_id': user!['id'].toString(),
        if (user?['user_id'] != null) 'user_id': user!['user_id'].toString(),
        if (user?['name'] != null) 'user_name': user!['name'].toString(),
      },
    );
    if (!mounted) return;

    if (uploadResult['success'] == true) {
      final resultData = uploadResult['data'] is Map<String, dynamic>
          ? uploadResult['data'] as Map<String, dynamic>
          : null;
      final resolvedPath = _resolveFilePath(resultData) ?? '';
      final resolvedName = (resultData?['filename'] ?? '').toString();
      final imported =
          resultData?['imported_items'] is List
              ? List<Map<String, dynamic>>.from(
                  (resultData?['imported_items'] as List)
                      .whereType<Map>()
                      .map((e) => Map<String, dynamic>.from(e)),
                )
              : <Map<String, dynamic>>[];
      final importedRows = imported
          .map((row) => _normalizeUploadedItem(row))
          .toList();
      setState(() {
        _uploadedFilename = resolvedName;
        _uploadedFilePath = resolvedPath;
        _uploadedItems = imported;
        if (importedRows.isNotEmpty) {
          _items = importedRows;
          _editUploaded = false;
        }
      });
      final importedCount = resultData?['rows_imported'];
      final skippedCount = resultData?['rows_skipped'];
      final summary =
          (importedCount != null || skippedCount != null)
              ? 'Imported ${importedCount ?? 0}, skipped ${skippedCount ?? 0}.'
              : 'Upload successful.';
      showToast(context, summary);
    } else {
      showToast(
        context,
        uploadResult['error']?.toString() ?? 'Upload failed',
        variant: ToastVariant.error,
      );
    }

    if (mounted) {
      setState(() {
        _uploading = false;
      });
    }
  }

  Map<String, String> _normalizeUploadedItem(Map<String, dynamic> row) {
    String read(dynamic value) => value?.toString() ?? '';
    return {
      'name': read(row['name']),
      'brand': read(row['brand']),
      'quantity': read(row['quantity']),
      'units': read(row['units']),
      'price': read(row['price']),
      'discount_percent': read(row['discount_percent']),
      'width': read(row['width']),
      'height': read(row['height']),
      'stockin': read(row['stockin']),
      'billing': read(row['billing']),
      'project_id': read(row['project_id']),
      'notes': read(row['notes']),
    };
  }

  void _addItemRow() {
    setState(() {
      _items = [..._items, _emptyItem()];
    });
  }

  void _removeItemRow(int index) {
    if (_items.length == 1) return;
    setState(() {
      _items = _items
          .asMap()
          .entries
          .where((entry) => entry.key != index)
          .map((entry) => entry.value)
          .toList();
    });
  }

  void _updateItem(int index, String key, String value) {
    final next = [..._items];
    next[index] = {...next[index], key: value};
    setState(() {
      _items = next;
    });
  }

  Future<void> _createPriceList() async {
    setState(() {
      _creating = true;
    });

    final trimmedVersionName = _versionName.trim();
    final versionName =
        trimmedVersionName.isNotEmpty
            ? trimmedVersionName
            : await _buildAutoVersionName();
    final payload = <String, dynamic>{
      'vendor_id': int.tryParse(widget.vendorId) ?? widget.vendorId,
      'version_name': versionName,
      'status': 'active',
      if (_uploadedFilename.trim().isNotEmpty)
        'filename': _uploadedFilename.trim(),
      if (_uploadedFilePath.trim().isNotEmpty)
        'file_path': _uploadedFilePath.trim(),
      'items': _items,
    };

    final result = await ApiClient.createVendorPriceList(payload);
    if (!mounted) return;

    if (result['success'] == true) {
      showToast(context, 'Price list created');
      Navigator.pop(context, true);
    } else {
      showToast(
        context,
        result['error']?.toString() ?? 'Create failed',
        variant: ToastVariant.error,
      );
    }

    if (mounted) {
      setState(() {
        _creating = false;
      });
    }
  }

  Widget _buildItemCard(int index, bool isDark) {
    final row = _items[index];
    final itemNumber = index + 1;

    Widget field(
      String key,
      String label, {
      TextInputType keyboardType = TextInputType.text,
      bool readOnly = false,
      ValueChanged<String>? onFieldChanged,
    }) {
      final value = row[key] ?? '';
      return SizedBox(
        width: 240,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 8),
            TextFormField(
              key: ValueKey(
                readOnly ? 'item-$index-$key-$value' : 'item-$index-$key',
              ),
              initialValue: value,
              keyboardType: keyboardType,
              readOnly: readOnly,
              onChanged: readOnly
                  ? null
                  : (value) {
                      if (onFieldChanged != null) {
                        onFieldChanged(value);
                        return;
                      }
                      _updateItem(index, key, value);
                    },
              decoration: const InputDecoration(
                isDense: true,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Item $itemNumber',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                MadButton(
                  text: 'Remove',
                  icon: LucideIcons.trash2,
                  variant: ButtonVariant.destructive,
                  size: ButtonSize.sm,
                  disabled: _items.length == 1,
                  onPressed: () => _removeItemRow(index),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 12,
              runSpacing: 10,
              children: [
                field('name', 'Name'),
                field('brand', 'Brand'),
                field('quantity', 'Qty', keyboardType: TextInputType.number),
                field('units', 'Units'),
                field('price', 'Price', keyboardType: TextInputType.number),
                field(
                  'discount_percent',
                  'Discount %',
                  keyboardType: TextInputType.number,
                ),
                field('width', 'Width', keyboardType: TextInputType.number),
                field('height', 'Height', keyboardType: TextInputType.number),
                field('stockin', 'Stock In'),
                field('billing', 'Billing'),
                field('project_id', 'Project Id'),
                field('notes', 'Notes'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUploadedItemsTable(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Uploaded Inventory Items',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Review items parsed from the Excel upload.',
                        style: TextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                ),
                MadButton(
                  text: 'Edit Items',
                  variant: ButtonVariant.outline,
                  onPressed: () => setState(() => _editUploaded = true),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: const [
                  DataColumn(label: Text('Name')),
                  DataColumn(label: Text('Brand')),
                  DataColumn(label: Text('Qty')),
                  DataColumn(label: Text('Units')),
                  DataColumn(label: Text('Price')),
                  DataColumn(label: Text('Width')),
                  DataColumn(label: Text('Height')),
                  DataColumn(label: Text('Stock In')),
                  DataColumn(label: Text('Billing')),
                  DataColumn(label: Text('Project Id')),
                  DataColumn(label: Text('Notes')),
                ],
                rows: _uploadedItems.map((item) {
                  String read(dynamic v) => v?.toString() ?? '-';
                  return DataRow(
                    cells: [
                      DataCell(Text(read(item['name']))),
                      DataCell(Text(read(item['brand']))),
                      DataCell(Text(read(item['quantity']))),
                      DataCell(Text(read(item['units']))),
                      DataCell(Text(read(item['price']))),
                      DataCell(Text(read(item['width']))),
                      DataCell(Text(read(item['height']))),
                      DataCell(Text(read(item['stockin']))),
                      DataCell(Text(read(item['billing']))),
                      DataCell(Text(read(item['project_id']))),
                      DataCell(
                        SizedBox(
                          width: 200,
                          child: Text(
                            read(item['notes']),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ProtectedRoute(
      title: 'Create Price List',
      route: '/vendors',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              MadButton(
                text: 'Back to Price Lists',
                icon: LucideIcons.arrowLeft,
                variant: ButtonVariant.outline,
                onPressed: () => Navigator.pop(context),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Create Price List',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Create a new vendor price list with optional file upload.',
            style: TextStyle(
              fontSize: 13,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Version Name',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Edit the version name before creating the price list.',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextFormField(
                            initialValue: _versionName,
                            onChanged: (value) =>
                                setState(() => _versionName = value),
                            decoration: const InputDecoration(
                              labelText: 'Version Name',
                              hintText: 'Auto-generated if left blank',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Upload File',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Drag and drop or choose a file to upload.',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                          const SizedBox(height: 10),
                          InkWell(
                            onTap: _uploading ? null : _pickAndUploadFile,
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: (isDark
                                          ? AppTheme.darkBorder
                                          : AppTheme.lightBorder)
                                      .withValues(alpha: 0.6),
                                ),
                                color: (isDark
                                        ? AppTheme.darkMuted
                                        : AppTheme.lightMuted)
                                    .withValues(alpha: 0.25),
                              ),
                              child: Column(
                                children: [
                                  Icon(
                                    LucideIcons.upload,
                                    size: 22,
                                    color: isDark
                                        ? AppTheme.darkMutedForeground
                                        : AppTheme.lightMutedForeground,
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Upload Vendor Price List',
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Drag and drop or click to upload',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isDark
                                          ? AppTheme.darkMutedForeground
                                          : AppTheme.lightMutedForeground,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  MadButton(
                                    text:
                                        _uploading ? 'Uploading...' : 'Choose File',
                                    variant: ButtonVariant.outline,
                                    size: ButtonSize.sm,
                                    loading: _uploading,
                                    onPressed:
                                        _uploading ? null : _pickAndUploadFile,
                                  ),
                                  if (_selectedFile != null) ...[
                                    const SizedBox(height: 10),
                                    Text(
                                      'Selected: ${_selectedFile!.path.split('/').last}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: isDark
                                            ? AppTheme.darkMutedForeground
                                            : AppTheme.lightMutedForeground,
                                      ),
                                    ),
                                    MadButton(
                                      text: 'Remove File',
                                      variant: ButtonVariant.ghost,
                                      size: ButtonSize.sm,
                                      onPressed: () {
                                        setState(() {
                                          _selectedFile = null;
                                          _uploadedFilename = '';
                                          _uploadedFilePath = '';
                                          _uploadedItems = [];
                                          _editUploaded = false;
                                        });
                                      },
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_uploadedItems.isNotEmpty && !_editUploaded)
                    _buildUploadedItemsTable(isDark)
                  else
                    MadCard(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  _uploadedItems.isNotEmpty
                                      ? 'Edit Uploaded Items'
                                      : 'Manual Item Entry',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const Spacer(),
                                MadButton(
                                  text: 'Add Item',
                                  icon: LucideIcons.plus,
                                  variant: ButtonVariant.outline,
                                  size: ButtonSize.sm,
                                  onPressed: _addItemRow,
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _uploadedItems.isNotEmpty
                                  ? 'Update uploaded items, then save the price list.'
                                  : 'Total items: ${_items.length}',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark
                                    ? AppTheme.darkMutedForeground
                                    : AppTheme.lightMutedForeground,
                              ),
                            ),
                            const SizedBox(height: 10),
                            ..._items.asMap().entries.map(
                              (entry) => _buildItemCard(entry.key, isDark),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (_uploadedItems.isNotEmpty && _editUploaded) ...[
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: MadButton(
                        text: 'Back to Table',
                        variant: ButtonVariant.outline,
                        onPressed: () =>
                            setState(() => _editUploaded = false),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      MadButton(
                        text: 'Cancel',
                        variant: ButtonVariant.outline,
                        onPressed: () => Navigator.pop(context),
                      ),
                      const SizedBox(width: 8),
                      MadButton(
                        text: _creating ? 'Creating...' : 'Create Price List',
                        loading: _creating,
                        onPressed: _creating ? null : _createPriceList,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
