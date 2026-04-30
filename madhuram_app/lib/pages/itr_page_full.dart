import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../models/itr.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';
import '../utils/error_handler.dart';

const String _itrDraftKey = 'itr_manual_entry_draft';

const List<String> _apiStatusOptions = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_INSPECTION',
  'APPROVED',
  'REJECTED',
  'RESUBMITTED',
  'CLOSED',
];

const List<Map<String, String>> _apiInspectionCodeOptions = [
  {'value': 'CODE_1', 'label': 'Work may proceed'},
  {
    'value': 'CODE_2',
    'label':
        'Conditionally approved. Work may proceed and resubmit incorporating comments',
  },
  {
    'value': 'CODE_3',
    'label': 'Revise and Resubmit. Work may NOT proceed',
  },
  {
    'value': 'CODE_4',
    'label': 'For information and records only. Work may proceed',
  },
];

const Map<String, String> _disciplineLabelToApi = {
  'Structural / Civil': 'STRUCTURAL_CIVIL',
  'Arch / Finishing': 'ARCH_FINISHING',
  'Mechanical': 'MECHANICAL',
  'Electrical': 'ELECTRICAL',
  'Landscape': 'LANDSCAPE',
  'Plumbing': 'PLUMBING',
  'Facade': 'FACADE',
  'Others': 'OTHERS',
  'ID': 'ID',
  'Surveying': 'SURVEYING',
};

Map<String, dynamic> _buildItrPayload(
  Map<String, dynamic> formData,
  String projectId,
  Map<String, dynamic>? user,
) {
  final disciplineListRaw = formData['discipline_list'];
  final disciplineLabel = (disciplineListRaw is List && disciplineListRaw.isNotEmpty)
      ? disciplineListRaw.first.toString()
      : (formData['discipline'] ?? '').toString();
  final selectedDisciplineApi =
      _disciplineLabelToApi[disciplineLabel] ??
      (disciplineLabel.isEmpty ? 'OTHERS' : disciplineLabel);

  return {
    'project_id': int.tryParse(projectId) ?? projectId,
    'project_info': {
      'project_name': formData['project_name'] ?? '',
      'project_code': formData['project_code'] ?? '',
      'client_employer': formData['client_employer'] ?? '',
      'pmc_engineer': formData['pmc_engineer'] ?? '',
      'contractor': formData['contractor'] ?? '',
      'vendor_code': formData['vendor_code'] ?? '',
      'material_code': formData['material_code'] ?? '',
      'work_order_no': formData['work_order_no'] ?? '',
    },
    'itr_header': {
      'itr_ref_no': formData['itr_ref_no'] ?? '',
      'rev_no': formData['rev_no'] ?? '',
      'submission_datetime': formData['wir_itr_submission_date_time'] ?? '',
      'inspection_datetime': formData['inspection_date_time'] ?? '',
      'submitted_to': formData['submitted_to'] ?? '',
      'submitted_by': formData['submitted_by'] ?? '',
    },
    'location': {
      'tower_block_ref': formData['tower_block'] ?? '',
      'floor_level': formData['floor'] ?? '',
      'room_area_ref': formData['room_area'] ?? '',
      'grid_reference': formData['grid'] ?? '',
    },
    'discipline': selectedDisciplineApi,
    'quantity': {
      'previous_qty':
          num.tryParse((formData['previous_quantity'] ?? '0').toString()) ?? 0,
      'current_qty':
          num.tryParse((formData['current_quantity'] ?? '0').toString()) ?? 0,
      'unit': formData['quantity_unit'] ?? '',
    },
    'description_of_work': formData['description_of_works'] ?? '',
    'work_items': (formData['work_items'] is List)
        ? formData['work_items']
        : <Map<String, dynamic>>[],
    'shaft_details': (formData['shaft_details'] is List)
        ? formData['shaft_details']
        : <Map<String, dynamic>>[],
    'attachments': {
      'drawing_attached': _yesNoNaToApi(formData['drawing_attachment']),
      'drawing_ref_no': formData['specific_drawing_ref_no'] ?? '',
      'method_statement_attached': _yesNoNaToApi(
        formData['method_statement_attachment'],
      ),
      'test_certificates_attached': _yesNoNaToApi(
        formData['test_certificates_attachment'],
      ),
      'checklist_attached': _yesNoNaToApi(formData['checklist_attachment']),
      'joint_measurement_attached': _yesNoNaToApi(
        formData['joint_measurement_attachment'],
      ),
    },
    'part_a_contractor': {
      'comments': formData['contractor_manager_comments'] ?? '',
      'ready_for_inspection_date': formData['ready_for_inspection_date'] ?? '',
      'ready_for_inspection_time': formData['ready_for_inspection_time'] ?? '',
      'signed_by': formData['ready_signed_by'] ?? '',
      'other_section_signoffs': [
        {
          'section': 'MEP Clearance',
          'name': formData['mep_clearance_name'] ?? '',
          'signed_date': formData['mep_clearance_date'] ?? '',
          'designation': formData['mep_clearance_designation'] ?? '',
          'signature_url': formData['mep_clearance_signature'] ?? '',
          'comments': formData['mep_clearance_comments'] ?? '',
        },
        {
          'section': 'Surveyor Clearance',
          'name': formData['surveyor_clearance_name'] ?? '',
          'signed_date': formData['surveyor_clearance_date'] ?? '',
          'designation': formData['surveyor_clearance_designation'] ?? '',
          'signature_url': formData['surveyor_clearance_signature'] ?? '',
          'comments': formData['surveyor_clearance_comments'] ?? '',
        },
        {
          'section': 'Interface Clearance',
          'name': formData['interface_clearance_name'] ?? '',
          'signed_date': formData['interface_clearance_date'] ?? '',
          'designation': formData['interface_clearance_designation'] ?? '',
          'signature_url': formData['interface_clearance_signature'] ?? '',
          'comments': formData['interface_clearance_comments'] ?? '',
        },
      ],
    },
    'part_b_lodha_pmc': {
      'comments': formData['comments'] ?? '',
      'inspection_code': formData['result_code'] ?? '',
      'signoffs': [
        {
          'role': 'Engineer/Manager-CIVIL',
          'name': formData['engineer_name'] ?? '',
          'signature_url': formData['engineer_signature'] ?? '',
          'signed_date': formData['engineer_date'] ?? '',
        },
        {
          'role': 'Engineer/Manager-MEP',
          'name': formData['engineer_mep_name'] ?? '',
          'signature_url': formData['engineer_mep_signature'] ?? '',
          'signed_date': formData['engineer_mep_date'] ?? '',
        },
        {
          'role': 'Tower Incharge',
          'name': formData['tower_incharge_name'] ?? '',
          'signature_url': formData['tower_incharge_signature'] ?? '',
          'signed_date': formData['tower_incharge_date'] ?? '',
        },
        {
          'role': 'QAA Department',
          'name': formData['qaa_department_name'] ?? '',
          'signature_url': formData['qaa_department_signature'] ?? '',
          'signed_date': formData['qaa_department_date'] ?? '',
        },
      ],
    },
    'status': formData['status'] ?? 'DRAFT',
    'allowed_values': {
      'discipline': _disciplineLabelToApi.values.toList(),
      'status': _apiStatusOptions,
      'attachments': ['YES', 'NO', 'NA'],
      'inspection_code': const {
        'CODE_1': 'Work may proceed',
        'CODE_2':
            'Conditionally approved. Work may proceed and resubmit incorporating comments',
        'CODE_3': 'Revise and Resubmit. Work may NOT proceed',
        'CODE_4': 'For information and records only. Work may proceed',
      },
    },
    'dynamic_field': [
      {'key': 'Source', 'value': formData['source'] ?? 'Manual'},
      {'key': 'Source File', 'value': formData['source_file_name'] ?? ''},
    ],
    'user_id':
        user?['id']?.toString() ??
        user?['user_id']?.toString() ??
        user?['userId']?.toString(),
    'user_name':
        user?['name']?.toString() ??
        user?['full_name']?.toString() ??
        user?['username']?.toString() ??
        user?['email']?.toString() ??
        '',
  };
}

String _yesNoNaToApi(dynamic value) {
  final v = (value ?? '').toString().trim().toUpperCase();
  if (v == 'YES') return 'YES';
  if (v == 'NO') return 'NO';
  if (v == 'N/A' || v == 'NA') return 'NA';
  return 'NO';
}

/// Installation Test Report page with PO-like shell and dedicated manual entry route.
class ITRPageFull extends StatefulWidget {
  const ITRPageFull({super.key});
  @override
  State<ITRPageFull> createState() => _ITRPageFullState();
}

class _ITRPageFullState extends State<ITRPageFull> {
  bool _isLoading = true;
  String? _error;
  List<ITR> _itrs = [];
  String _searchQuery = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;
  final _searchController = TextEditingController();
  String? _statusFilter;
  final Map<String, Map<String, String>> _statusDrafts = {};
  final Map<String, bool> _updatingStatusIds = {};

  // Create card
  File? _selectedFile;
  bool _isUploading = false;
  bool _prefillApplied = false;
  String _prefillItrRef = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadITRs();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadITRs() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    final store = StoreProvider.of<AppState>(context);
    final projectId = store.state.project.selectedProject?['project_id']?.toString() ??
        store.state.project.selectedProjectId ?? '';

    try {
      final result = projectId.isNotEmpty
          ? await ApiClient.getITRsByProject(projectId)
          : await ApiClient.getAllITRs();
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'] as List;
        final loaded = data.map((e) => ITR.fromJson(e)).toList();
        final nextDrafts = <String, Map<String, String>>{};
        for (final itr in loaded) {
          if (itr.id.isEmpty) continue;
          final existing = _statusDrafts[itr.id] ?? const {};
          final inspectionCode =
              (itr.lodhaPmcData?['result_code'] ??
                      itr.lodhaPmcData?['inspection_code'] ??
                      '')
                  .toString();
          nextDrafts[itr.id] = {
            'status': existing['status'] ?? (itr.status ?? 'DRAFT'),
            'inspectionCode': existing['inspectionCode'] ?? inspectionCode,
            'lodhaPmcComments': existing['lodhaPmcComments'] ?? '',
          };
        }
        setState(() {
          _itrs = loaded;
          _statusDrafts
            ..clear()
            ..addAll(nextDrafts);
          _isLoading = false;
        });
      } else {
        setState(() {
          _itrs = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load ITRs';
        });
      }
    } catch (e) {
      debugPrint('[ITR] API error: $e');
      if (!mounted) return;
      setState(() {
        _itrs = [];
        _isLoading = false;
        _error = 'Failed to load ITRs';
      });
    }
  }

  List<ITR> get _filteredITRs {
    List<ITR> result = _itrs;
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result
          .where((i) =>
              i.itrRefNo.toLowerCase().contains(query) ||
              (i.projectName?.toLowerCase().contains(query) ?? false) ||
              (i.discipline?.toLowerCase().contains(query) ?? false))
          .toList();
    }
    if (_statusFilter != null) result = result.where((i) => i.status == _statusFilter).toList();
    return result;
  }

  List<ITR> get _paginatedITRs {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final filtered = _filteredITRs;
    if (start >= filtered.length) return [];
    return filtered.sublist(start, end > filtered.length ? filtered.length : end);
  }

  int get _totalPages => (_filteredITRs.length / _itemsPerPage).ceil();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;
    final args = ModalRoute.of(context)?.settings.arguments;
    final argsMap = args is Map ? Map<String, dynamic>.from(args) : const <String, dynamic>{};
    final manualOnlyMode = argsMap['manualOnly'] == true;

    if (!_prefillApplied && args is Map && args['challan_number'] != null) {
      final challanNo = args['challan_number'].toString();
      _prefillItrRef = challanNo;
      _prefillApplied = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        showToast(context, 'Prefilled ITR ref from challan $challanNo');
        Navigator.pushNamed(
          context,
          '/itr/preview',
          arguments: {'manualOnly': true, 'prefill_itr_ref': challanNo},
        );
      });
    }

    return StoreConnector<AppState, String?>(
      distinct: true,
      converter: (store) =>
          store.state.project.selectedProject?['project_id']?.toString() ??
          store.state.project.selectedProjectId,
      builder: (context, projectId) {
        return ProtectedRoute(
          title: manualOnlyMode
              ? 'Installation Test Report - Manual Entry'
              : 'Installation Test Report',
          route: '/itr',
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
                      manualOnlyMode
                          ? 'ITR Manual Entry'
                          : 'Installation Test Report',
                          style: TextStyle(
                            fontSize: responsive.value(mobile: 24, tablet: 30, desktop: 32),
                            fontWeight: FontWeight.w800,
                            color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                      manualOnlyMode
                          ? 'Fill the ITR form manually.'
                          : 'Upload and manage installation test reports.',
                          style: TextStyle(
                            fontSize: responsive.value(mobile: 13, tablet: 15, desktop: 16),
                            color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Expanded(
                child: manualOnlyMode
                    ? _buildManualEntryTab(
                        isDark,
                        projectId,
                        prefillFromArgs:
                            argsMap['prefill_itr_ref']?.toString() ??
                                _prefillItrRef,
                      )
                    : SingleChildScrollView(
                  child: Column(
                    children: [
                      _buildCreateExtractCard(isDark),
                      const SizedBox(height: 16),
                      _buildRecentITRsTab(isDark, isMobile),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCreateExtractCard(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Create / Extract ITR',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Upload an ITR file directly from camera, gallery, or files.',
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                MadButton(
                  text: _isUploading ? 'Uploading...' : 'Upload',
                  icon: LucideIcons.upload,
                  loading: _isUploading,
                  onPressed: _isUploading
                      ? null
                      : () async {
                          await _pickFile();
                          if (_selectedFile != null) {
                            await _runUpload();
                          }
                        },
                ),
                MadButton(
                  text: 'Manual Entry',
                  icon: LucideIcons.filePenLine,
                  variant: ButtonVariant.outline,
                  onPressed: () => Navigator.pushNamed(
                    context,
                    '/itr/preview',
                    arguments: {
                      'manualOnly': true,
                      'prefill_itr_ref': _prefillItrRef,
                    },
                  ),
                ),
              ],
            ),
            if (_selectedFile != null) ...[
              const SizedBox(height: 10),
              Text(
                'Selected file: ${_selectedFile!.path.split(RegExp(r'[/\\]')).last}',
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _pickFile() async {
    final file = await FileService.pickFileWithSource(
      context: context,
      allowedExtensions: ['pdf', 'xlsx', 'xls', 'csv'],
    );
    if (!mounted || file == null) return;
    setState(() => _selectedFile = file);
  }

  Future<void> _runUpload() async {
    if (_selectedFile == null) return;
    setState(() => _isUploading = true);
    try {
      final user = StoreProvider.of<AppState>(context).state.auth.user;
      final result = await ApiClient.uploadITRReference(
        _selectedFile!,
        userId:
            user?['id']?.toString() ??
            user?['user_id']?.toString() ??
            user?['userId']?.toString(),
        userName:
            user?['name']?.toString() ??
            user?['full_name']?.toString() ??
            user?['username']?.toString() ??
            user?['email']?.toString(),
      );
      if (!mounted) return;
      if (result['success'] == true) {
        final fileName = _selectedFile!.path.split(RegExp(r'[/\\]')).last;
        final path =
            (result['data']?['filePath'] ?? result['data']?['path'] ?? '')
                .toString();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              path.isNotEmpty
                  ? 'Uploaded "$fileName" successfully.'
                  : 'Uploaded "$fileName".',
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (result['error'] ?? 'Failed to upload ITR reference').toString(),
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorHandler.getMessage(e))),
      );
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  Widget _buildManualEntryTab(
    bool isDark,
    String? projectId, {
    String prefillFromArgs = '',
  }) {
    return _ITRManualEntryForm(
      projectId: projectId ?? '',
      isDark: isDark,
      prefillItrRef: prefillFromArgs.isNotEmpty ? prefillFromArgs : _prefillItrRef,
      onPreview: _showITRPreview,
      onSubmit: _submitITR,
    );
  }

  void _showITRPreview(Map<String, dynamic> data) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: isDark ? AppTheme.darkCard : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560, maxHeight: 700),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'ITR Preview',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
                    ),
                    IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close)),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: _buildPreviewContent(data, isDark, Responsive(ctx).isMobile),
                ),
              ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    MadButton(text: 'Edit', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(ctx)),
                    const SizedBox(width: 12),
                    MadButton(
                      text: 'Submit',
                      onPressed: () {
                        Navigator.pop(ctx);
                        _submitITR(data);
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPreviewContent(Map<String, dynamic> data, bool isDark, bool isMobile) {
    final textStyle = TextStyle(fontSize: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground);
    final valueStyle = const TextStyle(fontSize: 14, fontWeight: FontWeight.w500);

    Widget section(String title, List<Widget> rows) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
          const SizedBox(height: 8),
          ...rows,
          const SizedBox(height: 16),
        ],
      );
    }

    Widget row(String label, dynamic value) {
      final v = value?.toString() ?? '-';
      return Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: isMobile ? 100 : 140, child: Text(label, style: textStyle)),
            Expanded(child: Text(v, style: valueStyle, overflow: TextOverflow.ellipsis, maxLines: 1)),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        section('Header', [
          row('ITR Reference No', data['itr_ref_no']),
          row('Project Name', data['project_name']),
          row('Discipline', data['discipline']),
          row('Client/Employer', data['client_employer']),
          row('Contractor', data['contractor']),
        ]),
        section('Location', [
          row('Tower/Block', data['tower_block']),
          row('Floor', data['floor']),
          row('Grid', data['grid']),
          row('Room/Area', data['room_area']),
        ]),
        section('Contractor Part', [
          row('PMC Engineer', data['pmc_engineer']),
          row('Vendor Code', data['vendor_code']),
          row('Material Code', data['material_code']),
          row('Description of Works', data['description_of_works']),
        ]),
        section('Measurement', [
          row('Previous Quantity', data['previous_quantity']),
          row('Current Quantity', data['current_quantity']),
          row('Cumulative Quantity', data['cumulative_quantity']),
        ]),
        section('Clearances', [
          row('MEP Clearance', data['mep_clearance']),
          row('Surveyor Clearance', data['surveyor_clearance']),
          row('Interface Clearance', data['interface_clearance']),
        ]),
        section('Contractor Manager', [
          row('Ready for Inspection', data['ready_for_inspection'] == true ? 'Yes' : 'No'),
          row('Contractor Manager Name', data['contractor_manager_name']),
          row('Date', data['contractor_manager_date']),
        ]),
        section('Lodha/PMC', [
          row('Comments', data['comments']),
          row('Result Code', data['result_code']),
          row('Engineer Name', data['engineer_name']),
          row('Date', data['engineer_date']),
        ]),
      ],
    );
  }

  Future<void> _submitITR(Map<String, dynamic> formData) async {
    final store = StoreProvider.of<AppState>(context);
    final projectId = store.state.project.selectedProject?['project_id']?.toString() ??
        store.state.project.selectedProjectId ?? '';
    if (projectId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a project before submitting ITR')),
      );
      return;
    }

    final payload = _buildItrPayload(formData, projectId, store.state.auth.user);
    final updateId = (formData['itr_id'] ?? '').toString().trim();
    final result = updateId.isEmpty
        ? await ApiClient.createITR(payload)
        : await ApiClient.updateITR(updateId, payload);
    if (!mounted) return;
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ITR submitted successfully.')));
      _loadITRs();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text((result['message'] ?? result['error'] ?? 'Failed to submit ITR').toString())),
      );
    }
  }

  Widget _buildRecentITRsTab(bool isDark, bool isMobile) {
    final submittedCount = _itrs
        .where((i) => (i.status ?? '').toUpperCase() == 'SUBMITTED')
        .length;
    final approvedCount = _itrs
        .where((i) => (i.status ?? '').toUpperCase() == 'APPROVED')
        .length;
    final draftCount = _itrs
        .where((i) => (i.status ?? '').toUpperCase() == 'DRAFT')
        .length;

    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Recent ITRs',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: isDark
                          ? AppTheme.darkForeground
                          : AppTheme.lightForeground,
                    ),
                  ),
                ),
                MadBadge(
                  text: '${_itrs.length} Total',
                  variant: BadgeVariant.secondary,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _metricPill(
                  isDark: isDark,
                  label: 'Submitted',
                  value: '$submittedCount',
                  icon: LucideIcons.clock3,
                  color: const Color(0xFFF59E0B),
                ),
                _metricPill(
                  isDark: isDark,
                  label: 'Approved',
                  value: '$approvedCount',
                  icon: LucideIcons.circleCheck,
                  color: const Color(0xFF22C55E),
                ),
                _metricPill(
                  isDark: isDark,
                  label: 'Draft',
                  value: '$draftCount',
                  icon: LucideIcons.filePenLine,
                  color: AppTheme.primaryColor,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                SizedBox(
                  width: isMobile ? double.infinity : 320,
                  child: MadSearchInput(
                    controller: _searchController,
                    hintText: 'Search ITRs...',
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
                SizedBox(
                  width: 180,
                  child: MadSelect<String>(
                    value: _statusFilter,
                    placeholder: 'All Status',
                    clearable: true,
                    options: _apiStatusOptions
                        .map((e) => MadSelectOption(value: e, label: e))
                        .toList(),
                    onChanged: (v) => setState(() {
                      _statusFilter = v;
                      _currentPage = 1;
                    }),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(8),
                child: MadTableSkeleton(rows: 8, columns: 4),
              )
            else if (_error != null)
              _buildErrorState(isDark, _error!)
            else if (_filteredITRs.isEmpty)
              _buildEmptyState(isDark)
            else
              Column(
                children: [
                  ...List.generate(_paginatedITRs.length, (index) {
                    final itr = _paginatedITRs[index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _buildRecentItrItemCard(itr, isDark, isMobile),
                    );
                  }),
                  if (_totalPages > 1) _buildPagination(isDark),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _metricPill({
    required bool isDark,
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(0.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(
              fontSize: 12,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentItrItemCard(ITR itr, bool isDark, bool isMobile) {
    final status = (itr.status ?? '').toUpperCase();
    final variant = status == 'APPROVED' || status == 'CLOSED'
        ? BadgeVariant.default_
        : status == 'UNDER_INSPECTION' || status == 'SUBMITTED'
            ? BadgeVariant.outline
            : status == 'REJECTED'
                ? BadgeVariant.destructive
                : BadgeVariant.secondary;

    final metaStyle = TextStyle(
      fontSize: 12,
      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
    );

    Widget kv(String key, String value) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(key, style: metaStyle),
            const SizedBox(height: 2),
            Text(
              value.isEmpty ? '-' : value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ],
        );

    final resolvedItrNo = itr.itrRefNo.trim().isNotEmpty
        ? itr.itrRefNo.trim()
        : (itr.id.trim().isNotEmpty ? 'ITR-${itr.id.trim()}' : '-');
    final resolvedProject = (itr.projectName ?? '').trim().isNotEmpty
        ? itr.projectName!.trim()
        : (itr.projectId?.trim().isNotEmpty == true
            ? 'Project ${itr.projectId!.trim()}'
            : '-');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF111827) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
              .withOpacity(0.55),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ITR No',
                      style: metaStyle,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      resolvedItrNo,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontFamily: 'monospace',
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              MadBadge(text: itr.status ?? 'Unknown', variant: variant),
              const SizedBox(width: 6),
              MadDropdownMenuButton(
                items: [
                  MadMenuItem(label: 'View Details', icon: LucideIcons.eye, onTap: () => _showITRDetails(itr)),
                  MadMenuItem(label: 'Edit', icon: LucideIcons.pencil, onTap: () => _showEditITRDialog(itr)),
                  MadMenuItem(label: 'Preview', icon: LucideIcons.fileText, onTap: () {}),
                  MadMenuItem(label: 'Update Status', icon: LucideIcons.save, onTap: () => _showStatusUpdateDialog(itr)),
                  MadMenuItem(label: 'Mark Complete', icon: LucideIcons.circleCheck, onTap: () => _markITRComplete(itr)),
                  MadMenuItem(label: 'Delete', icon: LucideIcons.trash2, destructive: true, onTap: () => _showDeleteITRConfirmation(itr)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: kv('Project', resolvedProject),
              ),
              const SizedBox(width: 10),
              MadButton(
                text: 'Status Update',
                size: ButtonSize.sm,
                variant: ButtonVariant.secondary,
                onPressed: () => _showStatusUpdateDialog(itr),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPagination(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Page $_currentPage of $_totalPages',
            style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
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
              LucideIcons.clipboardCheck,
              size: 64,
              color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withOpacity(0.3),
            ),
            const SizedBox(height: 24),
            Text(
              'No ITRs yet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
            ),
            const SizedBox(height: 8),
            Text(
              'Create an installation test report via Upload or Manual Entry',
              style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
              textAlign: TextAlign.center,
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
              color: Colors.red.withOpacity(0.5),
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load ITRs',
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
              onPressed: _loadITRs,
            ),
          ],
        ),
      ),
    );
  }

  void _showITRDetails(ITR itr) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: isDark ? AppTheme.darkCard : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500, maxHeight: 560),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(itr.itrRefNo, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                  ],
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _itrDetailRow(isDark, 'ITR Reference No', itr.itrRefNo),
                      _itrDetailRow(isDark, 'Project Name', itr.projectName ?? '-'),
                      _itrDetailRow(isDark, 'Discipline', itr.discipline ?? '-'),
                      _itrDetailRow(isDark, 'Status', itr.status ?? '-'),
                      _itrDetailRow(isDark, 'Client / Employer', itr.clientEmployer ?? '-'),
                      _itrDetailRow(isDark, 'Contractor', itr.contractor ?? '-'),
                      _itrDetailRow(isDark, 'PMC Engineer', itr.pmcEngineer ?? '-'),
                      _itrDetailRow(isDark, 'Vendor Code', itr.vendorCode ?? '-'),
                      _itrDetailRow(isDark, 'Material Code', itr.materialCode ?? '-'),
                      _itrDetailRow(isDark, 'Inspection Date/Time', itr.inspectionDateTime ?? '-'),
                      _itrDetailRow(isDark, 'WIR/ITR Submission Date', itr.wirItrSubmissionDateTime ?? '-'),
                      _itrDetailRow(isDark, 'Submitted To', itr.submittedTo ?? '-'),
                      _itrDetailRow(isDark, 'Submitted By', itr.submittedBy ?? '-'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _itrDetailRow(bool isDark, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  void _showEditITRDialog(ITR itr) {
    final itrRefController = TextEditingController(text: itr.itrRefNo);
    final projectNameController = TextEditingController(text: itr.projectName ?? '');
    String? selectedDiscipline = itr.discipline;
    String? selectedStatus = itr.status;

    MadFormDialog.show(
      context: context,
      title: 'Edit ITR',
      maxWidth: 500,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MadInput(controller: itrRefController, labelText: 'ITR Reference No', hintText: 'ITR-XXX'),
          const SizedBox(height: 16),
          MadInput(controller: projectNameController, labelText: 'Project Name', hintText: 'Project name'),
          const SizedBox(height: 16),
          MadSelect<String>(
            labelText: 'Discipline',
            value: selectedDiscipline,
            placeholder: 'Select discipline',
            options: _disciplineLabelToApi.keys
                .map((e) => MadSelectOption(value: e, label: e))
                .toList(),
            onChanged: (value) => selectedDiscipline = value,
          ),
          const SizedBox(height: 16),
          MadSelect<String>(
            labelText: 'Status',
            value: selectedStatus,
            placeholder: 'Select status',
            options: _apiStatusOptions
                .map((e) => MadSelectOption(value: e, label: e))
                .toList(),
            onChanged: (value) => selectedStatus = value,
          ),
        ],
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () {
            itrRefController.dispose();
            projectNameController.dispose();
            Navigator.pop(context);
          },
        ),
        MadButton(
          text: 'Save',
          onPressed: () async {
            final data = <String, dynamic>{
              'itr_ref_no': itrRefController.text.trim(),
              'project_name': projectNameController.text.trim().isEmpty ? null : projectNameController.text.trim(),
              'discipline': selectedDiscipline,
              'status': selectedStatus ?? itr.status,
            };
            itrRefController.dispose();
            projectNameController.dispose();
            Navigator.pop(context);
            final result = await ApiClient.updateITR(itr.id, data);
            if (!mounted) return;
            if (result['success'] == true) _loadITRs();
          },
        ),
      ],
    );
  }

  void _showDeleteITRConfirmation(ITR itr) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppTheme.darkCard : Colors.white,
        title: const Text('Delete ITR'),
        content: Text('Are you sure you want to delete "${itr.itrRefNo}"? This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final result = await ApiClient.deleteITR(itr.id);
              if (!mounted) return;
              if (result['success'] == true) _loadITRs();
            },
            child: Text('Delete', style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );
  }

  Future<void> _markITRComplete(ITR itr) async {
    final result = await ApiClient.updateITR(itr.id, {'status': 'APPROVED'});
    if (!mounted) return;
    if (result['success'] == true) _loadITRs();
  }

  Future<void> _updateITRStatus(ITR itr) async {
    final key = itr.id;
    if (key.isEmpty) return;
    final draft = _statusDrafts[key] ?? {};
    final status = (draft['status'] ?? '').trim();
    if (status.isEmpty) {
      showToast(context, 'Select a workflow status first');
      return;
    }

    final user = StoreProvider.of<AppState>(context).state.auth.user;
    setState(() => _updatingStatusIds[key] = true);
    try {
      final result = await ApiClient.updateITRStatus(
        key,
        status: status,
        inspectionCode: draft['inspectionCode'] ?? '',
        lodhaPmcComments: draft['lodhaPmcComments'] ?? '',
        userId:
            user?['id']?.toString() ??
            user?['user_id']?.toString() ??
            user?['userId']?.toString(),
        userName:
            user?['name']?.toString() ??
            user?['full_name']?.toString() ??
            user?['username']?.toString() ??
            user?['email']?.toString(),
      );
      if (!mounted) return;
      if (result['success'] == true) {
        showToast(context, 'Approval workflow status updated');
        await _loadITRs();
      } else {
        showToast(
          context,
          (result['error'] ?? 'Failed to update ITR status').toString(),
        );
      }
    } catch (e) {
      if (!mounted) return;
      showToast(context, ErrorHandler.getMessage(e));
    } finally {
      if (mounted) {
        setState(() => _updatingStatusIds[key] = false);
      }
    }
  }

  void _showStatusUpdateDialog(ITR itr) {
    final key = itr.id;
    if (key.isEmpty) return;
    final draft = _statusDrafts[key] ??
        {
          'status': itr.status ?? 'DRAFT',
          'inspectionCode': '',
          'lodhaPmcComments': '',
        };
    String selectedStatus = draft['status'] ?? 'DRAFT';
    String selectedCode = draft['inspectionCode'] ?? '';
    final commentsController = TextEditingController(
      text: draft['lodhaPmcComments'] ?? '',
    );

    MadFormDialog.show(
      context: context,
      title: 'Update ITR Status',
      maxWidth: 560,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MadSelect<String>(
            labelText: 'Status',
            value: selectedStatus,
            options: _apiStatusOptions
                .map((e) => MadSelectOption(value: e, label: e))
                .toList(),
            onChanged: (value) {
              selectedStatus = value ?? selectedStatus;
            },
          ),
          const SizedBox(height: 16),
          MadSelect<String>(
            labelText: 'Inspection Code',
            value: selectedCode.isEmpty ? null : selectedCode,
            placeholder: 'Select inspection code',
            options: _apiInspectionCodeOptions
                .map(
                  (e) => MadSelectOption(
                    value: e['value']!,
                    label: '${e['value']} - ${e['label']}',
                  ),
                )
                .toList(),
            onChanged: (value) {
              selectedCode = value ?? '';
            },
          ),
          const SizedBox(height: 16),
          MadTextarea(
            controller: commentsController,
            labelText: 'PMC Comments',
            hintText: 'Enter comments',
            minLines: 2,
          ),
        ],
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () {
            commentsController.dispose();
            Navigator.pop(context);
          },
        ),
        MadButton(
          text: _updatingStatusIds[key] == true ? 'Updating...' : 'Update',
          disabled: _updatingStatusIds[key] == true,
          onPressed: () async {
            setState(() {
              _statusDrafts[key] = {
                'status': selectedStatus,
                'inspectionCode': selectedCode,
                'lodhaPmcComments': commentsController.text.trim(),
              };
            });
            commentsController.dispose();
            Navigator.pop(context);
            await _updateITRStatus(itr);
          },
        ),
      ],
    );
  }
}

/// Manual entry form for ITR - all sections from React ITR.jsx
class _ITRManualEntryForm extends StatefulWidget {
  final String projectId;
  final bool isDark;
  final String prefillItrRef;
  final void Function(Map<String, dynamic>) onPreview;
  final void Function(Map<String, dynamic>) onSubmit;

  const _ITRManualEntryForm({
    required this.projectId,
    required this.isDark,
    required this.prefillItrRef,
    required this.onPreview,
    required this.onSubmit,
  });

  @override
  State<_ITRManualEntryForm> createState() => _ITRManualEntryFormState();
}

class _ITRManualEntryFormState extends State<_ITRManualEntryForm> {
  final _formKey = GlobalKey<FormState>();

  final _itrRefController = TextEditingController();
  final _projectNameController = TextEditingController();
  final _projectCodeController = TextEditingController();
  final _clientEmployerController = TextEditingController();
  final _contractorController = TextEditingController();
  final _workOrderNoController = TextEditingController();
  final _revNoController = TextEditingController();
  final _submissionDateTimeController = TextEditingController();
  final _inspectionDateTimeController = TextEditingController();
  final _submittedToController = TextEditingController();
  final _submittedByController = TextEditingController();
  final _towerBlockController = TextEditingController();
  final _floorController = TextEditingController();
  final _gridController = TextEditingController();
  final _roomAreaController = TextEditingController();
  final _pmcEngineerController = TextEditingController();
  final _vendorCodeController = TextEditingController();
  final _materialCodeController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _prevQtyController = TextEditingController();
  final _currentQtyController = TextEditingController();
  final _cumulativeQtyController = TextEditingController();
  final _quantityUnitController = TextEditingController();
  final _specificDrawingRefNoController = TextEditingController();
  final _contractorManagerCommentsController = TextEditingController();
  final _readyInspectionDateController = TextEditingController();
  final _readyInspectionTimeController = TextEditingController();
  final _readySignedByController = TextEditingController();
  final _commentsController = TextEditingController();
  final _engineerNameController = TextEditingController();
  final _engineerSignatureController = TextEditingController();
  final _engineerDateController = TextEditingController();
  final _engineerMepNameController = TextEditingController();
  final _engineerMepSignatureController = TextEditingController();
  final _engineerMepDateController = TextEditingController();
  final _towerInchargeNameController = TextEditingController();
  final _towerInchargeSignatureController = TextEditingController();
  final _towerInchargeDateController = TextEditingController();
  final _qaaDepartmentNameController = TextEditingController();
  final _qaaDepartmentSignatureController = TextEditingController();
  final _qaaDepartmentDateController = TextEditingController();

  String _status = 'DRAFT';
  final List<String> _selectedDisciplines = [];
  String? _drawingAttach;
  String? _testCertAttach;
  String? _methodStatementAttach;
  String? _checklistAttach;
  String? _jointMeasurementAttach;
  final _mepClearanceNameController = TextEditingController();
  final _mepClearanceDateController = TextEditingController();
  final _mepClearanceDesignationController = TextEditingController();
  final _mepClearanceSignatureController = TextEditingController();
  final _mepClearanceCommentsController = TextEditingController();
  final _surveyorClearanceNameController = TextEditingController();
  final _surveyorClearanceDateController = TextEditingController();
  final _surveyorClearanceDesignationController = TextEditingController();
  final _surveyorClearanceSignatureController = TextEditingController();
  final _surveyorClearanceCommentsController = TextEditingController();
  final _interfaceClearanceNameController = TextEditingController();
  final _interfaceClearanceDateController = TextEditingController();
  final _interfaceClearanceDesignationController = TextEditingController();
  final _interfaceClearanceSignatureController = TextEditingController();
  final _interfaceClearanceCommentsController = TextEditingController();
  String? _resultCode;
  String? _selectedProjectId;
  String? _selectedPoId;
  String? _selectedMirId;
  bool _loadingOptions = false;
  List<Map<String, dynamic>> _projectOptions = const [];
  List<Map<String, dynamic>> _poOptions = const [];
  List<Map<String, dynamic>> _mirOptions = const [];
  final List<Map<String, String>> _workItems = [];
  final List<Map<String, String>> _shaftDetails = [];

  static const List<MadSelectOption<String>> _disciplineOptions = [
    MadSelectOption(value: 'Structural / Civil', label: 'Structural / Civil'),
    MadSelectOption(value: 'Arch / Finishing', label: 'Arch / Finishing'),
    MadSelectOption(value: 'Landscape', label: 'Landscape'),
    MadSelectOption(value: 'Mechanical', label: 'Mechanical'),
    MadSelectOption(value: 'Plumbing', label: 'Plumbing'),
    MadSelectOption(value: 'Electrical', label: 'Electrical'),
    MadSelectOption(value: 'Facade', label: 'Facade'),
    MadSelectOption(value: 'Others', label: 'Others'),
    MadSelectOption(value: 'ID', label: 'ID'),
    MadSelectOption(value: 'Surveying', label: 'Surveying'),
  ];

  static const List<MadSelectOption<String>> _statusOptions = [
    MadSelectOption(value: 'DRAFT', label: 'DRAFT'),
    MadSelectOption(value: 'SUBMITTED', label: 'SUBMITTED'),
    MadSelectOption(value: 'UNDER_INSPECTION', label: 'UNDER_INSPECTION'),
    MadSelectOption(value: 'APPROVED', label: 'APPROVED'),
    MadSelectOption(value: 'REJECTED', label: 'REJECTED'),
    MadSelectOption(value: 'RESUBMITTED', label: 'RESUBMITTED'),
    MadSelectOption(value: 'CLOSED', label: 'CLOSED'),
  ];

  static const List<MadSelectOption<String>> _yesNoNaOptions = [
    MadSelectOption(value: 'Yes', label: 'Yes'),
    MadSelectOption(value: 'No', label: 'No'),
    MadSelectOption(value: 'N/A', label: 'N/A'),
  ];

  static const List<MadSelectOption<String>> _resultCodeOptions = [
    MadSelectOption(value: 'CODE_1', label: 'CODE_1 - Work may proceed'),
    MadSelectOption(
      value: 'CODE_2',
      label:
          'CODE_2 - Conditionally approved. Work may proceed and resubmit incorporating comments',
    ),
    MadSelectOption(
      value: 'CODE_3',
      label: 'CODE_3 - Revise and resubmit. Work may NOT proceed',
    ),
    MadSelectOption(
      value: 'CODE_4',
      label: 'CODE_4 - For information and records only. Work may proceed',
    ),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryLoadDraft());
    _selectedProjectId = widget.projectId.isEmpty ? null : widget.projectId;
    _loadProjectOptions();
    if (_selectedProjectId != null && _selectedProjectId!.isNotEmpty) {
      _loadPoMirOptions(_selectedProjectId!);
    }
    if (widget.prefillItrRef.isNotEmpty) {
      _itrRefController.text = widget.prefillItrRef;
    }
  }

  Future<void> _loadProjectOptions() async {
    setState(() => _loadingOptions = true);
    try {
      final res = await ApiClient.getProjects();
      if (!mounted) return;
      final data =
          (res['success'] == true && res['data'] is List)
              ? List<Map<String, dynamic>>.from(
                  (res['data'] as List).map((e) => Map<String, dynamic>.from(e)),
                )
              : <Map<String, dynamic>>[];
      setState(() => _projectOptions = data);
    } catch (_) {
      if (!mounted) return;
      setState(() => _projectOptions = const []);
    } finally {
      if (mounted) setState(() => _loadingOptions = false);
    }
  }

  Future<void> _loadPoMirOptions(String projectId) async {
    try {
      final poRes = await ApiClient.getPosByProject(projectId);
      final mirRes = await ApiClient.getMirsByProject(projectId);
      if (!mounted) return;
      setState(() {
        _poOptions =
            (poRes['success'] == true && poRes['data'] is List)
                ? List<Map<String, dynamic>>.from(
                    (poRes['data'] as List).map(
                      (e) => Map<String, dynamic>.from(e),
                    ),
                  )
                : const [];
        _mirOptions =
            (mirRes['success'] == true && mirRes['data'] is List)
                ? List<Map<String, dynamic>>.from(
                    (mirRes['data'] as List).map(
                      (e) => Map<String, dynamic>.from(e),
                    ),
                  )
                : const [];
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _poOptions = const [];
        _mirOptions = const [];
      });
    }
  }

  Future<void> _tryLoadDraft() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_itrDraftKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = _decodeDraft(raw);
      if (decoded.isEmpty) return;
      final decodedDisciplinesRaw = decoded['discipline_list']?.toString() ?? '';
      final decodedDisciplines = decodedDisciplinesRaw
          .split(',')
          .map((e) => e.trim())
          .where((e) => e.isNotEmpty)
          .toList();
      List<Map<String, String>> decodedWorkItems = [];
      List<Map<String, String>> decodedShaftDetails = [];
      try {
        final workRaw = decoded['work_items_json']?.toString() ?? '';
        if (workRaw.isNotEmpty) {
          final parsed = jsonDecode(workRaw);
          if (parsed is List) {
            decodedWorkItems = parsed
                .map(
                  (e) => Map<String, String>.from(
                    (e as Map).map((k, v) => MapEntry('$k', '${v ?? ''}')),
                  ),
                )
                .toList();
          }
        }
      } catch (_) {}
      try {
        final shaftRaw = decoded['shaft_details_json']?.toString() ?? '';
        if (shaftRaw.isNotEmpty) {
          final parsed = jsonDecode(shaftRaw);
          if (parsed is List) {
            decodedShaftDetails = parsed
                .map(
                  (e) => Map<String, String>.from(
                    (e as Map).map((k, v) => MapEntry('$k', '${v ?? ''}')),
                  ),
                )
                .toList();
          }
        }
      } catch (_) {}
      setState(() {
        _itrRefController.text = decoded['itr_ref_no']?.toString() ?? '';
        _selectedProjectId =
            decoded['project_id']?.toString().isNotEmpty == true
                ? decoded['project_id'].toString()
                : _selectedProjectId;
        _selectedPoId =
            decoded['po_id']?.toString().isNotEmpty == true
                ? decoded['po_id'].toString()
                : null;
        _selectedMirId =
            decoded['mir_id']?.toString().isNotEmpty == true
                ? decoded['mir_id'].toString()
                : null;
        _projectNameController.text = decoded['project_name']?.toString() ?? '';
        _projectCodeController.text = decoded['project_code']?.toString() ?? '';
        _clientEmployerController.text = decoded['client_employer']?.toString() ?? '';
        _contractorController.text = decoded['contractor']?.toString() ?? '';
        _workOrderNoController.text = decoded['work_order_no']?.toString() ?? '';
        _revNoController.text = decoded['rev_no']?.toString() ?? '';
        _submissionDateTimeController.text = decoded['wir_itr_submission_date_time']?.toString() ?? '';
        _inspectionDateTimeController.text = decoded['inspection_date_time']?.toString() ?? '';
        _submittedToController.text = decoded['submitted_to']?.toString() ?? '';
        _submittedByController.text = decoded['submitted_by']?.toString() ?? '';
        _towerBlockController.text = decoded['tower_block']?.toString() ?? '';
        _floorController.text = decoded['floor']?.toString() ?? '';
        _gridController.text = decoded['grid']?.toString() ?? '';
        _roomAreaController.text = decoded['room_area']?.toString() ?? '';
        _pmcEngineerController.text = decoded['pmc_engineer']?.toString() ?? '';
        _vendorCodeController.text = decoded['vendor_code']?.toString() ?? '';
        _materialCodeController.text = decoded['material_code']?.toString() ?? '';
        _descriptionController.text = decoded['description_of_works']?.toString() ?? '';
        _prevQtyController.text = decoded['previous_quantity']?.toString() ?? '';
        _currentQtyController.text = decoded['current_quantity']?.toString() ?? '';
        _cumulativeQtyController.text = decoded['cumulative_quantity']?.toString() ?? '';
        _quantityUnitController.text = decoded['quantity_unit']?.toString() ?? '';
        _specificDrawingRefNoController.text = decoded['specific_drawing_ref_no']?.toString() ?? '';
        _contractorManagerCommentsController.text = decoded['contractor_manager_comments']?.toString() ?? '';
        _readyInspectionDateController.text = decoded['ready_for_inspection_date']?.toString() ?? '';
        _readyInspectionTimeController.text = decoded['ready_for_inspection_time']?.toString() ?? '';
        _readySignedByController.text = decoded['ready_signed_by']?.toString() ?? '';
        _commentsController.text = decoded['comments']?.toString() ?? '';
        _engineerNameController.text = decoded['engineer_name']?.toString() ?? '';
        _engineerSignatureController.text = decoded['engineer_signature']?.toString() ?? '';
        _engineerDateController.text = decoded['engineer_date']?.toString() ?? '';
        _engineerMepNameController.text = decoded['engineer_mep_name']?.toString() ?? '';
        _engineerMepSignatureController.text = decoded['engineer_mep_signature']?.toString() ?? '';
        _engineerMepDateController.text = decoded['engineer_mep_date']?.toString() ?? '';
        _towerInchargeNameController.text = decoded['tower_incharge_name']?.toString() ?? '';
        _towerInchargeSignatureController.text = decoded['tower_incharge_signature']?.toString() ?? '';
        _towerInchargeDateController.text = decoded['tower_incharge_date']?.toString() ?? '';
        _qaaDepartmentNameController.text = decoded['qaa_department_name']?.toString() ?? '';
        _qaaDepartmentSignatureController.text = decoded['qaa_department_signature']?.toString() ?? '';
        _qaaDepartmentDateController.text = decoded['qaa_department_date']?.toString() ?? '';
        _status = decoded['status']?.toString() ?? 'DRAFT';
        _selectedDisciplines
          ..clear()
          ..addAll(
            decodedDisciplines.isNotEmpty
                ? decodedDisciplines
                : (decoded['discipline']?.toString().isNotEmpty == true
                      ? [decoded['discipline'].toString()]
                      : const []),
          );
        _drawingAttach = decoded['drawing_attachment']?.toString();
        _testCertAttach = decoded['test_certificates_attachment']?.toString();
        _methodStatementAttach = decoded['method_statement_attachment']?.toString();
        _checklistAttach = decoded['checklist_attachment']?.toString();
        _jointMeasurementAttach = decoded['joint_measurement_attachment']?.toString();
        _mepClearanceNameController.text = decoded['mep_clearance_name']?.toString() ?? '';
        _mepClearanceDateController.text = decoded['mep_clearance_date']?.toString() ?? '';
        _mepClearanceDesignationController.text = decoded['mep_clearance_designation']?.toString() ?? '';
        _mepClearanceSignatureController.text = decoded['mep_clearance_signature']?.toString() ?? '';
        _mepClearanceCommentsController.text = decoded['mep_clearance_comments']?.toString() ?? '';
        _surveyorClearanceNameController.text = decoded['surveyor_clearance_name']?.toString() ?? '';
        _surveyorClearanceDateController.text = decoded['surveyor_clearance_date']?.toString() ?? '';
        _surveyorClearanceDesignationController.text = decoded['surveyor_clearance_designation']?.toString() ?? '';
        _surveyorClearanceSignatureController.text = decoded['surveyor_clearance_signature']?.toString() ?? '';
        _surveyorClearanceCommentsController.text = decoded['surveyor_clearance_comments']?.toString() ?? '';
        _interfaceClearanceNameController.text = decoded['interface_clearance_name']?.toString() ?? '';
        _interfaceClearanceDateController.text = decoded['interface_clearance_date']?.toString() ?? '';
        _interfaceClearanceDesignationController.text = decoded['interface_clearance_designation']?.toString() ?? '';
        _interfaceClearanceSignatureController.text = decoded['interface_clearance_signature']?.toString() ?? '';
        _interfaceClearanceCommentsController.text = decoded['interface_clearance_comments']?.toString() ?? '';
        _resultCode = decoded['result_code']?.toString();
        _workItems
          ..clear()
          ..addAll(decodedWorkItems);
        _shaftDetails
          ..clear()
          ..addAll(decodedShaftDetails);
      });
      if (_selectedProjectId != null && _selectedProjectId!.isNotEmpty) {
        _loadPoMirOptions(_selectedProjectId!);
      }
      if (_itrRefController.text.isEmpty && widget.prefillItrRef.isNotEmpty) {
        setState(() {
          _itrRefController.text = widget.prefillItrRef;
        });
      }
    } catch (_) {}
  }

  Map<String, dynamic> _decodeDraft(String raw) {
    final out = <String, dynamic>{};
    final parts = raw.split(';;');
    for (final p in parts) {
      if (p.isEmpty) continue;
      final idx = p.indexOf('::');
      if (idx == -1) continue;
      final key = p.substring(0, idx);
      final value = p.substring(idx + 2);
      if (value.isNotEmpty) out[key] = value;
    }
    return out;
  }

  @override
  void dispose() {
    _itrRefController.dispose();
    _projectNameController.dispose();
    _projectCodeController.dispose();
    _clientEmployerController.dispose();
    _contractorController.dispose();
    _workOrderNoController.dispose();
    _revNoController.dispose();
    _submissionDateTimeController.dispose();
    _inspectionDateTimeController.dispose();
    _submittedToController.dispose();
    _submittedByController.dispose();
    _towerBlockController.dispose();
    _floorController.dispose();
    _gridController.dispose();
    _roomAreaController.dispose();
    _pmcEngineerController.dispose();
    _vendorCodeController.dispose();
    _materialCodeController.dispose();
    _descriptionController.dispose();
    _prevQtyController.dispose();
    _currentQtyController.dispose();
    _cumulativeQtyController.dispose();
    _quantityUnitController.dispose();
    _specificDrawingRefNoController.dispose();
    _contractorManagerCommentsController.dispose();
    _readyInspectionDateController.dispose();
    _readyInspectionTimeController.dispose();
    _readySignedByController.dispose();
    _commentsController.dispose();
    _engineerNameController.dispose();
    _engineerSignatureController.dispose();
    _engineerDateController.dispose();
    _engineerMepNameController.dispose();
    _engineerMepSignatureController.dispose();
    _engineerMepDateController.dispose();
    _towerInchargeNameController.dispose();
    _towerInchargeSignatureController.dispose();
    _towerInchargeDateController.dispose();
    _qaaDepartmentNameController.dispose();
    _qaaDepartmentSignatureController.dispose();
    _qaaDepartmentDateController.dispose();
    _mepClearanceNameController.dispose();
    _mepClearanceDateController.dispose();
    _mepClearanceDesignationController.dispose();
    _mepClearanceSignatureController.dispose();
    _mepClearanceCommentsController.dispose();
    _surveyorClearanceNameController.dispose();
    _surveyorClearanceDateController.dispose();
    _surveyorClearanceDesignationController.dispose();
    _surveyorClearanceSignatureController.dispose();
    _surveyorClearanceCommentsController.dispose();
    _interfaceClearanceNameController.dispose();
    _interfaceClearanceDateController.dispose();
    _interfaceClearanceDesignationController.dispose();
    _interfaceClearanceSignatureController.dispose();
    _interfaceClearanceCommentsController.dispose();
    super.dispose();
  }

  Map<String, dynamic> _collectData() {
    return {
      'itr_ref_no': _itrRefController.text.trim(),
      'project_id': _selectedProjectId ?? widget.projectId,
      'po_id': _selectedPoId ?? '',
      'mir_id': _selectedMirId ?? '',
      'status': _status,
      'project_name': _projectNameController.text.trim(),
      'project_code': _projectCodeController.text.trim(),
      'discipline':
          _selectedDisciplines.isNotEmpty ? _selectedDisciplines.first : '',
      'discipline_list': _selectedDisciplines,
      'client_employer': _clientEmployerController.text.trim(),
      'contractor': _contractorController.text.trim(),
      'work_order_no': _workOrderNoController.text.trim(),
      'rev_no': _revNoController.text.trim(),
      'wir_itr_submission_date_time': _submissionDateTimeController.text.trim(),
      'inspection_date_time': _inspectionDateTimeController.text.trim(),
      'submitted_to': _submittedToController.text.trim(),
      'submitted_by': _submittedByController.text.trim(),
      'tower_block': _towerBlockController.text.trim(),
      'floor': _floorController.text.trim(),
      'grid': _gridController.text.trim(),
      'room_area': _roomAreaController.text.trim(),
      'pmc_engineer': _pmcEngineerController.text.trim(),
      'vendor_code': _vendorCodeController.text.trim(),
      'material_code': _materialCodeController.text.trim(),
      'description_of_works': _descriptionController.text.trim(),
      'previous_quantity': _prevQtyController.text.trim(),
      'current_quantity': _currentQtyController.text.trim(),
      'cumulative_quantity': _cumulativeQtyController.text.trim(),
      'quantity_unit': _quantityUnitController.text.trim(),
      'drawing_attachment': _drawingAttach,
      'test_certificates_attachment': _testCertAttach,
      'specific_drawing_ref_no': _specificDrawingRefNoController.text.trim(),
      'method_statement_attachment': _methodStatementAttach,
      'checklist_attachment': _checklistAttach,
      'joint_measurement_attachment': _jointMeasurementAttach,
      'mep_clearance_name': _mepClearanceNameController.text.trim(),
      'mep_clearance_date': _mepClearanceDateController.text.trim(),
      'mep_clearance_designation': _mepClearanceDesignationController.text.trim(),
      'mep_clearance_signature': _mepClearanceSignatureController.text.trim(),
      'mep_clearance_comments': _mepClearanceCommentsController.text.trim(),
      'surveyor_clearance_name': _surveyorClearanceNameController.text.trim(),
      'surveyor_clearance_date': _surveyorClearanceDateController.text.trim(),
      'surveyor_clearance_designation':
          _surveyorClearanceDesignationController.text.trim(),
      'surveyor_clearance_signature':
          _surveyorClearanceSignatureController.text.trim(),
      'surveyor_clearance_comments': _surveyorClearanceCommentsController.text.trim(),
      'interface_clearance_name': _interfaceClearanceNameController.text.trim(),
      'interface_clearance_date': _interfaceClearanceDateController.text.trim(),
      'interface_clearance_designation':
          _interfaceClearanceDesignationController.text.trim(),
      'interface_clearance_signature':
          _interfaceClearanceSignatureController.text.trim(),
      'interface_clearance_comments':
          _interfaceClearanceCommentsController.text.trim(),
      'contractor_manager_comments': _contractorManagerCommentsController.text.trim(),
      'ready_for_inspection_date': _readyInspectionDateController.text.trim(),
      'ready_for_inspection_time': _readyInspectionTimeController.text.trim(),
      'ready_signed_by': _readySignedByController.text.trim(),
      'comments': _commentsController.text.trim(),
      'result_code': _resultCode,
      'engineer_name': _engineerNameController.text.trim(),
      'engineer_signature': _engineerSignatureController.text.trim(),
      'engineer_date': _engineerDateController.text.trim(),
      'engineer_mep_name': _engineerMepNameController.text.trim(),
      'engineer_mep_signature': _engineerMepSignatureController.text.trim(),
      'engineer_mep_date': _engineerMepDateController.text.trim(),
      'tower_incharge_name': _towerInchargeNameController.text.trim(),
      'tower_incharge_signature': _towerInchargeSignatureController.text.trim(),
      'tower_incharge_date': _towerInchargeDateController.text.trim(),
      'qaa_department_name': _qaaDepartmentNameController.text.trim(),
      'qaa_department_signature': _qaaDepartmentSignatureController.text.trim(),
      'qaa_department_date': _qaaDepartmentDateController.text.trim(),
      'source': 'Manual',
      'source_file_name': '',
      'work_items': _workItems
          .map((e) => Map<String, dynamic>.from(e))
          .toList(),
      'shaft_details': _shaftDetails
          .map((e) => Map<String, dynamic>.from(e))
          .toList(),
    };
  }

  Future<void> _saveDraft() async {
    final data = _collectData();
    try {
      final prefs = await SharedPreferences.getInstance();
      final parts = <String>[];
      for (final e in data.entries) {
        if (e.key == 'work_items' || e.key == 'shaft_details') continue;
        if (e.key == 'discipline_list' && e.value is List) {
          final v = (e.value as List).map((x) => x.toString()).join(',');
          if (v.isNotEmpty) parts.add('${e.key}::$v');
          continue;
        }
        if (e.value != null && e.value.toString().isNotEmpty) parts.add('${e.key}::${e.value}');
      }
      if (_workItems.isNotEmpty) {
        parts.add('work_items_json::${jsonEncode(_workItems)}');
      }
      if (_shaftDetails.isNotEmpty) {
        parts.add('shaft_details_json::${jsonEncode(_shaftDetails)}');
      }
      await prefs.setString(_itrDraftKey, parts.join(';;'));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Draft saved.')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ErrorHandler.getMessage(e))));
    }
  }

  void _toggleDiscipline(String option) {
    setState(() {
      if (_selectedDisciplines.contains(option)) {
        _selectedDisciplines.remove(option);
      } else {
        _selectedDisciplines.add(option);
      }
    });
  }

  void _addWorkItem() {
    setState(() {
      _workItems.add({
        'item_description': '',
        'size': '',
        'quantity': '',
        'unit': '',
      });
    });
  }

  void _removeWorkItem(int index) {
    if (index < 0 || index >= _workItems.length) return;
    setState(() => _workItems.removeAt(index));
  }

  void _updateWorkItem(int index, String key, String value) {
    if (index < 0 || index >= _workItems.length) return;
    setState(() => _workItems[index][key] = value);
  }

  void _addShaftDetail() {
    setState(() {
      _shaftDetails.add({
        'shaft_no': '',
        'staff_id': '',
        'staff_name': '',
        'staff_number': '',
      });
    });
  }

  void _removeShaftDetail(int index) {
    if (index < 0 || index >= _shaftDetails.length) return;
    setState(() => _shaftDetails.removeAt(index));
  }

  void _updateShaftDetail(int index, String key, String value) {
    if (index < 0 || index >= _shaftDetails.length) return;
    setState(() => _shaftDetails[index][key] = value);
  }

  Widget _dynamicField(
    String label,
    String value,
    ValueChanged<String> onChanged,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: value,
          onChanged: onChanged,
          decoration: const InputDecoration(
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    final isNarrow = MediaQuery.of(context).size.width < 700;
    return SingleChildScrollView(
      padding: EdgeInsets.all(isNarrow ? 12 : 24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Header', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                    const SizedBox(height: 16),
                    MadInput(controller: _itrRefController, labelText: 'ITR Reference No', hintText: 'ITR-XXX'),
                    const SizedBox(height: 16),
                    MadSelect<String>(labelText: 'Status', value: _status, options: _statusOptions, onChanged: (v) => setState(() => _status = v ?? 'DRAFT')),
                    const SizedBox(height: 16),
                    MadSelect<String>(
                      labelText: 'project_id',
                      value: _selectedProjectId,
                      placeholder: _loadingOptions ? 'Loading projects...' : 'Select project_id',
                      options: _projectOptions
                          .map((item) {
                            final id = (item['project_id'] ?? item['id']).toString();
                            final name = (item['project_name'] ?? item['projectName'] ?? 'Project $id').toString();
                            return MadSelectOption(value: id, label: '$id - $name');
                          })
                          .toList(),
                      onChanged: (value) async {
                        if (value == null || value == _selectedProjectId) return;
                        setState(() {
                          _selectedProjectId = value;
                          _selectedPoId = null;
                          _selectedMirId = null;
                        });
                        final selected = _projectOptions.firstWhere(
                          (item) => (item['project_id'] ?? item['id']).toString() == value,
                          orElse: () => <String, dynamic>{},
                        );
                        if (selected.isNotEmpty) {
                          _projectNameController.text = (selected['project_name'] ?? selected['projectName'] ?? '').toString();
                          _projectCodeController.text = (selected['project_code'] ?? selected['projectCode'] ?? '').toString();
                        }
                        await _loadPoMirOptions(value);
                      },
                    ),
                    const SizedBox(height: 16),
                    MadSelect<String>(
                      labelText: 'po_id',
                      value: _selectedPoId,
                      placeholder: _selectedProjectId == null ? 'Select project first' : 'Select po_id',
                      options: _poOptions
                          .map((item) {
                            final id = (item['po_id'] ?? item['id']).toString();
                            final label = (item['order_no'] ?? item['indent_no'] ?? item['vendor_name'] ?? 'PO $id').toString();
                            return MadSelectOption(value: id, label: '$id - $label');
                          })
                          .toList(),
                      onChanged: (value) => setState(() => _selectedPoId = value),
                    ),
                    const SizedBox(height: 16),
                    MadSelect<String>(
                      labelText: 'mir_id',
                      value: _selectedMirId,
                      placeholder: _selectedProjectId == null ? 'Select project first' : 'Select mir_id',
                      options: _mirOptions
                          .map((item) {
                            final id = (item['mir_id'] ?? item['id']).toString();
                            final label = (item['mir_refrence_no'] ?? item['challan_no'] ?? 'MIR $id').toString();
                            return MadSelectOption(value: id, label: '$id - $label');
                          })
                          .toList(),
                      onChanged: (value) => setState(() => _selectedMirId = value),
                    ),
                    const SizedBox(height: 16),
                    MadInput(controller: _projectNameController, labelText: 'Project Name', hintText: 'Enter project name'),
                    const SizedBox(height: 16),
                    MadInput(controller: _projectCodeController, labelText: 'Project Code', hintText: 'Project code'),
                    const SizedBox(height: 16),
                    Text(
                      'Discipline',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _disciplineOptions
                          .map(
                            (option) => MadButton(
                              text: option.label,
                              size: ButtonSize.sm,
                              variant: _selectedDisciplines.contains(option.value)
                                  ? ButtonVariant.primary
                                  : ButtonVariant.outline,
                              onPressed: () => _toggleDiscipline(option.value),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 16),
                    MadInput(controller: _clientEmployerController, labelText: 'Client/Employer', hintText: 'Client or employer name'),
                    const SizedBox(height: 16),
                    MadInput(controller: _contractorController, labelText: 'Contractor', hintText: 'Contractor name'),
                    const SizedBox(height: 16),
                    MadInput(controller: _workOrderNoController, labelText: 'Work Order No', hintText: 'Work order number'),
                    const SizedBox(height: 16),
                    MadInput(controller: _revNoController, labelText: 'Revision No', hintText: 'Revision number'),
                    const SizedBox(height: 16),
                    MadInput(controller: _submissionDateTimeController, labelText: 'WIR/ITR Submission Date & Time', hintText: 'YYYY-MM-DD HH:mm'),
                    const SizedBox(height: 16),
                    MadInput(controller: _inspectionDateTimeController, labelText: 'Inspection Date & Time', hintText: 'YYYY-MM-DD HH:mm'),
                    const SizedBox(height: 16),
                    MadInput(controller: _submittedToController, labelText: 'Submitted To', hintText: 'WIR/ITR submitted to'),
                    const SizedBox(height: 16),
                    MadInput(controller: _submittedByController, labelText: 'Submitted By', hintText: 'WIR/ITR submitted by'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('work_items', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                        MadButton(
                          text: 'Add Item',
                          size: ButtonSize.sm,
                          variant: ButtonVariant.outline,
                          onPressed: _addWorkItem,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_workItems.isEmpty)
                      Text(
                        'No work items added.',
                        style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                      ),
                    ...List.generate(_workItems.length, (index) {
                      final item = _workItems[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          children: [
                            _dynamicField(
                              'Item Description',
                              item['item_description'] ?? '',
                              (v) => _updateWorkItem(index, 'item_description', v),
                            ),
                            const SizedBox(height: 10),
                            _dynamicField(
                              'Size',
                              item['size'] ?? '',
                              (v) => _updateWorkItem(index, 'size', v),
                            ),
                            const SizedBox(height: 10),
                            _dynamicField(
                              'Quantity',
                              item['quantity'] ?? '',
                              (v) => _updateWorkItem(index, 'quantity', v),
                            ),
                            const SizedBox(height: 10),
                            _dynamicField(
                              'Unit',
                              item['unit'] ?? '',
                              (v) => _updateWorkItem(index, 'unit', v),
                            ),
                            const SizedBox(height: 10),
                            Align(
                              alignment: Alignment.centerRight,
                              child: MadButton(
                                text: 'Remove',
                                size: ButtonSize.sm,
                                variant: ButtonVariant.destructive,
                                onPressed: () => _removeWorkItem(index),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('shaft_details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                        MadButton(
                          text: 'Add Shaft Row',
                          size: ButtonSize.sm,
                          variant: ButtonVariant.outline,
                          onPressed: _addShaftDetail,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_shaftDetails.isEmpty)
                      Text(
                        'No shaft rows added.',
                        style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                      ),
                    ...List.generate(_shaftDetails.length, (index) {
                      final item = _shaftDetails[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          children: [
                            _dynamicField(
                              'Shaft No',
                              item['shaft_no'] ?? '',
                              (v) => _updateShaftDetail(index, 'shaft_no', v),
                            ),
                            const SizedBox(height: 10),
                            _dynamicField(
                              'Staff ID',
                              item['staff_id'] ?? '',
                              (v) => _updateShaftDetail(index, 'staff_id', v),
                            ),
                            const SizedBox(height: 10),
                            _dynamicField(
                              'Staff Name',
                              item['staff_name'] ?? '',
                              (v) => _updateShaftDetail(index, 'staff_name', v),
                            ),
                            const SizedBox(height: 10),
                            _dynamicField(
                              'Staff Number',
                              item['staff_number'] ?? '',
                              (v) => _updateShaftDetail(index, 'staff_number', v),
                            ),
                            const SizedBox(height: 10),
                            Align(
                              alignment: Alignment.centerRight,
                              child: MadButton(
                                text: 'Remove',
                                size: ButtonSize.sm,
                                variant: ButtonVariant.destructive,
                                onPressed: () => _removeShaftDetail(index),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Location', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                    const SizedBox(height: 16),
                    MadInput(controller: _towerBlockController, labelText: 'Tower/Block', hintText: 'Tower or block'),
                    const SizedBox(height: 16),
                    MadInput(controller: _floorController, labelText: 'Floor', hintText: 'Floor'),
                    const SizedBox(height: 16),
                    MadInput(controller: _gridController, labelText: 'Grid', hintText: 'Grid'),
                    const SizedBox(height: 16),
                    MadInput(controller: _roomAreaController, labelText: 'Room/Area', hintText: 'Room or area'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Contractor Part', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                    const SizedBox(height: 16),
                    MadInput(controller: _pmcEngineerController, labelText: 'PMC Engineer', hintText: 'PMC engineer name'),
                    const SizedBox(height: 16),
                    MadInput(controller: _vendorCodeController, labelText: 'Vendor Code', hintText: 'Vendor code'),
                    const SizedBox(height: 16),
                    MadInput(controller: _materialCodeController, labelText: 'Material Code', hintText: 'Material code'),
                    const SizedBox(height: 16),
                    MadTextarea(controller: _descriptionController, labelText: 'Description of Works', hintText: 'Describe the works...', minLines: 3),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Measurement', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                    const SizedBox(height: 16),
                    MadInput(controller: _prevQtyController, labelText: 'Previous Quantity', hintText: '0', keyboardType: TextInputType.number),
                    const SizedBox(height: 16),
                    MadInput(controller: _currentQtyController, labelText: 'Current Quantity', hintText: '0', keyboardType: TextInputType.number),
                    const SizedBox(height: 16),
                    MadInput(controller: _cumulativeQtyController, labelText: 'Cumulative Quantity', hintText: '0', keyboardType: TextInputType.number),
                    const SizedBox(height: 16),
                    MadInput(controller: _quantityUnitController, labelText: 'Quantity Unit', hintText: 'NOS'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Attachments (Yes/No/NA)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                    const SizedBox(height: 16),
                    MadSelect<String>(labelText: 'Drawing', value: _drawingAttach, placeholder: 'Select', options: _yesNoNaOptions, onChanged: (v) => setState(() => _drawingAttach = v)),
                    const SizedBox(height: 12),
                    MadSelect<String>(labelText: 'Test Certificates', value: _testCertAttach, placeholder: 'Select', options: _yesNoNaOptions, onChanged: (v) => setState(() => _testCertAttach = v)),
                    const SizedBox(height: 12),
                    MadInput(controller: _specificDrawingRefNoController, labelText: 'Specific Drawing Ref No', hintText: 'Drawing reference'),
                    const SizedBox(height: 12),
                    MadSelect<String>(labelText: 'Method Statement', value: _methodStatementAttach, placeholder: 'Select', options: _yesNoNaOptions, onChanged: (v) => setState(() => _methodStatementAttach = v)),
                    const SizedBox(height: 12),
                    MadSelect<String>(labelText: 'Checklist', value: _checklistAttach, placeholder: 'Select', options: _yesNoNaOptions, onChanged: (v) => setState(() => _checklistAttach = v)),
                    const SizedBox(height: 12),
                    MadSelect<String>(labelText: 'Joint Measurement Sheet', value: _jointMeasurementAttach, placeholder: 'Select', options: _yesNoNaOptions, onChanged: (v) => setState(() => _jointMeasurementAttach = v)),
                    const SizedBox(height: 20),
                    Text('Clearances', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                    const SizedBox(height: 12),
                    MadInput(controller: _mepClearanceNameController, labelText: 'MEP - Name', hintText: 'Name'),
                    const SizedBox(height: 12),
                    MadInput(controller: _mepClearanceDateController, labelText: 'MEP - Date', hintText: 'Date'),
                    const SizedBox(height: 12),
                    MadInput(controller: _mepClearanceDesignationController, labelText: 'MEP - Designation', hintText: 'Designation'),
                    const SizedBox(height: 12),
                    MadInput(controller: _mepClearanceSignatureController, labelText: 'MEP - Signature', hintText: 'Signature/url'),
                    const SizedBox(height: 12),
                    MadInput(controller: _mepClearanceCommentsController, labelText: 'MEP - Comments', hintText: 'Comments'),
                    const SizedBox(height: 16),
                    MadInput(controller: _surveyorClearanceNameController, labelText: 'Surveyor - Name', hintText: 'Name'),
                    const SizedBox(height: 12),
                    MadInput(controller: _surveyorClearanceDateController, labelText: 'Surveyor - Date', hintText: 'Date'),
                    const SizedBox(height: 12),
                    MadInput(controller: _surveyorClearanceDesignationController, labelText: 'Surveyor - Designation', hintText: 'Designation'),
                    const SizedBox(height: 12),
                    MadInput(controller: _surveyorClearanceSignatureController, labelText: 'Surveyor - Signature', hintText: 'Signature/url'),
                    const SizedBox(height: 12),
                    MadInput(controller: _surveyorClearanceCommentsController, labelText: 'Surveyor - Comments', hintText: 'Comments'),
                    const SizedBox(height: 16),
                    MadInput(controller: _interfaceClearanceNameController, labelText: 'Interface - Name', hintText: 'Name'),
                    const SizedBox(height: 12),
                    MadInput(controller: _interfaceClearanceDateController, labelText: 'Interface - Date', hintText: 'Date'),
                    const SizedBox(height: 12),
                    MadInput(controller: _interfaceClearanceDesignationController, labelText: 'Interface - Designation', hintText: 'Designation'),
                    const SizedBox(height: 12),
                    MadInput(controller: _interfaceClearanceSignatureController, labelText: 'Interface - Signature', hintText: 'Signature/url'),
                    const SizedBox(height: 12),
                    MadInput(controller: _interfaceClearanceCommentsController, labelText: 'Interface - Comments', hintText: 'Comments'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Contractor Manager Readiness', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                    const SizedBox(height: 16),
                    MadTextarea(controller: _contractorManagerCommentsController, labelText: 'Contractor Manager / Engineer Comments', hintText: 'Comments...', minLines: 2),
                    const SizedBox(height: 16),
                    MadInput(controller: _readyInspectionDateController, labelText: 'Ready for Inspection Date', hintText: 'YYYY-MM-DD'),
                    const SizedBox(height: 16),
                    MadInput(controller: _readyInspectionTimeController, labelText: 'Ready for Inspection Time', hintText: 'HH:mm'),
                    const SizedBox(height: 16),
                    MadInput(controller: _readySignedByController, labelText: 'Signed By', hintText: 'Name'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Lodha/PMC Part', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                    const SizedBox(height: 16),
                    MadTextarea(controller: _commentsController, labelText: 'Comments', hintText: 'Comments...', minLines: 3),
                    const SizedBox(height: 16),
                    MadSelect<String>(labelText: 'Result Code', value: _resultCode, placeholder: 'Select result', options: _resultCodeOptions, onChanged: (v) => setState(() => _resultCode = v)),
                    const SizedBox(height: 16),
                    MadInput(controller: _engineerNameController, labelText: 'Engineer/Manager Civil - Name', hintText: 'Name'),
                    const SizedBox(height: 16),
                    MadInput(controller: _engineerSignatureController, labelText: 'Engineer/Manager Civil - Signature', hintText: 'Signature/url'),
                    const SizedBox(height: 16),
                    MadInput(controller: _engineerDateController, labelText: 'Date', hintText: 'Date'),
                    const SizedBox(height: 16),
                    MadInput(controller: _engineerMepNameController, labelText: 'Engineer/Manager MEP - Name', hintText: 'Name'),
                    const SizedBox(height: 16),
                    MadInput(controller: _engineerMepSignatureController, labelText: 'Engineer/Manager MEP - Signature', hintText: 'Signature/url'),
                    const SizedBox(height: 16),
                    MadInput(controller: _engineerMepDateController, labelText: 'Engineer/Manager MEP - Date', hintText: 'Date'),
                    const SizedBox(height: 16),
                    MadInput(controller: _towerInchargeNameController, labelText: 'Tower Incharge - Name', hintText: 'Name'),
                    const SizedBox(height: 16),
                    MadInput(controller: _towerInchargeSignatureController, labelText: 'Tower Incharge - Signature', hintText: 'Signature/url'),
                    const SizedBox(height: 16),
                    MadInput(controller: _towerInchargeDateController, labelText: 'Tower Incharge - Date', hintText: 'Date'),
                    const SizedBox(height: 16),
                    MadInput(controller: _qaaDepartmentNameController, labelText: 'QAA Department - Name', hintText: 'Name'),
                    const SizedBox(height: 16),
                    MadInput(controller: _qaaDepartmentSignatureController, labelText: 'QAA Department - Signature', hintText: 'Signature/url'),
                    const SizedBox(height: 16),
                    MadInput(controller: _qaaDepartmentDateController, labelText: 'QAA Department - Date', hintText: 'Date'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            if (isNarrow)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  MadButton(
                    text: 'Save Draft',
                    width: double.infinity,
                    variant: ButtonVariant.outline,
                    icon: LucideIcons.save,
                    onPressed: _saveDraft,
                  ),
                  const SizedBox(height: 10),
                  MadButton(
                    text: 'Preview',
                    width: double.infinity,
                    variant: ButtonVariant.secondary,
                    icon: LucideIcons.eye,
                    onPressed: () => widget.onPreview(_collectData()),
                  ),
                  const SizedBox(height: 10),
                  MadButton(
                    text: 'Submit ITR',
                    width: double.infinity,
                    icon: LucideIcons.send,
                    onPressed: () => widget.onSubmit(_collectData()),
                  ),
                ],
              )
            else
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  MadButton(
                    text: 'Save Draft',
                    variant: ButtonVariant.outline,
                    icon: LucideIcons.save,
                    onPressed: _saveDraft,
                  ),
                  MadButton(
                    text: 'Preview',
                    variant: ButtonVariant.secondary,
                    icon: LucideIcons.eye,
                    onPressed: () => widget.onPreview(_collectData()),
                  ),
                  MadButton(
                    text: 'Submit ITR',
                    icon: LucideIcons.send,
                    onPressed: () => widget.onSubmit(_collectData()),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
