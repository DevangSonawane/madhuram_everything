import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';
import '../utils/riverpod_context.dart';

const String _lodhaFormat = 'lodha';
const String _hiranandaniFormat = 'hiranandani';

class MIRCreatePage extends StatefulWidget {
  const MIRCreatePage({super.key});

  @override
  State<MIRCreatePage> createState() => _MIRCreatePageState();
}

class _MIRCreatePageState extends State<MIRCreatePage> {
  bool _loading = true;
  bool _submitting = false;
  bool _uploadingFiles = false;
  String _mirFormat = _lodhaFormat;

  final _projectNameController = TextEditingController();
  final _projectCodeController = TextEditingController();
  final _clientNameController = TextEditingController();
  final _pmcController = TextEditingController();
  final _contractorController = TextEditingController();
  final _vendorCodeController = TextEditingController();
  final _poIdController = TextEditingController();
  final _challanNoController = TextEditingController();
  final _mirRefController = TextEditingController();
  final _materialCodeController = TextEditingController();
  final _inspectionDateController = TextEditingController();
  final _clientSubmissionDateController = TextEditingController();
  final _projectIdController = TextEditingController();
  final _dynamicControllers = <String, TextEditingController>{};

  String? _selectedPoId;
  String? _selectedChallanNo;
  String? _preselectChallan;
  final List<String> _uploadedFilePaths = [];

  List<Map<String, dynamic>> _projectPos = [];
  List<Map<String, dynamic>> _challans = [];
  List<Map<String, dynamic>> _items = [];
  final List<Map<String, TextEditingController>> _hiraRows = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map && args['challan'] != null) {
        final raw = args['challan'].toString().trim();
        if (raw.isNotEmpty) _preselectChallan = raw;
      }
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
    _poIdController.dispose();
    _challanNoController.dispose();
    for (final controller in _dynamicControllers.values) {
      controller.dispose();
    }
    for (final row in _hiraRows) {
      for (final controller in row.values) {
        controller.dispose();
      }
    }
    super.dispose();
  }

  String _selectedProjectId() {
    return context.appProject.selectedProject?['project_id']?.toString() ??
        context.appProject.selectedProjectId ??
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
    _ensureHiraRow();
    _fieldController('lodha_discipline', initial: 'Structural / Civil');
    _fieldController(
      'lodha_inspection_result',
      initial: 'Code 1 - Approved - Material can be used',
    );
    _fieldController('lodha_distribution', initial: 'Lodha');
    _fieldController('hira_approval_code', initial: 'Code A - Approved');
    _fieldController('hira_status', initial: 'Completed');
    if (_preselectChallan != null && _preselectChallan!.isNotEmpty) {
      final exists = _challanOptions.any((row) {
        final challanNo = (row['challan_number'] ?? '').toString().trim();
        return challanNo == _preselectChallan;
      });
      if (exists) {
        await _handleChallanChange(_preselectChallan);
      }
    }
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
        'hsn': _toText(
          item['hsn'] ?? item['hsnCode'] ?? item['hsn_code'] ?? item['HSN'],
        ),
        'description': _toText(item['description'] ?? item['name']),
        'qty': qty,
        'UOM': _toText(
          item['UOM'] ?? item['uom'] ?? item['unit'] ?? item['Unit'],
        ),
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
      final poItem =
          byDesc[descKey] ??
          (index < poItems.length && poItems[index] is Map
              ? Map<String, dynamic>.from(poItems[index] as Map)
              : <String, dynamic>{});

      if (poItem.isEmpty) return item;

      return {
        ...item,
        'hsn': _toText(item['hsn']).isNotEmpty
            ? _toText(item['hsn'])
            : _toText(
                poItem['hsn'] ??
                    poItem['hsnCode'] ??
                    poItem['hsn_code'] ??
                    poItem['HSN'],
              ),
        'UOM': _toText(item['UOM']).isNotEmpty
            ? _toText(item['UOM'])
            : _toText(
                poItem['UOM'] ??
                    poItem['uom'] ??
                    poItem['unit'] ??
                    poItem['Unit'],
              ),
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
          mappedItems = _enrichMirItemsFromPo(
            mappedItems,
            po['items'] as List<dynamic>,
          );
        }
      }
    }

    if (!mounted) return;
    setState(() {
      _selectedChallanNo = value;
      _fieldController('challan_no').text = value;
      if (poId.isNotEmpty) {
        _selectedPoId = poId;
        _fieldController('po_id').text = poId;
      }
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

  TextEditingController _fieldController(String key, {String initial = ''}) {
    return _dynamicControllers.putIfAbsent(
      key,
      () => TextEditingController(text: initial),
    );
  }

  Future<void> _uploadReferenceFiles() async {
    final files = await FileService.pickMultipleFilesWithSource(
      context: context,
    );
    if (files.isEmpty) return;

    setState(() => _uploadingFiles = true);
    final uploaded = <String>[];

    for (final file in files) {
      final result = await ApiClient.uploadMirReference(file);
      if (result['success'] == true && result['data'] is Map) {
        final data = Map<String, dynamic>.from(result['data'] as Map);
        final filePath = (data['filePath'] ?? '').toString();
        if (filePath.isNotEmpty) uploaded.add(filePath);
      }
    }

    if (!mounted) return;
    setState(() {
      _uploadingFiles = false;
      if (uploaded.isNotEmpty) {
        _uploadedFilePaths.addAll(uploaded);
      }
    });

    if (uploaded.isNotEmpty) {
      showToast(context, 'Uploaded ${uploaded.length} file(s)');
    } else {
      showToast(context, 'Upload failed');
    }
  }

  void _removeUploadedFile(int index) {
    if (index < 0 || index >= _uploadedFilePaths.length) return;
    setState(() => _uploadedFilePaths.removeAt(index));
  }

  void _ensureHiraRow() {
    if (_hiraRows.isNotEmpty) return;
    _hiraRows.add({
      'material': TextEditingController(),
      'size': TextEditingController(),
      'quantity': TextEditingController(),
      'unit': TextEditingController(),
    });
  }

  void _addHiraRow() {
    setState(() {
      _hiraRows.add({
        'material': TextEditingController(),
        'size': TextEditingController(),
        'quantity': TextEditingController(),
        'unit': TextEditingController(),
      });
    });
  }

  void _removeHiraRow(int index) {
    if (index < 0 || index >= _hiraRows.length) return;
    final row = _hiraRows.removeAt(index);
    for (final controller in row.values) {
      controller.dispose();
    }
    setState(() {});
  }

  int get _inspectedCount =>
      _items.where((item) => item['inspected'] == true).length;

  bool get _allItemsInspected =>
      _items.isNotEmpty && _inspectedCount == _items.length;

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
          final inspectedCount = workingItems
              .where((item) => item['inspected'] == true)
              .length;

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
            insetPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 24,
            ),
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
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Review all items and tick each checkbox after inspection.',
                    ),
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
                                      onChanged: (v) =>
                                          toggleItem(index, v ?? false),
                                    ),
                                  ),
                                  DataCell(Text('${item['srno'] ?? '-'}')),
                                  DataCell(
                                    Text(
                                      _toText(item['hsn']).isEmpty
                                          ? '-'
                                          : _toText(item['hsn']),
                                    ),
                                  ),
                                  DataCell(
                                    Text(
                                      _toText(item['description']).isEmpty
                                          ? '-'
                                          : _toText(item['description']),
                                    ),
                                  ),
                                  DataCell(Text('${item['qty'] ?? '-'}')),
                                  DataCell(
                                    Text(
                                      _toText(item['UOM']).isEmpty
                                          ? '-'
                                          : _toText(item['UOM']),
                                    ),
                                  ),
                                  DataCell(Text('${item['Rate'] ?? '-'}')),
                                  DataCell(Text('${item['Amount'] ?? '-'}')),
                                  DataCell(
                                    Text(
                                      _toText(item['remark']).isEmpty
                                          ? '-'
                                          : _toText(item['remark']),
                                    ),
                                  ),
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
                          Text(
                            '$inspectedCount / ${workingItems.length} items inspected',
                          ),
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
                                          .map(
                                            (item) =>
                                                Map<String, dynamic>.from(item),
                                          )
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
                          Text(
                            '$inspectedCount / ${workingItems.length} items inspected',
                          ),
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
                                          .map(
                                            (item) =>
                                                Map<String, dynamic>.from(item),
                                          )
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
    if ((_selectedPoId ?? '').trim().isEmpty) {
      showToast(context, 'PO ID required');
      return;
    }
    if ((_selectedChallanNo ?? '').trim().isEmpty) {
      showToast(context, 'Challan required');
      return;
    }

    final parsedPoId = int.tryParse(_selectedPoId!.trim());
    final projectId =
        int.tryParse(_projectIdController.text.trim()) ??
        int.tryParse(_selectedProjectId());

    if (parsedPoId == null || parsedPoId <= 0) {
      showToast(context, 'Select a valid PO ID');
      return;
    }
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

    final formatData = <String, dynamic>{};
    if (_mirFormat == _lodhaFormat) {
      formatData['lodha'] = {
        'mir_submitted_to': _fieldController(
          'lodha_mir_submitted_to',
        ).text.trim(),
        'discipline': _fieldController('lodha_discipline').text.trim(),
        'material_submittal_approved': _fieldController(
          'lodha_material_submittal_approved',
        ).text.trim(),
        'approval_reference_no': _fieldController(
          'lodha_approval_reference_no',
        ).text.trim(),
        'previous_quantity': _fieldController(
          'lodha_previous_quantity',
        ).text.trim(),
        'current_qty': _fieldController('lodha_current_qty').text.trim(),
        'cumulative_qty': _fieldController('lodha_cumulative_qty').text.trim(),
        'boq_reference': _fieldController('lodha_boq_reference').text.trim(),
        'manufacturer_country': _fieldController(
          'lodha_manufacturer_country',
        ).text.trim(),
        'supplier': _fieldController('lodha_supplier').text.trim(),
        'delivery_note_details': _fieldController(
          'lodha_delivery_note_details',
        ).text.trim(),
        'receipt_date': _fieldController('lodha_receipt_date').text.trim(),
        'storage_location': _fieldController(
          'lodha_storage_location',
        ).text.trim(),
        'mtc_delivered': _fieldController('lodha_mtc_delivered').text.trim(),
        'field_test_compliance': _fieldController(
          'lodha_field_test_compliance',
        ).text.trim(),
        'third_party_test_contractor_scope': _fieldController(
          'lodha_third_party_test_contractor_scope',
        ).text.trim(),
        'third_party_test_lodha_scope': _fieldController(
          'lodha_third_party_test_lodha_scope',
        ).text.trim(),
        'contractor_name': _fieldController(
          'lodha_contractor_name',
        ).text.trim(),
        'contractor_signature': _fieldController(
          'lodha_contractor_signature',
        ).text.trim(),
        'contractor_date': _fieldController(
          'lodha_contractor_date',
        ).text.trim(),
        'physical_damage': _fieldController(
          'lodha_physical_damage',
        ).text.trim(),
        'delivery_note_correct': _fieldController(
          'lodha_delivery_note_correct',
        ).text.trim(),
        'conform_with_approved_material_submittal': _fieldController(
          'lodha_conform_with_approved_material_submittal',
        ).text.trim(),
        'mtc_delivered_with_material': _fieldController(
          'lodha_mtc_delivered_with_material',
        ).text.trim(),
        'field_test_results_comply': _fieldController(
          'lodha_field_test_results_comply',
        ).text.trim(),
        'third_party_test_contractor_scope_part_b': _fieldController(
          'lodha_third_party_test_contractor_scope_part_b',
        ).text.trim(),
        'third_party_test_lodha_scope_part_b': _fieldController(
          'lodha_third_party_test_lodha_scope_part_b',
        ).text.trim(),
        'civil_project_manager_sign': _fieldController(
          'lodha_civil_project_manager_sign',
        ).text.trim(),
        'civil_quality_manager_sign': _fieldController(
          'lodha_civil_quality_manager_sign',
        ).text.trim(),
        'facade_manager_sign': _fieldController(
          'lodha_facade_manager_sign',
        ).text.trim(),
        'landscape_architect_sign': _fieldController(
          'lodha_landscape_architect_sign',
        ).text.trim(),
        'mep_manager_sign': _fieldController(
          'lodha_mep_manager_sign',
        ).text.trim(),
        'comments': _fieldController('lodha_comments').text.trim(),
        'inspection_result': _fieldController(
          'lodha_inspection_result',
        ).text.trim(),
        'result_name': _fieldController('lodha_result_name').text.trim(),
        'result_signature': _fieldController(
          'lodha_result_signature',
        ).text.trim(),
        'result_date': _fieldController('lodha_result_date').text.trim(),
        'distribution': _fieldController('lodha_distribution').text.trim(),
        'template_ref': _fieldController('lodha_template_ref').text.trim(),
        'template_revision': _fieldController(
          'lodha_template_revision',
        ).text.trim(),
        'template_date': _fieldController('lodha_template_date').text.trim(),
      };
    } else {
      formatData['hiranandani'] = {
        'control_form': _fieldController('hira_control_form').text.trim(),
        'revision': _fieldController('hira_revision').text.trim(),
        'location': _fieldController('hira_location').text.trim(),
        'material_to_be_inspected': _fieldController(
          'hira_material_to_be_inspected',
        ).text.trim(),
        'location_of_storage': _fieldController(
          'hira_location_of_storage',
        ).text.trim(),
        'attachments': _fieldController('hira_attachments').text.trim(),
        'notes_details': _fieldController('hira_notes_details').text.trim(),
        'manufacturer': _fieldController('hira_manufacturer').text.trim(),
        'purchase_order_no': _fieldController(
          'hira_purchase_order_no',
        ).text.trim(),
        'manufacturer_date': _fieldController(
          'hira_manufacturer_date',
        ).text.trim(),
        'challan_invoice_no': _fieldController(
          'hira_challan_invoice_no',
        ).text.trim(),
        'expiry_date': _fieldController('hira_expiry_date').text.trim(),
        'delivery_date': _fieldController('hira_delivery_date').text.trim(),
        'batch_no': _fieldController('hira_batch_no').text.trim(),
        'material_submittal_ref': _fieldController(
          'hira_material_submittal_ref',
        ).text.trim(),
        'source_country_of_origin': _fieldController(
          'hira_source_country_of_origin',
        ).text.trim(),
        'specification_ref': _fieldController(
          'hira_specification_ref',
        ).text.trim(),
        'quantity_delivered': _fieldController(
          'hira_quantity_delivered',
        ).text.trim(),
        'drawings_ref': _fieldController('hira_drawings_ref').text.trim(),
        'material_rows': _hiraRows.map((row) {
          return {
            'material': row['material']?.text.trim() ?? '',
            'size': row['size']?.text.trim() ?? '',
            'quantity': row['quantity']?.text.trim() ?? '',
            'unit': row['unit']?.text.trim() ?? '',
          };
        }).toList(),
        'mir_raised_by_name': _fieldController(
          'hira_mir_raised_by_name',
        ).text.trim(),
        'mir_raised_by_date_signature': _fieldController(
          'hira_mir_raised_by_date_signature',
        ).text.trim(),
        'received_by_name': _fieldController(
          'hira_received_by_name',
        ).text.trim(),
        'received_by_date_signature': _fieldController(
          'hira_received_by_date_signature',
        ).text.trim(),
        'inspection_engineer_comments': _fieldController(
          'hira_inspection_engineer_comments',
        ).text.trim(),
        'approval_code': _fieldController('hira_approval_code').text.trim(),
        'checked_by_client_representative': _fieldController(
          'hira_checked_by_client_representative',
        ).text.trim(),
        'checked_by_date_signature': _fieldController(
          'hira_checked_by_date_signature',
        ).text.trim(),
        'issued_by_name': _fieldController('hira_issued_by_name').text.trim(),
        'issued_by_date_signature': _fieldController(
          'hira_issued_by_date_signature',
        ).text.trim(),
        'action_taken': _fieldController('hira_action_taken').text.trim(),
        'close_out_checked_by': _fieldController(
          'hira_close_out_checked_by',
        ).text.trim(),
        'status': _fieldController('hira_status').text.trim(),
        'close_out_date_signature': _fieldController(
          'hira_close_out_date_signature',
        ).text.trim(),
      };
    }

    final payload = {
      'mir_format': _mirFormat,
      'format': _mirFormat,
      'project_name': _projectNameController.text.trim(),
      'project_code': _projectCodeController.text.trim(),
      'client_name': _clientNameController.text.trim(),
      'pmc': _pmcController.text.trim(),
      'contractor': _contractorController.text.trim(),
      'vendor_code': _vendorCodeController.text.trim(),
      'po_id': parsedPoId,
      'challan_no': _selectedChallanNo!.trim(),
      'mir_refrence_no': _mirRefController.text.trim(),
      'material_code': _materialCodeController.text.trim(),
      'inspection_date_time': _inspectionDateController.text.trim().isEmpty
          ? ''
          : '${_inspectionDateController.text.trim()}T00:00:00.000Z',
      'client_submission_date': _clientSubmissionDateController.text.trim(),
      'project_id': projectId,
      'items': itemsPayload,
      'refrence_docs_attached': _uploadedFilePaths,
      'reference_files': _uploadedFilePaths,
      'dynamic_field': {
        'format': _mirFormat,
        'shared': {
          'project_id': projectId,
          'project_name': _projectNameController.text.trim(),
          'project_code': _projectCodeController.text.trim(),
          'client_name': _clientNameController.text.trim(),
          'pmc': _pmcController.text.trim(),
          'contractor': _contractorController.text.trim(),
          'vendor_code': _vendorCodeController.text.trim(),
          'po_id': parsedPoId,
          'challan_no': _selectedChallanNo!.trim(),
          'mir_refrence_no': _mirRefController.text.trim(),
          'material_code': _materialCodeController.text.trim(),
          'inspection_date_time': _inspectionDateController.text.trim(),
          'client_submission_date': _clientSubmissionDateController.text.trim(),
        },
        ...formatData,
        'reference_files': _uploadedFilePaths,
      },
      'mir_submited': true,
    };

    setState(() => _submitting = true);
    final result = await ApiClient.createMir(payload);
    if (!mounted) return;
    setState(() => _submitting = false);

    if (result['success'] == true) {
      showToast(context, 'MIR created successfully');
      Navigator.pop(context, true);
      return;
    }

    showToast(context, result['error']?.toString() ?? 'Failed to create MIR');
  }

  Widget _buildSectionCard(
    bool isDark,
    String title,
    List<Widget> children, {
    String? subtitle,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkCard : AppTheme.lightCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: isDark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < children.length; i++) ...[
                children[i],
                if (i < children.length - 1) const SizedBox(height: 12),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _fieldBox(Widget child, {required bool isMobile, double width = 320}) {
    return SizedBox(width: isMobile ? double.infinity : width, child: child);
  }

  Widget _textField(
    String label,
    String key,
    bool isMobile, {
    String? hintText,
    TextInputType? keyboardType,
    int maxLines = 1,
    Widget? suffix,
    double width = 320,
  }) {
    return _fieldBox(
      MadInput(
        controller: _fieldController(key),
        labelText: label,
        hintText: hintText,
        keyboardType: keyboardType,
        maxLines: maxLines,
        suffix: suffix,
      ),
      isMobile: isMobile,
      width: width,
    );
  }

  Widget _textareaField(
    String label,
    String key,
    bool isMobile, {
    String? hintText,
    double width = 320,
  }) {
    return _fieldBox(
      MadTextarea(
        controller: _fieldController(key),
        labelText: label,
        hintText: hintText,
        minLines: 3,
      ),
      isMobile: isMobile,
      width: width,
    );
  }

  Widget _selectField(
    String label,
    String key,
    List<MadSelectOption<String>> options,
    bool isMobile, {
    String placeholder = 'Select',
    double width = 320,
    ValueChanged<String?>? onChanged,
  }) {
    return _fieldBox(
      MadSelect<String>(
        labelText: label,
        value: _fieldController(key).text.isEmpty
            ? null
            : _fieldController(key).text,
        placeholder: placeholder,
        options: options,
        onChanged: (value) {
          setState(() => _fieldController(key).text = value ?? '');
          onChanged?.call(value);
        },
      ),
      isMobile: isMobile,
      width: width,
    );
  }

  Widget _yesNoField(
    String label,
    String key,
    bool isMobile, {
    double width = 320,
  }) {
    return _selectField(
      label,
      key,
      const [
        MadSelectOption(value: 'Yes', label: 'Yes'),
        MadSelectOption(value: 'No', label: 'No'),
      ],
      isMobile,
      width: width,
    );
  }

  Widget _dateField(
    String label,
    TextEditingController controller,
    bool isMobile, {
    double width = 320,
  }) {
    return _fieldBox(
      MadInput(
        controller: controller,
        labelText: label,
        hintText: 'dd/mm/yyyy',
        suffix: IconButton(
          icon: const Icon(LucideIcons.calendar, size: 18),
          onPressed: () => _pickDate(controller),
        ),
      ),
      isMobile: isMobile,
      width: width,
    );
  }

  Widget _buildCommonFields(
    bool isDark,
    bool isMobile,
    List<MadSelectOption<String>> poOptions,
    List<MadSelectOption<String>> challanOptions,
  ) {
    return _buildSectionCard(
      isDark,
      'MIR Details',
      [
        _fieldBox(
          MadInput(
            controller: _projectNameController,
            labelText: 'Project Name',
          ),
          isMobile: isMobile,
        ),
        _fieldBox(
          MadInput(
            controller: _projectCodeController,
            labelText: 'Project Code',
          ),
          isMobile: isMobile,
        ),
        _fieldBox(
          MadInput(controller: _clientNameController, labelText: 'Client Name'),
          isMobile: isMobile,
        ),
        _fieldBox(
          MadInput(controller: _pmcController, labelText: 'PMC'),
          isMobile: isMobile,
        ),
        _fieldBox(
          MadInput(controller: _contractorController, labelText: 'Contractor'),
          isMobile: isMobile,
        ),
        _fieldBox(
          MadInput(controller: _vendorCodeController, labelText: 'Vendor Code'),
          isMobile: isMobile,
        ),
        _selectField(
          'PO ID',
          'po_id',
          poOptions,
          isMobile,
          placeholder: poOptions.isEmpty ? 'No POs found' : 'Select PO ID',
          onChanged: (value) => _selectedPoId = value,
        ),
        _selectField(
          'Challan No',
          'challan_no',
          challanOptions,
          isMobile,
          placeholder: challanOptions.isEmpty
              ? 'No challans found'
              : 'Select challan no',
          onChanged: _handleChallanChange,
        ),
        _fieldBox(
          MadInput(
            controller: _mirRefController,
            labelText: 'MIR Reference No *',
          ),
          isMobile: isMobile,
        ),
        _fieldBox(
          MadInput(
            controller: _materialCodeController,
            labelText: 'Material Code',
          ),
          isMobile: isMobile,
        ),
        _dateField('Inspection Date', _inspectionDateController, isMobile),
        _dateField(
          'Client Submission Date',
          _clientSubmissionDateController,
          isMobile,
        ),
        _fieldBox(
          MadInput(
            controller: _projectIdController,
            labelText: 'Project ID',
            keyboardType: TextInputType.number,
          ),
          isMobile: isMobile,
        ),
      ],
      subtitle:
          'Select the client format first. Only that format\'s fields will be shown.',
    );
  }

  Widget _buildFormatHeader(bool isDark, bool isMobile) {
    final formatOptions = const [
      MadSelectOption<String>(value: _lodhaFormat, label: 'Lodha'),
      MadSelectOption<String>(value: _hiranandaniFormat, label: 'Hiranandani'),
    ];

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: isMobile ? 8 : 4,
        vertical: isMobile ? 6 : 8,
      ),
      child: isMobile
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Create MIR',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: isDark
                              ? AppTheme.darkForeground
                              : AppTheme.lightForeground,
                        ),
                      ),
                    ),
                    MadSelect<String>(
                      value: _mirFormat,
                      options: formatOptions,
                      onChanged: (value) {
                        if (value == null || value == _mirFormat) return;
                        setState(() => _mirFormat = value);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Add a new material inspection request.',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              ],
            )
          : Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Create MIR',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          color: isDark
                              ? AppTheme.darkForeground
                              : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Add a new material inspection request.',
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
                SizedBox(
                  width: 220,
                  child: MadSelect<String>(
                    value: _mirFormat,
                    options: formatOptions,
                    onChanged: (value) {
                      if (value == null || value == _mirFormat) return;
                      setState(() => _mirFormat = value);
                    },
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildLodhaFields(bool isDark, bool isMobile) {
    final disciplineOptions = const [
      MadSelectOption(value: 'Structural / Civil', label: 'Structural / Civil'),
      MadSelectOption(value: 'Arch / Finishing', label: 'Arch / Finishing'),
      MadSelectOption(value: 'Landscape', label: 'Landscape'),
      MadSelectOption(value: 'Mechanical', label: 'Mechanical'),
      MadSelectOption(value: 'Electrical', label: 'Electrical'),
      MadSelectOption(value: 'Plumbing', label: 'Plumbing'),
      MadSelectOption(value: 'Facade', label: 'Facade'),
      MadSelectOption(value: 'Others', label: 'Others'),
    ];

    final resultOptions = const [
      MadSelectOption(
        value: 'Code 1 - Approved - Material can be used',
        label: 'Code 1 - Approved - Material can be used',
      ),
      MadSelectOption(
        value:
            'Code 2 - Conditionally approved. Material can be used, Resubmit incorporating comments indicated',
        label:
            'Code 2 - Conditionally approved. Material can be used, Resubmit incorporating comments indicated',
      ),
      MadSelectOption(
        value: 'Code 3 - Revise & Resubmit. Material may not be used',
        label: 'Code 3 - Revise & Resubmit. Material may not be used',
      ),
      MadSelectOption(
        value: 'Code 4 - For information and records only.',
        label: 'Code 4 - For information and records only.',
      ),
    ];

    final distributionOptions = const [
      MadSelectOption(value: 'Lodha', label: 'Lodha'),
      MadSelectOption(value: 'Contractor', label: 'Contractor'),
      MadSelectOption(value: 'Others', label: 'Others'),
    ];

    return _buildSectionCard(
      isDark,
      'Lodha Request Submission',
      [
        _selectField('MIR Submitted To', 'lodha_mir_submitted_to', const [
          MadSelectOption(value: 'Lodha', label: 'Lodha'),
          MadSelectOption(value: 'PMC', label: 'PMC'),
          MadSelectOption(value: 'Lodha / PMC', label: 'Lodha / PMC'),
        ], isMobile),
        _selectField(
          'Discipline',
          'lodha_discipline',
          disciplineOptions,
          isMobile,
          placeholder: 'Select discipline',
        ),
        _yesNoField(
          'Material Submittal Approved',
          'lodha_material_submittal_approved',
          isMobile,
        ),
        _textField(
          'Approval Reference No',
          'lodha_approval_reference_no',
          isMobile,
        ),
        _textField(
          'Previous Quantity',
          'lodha_previous_quantity',
          isMobile,
          keyboardType: TextInputType.number,
        ),
        _textField(
          'Current Qty',
          'lodha_current_qty',
          isMobile,
          keyboardType: TextInputType.number,
        ),
        _textField(
          'Cumulative Qty',
          'lodha_cumulative_qty',
          isMobile,
          keyboardType: TextInputType.number,
        ),
        _textField('BOQ Reference', 'lodha_boq_reference', isMobile),
        _textField(
          'Manufacturer - Country of Origin',
          'lodha_manufacturer_country',
          isMobile,
        ),
        _textField('Supplier', 'lodha_supplier', isMobile),
        _textField(
          'Supplied Quantity and Delivery Note Number',
          'lodha_delivery_note_details',
          isMobile,
        ),
        _dateField(
          'Date of Receipt of Material On Site',
          _fieldController('lodha_receipt_date'),
          isMobile,
        ),
        _textField('Storage Location', 'lodha_storage_location', isMobile),
        _yesNoField('MTC Delivered', 'lodha_mtc_delivered', isMobile),
        _textField(
          'Field Test Compliance',
          'lodha_field_test_compliance',
          isMobile,
        ),
        _textField(
          'Third Party Test Under Contractor Scope',
          'lodha_third_party_test_contractor_scope',
          isMobile,
        ),
        _textField(
          'Third Party Test Under Lodha Scope',
          'lodha_third_party_test_lodha_scope',
          isMobile,
        ),
        _textField('Contractor Name', 'lodha_contractor_name', isMobile),
        _textField(
          'Contractor Signature',
          'lodha_contractor_signature',
          isMobile,
        ),
        _dateField(
          'Contractor Date',
          _fieldController('lodha_contractor_date'),
          isMobile,
        ),
        _yesNoField('Physical Damage', 'lodha_physical_damage', isMobile),
        _yesNoField(
          'Delivery Note Details Correct',
          'lodha_delivery_note_correct',
          isMobile,
        ),
        _yesNoField(
          'Conform with Approved Material Submittal',
          'lodha_conform_with_approved_material_submittal',
          isMobile,
        ),
        _yesNoField(
          'MTC Delivered with Material',
          'lodha_mtc_delivered_with_material',
          isMobile,
        ),
        _yesNoField(
          'Field Test Results Comply',
          'lodha_field_test_results_comply',
          isMobile,
        ),
        _textField(
          'Third Party Test Contractor Scope',
          'lodha_third_party_test_contractor_scope_part_b',
          isMobile,
        ),
        _textField(
          'Third Party Test Lodha Scope',
          'lodha_third_party_test_lodha_scope_part_b',
          isMobile,
        ),
        _textField(
          'Civil Project Manager Sign',
          'lodha_civil_project_manager_sign',
          isMobile,
        ),
        _textField(
          'Civil Quality Manager Sign',
          'lodha_civil_quality_manager_sign',
          isMobile,
        ),
        _textField(
          'Facade Manager Sign',
          'lodha_facade_manager_sign',
          isMobile,
        ),
        _textField(
          'Landscape Architect Sign',
          'lodha_landscape_architect_sign',
          isMobile,
        ),
        _textField('MEP Manager Sign', 'lodha_mep_manager_sign', isMobile),
        _textareaField(
          'Comments',
          'lodha_comments',
          isMobile,
          width: double.infinity,
        ),
        _selectField(
          'Inspection Result',
          'lodha_inspection_result',
          resultOptions,
          isMobile,
          placeholder: 'Select inspection result',
        ),
        _textField('Result Name', 'lodha_result_name', isMobile),
        _textField('Result Signature', 'lodha_result_signature', isMobile),
        _dateField(
          'Result Date',
          _fieldController('lodha_result_date'),
          isMobile,
        ),
        _selectField(
          'Distribution',
          'lodha_distribution',
          distributionOptions,
          isMobile,
          placeholder: 'Select distribution',
        ),
        _textField('Template Ref', 'lodha_template_ref', isMobile),
        _textField('Template Revision', 'lodha_template_revision', isMobile),
        _dateField(
          'Template Date',
          _fieldController('lodha_template_date'),
          isMobile,
        ),
      ],
      subtitle: 'Part A and Part B fields appear only for Lodha format.',
    );
  }

  Widget _buildHiranandaniFields(bool isDark, bool isMobile) {
    final approvalOptions = const [
      MadSelectOption(value: 'Code A - Approved', label: 'Code A - Approved'),
      MadSelectOption(
        value: 'Code B - Approved as noted',
        label: 'Code B - Approved as noted',
      ),
      MadSelectOption(
        value: 'Code C - Not approved',
        label: 'Code C - Not approved',
      ),
      MadSelectOption(
        value: 'Code D - For info & Records only',
        label: 'Code D - For info & Records only',
      ),
    ];
    final statusOptions = const [
      MadSelectOption(value: 'Completed', label: 'Completed'),
      MadSelectOption(value: 'Ongoing', label: 'Ongoing'),
    ];

    return _buildSectionCard(
      isDark,
      'Hiranandani Header',
      [
        _textField('Control Form', 'hira_control_form', isMobile),
        _textField('Revision', 'hira_revision', isMobile),
        _textField(
          'Location',
          'hira_location',
          isMobile,
          width: double.infinity,
        ),
        _textField(
          'Material to be Inspected',
          'hira_material_to_be_inspected',
          isMobile,
          width: double.infinity,
        ),
        _textField(
          'Location of Storage',
          'hira_location_of_storage',
          isMobile,
          width: double.infinity,
        ),
        _textField(
          'Attachments',
          'hira_attachments',
          isMobile,
          width: double.infinity,
        ),
        _textareaField(
          'Notes / Details',
          'hira_notes_details',
          isMobile,
          width: double.infinity,
        ),
        _textField('Manufacturer', 'hira_manufacturer', isMobile),
        _textField('Purchase Order No', 'hira_purchase_order_no', isMobile),
        _dateField(
          'Manufacturer Date',
          _fieldController('hira_manufacturer_date'),
          isMobile,
        ),
        _textField(
          'Challan / Invoice Note No',
          'hira_challan_invoice_no',
          isMobile,
        ),
        _dateField(
          'Expiry Date',
          _fieldController('hira_expiry_date'),
          isMobile,
        ),
        _dateField(
          'Delivery Date',
          _fieldController('hira_delivery_date'),
          isMobile,
        ),
        _textField('Batch No', 'hira_batch_no', isMobile),
        _textField(
          'Material Submittal Ref',
          'hira_material_submittal_ref',
          isMobile,
        ),
        _textField(
          'Source / Country of Origin',
          'hira_source_country_of_origin',
          isMobile,
        ),
        _textField('Specification Ref', 'hira_specification_ref', isMobile),
        _textField('Quantity Delivered', 'hira_quantity_delivered', isMobile),
        _textField('Drawings Ref', 'hira_drawings_ref', isMobile),
        _buildHiraRowsSection(isDark, isMobile),
        _textField('MIR Raised By Name', 'hira_mir_raised_by_name', isMobile),
        _textField(
          'MIR Raised By Date & Signature',
          'hira_mir_raised_by_date_signature',
          isMobile,
        ),
        _textField('Received By Name', 'hira_received_by_name', isMobile),
        _textField(
          'Received By Date & Signature',
          'hira_received_by_date_signature',
          isMobile,
        ),
        _textareaField(
          'Inspection Engineer Comments',
          'hira_inspection_engineer_comments',
          isMobile,
          width: double.infinity,
        ),
        _selectField(
          'Approval Code',
          'hira_approval_code',
          approvalOptions,
          isMobile,
          placeholder: 'Select approval code',
        ),
        _textField(
          'Checked By Client Representative',
          'hira_checked_by_client_representative',
          isMobile,
        ),
        _textField(
          'Checked By Date & Signature',
          'hira_checked_by_date_signature',
          isMobile,
        ),
        _textField('Issued By Name', 'hira_issued_by_name', isMobile),
        _textField(
          'Issued By Date & Signature',
          'hira_issued_by_date_signature',
          isMobile,
        ),
        _textareaField(
          'Action Taken',
          'hira_action_taken',
          isMobile,
          width: double.infinity,
        ),
        _textField(
          'Close-Out Checked By',
          'hira_close_out_checked_by',
          isMobile,
        ),
        _selectField(
          'Status',
          'hira_status',
          statusOptions,
          isMobile,
          placeholder: 'Select status',
        ),
        _textField(
          'Close-Out Date & Signature',
          'hira_close_out_date_signature',
          isMobile,
        ),
      ],
      subtitle:
          'Hiranandani-specific sections are shown here, including material rows.',
    );
  }

  Widget _buildHiraRowsSection(bool isDark, bool isMobile) {
    _ensureHiraRow();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Material Rows',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTheme.darkForeground
                      : AppTheme.lightForeground,
                ),
              ),
              MadButton(
                text: 'Add Material Row',
                icon: LucideIcons.plus,
                variant: ButtonVariant.outline,
                size: ButtonSize.sm,
                onPressed: _addHiraRow,
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < _hiraRows.length; i++) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                    .withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: MadInput(
                          controller: _hiraRows[i]['material'],
                          labelText: 'Material',
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: MadInput(
                          controller: _hiraRows[i]['size'],
                          labelText: 'Size',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: MadInput(
                          controller: _hiraRows[i]['quantity'],
                          labelText: 'Quantity',
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: MadInput(
                          controller: _hiraRows[i]['unit'],
                          labelText: 'Unit',
                        ),
                      ),
                    ],
                  ),
                  if (_hiraRows.length > 1) ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: MadButton(
                        text: 'Remove Row',
                        icon: LucideIcons.trash2,
                        variant: ButtonVariant.destructive,
                        size: ButtonSize.sm,
                        onPressed: () => _removeHiraRow(i),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildUploadedFilesSection(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Uploaded Files',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: isDark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Upload one or more reference files for this MIR.',
            style: TextStyle(
              fontSize: 12,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              MadButton(
                text: _uploadingFiles ? 'Uploading...' : 'Choose Files',
                icon: LucideIcons.upload,
                variant: ButtonVariant.outline,
                loading: _uploadingFiles,
                disabled: _uploadingFiles,
                onPressed: _uploadReferenceFiles,
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_uploadedFilePaths.isEmpty)
            Text(
              'No uploaded files yet.',
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _uploadedFilePaths.asMap().entries.map((entry) {
                final index = entry.key;
                final path = entry.value;
                final parts = path.split(RegExp(r'[/\\]'));
                final fileName = parts.isEmpty ? path : parts.last;
                return InputChip(
                  label: Text(fileName),
                  onDeleted: () => _removeUploadedFile(index),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildChallanItemsSection(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Item Preview',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: isDark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Review the challan items here, edit the fields if needed, and tick the items you want to print in the MIR.',
            style: TextStyle(
              fontSize: 12,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 12),
          if ((_selectedChallanNo ?? '').isEmpty)
            Text(
              'Select a delivery challan to see the items.',
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            )
          else if (_items.isEmpty)
            Text(
              'No items found for the selected delivery challan.',
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: const [
                  DataColumn(label: Text('Print')),
                  DataColumn(label: Text('Sr No')),
                  DataColumn(label: Text('Item Code')),
                  DataColumn(label: Text('Product')),
                  DataColumn(label: Text('Name')),
                  DataColumn(label: Text('UOM')),
                  DataColumn(label: Text('Qty')),
                ],
                rows: _items.map((item) {
                  return DataRow(
                    cells: [
                      DataCell(
                        Checkbox(
                          value:
                              _allItemsInspected || item['inspected'] == true,
                          onChanged: (_) => _showInspectionDialog(),
                        ),
                      ),
                      DataCell(Text('${item['srno'] ?? '-'}')),
                      DataCell(
                        Text(
                          _toText(item['hsn']).isEmpty
                              ? '-'
                              : _toText(item['hsn']),
                        ),
                      ),
                      DataCell(
                        Text(
                          _toText(item['description']).isEmpty
                              ? '-'
                              : _toText(item['description']),
                        ),
                      ),
                      DataCell(
                        Text(
                          _toText(item['description']).isEmpty
                              ? '-'
                              : _toText(item['description']),
                        ),
                      ),
                      DataCell(
                        Text(
                          _toText(item['UOM']).isEmpty
                              ? '-'
                              : _toText(item['UOM']),
                        ),
                      ),
                      DataCell(Text('${item['qty'] ?? '-'}')),
                    ],
                  );
                }).toList(),
              ),
            ),
          if ((_selectedChallanNo ?? '').isNotEmpty && _items.isNotEmpty) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: MadButton(
                text: 'Inspection',
                variant: ButtonVariant.outline,
                onPressed: _showInspectionDialog,
              ),
            ),
          ],
        ],
      ),
    );
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
          _buildFormatHeader(isDark, isMobile),
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
                          _buildCommonFields(
                            isDark,
                            isMobile,
                            poOptions,
                            challanOptions,
                          ),
                          if (_mirFormat == _lodhaFormat)
                            _buildLodhaFields(isDark, isMobile),
                          if (_mirFormat == _hiranandaniFormat)
                            _buildHiranandaniFields(isDark, isMobile),
                          _buildChallanItemsSection(isDark),
                          const SizedBox(height: 16),
                          _buildUploadedFilesSection(isDark),
                          const SizedBox(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              MadButton(
                                text: 'Cancel',
                                variant: ButtonVariant.outline,
                                onPressed: _submitting
                                    ? null
                                    : () => Navigator.pop(context),
                              ),
                              const SizedBox(width: 12),
                              MadButton(
                                text: _submitting
                                    ? 'Creating...'
                                    : 'Create MIR',
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
