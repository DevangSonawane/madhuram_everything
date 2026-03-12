import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class MIRCreatePage extends StatefulWidget {
  const MIRCreatePage({super.key});

  @override
  State<MIRCreatePage> createState() => _MIRCreatePageState();
}

class _MIRCreatePageState extends State<MIRCreatePage> {
  bool _loading = true;
  bool _submitting = false;
  bool _uploadingAttachment = false;

  final _projectNameController = TextEditingController();
  final _projectCodeController = TextEditingController();
  final _clientNameController = TextEditingController();
  final _pmcController = TextEditingController();
  final _contractorController = TextEditingController();
  final _vendorCodeController = TextEditingController();
  final _mirRefController = TextEditingController();
  final _materialCodeController = TextEditingController();
  final _inspectionDateController = TextEditingController();
  final _clientSubmissionDateController = TextEditingController();
  final _projectIdController = TextEditingController();

  String? _selectedPoId;
  String? _selectedChallanNo;
  String _attachmentPath = '';

  List<Map<String, dynamic>> _projectPos = [];
  List<Map<String, dynamic>> _challans = [];
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initForm();
    });
  }

  @override
  void dispose() {
    _projectNameController.dispose();
    _projectCodeController.dispose();
    _clientNameController.dispose();
    _pmcController.dispose();
    _contractorController.dispose();
    _vendorCodeController.dispose();
    _mirRefController.dispose();
    _materialCodeController.dispose();
    _inspectionDateController.dispose();
    _clientSubmissionDateController.dispose();
    _projectIdController.dispose();
    super.dispose();
  }

  String _selectedProjectId() {
    final store = StoreProvider.of<AppState>(context);
    return store.state.project.selectedProject?['project_id']?.toString() ??
        store.state.project.selectedProjectId ??
        '';
  }

  Future<void> _initForm() async {
    final projectId = _selectedProjectId();
    _projectIdController.text = projectId;

    if (projectId.isEmpty) {
      if (!mounted) return;
      setState(() => _loading = false);
      return;
    }

    await Future.wait([_loadPOs(projectId), _loadChallans(projectId)]);
    if (!mounted) return;
    setState(() => _loading = false);
  }

  Future<void> _loadPOs(String projectId) async {
    final result = await ApiClient.getPosByProject(projectId);
    if (result['success'] == true && result['data'] is List) {
      _projectPos = (result['data'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      return;
    }
    _projectPos = [];
  }

  Future<void> _loadChallans(String projectId) async {
    final result = await ApiClient.getDcsByProject(projectId);
    if (result['success'] == true && result['data'] is List) {
      _challans = (result['data'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      return;
    }
    _challans = [];
  }

  List<Map<String, dynamic>> get _challanOptions {
    final seen = <String>{};
    final options = <Map<String, dynamic>>[];
    for (final row in _challans) {
      final challanNo = (row['challan_number'] ?? '').toString();
      if (challanNo.isEmpty || seen.contains(challanNo)) continue;
      seen.add(challanNo);
      options.add(row);
    }
    return options;
  }

  double _toNum(dynamic value, [double fallback = 0]) {
    final parsed = double.tryParse(value?.toString() ?? '');
    return parsed ?? fallback;
  }

  int _toInt(dynamic value, [int fallback = 0]) {
    final parsed = int.tryParse(value?.toString() ?? '');
    return parsed ?? fallback;
  }

  String _toText(dynamic value) => value == null ? '' : value.toString().trim();

  List<Map<String, dynamic>> _mapChallanItemsToMirItems(dynamic rawItems) {
    if (rawItems is! List) return [];
    return rawItems.asMap().entries.map((entry) {
      final index = entry.key;
      final item = entry.value is Map
          ? Map<String, dynamic>.from(entry.value as Map)
          : <String, dynamic>{};

      final qty = _toNum(item['qty'] ?? item['quantity']);
      final rate = _toNum(item['Rate'] ?? item['rate'] ?? item['price']);
      final amount = _toNum(item['Amount'] ?? item['amount'], qty * rate);

      return {
        'srno': _toInt(item['srno'], index + 1),
        'hsn': _toText(item['hsn'] ?? item['hsnCode'] ?? item['hsn_code'] ?? item['HSN']),
        'description': _toText(item['description'] ?? item['name']),
        'qty': qty,
        'UOM': _toText(item['UOM'] ?? item['uom'] ?? item['unit'] ?? item['Unit']),
        'Rate': rate,
        'Amount': amount,
        'remark': _toText(item['remark']),
        'inspected': false,
      };
    }).toList();
  }

  List<Map<String, dynamic>> _enrichMirItemsFromPo(
    List<Map<String, dynamic>> mirItems,
    List<dynamic> poItems,
  ) {
    final byDesc = <String, Map<String, dynamic>>{};
    for (final item in poItems) {
      if (item is! Map) continue;
      final m = Map<String, dynamic>.from(item);
      final key = _toText(m['description'] ?? m['name']).toLowerCase();
      if (key.isNotEmpty && !byDesc.containsKey(key)) byDesc[key] = m;
    }

    return mirItems.asMap().entries.map((entry) {
      final index = entry.key;
      final item = entry.value;
      final descKey = _toText(item['description']).toLowerCase();
      final poItem = byDesc[descKey] ??
          (index < poItems.length && poItems[index] is Map
              ? Map<String, dynamic>.from(poItems[index] as Map)
              : <String, dynamic>{});

      if (poItem.isEmpty) return item;

      return {
        ...item,
        'hsn': _toText(item['hsn']).isNotEmpty
            ? _toText(item['hsn'])
            : _toText(poItem['hsn'] ?? poItem['hsnCode'] ?? poItem['hsn_code'] ?? poItem['HSN']),
        'UOM': _toText(item['UOM']).isNotEmpty
            ? _toText(item['UOM'])
            : _toText(poItem['UOM'] ?? poItem['uom'] ?? poItem['unit'] ?? poItem['Unit']),
      };
    }).toList();
  }

  Future<void> _handleChallanChange(String? value) async {
    if (value == null || value.isEmpty) return;

    final selected = _challans.firstWhere(
      (row) => (row['challan_number'] ?? '').toString() == value,
      orElse: () => <String, dynamic>{},
    );

    var mappedItems = _mapChallanItemsToMirItems(selected['items']);
    final needsPoEnrichment = mappedItems.any((item) {
      return _toText(item['hsn']).isEmpty || _toText(item['UOM']).isEmpty;
    });

    final poId = _toText(selected['po_id']).isNotEmpty
        ? _toText(selected['po_id'])
        : (_selectedPoId ?? '');

    if (needsPoEnrichment && poId.isNotEmpty) {
      final poRes = await ApiClient.getPoById(poId);
      if (poRes['success'] == true && poRes['data'] is Map) {
        final po = Map<String, dynamic>.from(poRes['data'] as Map);
        if (po['items'] is List) {
          mappedItems = _enrichMirItemsFromPo(mappedItems, po['items'] as List<dynamic>);
        }
      }
    }

    if (!mounted) return;
    setState(() {
      _selectedChallanNo = value;
      _items = mappedItems;
    });
  }

  Future<void> _pickDate(TextEditingController controller) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (date != null && mounted) {
      controller.text = DateFormat('yyyy-MM-dd').format(date);
    }
  }

  Future<void> _uploadAttachment() async {
    final file = await FileService.pickFile(context: context);
    if (file == null) return;

    setState(() => _uploadingAttachment = true);
    final result = await ApiClient.uploadMirReference(file);
    if (!mounted) return;
    setState(() => _uploadingAttachment = false);

    if (result['success'] == true && result['data'] is Map) {
      final data = Map<String, dynamic>.from(result['data'] as Map);
      setState(() => _attachmentPath = (data['filePath'] ?? '').toString());
      showToast(context, 'Attachment uploaded');
      return;
    }

    showToast(context, result['error']?.toString() ?? 'Upload failed');
  }

  int get _inspectedCount =>
      _items.where((item) => item['inspected'] == true).length;

  bool get _allItemsInspected => _items.isNotEmpty && _inspectedCount == _items.length;

  Future<void> _showInspectionDialog() async {
    final workingItems = _items
        .map((item) => Map<String, dynamic>.from(item))
        .toList();

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final size = MediaQuery.of(context).size;
          final isNarrow = size.width < 640;
          final inspectedCount =
              workingItems.where((item) => item['inspected'] == true).length;

          void toggleItem(int index, bool checked) {
            if (index < 0 || index >= workingItems.length) return;
            setDialogState(() {
              workingItems[index] = {
                ...workingItems[index],
                'inspected': checked,
              };
            });
          }

          void toggleAll(bool checked) {
            setDialogState(() {
              for (var i = 0; i < workingItems.length; i++) {
                workingItems[i] = {...workingItems[i], 'inspected': checked};
              }
            });
          }

          return Dialog(
            insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: isNarrow ? size.width - 32 : 760,
                maxHeight: isNarrow ? size.height * 0.78 : 560,
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Inspection Checklist',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    const Text('Review all items and tick each checkbox after inspection.'),
                    const SizedBox(height: 12),
                    Expanded(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: SingleChildScrollView(
                          child: DataTable(
                            columns: const [
                              DataColumn(label: Text('Done')),
                              DataColumn(label: Text('Sr No')),
                              DataColumn(label: Text('HSN')),
                              DataColumn(label: Text('Description')),
                              DataColumn(label: Text('Qty')),
                              DataColumn(label: Text('UOM')),
                              DataColumn(label: Text('Rate')),
                              DataColumn(label: Text('Amount')),
                              DataColumn(label: Text('Remark')),
                            ],
                            rows: workingItems.asMap().entries.map((entry) {
                              final index = entry.key;
                              final item = entry.value;
                              return DataRow(
                                cells: [
                                  DataCell(
                                    Checkbox(
                                      value: item['inspected'] == true,
                                      onChanged: (v) => toggleItem(index, v ?? false),
                                    ),
                                  ),
                                  DataCell(Text('${item['srno'] ?? '-'}')),
                                  DataCell(Text(_toText(item['hsn']).isEmpty ? '-' : _toText(item['hsn']))),
                                  DataCell(Text(_toText(item['description']).isEmpty ? '-' : _toText(item['description']))),
                                  DataCell(Text('${item['qty'] ?? '-'}')),
                                  DataCell(Text(_toText(item['UOM']).isEmpty ? '-' : _toText(item['UOM']))),
                                  DataCell(Text('${item['Rate'] ?? '-'}')),
                                  DataCell(Text('${item['Amount'] ?? '-'}')),
                                  DataCell(Text(_toText(item['remark']).isEmpty ? '-' : _toText(item['remark']))),
                                ],
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (isNarrow)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('$inspectedCount / ${workingItems.length} items inspected'),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              MadButton(
                                text: 'Mark All',
                                variant: ButtonVariant.outline,
                                onPressed: () => toggleAll(true),
                              ),
                              MadButton(
                                text: 'Clear All',
                                variant: ButtonVariant.outline,
                                onPressed: () => toggleAll(false),
                              ),
                              MadButton(
                                text: 'Done',
                                onPressed: () {
                                  if (mounted) {
                                    setState(() {
                                      _items = workingItems
                                          .map((item) => Map<String, dynamic>.from(item))
                                          .toList();
                                    });
                                  }
                                  Navigator.pop(context);
                                },
                              ),
                            ],
                          ),
                        ],
                      )
                    else
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('$inspectedCount / ${workingItems.length} items inspected'),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              MadButton(
                                text: 'Mark All',
                                variant: ButtonVariant.outline,
                                onPressed: () => toggleAll(true),
                              ),
                              MadButton(
                                text: 'Clear All',
                                variant: ButtonVariant.outline,
                                onPressed: () => toggleAll(false),
                              ),
                              MadButton(
                                text: 'Done',
                                onPressed: () {
                                  if (mounted) {
                                    setState(() {
                                      _items = workingItems
                                          .map((item) => Map<String, dynamic>.from(item))
                                          .toList();
                                    });
                                  }
                                  Navigator.pop(context);
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _createMIR() async {
    if (_mirRefController.text.trim().isEmpty) {
      showToast(context, 'MIR reference required');
      return;
    }
    if ((_selectedChallanNo ?? '').trim().isEmpty) {
      showToast(context, 'Challan required');
      return;
    }
    if ((_selectedPoId ?? '').trim().isEmpty) {
      showToast(context, 'PO ID required');
      return;
    }

    final parsedPoId = int.tryParse(_selectedPoId!.trim());
    if (parsedPoId == null || parsedPoId <= 0) {
      showToast(context, 'Select a valid PO ID');
      return;
    }

    final projectId = int.tryParse(_projectIdController.text.trim()) ??
        int.tryParse(_selectedProjectId());

    if (projectId == null || projectId <= 0) {
      showToast(context, 'Project ID required');
      return;
    }

    final itemsPayload = _items.asMap().entries.map((entry) {
      final index = entry.key;
      final item = entry.value;
      final qty = _toNum(item['qty']);
      final rate = _toNum(item['Rate']);
      final amount = _toNum(item['Amount'], qty * rate);

      return {
        'srno': _toInt(item['srno'], index + 1),
        'hsn': _toText(item['hsn']),
        'description': _toText(item['description']),
        'qty': qty,
        'UOM': _toText(item['UOM']),
        'Rate': rate,
        'Amount': amount,
        'remark': _toText(item['remark']),
        'inspected': item['inspected'] == true,
      };
    }).toList();

    final payload = {
      'project_name': _projectNameController.text.trim(),
      'project_code': _projectCodeController.text.trim(),
      'client_name': _clientNameController.text.trim(),
      'pmc': _pmcController.text.trim(),
      'contractor': _contractorController.text.trim(),
      'vendor_code': _vendorCodeController.text.trim(),
      'po_id': parsedPoId,
      'challan_no': (_selectedChallanNo ?? '').trim(),
      'mir_refrence_no': _mirRefController.text.trim(),
      'material_code': _materialCodeController.text.trim(),
      'inspection_date_time': _inspectionDateController.text.trim().isEmpty
          ? ''
          : '${_inspectionDateController.text.trim()}T00:00:00.000Z',
      'client_submission_date': _clientSubmissionDateController.text.trim(),
      'refrence_docs_attached': _attachmentPath.trim(),
      'project_id': projectId,
      'items': itemsPayload,
      'dynamic_field': <dynamic>[],
      'mir_submited': true,
    };

    setState(() => _submitting = true);
    final result = await ApiClient.createMir(payload);
    if (!mounted) return;
    setState(() => _submitting = false);

    if (result['success'] == true) {
      showToast(context, 'MIR created successfully');
      Navigator.pop(context);
      return;
    }

    showToast(context, result['error']?.toString() ?? 'Failed to create MIR');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    final poOptions = _projectPos
        .map((po) {
          final id = (po['po_id'] ?? '').toString();
          if (id.isEmpty) return null;
          return MadSelectOption<String>(value: id, label: id);
        })
        .whereType<MadSelectOption<String>>()
        .toList();

    final challanOptions = _challanOptions
        .map((row) {
          final no = (row['challan_number'] ?? '').toString();
          if (no.isEmpty) return null;
          return MadSelectOption<String>(value: no, label: no);
        })
        .whereType<MadSelectOption<String>>()
        .toList();

    return ProtectedRoute(
      title: 'Create MIR',
      route: '/mir/create',
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
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
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
                        'Add a new material inspection request.',
                        style: TextStyle(
                          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
                MadButton(
                  text: 'Back to MIR List',
                  icon: LucideIcons.arrowLeft,
                  variant: ButtonVariant.outline,
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Expanded(
            child: MadCard(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'MIR Details',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Fill fields as per the MIR API payload.',
                            style: TextStyle(
                              color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                            ),
                          ),
                          const SizedBox(height: 20),
                          Wrap(
                            spacing: 16,
                            runSpacing: 16,
                            children: [
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _projectNameController,
                                  labelText: 'Project Name',
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _projectCodeController,
                                  labelText: 'Project Code',
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _clientNameController,
                                  labelText: 'Client Name',
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _pmcController,
                                  labelText: 'PMC',
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _contractorController,
                                  labelText: 'Contractor',
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _vendorCodeController,
                                  labelText: 'Vendor Code',
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadSelect<String>(
                                  labelText: 'PO ID',
                                  value: _selectedPoId,
                                  placeholder: poOptions.isEmpty ? 'No POs found' : 'Select PO ID',
                                  options: poOptions,
                                  searchable: true,
                                  onChanged: (v) => setState(() => _selectedPoId = v),
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadSelect<String>(
                                  labelText: 'Challan No',
                                  value: _selectedChallanNo,
                                  placeholder: challanOptions.isEmpty ? 'No challans found' : 'Select challan no',
                                  options: challanOptions,
                                  searchable: true,
                                  onChanged: _handleChallanChange,
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _mirRefController,
                                  labelText: 'MIR Reference No *',
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _materialCodeController,
                                  labelText: 'Material Code',
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _inspectionDateController,
                                  labelText: 'Inspection Date',
                                  hintText: 'YYYY-MM-DD',
                                  suffix: IconButton(
                                    icon: const Icon(LucideIcons.calendar, size: 18),
                                    onPressed: () => _pickDate(_inspectionDateController),
                                  ),
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _clientSubmissionDateController,
                                  labelText: 'Client Submission Date',
                                  hintText: 'YYYY-MM-DD',
                                  suffix: IconButton(
                                    icon: const Icon(LucideIcons.calendar, size: 18),
                                    onPressed: () => _pickDate(_clientSubmissionDateController),
                                  ),
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: MadInput(
                                  controller: _projectIdController,
                                  labelText: 'Project ID',
                                  keyboardType: TextInputType.number,
                                ),
                              ),
                              SizedBox(
                                width: isMobile ? double.infinity : 320,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Add Attachment',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Container(
                                            height: 40,
                                            padding: const EdgeInsets.symmetric(horizontal: 12),
                                            alignment: Alignment.centerLeft,
                                            decoration: BoxDecoration(
                                              borderRadius: BorderRadius.circular(8),
                                              color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                                                  .withValues(alpha: 0.5),
                                            ),
                                            child: Text(
                                              _attachmentPath.isEmpty ? 'No attachment' : 'Attachment added',
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                color: isDark
                                                    ? AppTheme.darkMutedForeground
                                                    : AppTheme.lightMutedForeground,
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        MadButton(
                                          text: _uploadingAttachment ? 'Uploading...' : 'Choose File',
                                          icon: LucideIcons.upload,
                                          variant: ButtonVariant.outline,
                                          loading: _uploadingAttachment,
                                          disabled: _uploadingAttachment,
                                          onPressed: _uploadAttachment,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          Text(
                            'Items',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 10),
                          if ((_selectedChallanNo ?? '').isEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                                ),
                              ),
                              child: Text(
                                'Select a delivery challan to see the items.',
                                style: TextStyle(
                                  color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                                ),
                              ),
                            )
                          else if (_items.isEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                                ),
                              ),
                              child: Text(
                                'No items found for the selected delivery challan.',
                                style: TextStyle(
                                  color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                                ),
                              ),
                            )
                          else
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: DataTable(
                                columns: const [
                                  DataColumn(label: Text('Sr No')),
                                  DataColumn(label: Text('HSN')),
                                  DataColumn(label: Text('Description')),
                                  DataColumn(label: Text('Qty')),
                                  DataColumn(label: Text('UOM')),
                                  DataColumn(label: Text('Rate')),
                                  DataColumn(label: Text('Amount')),
                                  DataColumn(label: Text('Remark')),
                                  DataColumn(label: Text('Inspected')),
                                ],
                                rows: _items.map((item) {
                                  return DataRow(
                                    cells: [
                                      DataCell(Text('${item['srno'] ?? '-'}')),
                                      DataCell(Text(_toText(item['hsn']).isEmpty ? '-' : _toText(item['hsn']))),
                                      DataCell(Text(_toText(item['description']).isEmpty ? '-' : _toText(item['description']))),
                                      DataCell(Text('${item['qty'] ?? '-'}')),
                                      DataCell(Text(_toText(item['UOM']).isEmpty ? '-' : _toText(item['UOM']))),
                                      DataCell(Text('${item['Rate'] ?? '-'}')),
                                      DataCell(Text('${item['Amount'] ?? '-'}')),
                                      DataCell(Text(_toText(item['remark']).isEmpty ? '-' : _toText(item['remark']))),
                                      DataCell(
                                        (_allItemsInspected || item['inspected'] == true)
                                            ? const Icon(Icons.check_circle, color: Colors.green)
                                            : const Text('-'),
                                      ),
                                    ],
                                  );
                                }).toList(),
                              ),
                            ),
                          if ((_selectedChallanNo ?? '').isNotEmpty && _items.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                MadButton(
                                  text: 'Inspection',
                                  variant: ButtonVariant.outline,
                                  onPressed: _showInspectionDialog,
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 24),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              MadButton(
                                text: 'Cancel',
                                variant: ButtonVariant.outline,
                                onPressed: _submitting ? null : () => Navigator.pop(context),
                              ),
                              const SizedBox(width: 12),
                              MadButton(
                                text: _submitting ? 'Creating...' : 'Create MIR',
                                loading: _submitting,
                                disabled: _submitting,
                                onPressed: _createMIR,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
