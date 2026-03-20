import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../services/pdf_service.dart';
import '../utils/responsive.dart';

class PurchaseRequestItem {
  String materialDescription;
  String unit;
  String reqQty;
  String make;
  String placeOfUtilisation;

  PurchaseRequestItem({
    this.materialDescription = '',
    this.unit = 'NOS',
    this.reqQty = '',
    this.make = '',
    this.placeOfUtilisation = '',
  });

  factory PurchaseRequestItem.fromJson(Map<String, dynamic> json) {
    return PurchaseRequestItem(
      materialDescription: (json['material_description'] ?? '').toString(),
      unit: (json['unit'] ?? 'NOS').toString(),
      reqQty: (json['req_qty'] ?? '').toString(),
      make: (json['make'] ?? '').toString(),
      placeOfUtilisation: (json['place_of_utilisation'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'material_description': materialDescription,
      'unit': unit,
      'req_qty': reqQty,
      'make': make,
      'place_of_utilisation': placeOfUtilisation,
    };
  }
}

class PurchaseRequest {
  final String id;
  final String projectId;
  final String projectName;
  final String? sampleId;
  final String workorderNo;
  final String location;
  final String mirNo;
  final String urgency;
  final String? date;
  final String approvedBy;
  final String remarks;
  final String prFilePath;
  final String signatureFilePath;
  final List<PurchaseRequestItem> items;

  const PurchaseRequest({
    required this.id,
    required this.projectId,
    required this.projectName,
    required this.sampleId,
    required this.workorderNo,
    required this.location,
    required this.mirNo,
    required this.urgency,
    required this.date,
    required this.approvedBy,
    required this.remarks,
    required this.prFilePath,
    required this.signatureFilePath,
    required this.items,
  });

  factory PurchaseRequest.fromJson(Map<String, dynamic> json) {
    final itemsRaw = json['items'];
    final List<PurchaseRequestItem> parsedItems = itemsRaw is List
        ? itemsRaw
              .whereType<Map>()
              .map(
                (e) =>
                    PurchaseRequestItem.fromJson(Map<String, dynamic>.from(e)),
              )
              .toList()
        : const [];

    return PurchaseRequest(
      id: (json['pr_id'] ?? json['id'] ?? '').toString(),
      projectId: (json['project_id'] ?? json['projectId'] ?? '').toString(),
      sampleId: json['sample_id']?.toString(),
      projectName: (json['project_name'] ?? '-').toString(),
      workorderNo: (json['workorder_no'] ?? '-').toString(),
      location: (json['location'] ?? '-').toString(),
      mirNo: (json['mirno'] ?? '').toString(),
      urgency: (json['urgency'] ?? 'Medium').toString(),
      date: (json['date'] ?? json['created_at'])?.toString(),
      approvedBy: (json['approved_by'] ?? '-').toString(),
      remarks: (json['remarks'] ?? '').toString(),
      prFilePath: (json['pr_file_path'] ?? '').toString(),
      signatureFilePath: (json['signature_file_path'] ?? '').toString(),
      items: parsedItems,
    );
  }
}

String _formatPrNumber(PurchaseRequest pr) {
  final sourceDate = pr.date ?? DateTime.now().toIso8601String();
  final parsed = DateTime.tryParse(sourceDate);
  final datePart = parsed == null
      ? '0000-00-00'
      : '${parsed.year.toString().padLeft(4, '0')}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
  final sequence = pr.id.isEmpty ? '0' : pr.id;
  final project = pr.projectId.isEmpty ? '0' : pr.projectId;
  return 'PR-$datePart-$sequence-$project';
}

int? _parsePositiveIntOrNull(String value) {
  final parsed = int.tryParse(value.trim());
  if (parsed == null || parsed <= 0) return null;
  return parsed;
}

class _PRWizardItem extends PurchaseRequestItem {
  _PRWizardItem()
    : super(
        materialDescription: '',
        unit: 'NOS',
        reqQty: '',
        make: '',
        placeOfUtilisation: '',
      );
}

/// One editable row for Items step in PR wizard
class _PRItemRow extends StatefulWidget {
  final _PRWizardItem item;
  final int index;
  final bool canRemove;
  final VoidCallback onRemove;

  const _PRItemRow({
    super.key,
    required this.item,
    required this.index,
    required this.canRemove,
    required this.onRemove,
  });

  @override
  State<_PRItemRow> createState() => _PRItemRowState();
}

class _PRItemRowState extends State<_PRItemRow> {
  late TextEditingController _materialController;
  late TextEditingController _qtyController;
  late TextEditingController _makeController;
  late TextEditingController _placeController;

  @override
  void initState() {
    super.initState();
    _materialController = TextEditingController(
      text: widget.item.materialDescription,
    );
    _qtyController = TextEditingController(text: widget.item.reqQty);
    _makeController = TextEditingController(text: widget.item.make);
    _placeController = TextEditingController(
      text: widget.item.placeOfUtilisation,
    );
  }

  @override
  void dispose() {
    _materialController.dispose();
    _qtyController.dispose();
    _makeController.dispose();
    _placeController.dispose();
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
                Text(
                  'Item ${widget.index + 1}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.trash2, size: 18),
                  onPressed: widget.canRemove ? widget.onRemove : null,
                ),
              ],
            ),
            const SizedBox(height: 12),
            MadInput(
              labelText: 'Material Description',
              hintText: 'Material',
              controller: _materialController,
              onChanged: (v) => item.materialDescription = v,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MadInput(
                    labelText: 'Req Qty',
                    hintText: '0',
                    keyboardType: TextInputType.number,
                    controller: _qtyController,
                    onChanged: (v) => item.reqQty = v,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MadSelect<String>(
                    labelText: 'Unit',
                    placeholder: 'Unit',
                    value: item.unit,
                    options: const [
                      MadSelectOption(value: 'NOS', label: 'NOS'),
                      MadSelectOption(value: 'MTR', label: 'MTR'),
                      MadSelectOption(value: 'KG', label: 'KG'),
                      MadSelectOption(value: 'LTR', label: 'LTR'),
                    ],
                    onChanged: (v) => setState(() => item.unit = v ?? 'NOS'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            MadInput(
              labelText: 'Make',
              hintText: 'Make',
              controller: _makeController,
              onChanged: (v) => item.make = v,
            ),
            const SizedBox(height: 12),
            MadInput(
              labelText: 'Place of Utilisation',
              hintText: 'Place of utilisation',
              controller: _placeController,
              onChanged: (v) => item.placeOfUtilisation = v,
            ),
          ],
        ),
      ),
    );
  }
}

/// Purchase Requests page matching React's PurchaseRequests page.
class PurchaseRequestsPageFull extends StatefulWidget {
  const PurchaseRequestsPageFull({super.key});

  @override
  State<PurchaseRequestsPageFull> createState() =>
      _PurchaseRequestsPageFullState();
}

class _PurchaseRequestsPageFullState extends State<PurchaseRequestsPageFull> {
  bool _isLoading = false;
  List<PurchaseRequest> _requests = [];
  String? _error;
  String _searchQuery = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;
  final _searchController = TextEditingController();
  String _urgencyFilter = 'all';
  String _sampleFilter = '';
  final _sampleController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadRequests();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _sampleController.dispose();
    super.dispose();
  }

  Future<void> _loadRequests() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final store = StoreProvider.of<AppState>(context);
      final selectedProjectId = store
          .state
          .project
          .selectedProject?['project_id']
          ?.toString();

      Map<String, dynamic> result;
      final sampleId = _sampleFilter.trim();
      if (sampleId.isNotEmpty) {
        result = await ApiClient.getPrsBySample(sampleId);
      } else if (selectedProjectId != null && selectedProjectId.isNotEmpty) {
        result = await ApiClient.getPrsByProject(selectedProjectId);
      } else {
        result = await ApiClient.getPrs();
      }

      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final List<dynamic> list = data is List ? data : const [];
        setState(() {
          _requests = list
              .whereType<Map>()
              .map(
                (e) => PurchaseRequest.fromJson(Map<String, dynamic>.from(e)),
              )
              .toList();
          _isLoading = false;
          _error = null;
        });
        return;
      }

      setState(() {
        _requests = [];
        _isLoading = false;
        _error = (result['error'] ?? 'Unable to fetch purchase requests')
            .toString();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _requests = [];
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  List<PurchaseRequest> get _filteredRequests {
    List<PurchaseRequest> result = _requests;

    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result.where((r) {
        return _formatPrNumber(r).toLowerCase().contains(query) ||
            r.projectId.toLowerCase().contains(query) ||
            r.projectName.toLowerCase().contains(query) ||
            r.workorderNo.toLowerCase().contains(query) ||
            r.location.toLowerCase().contains(query) ||
            r.mirNo.toLowerCase().contains(query) ||
            r.urgency.toLowerCase().contains(query) ||
            (r.sampleId?.toLowerCase().contains(query) ?? false);
      }).toList();
    }

    if (_urgencyFilter != 'all') {
      result = result
          .where((r) => r.urgency.toLowerCase() == _urgencyFilter)
          .toList();
    }

    return result;
  }

  List<PurchaseRequest> get _paginatedRequests {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final filtered = _filteredRequests;
    if (start >= filtered.length) return [];
    return filtered.sublist(
      start,
      end > filtered.length ? filtered.length : end,
    );
  }

  int get _totalPages => (_filteredRequests.length / _itemsPerPage).ceil();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Purchase Requests',
      route: '/purchase-requests',
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
                      'Purchase Requests',
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
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Manage material purchase requests',
                      style: TextStyle(
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isMobile)
                MadButton(
                  text: 'New Request',
                  icon: LucideIcons.plus,
                  onPressed: () async {
                    final result = await Navigator.of(
                      context,
                    ).pushNamed('/purchase-requests/create');
                    if (!mounted) return;
                    if (result == true) {
                      _loadRequests();
                    }
                  },
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
                    title: 'Total PRs',
                    value: _requests.length.toString(),
                    icon: LucideIcons.fileText,
                    iconColor: AppTheme.primaryColor,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'High Urgency',
                    value: _requests
                        .where((r) => r.urgency == 'High')
                        .length
                        .toString(),
                    icon: LucideIcons.flame,
                    iconColor: const Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Total Items',
                    value: _requests
                        .fold<int>(0, (sum, r) => sum + r.items.length)
                        .toString(),
                    icon: LucideIcons.list,
                    iconColor: const Color(0xFF3B82F6),
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
                  hintText: 'Search requests...',
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
                width: isMobile ? double.infinity : 180,
                child: MadSelect<String>(
                  value: _urgencyFilter,
                  placeholder: 'Urgency',
                  options: const [
                    MadSelectOption(value: 'all', label: 'All Urgency'),
                    MadSelectOption(value: 'high', label: 'High'),
                    MadSelectOption(value: 'medium', label: 'Medium'),
                    MadSelectOption(value: 'low', label: 'Low'),
                  ],
                  onChanged: (value) => setState(() {
                    _urgencyFilter = value ?? 'all';
                    _currentPage = 1;
                  }),
                ),
              ),
              SizedBox(
                width: isMobile ? double.infinity : 180,
                child: MadInput(
                  controller: _sampleController,
                  labelText: 'Sample ID',
                  hintText: 'Optional',
                  onChanged: (value) => setState(() {
                    _sampleFilter = value;
                  }),
                ),
              ),
              if (isMobile)
                MadButton(
                  icon: LucideIcons.plus,
                  text: 'New',
                  onPressed: () async {
                    final result = await Navigator.of(
                      context,
                    ).pushNamed('/purchase-requests/create');
                    if (!mounted) return;
                    if (result == true) {
                      _loadRequests();
                    }
                  },
                ),
              MadButton(
                icon: LucideIcons.refreshCw,
                text: isMobile ? 'Refresh' : 'Refresh',
                variant: ButtonVariant.outline,
                onPressed: _loadRequests,
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
                : _filteredRequests.isEmpty
                ? _buildEmptyState(isDark)
                : isMobile
                ? ListView.separated(
                    itemCount: _paginatedRequests.length,
                    padding: const EdgeInsets.only(bottom: 12),
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) =>
                        _buildRequestCard(_paginatedRequests[index], isDark),
                  )
                : MadCard(
                    child: Column(
                      children: [
                        // Table header
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color:
                                (isDark
                                        ? AppTheme.darkMuted
                                        : AppTheme.lightMuted)
                                    .withOpacity(0.3),
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(12),
                            ),
                          ),
                          child: Row(
                            children: [
                              _buildHeaderCell('PR', flex: 2, isDark: isDark),
                              _buildHeaderCell(
                                'Project',
                                flex: 2,
                                isDark: isDark,
                              ),
                              if (!isMobile) ...[
                                _buildHeaderCell('WO', flex: 1, isDark: isDark),
                                _buildHeaderCell(
                                  'Date',
                                  flex: 1,
                                  isDark: isDark,
                                ),
                                _buildHeaderCell(
                                  'Urgency',
                                  flex: 1,
                                  isDark: isDark,
                                ),
                                _buildHeaderCell(
                                  'Items',
                                  flex: 1,
                                  isDark: isDark,
                                ),
                                _buildHeaderCell(
                                  'Files',
                                  flex: 1,
                                  isDark: isDark,
                                ),
                              ],
                              const SizedBox(width: 48),
                            ],
                          ),
                        ),
                        // Table rows
                        Expanded(
                          child: ListView.separated(
                            itemCount: _paginatedRequests.length,
                            separatorBuilder: (_, __) => Divider(
                              height: 1,
                              color:
                                  (isDark
                                          ? AppTheme.darkBorder
                                          : AppTheme.lightBorder)
                                      .withOpacity(0.5),
                            ),
                            itemBuilder: (context, index) {
                              return _buildTableRow(
                                _paginatedRequests[index],
                                isDark,
                                isMobile,
                              );
                            },
                          ),
                        ),
                        // Pagination
                        if (_totalPages > 1) _buildPagination(isDark),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCell(
    String text, {
    required int flex,
    required bool isDark,
  }) {
    return Expanded(
      flex: flex,
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isDark
              ? AppTheme.darkMutedForeground
              : AppTheme.lightMutedForeground,
        ),
      ),
    );
  }

  Widget _buildTableRow(PurchaseRequest request, bool isDark, bool isMobile) {
    BadgeVariant urgencyVariant;
    switch (request.urgency) {
      case 'High':
        urgencyVariant = BadgeVariant.destructive;
        break;
      case 'Medium':
        urgencyVariant = BadgeVariant.warning;
        break;
      case 'Low':
        urgencyVariant = BadgeVariant.primary;
        break;
      default:
        urgencyVariant = BadgeVariant.outline;
    }

    final dateLabel = request.date == null || request.date!.isEmpty
        ? '-'
        : (DateTime.tryParse(request.date!) != null
              ? DateFormat('yyyy-MM-dd').format(DateTime.parse(request.date!))
              : request.date!);
    final filesLabel = [
      if (request.prFilePath.isNotEmpty) 'PR',
      if (request.signatureFilePath.isNotEmpty) 'SIG',
    ].join(' ');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              _formatPrNumber(request),
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontFamily: 'monospace',
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.projectName,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
                if (isMobile)
                  Text(
                    request.workorderNo,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                  ),
              ],
            ),
          ),
          if (!isMobile) ...[
            Expanded(
              flex: 1,
              child: Text(request.workorderNo, overflow: TextOverflow.ellipsis),
            ),
            Expanded(
              flex: 1,
              child: Text(dateLabel, overflow: TextOverflow.ellipsis),
            ),
            Expanded(
              flex: 1,
              child: MadBadge(text: request.urgency, variant: urgencyVariant),
            ),
            Expanded(
              flex: 1,
              child: Text(
                request.items.length.toString(),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Expanded(
              flex: 1,
              child: Text(
                filesLabel.isEmpty ? '-' : filesLabel,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
          MadDropdownMenuButton(
            items: [
              MadMenuItem(
                label: 'View Details',
                icon: LucideIcons.eye,
                onTap: () => _showDetailsDialog(request),
              ),
              MadMenuItem(
                label: 'Edit',
                icon: LucideIcons.pencil,
                onTap: () => _showRequestDialog(existing: request),
              ),
              MadMenuItem(
                label: 'Email',
                icon: LucideIcons.mail,
                onTap: () => _openEmailDialog(request),
              ),
              MadMenuItem(
                label: 'Delete',
                icon: LucideIcons.trash2,
                destructive: true,
                onTap: () => _deleteRequest(request),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRequestCard(PurchaseRequest request, bool isDark) {
    final dateLabel = request.date == null || request.date!.isEmpty
        ? '-'
        : (DateTime.tryParse(request.date!) != null
              ? DateFormat('dd MMM yyyy').format(DateTime.parse(request.date!))
              : request.date!);
    final files = <String>[
      if (request.prFilePath.isNotEmpty) 'PR File',
      if (request.signatureFilePath.isNotEmpty) 'Signature',
    ];

    BadgeVariant urgencyVariant;
    switch (request.urgency) {
      case 'High':
        urgencyVariant = BadgeVariant.destructive;
        break;
      case 'Medium':
        urgencyVariant = BadgeVariant.warning;
        break;
      case 'Low':
        urgencyVariant = BadgeVariant.primary;
        break;
      default:
        urgencyVariant = BadgeVariant.outline;
    }

    final cardBorder = isDark ? AppTheme.darkBorder : AppTheme.lightBorder;
    final muted = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;

    return MadCard(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
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
                        _formatPrNumber(request),
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          fontFamily: 'monospace',
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        request.projectName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                      if ((request.sampleId ?? '').isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Sample #${request.sampleId}',
                          style: TextStyle(color: muted, fontSize: 12),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    MadBadge(text: request.urgency, variant: urgencyVariant),
                    const SizedBox(height: 4),
                    MadDropdownMenuButton(
                      items: [
                        MadMenuItem(
                          label: 'View Details',
                          icon: LucideIcons.eye,
                          onTap: () => _showDetailsDialog(request),
                        ),
                        MadMenuItem(
                          label: 'Edit',
                          icon: LucideIcons.pencil,
                          onTap: () => _showRequestDialog(existing: request),
                        ),
                        MadMenuItem(
                          label: 'Email',
                          icon: LucideIcons.mail,
                          onTap: () => _openEmailDialog(request),
                        ),
                        MadMenuItem(
                          label: 'Delete',
                          icon: LucideIcons.trash2,
                          destructive: true,
                          onTap: () => _deleteRequest(request),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: cardBorder.withOpacity(0.6)),
                color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                    .withOpacity(0.25),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(LucideIcons.briefcase, size: 14),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          request.workorderNo.isEmpty
                              ? '-'
                              : request.workorderNo,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Icon(LucideIcons.calendarDays, size: 14),
                      const SizedBox(width: 6),
                      Text(
                        dateLabel,
                        style: TextStyle(fontSize: 13, color: muted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(LucideIcons.mapPin, size: 14),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          request.location.isEmpty ? '-' : request.location,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13, color: muted),
                        ),
                      ),
                    ],
                  ),
                  if (request.mirNo.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(LucideIcons.hash, size: 14),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'MIR: ${request.mirNo}',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 13, color: muted),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                MadBadge(
                  text:
                      '${request.items.length} item${request.items.length == 1 ? '' : 's'}',
                  variant: BadgeVariant.outline,
                ),
                if (files.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      files.join(' • '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: muted, fontSize: 12),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPagination(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                .withOpacity(0.5),
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Showing ${(_currentPage - 1) * _itemsPerPage + 1}-${_currentPage * _itemsPerPage > _filteredRequests.length ? _filteredRequests.length : _currentPage * _itemsPerPage} of ${_filteredRequests.length}',
            style: TextStyle(
              fontSize: 13,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
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
              LucideIcons.fileText,
              size: 64,
              color:
                  (isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground)
                      .withOpacity(0.3),
            ),
            const SizedBox(height: 24),
            Text(
              _searchQuery.isEmpty
                  ? 'No purchase requests yet'
                  : 'No requests found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchQuery.isEmpty
                  ? 'Create a purchase request to get started'
                  : 'Try a different search term',
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            if (_searchQuery.isEmpty) ...[
              const SizedBox(height: 24),
              MadButton(
                text: 'New Request',
                icon: LucideIcons.plus,
                onPressed: () async {
                  final result = await Navigator.of(
                    context,
                  ).pushNamed('/purchase-requests/create');
                  if (!mounted) return;
                  if (result == true) {
                    _loadRequests();
                  }
                },
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
              'Failed to load purchase requests',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            MadButton(
              text: 'Retry',
              icon: LucideIcons.refreshCw,
              onPressed: _loadRequests,
            ),
          ],
        ),
      ),
    );
  }

  void _showRequestDialog({PurchaseRequest? existing}) {
    MadFormDialog.show(
      context: context,
      title: existing == null
          ? 'New Purchase Request'
          : 'Edit Purchase Request',
      maxWidth: 760,
      content: _PurchaseRequestFormContent(
        existing: existing,
        onSaved: () {
          Navigator.of(context).pop();
          _loadRequests();
        },
        onCancel: () => Navigator.of(context).pop(),
      ),
      actions: const [],
    );
  }

  void _showDetailsDialog(PurchaseRequest pr) {
    MadDialog.show(
      context: context,
      title: 'Purchase Request',
      description: _formatPrNumber(pr),
      content: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _detailRow('Project', '${pr.projectId} - ${pr.projectName}'),
            _detailRow(
              'Sample ID',
              pr.sampleId?.isNotEmpty == true ? pr.sampleId! : '-',
            ),
            _detailRow('Work Order', pr.workorderNo),
            _detailRow('Location', pr.location),
            _detailRow('MIR No', pr.mirNo.isEmpty ? '-' : pr.mirNo),
            _detailRow('Urgency', pr.urgency),
            _detailRow('Date', pr.date ?? '-'),
            _detailRow('Approved By', pr.approvedBy),
            _detailRow('PR File', pr.prFilePath.isEmpty ? '-' : pr.prFilePath),
            _detailRow(
              'Signature File',
              pr.signatureFilePath.isEmpty ? '-' : pr.signatureFilePath,
            ),
            _detailRow('Remarks', pr.remarks.isEmpty ? '-' : pr.remarks),
            const SizedBox(height: 16),
            Text(
              'Items (${pr.items.length})',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            if (pr.items.isEmpty)
              Text(
                '-',
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                ),
              )
            else
              ...pr.items.map((item) {
                final qtyLabel = item.reqQty.isEmpty
                    ? ''
                    : ' (${item.reqQty} ${item.unit})';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '${item.materialDescription.isEmpty ? '-' : item.materialDescription}$qtyLabel',
                  ),
                );
              }),
          ],
        ),
      ),
      actions: [
        MadButton(text: 'Close', onPressed: () => Navigator.of(context).pop()),
      ],
    );
  }

  Future<void> _openAttachment(String path) async {
    if (path.isEmpty) return;
    final uri = Uri.parse(
      path.startsWith('http') ? path : ApiClient.getApiFileUrl(path),
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

  void _openEmailDialog(PurchaseRequest pr) {
    showDialog(
      context: context,
      builder: (context) => _PurchaseRequestEmailDialog(pr: pr),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteRequest(PurchaseRequest pr) async {
    final ok = await MadDialog.confirm(
      context: context,
      title: 'Delete purchase request?',
      description: _formatPrNumber(pr),
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    );
    if (!ok) return;

    setState(() => _isLoading = true);
    try {
      final id = pr.id;
      if (id.isEmpty) {
        setState(() => _isLoading = false);
        return;
      }
      final result = await ApiClient.deletePr(id);
      if (!mounted) return;
      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Purchase request deleted')),
        );
        await _loadRequests();
        return;
      }
      setState(() => _isLoading = false);
      MadDialog.alert(
        context: context,
        title: 'Delete failed',
        description: (result['error'] ?? 'Unable to delete purchase request')
            .toString(),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      MadDialog.alert(
        context: context,
        title: 'Delete failed',
        description: e.toString(),
      );
    }
  }
}

class _PurchaseRequestFormContent extends StatefulWidget {
  final PurchaseRequest? existing;
  final VoidCallback onSaved;
  final VoidCallback onCancel;

  const _PurchaseRequestFormContent({
    required this.existing,
    required this.onSaved,
    required this.onCancel,
  });

  @override
  State<_PurchaseRequestFormContent> createState() =>
      _PurchaseRequestFormContentState();
}

class _PurchaseRequestFormContentState
    extends State<_PurchaseRequestFormContent> {
  int _step = 0;
  bool _submitting = false;
  bool _uploadingPr = false;
  bool _uploadingSig = false;
  bool _appliedProjectDefaults = false;

  late final TextEditingController _projectIdController;
  late final TextEditingController _projectNameController;
  late final TextEditingController _sampleIdController;
  late final TextEditingController _workorderController;
  late final TextEditingController _locationController;
  late final TextEditingController _mirNoController;
  late final TextEditingController _approvedByController;
  late final TextEditingController _remarksController;
  late final TextEditingController _dateController;

  String _urgency = 'Medium';
  String _prFilePath = '';
  String _signatureFilePath = '';
  String? _prFileName;
  String? _signatureFileName;
  final List<_PRWizardItem> _items = [];

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;

    _projectIdController = TextEditingController(
      text: existing?.projectId ?? '',
    );
    _projectNameController = TextEditingController(
      text: existing?.projectName ?? '',
    );
    _sampleIdController = TextEditingController(text: existing?.sampleId ?? '');
    _workorderController = TextEditingController(
      text: existing?.workorderNo ?? '',
    );
    _locationController = TextEditingController(text: existing?.location ?? '');
    _mirNoController = TextEditingController(text: existing?.mirNo ?? '');
    _approvedByController = TextEditingController(
      text: existing?.approvedBy ?? '',
    );
    _remarksController = TextEditingController(text: existing?.remarks ?? '');
    _dateController = TextEditingController(
      text: existing?.date?.isNotEmpty == true
          ? existing!.date!
          : DateFormat('yyyy-MM-dd').format(DateTime.now()),
    );
    _urgency = existing?.urgency ?? 'Medium';
    _prFilePath = existing?.prFilePath ?? '';
    _signatureFilePath = existing?.signatureFilePath ?? '';
    _prFileName = _fileNameFromPath(_prFilePath);
    _signatureFileName = _fileNameFromPath(_signatureFilePath);
    final existingItems = existing?.items ?? const [];
    if (existingItems.isNotEmpty) {
      _items.addAll(
        existingItems.map((i) {
          final item = _PRWizardItem();
          item.materialDescription = i.materialDescription;
          item.unit = i.unit;
          item.reqQty = i.reqQty;
          item.make = i.make;
          item.placeOfUtilisation = i.placeOfUtilisation;
          return item;
        }),
      );
    } else {
      _items.add(_PRWizardItem());
    }
    _appliedProjectDefaults = existing != null;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_appliedProjectDefaults) return;
    final store = StoreProvider.of<AppState>(context);
    final selectedProject = store.state.project.selectedProject;
    final defaultProjectId = selectedProject?['project_id']?.toString() ?? '';
    final defaultProjectName =
        selectedProject?['project_name']?.toString() ?? '';

    if (_projectIdController.text.trim().isEmpty &&
        defaultProjectId.isNotEmpty) {
      _projectIdController.text = defaultProjectId;
    }
    if (_projectNameController.text.trim().isEmpty &&
        defaultProjectName.isNotEmpty) {
      _projectNameController.text = defaultProjectName;
    }
    _appliedProjectDefaults = true;
  }

  @override
  void dispose() {
    _projectIdController.dispose();
    _projectNameController.dispose();
    _sampleIdController.dispose();
    _workorderController.dispose();
    _locationController.dispose();
    _mirNoController.dispose();
    _approvedByController.dispose();
    _remarksController.dispose();
    _dateController.dispose();
    super.dispose();
  }

  String? _fileNameFromPath(String path) {
    if (path.isEmpty) return null;
    return path.split(RegExp(r'[/\\]')).last;
  }

  Future<void> _pickDate() async {
    final current = DateTime.tryParse(_dateController.text) ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime(2035),
    );
    if (date != null) {
      setState(
        () => _dateController.text = DateFormat('yyyy-MM-dd').format(date),
      );
    }
  }

  String _extractUploadedPath(dynamic data) {
    if (data is String) return data;
    if (data is Map) {
      final candidates = [
        data['file_path'],
        data['filePath'],
        data['path'],
        data['url'],
        data['location'],
      ];
      for (final c in candidates) {
        final v = c?.toString() ?? '';
        if (v.isNotEmpty) return v;
      }
    }
    return '';
  }

  Future<void> _uploadPrFile() async {
    final file = await FileService.pickFileWithSource(
      context: context,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'xls'],
    );
    if (file == null) return;
    setState(() {
      _uploadingPr = true;
      _prFileName = file.path.split(RegExp(r'[/\\]')).last;
    });
    final result = await ApiClient.uploadPrFile(file);
    if (!mounted) return;
    if (result['success'] == true) {
      final path = _extractUploadedPath(result['data']);
      setState(() {
        _prFilePath = path;
        _uploadingPr = false;
      });
      return;
    }
    setState(() => _uploadingPr = false);
    MadDialog.alert(
      context: context,
      title: 'Upload failed',
      description: (result['error'] ?? 'Unable to upload file').toString(),
    );
  }

  Future<void> _uploadSignatureFile() async {
    final file = await FileService.pickFileWithSource(
      context: context,
      allowedExtensions: const ['png', 'jpg', 'jpeg', 'pdf'],
    );
    if (file == null) return;
    setState(() {
      _uploadingSig = true;
      _signatureFileName = file.path.split(RegExp(r'[/\\]')).last;
    });
    final result = await ApiClient.uploadPrSignature(file);
    if (!mounted) return;
    if (result['success'] == true) {
      final path = _extractUploadedPath(result['data']);
      setState(() {
        _signatureFilePath = path;
        _uploadingSig = false;
      });
      return;
    }
    setState(() => _uploadingSig = false);
    MadDialog.alert(
      context: context,
      title: 'Upload failed',
      description: (result['error'] ?? 'Unable to upload signature').toString(),
    );
  }

  Map<String, dynamic> _buildPayload() {
    final projectIdStr = _projectIdController.text.trim();
    final sampleIdStr = _sampleIdController.text.trim();
    final projectIdInt = _parsePositiveIntOrNull(projectIdStr);
    final sampleIdInt = _parsePositiveIntOrNull(sampleIdStr);
    return {
      'project_id': projectIdInt ?? projectIdStr,
      'sample_id': sampleIdInt ?? (sampleIdStr.isEmpty ? null : sampleIdStr),
      'project_name': _projectNameController.text.trim(),
      'workorder_no': _workorderController.text.trim(),
      'location': _locationController.text.trim(),
      'mirno': _mirNoController.text.trim(),
      'urgency': _urgency,
      'date': _dateController.text.trim(),
      'approved_by': _approvedByController.text.trim(),
      'remarks': _remarksController.text.trim(),
      'pr_file_path': _prFilePath,
      'signature_file_path': _signatureFilePath,
      'items': _items.map((i) => i.toJson()).toList(),
    };
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final projectId = _projectIdController.text.trim();
    final projectName = _projectNameController.text.trim();
    if (projectId.isEmpty || projectName.isEmpty) {
      MadDialog.alert(
        context: context,
        title: 'Missing fields',
        description: 'Project ID and Project Name are required.',
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final payload = _buildPayload();
      final existingId = widget.existing?.id ?? '';
      final result = existingId.isNotEmpty
          ? await ApiClient.updatePr(existingId, payload)
          : await ApiClient.createPr(payload);
      if (!mounted) return;
      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              existingId.isNotEmpty
                  ? 'Purchase request updated'
                  : 'Purchase request created',
            ),
          ),
        );
        widget.onSaved();
        return;
      }
      setState(() => _submitting = false);
      MadDialog.alert(
        context: context,
        title: existingId.isNotEmpty ? 'Update failed' : 'Create failed',
        description: (result['error'] ?? 'Unable to save purchase request')
            .toString(),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      MadDialog.alert(
        context: context,
        title: 'Save failed',
        description: e.toString(),
      );
    }
  }

  Widget _stepChip(int step, String label, bool isDark) {
    final active = _step == step;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: active
            ? AppTheme.primaryColor
            : (isDark ? AppTheme.darkMuted : AppTheme.lightMuted),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: active ? FontWeight.w600 : FontWeight.w500,
          color: active
              ? Colors.white
              : (isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground),
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        _stepChip(0, 'Header', isDark),
        const SizedBox(width: 8),
        _stepChip(1, 'Items', isDark),
        const SizedBox(width: 8),
        _stepChip(2, 'Files', isDark),
      ],
    );
  }

  Widget _buildHeaderStep() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: MadInput(
                controller: _projectIdController,
                labelText: 'Project ID *',
                hintText: 'e.g. 5',
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MadInput(
                controller: _projectNameController,
                labelText: 'Project Name *',
                hintText: 'Project name',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MadInput(
                controller: _sampleIdController,
                labelText: 'Sample ID',
                hintText: 'Optional',
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MadSelect<String>(
                labelText: 'Urgency',
                value: _urgency,
                placeholder: 'Select urgency',
                options: const [
                  MadSelectOption(value: 'High', label: 'High'),
                  MadSelectOption(value: 'Medium', label: 'Medium'),
                  MadSelectOption(value: 'Low', label: 'Low'),
                ],
                onChanged: (v) => setState(() => _urgency = v ?? 'Medium'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MadInput(
                controller: _workorderController,
                labelText: 'Work Order No',
                hintText: 'WO number',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GestureDetector(
                onTap: _pickDate,
                child: AbsorbPointer(
                  child: MadInput(
                    controller: _dateController,
                    labelText: 'Date',
                    hintText: 'Select date',
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MadInput(
          controller: _locationController,
          labelText: 'Location',
          hintText: 'Location',
        ),
        const SizedBox(height: 12),
        MadInput(
          controller: _mirNoController,
          labelText: 'MIR No',
          hintText: 'MIR reference',
        ),
        const SizedBox(height: 12),
        MadInput(
          controller: _approvedByController,
          labelText: 'Approved By',
          hintText: 'Optional',
        ),
        const SizedBox(height: 12),
        MadTextarea(
          controller: _remarksController,
          labelText: 'Remarks',
          hintText: 'Remarks',
          minLines: 2,
        ),
      ],
    );
  }

  Widget _buildItemsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        ...List.generate(_items.length, (i) {
          final item = _items[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _PRItemRow(
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
          onPressed: () => setState(() => _items.add(_PRWizardItem())),
        ),
      ],
    );
  }

  Widget _buildFilesStep() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;

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
                Text(
                  'Attachments',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppTheme.darkForeground
                        : AppTheme.lightForeground,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: MadButton(
                        text: _uploadingPr ? 'Uploading...' : 'Upload PR File',
                        icon: LucideIcons.upload,
                        variant: ButtonVariant.outline,
                        disabled: _uploadingPr || _submitting,
                        onPressed: _uploadPrFile,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MadButton(
                        text: _uploadingSig
                            ? 'Uploading...'
                            : 'Upload Signature',
                        icon: LucideIcons.upload,
                        variant: ButtonVariant.outline,
                        disabled: _uploadingSig || _submitting,
                        onPressed: _uploadSignatureFile,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'PR File: ${_prFileName ?? '-'}',
                  style: TextStyle(color: muted, fontSize: 12),
                ),
                const SizedBox(height: 6),
                Text(
                  'Signature: ${_signatureFileName ?? '-'}',
                  style: TextStyle(color: muted, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ],
    );
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
            child: _step == 0
                ? _buildHeaderStep()
                : _step == 1
                ? _buildItemsStep()
                : _buildFilesStep(),
          ),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            MadButton(
              text: 'Cancel',
              variant: ButtonVariant.outline,
              disabled: _submitting,
              onPressed: widget.onCancel,
            ),
            const SizedBox(width: 12),
            if (_step > 0)
              MadButton(
                text: 'Back',
                variant: ButtonVariant.outline,
                disabled: _submitting,
                onPressed: () => setState(() => _step--),
              ),
            if (_step > 0) const SizedBox(width: 12),
            if (_step == 2)
              MadButton(
                text: widget.existing != null ? 'Save' : 'Create',
                disabled: _submitting || _uploadingPr || _uploadingSig,
                onPressed: _submit,
              )
            else
              MadButton(
                text: 'Next',
                disabled: _submitting,
                onPressed: () => setState(() => _step++),
              ),
          ],
        ),
      ],
    );
  }
}

class PurchaseRequestCreatePage extends StatefulWidget {
  const PurchaseRequestCreatePage({super.key});

  @override
  State<PurchaseRequestCreatePage> createState() =>
      _PurchaseRequestCreatePageState();
}

class _PurchaseRequestCreatePageState extends State<PurchaseRequestCreatePage> {
  bool _loadingProjects = false;
  bool _loadingSamples = false;
  bool _loadingMirs = false;
  bool _loadingSampleItems = false;
  bool _submitting = false;
  bool _uploadingPr = false;
  bool _uploadingSig = false;

  List<Map<String, dynamic>> _projects = [];
  List<Map<String, dynamic>> _samples = [];
  List<Map<String, dynamic>> _mirs = [];

  String _projectId = '';
  String _sampleId = 'none';
  String _mirNo = 'none';
  String _urgency = 'Medium';

  final TextEditingController _projectNameController = TextEditingController();
  final TextEditingController _workorderController = TextEditingController();
  final TextEditingController _locationController = TextEditingController();
  final TextEditingController _dateController = TextEditingController(
    text: DateFormat('yyyy-MM-dd').format(DateTime.now()),
  );
  final TextEditingController _approvedByController = TextEditingController();
  final TextEditingController _remarksController = TextEditingController();

  String _prFilePath = '';
  String _signatureFilePath = '';
  String? _prFileName;
  String? _signatureFileName;

  final List<_PRWizardItem> _items = [_PRWizardItem()];

  bool _appliedInitialProject = false;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_appliedInitialProject) return;
    final store = StoreProvider.of<AppState>(context);
    final selectedProjectId =
        store.state.project.selectedProject?['project_id']?.toString() ?? '';
    if (_projectId.isEmpty && selectedProjectId.isNotEmpty) {
      _projectId = selectedProjectId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _syncProjectNameFromList();
        _loadSamplesAndMirs();
      });
    }
    _appliedInitialProject = true;
  }

  @override
  void dispose() {
    _projectNameController.dispose();
    _workorderController.dispose();
    _locationController.dispose();
    _dateController.dispose();
    _approvedByController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  String _extractUploadedPath(dynamic data) {
    if (data is String) return data;
    if (data is Map) {
      final candidates = [
        data['file_path'],
        data['filePath'],
        data['path'],
        data['url'],
        data['location'],
      ];
      for (final c in candidates) {
        final v = c?.toString() ?? '';
        if (v.isNotEmpty) return v;
      }
    }
    return '';
  }

  Future<void> _loadProjects() async {
    setState(() {
      _loadingProjects = true;
    });
    final result = await ApiClient.getProjects();
    if (!mounted) return;
    if (result['success'] == true) {
      final data = result['data'];
      final list = data is List ? data : const [];
      setState(() {
        _projects = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _loadingProjects = false;
      });
      _syncProjectNameFromList();
      await _loadSamplesAndMirs();
      return;
    }
    setState(() {
      _projects = [];
      _loadingProjects = false;
    });
  }

  void _syncProjectNameFromList() {
    if (_projectId.isEmpty) return;
    final match = _projects.firstWhere(
      (p) =>
          (p['project_id']?.toString() ?? p['id']?.toString() ?? '') ==
          _projectId,
      orElse: () => const {},
    );
    final name = (match['project_name'] ?? match['name'] ?? '')
        .toString()
        .trim();
    if (name.isNotEmpty) {
      _projectNameController.text = name;
    }
  }

  Future<void> _loadSamplesAndMirs() async {
    final projectId = _projectId.trim();
    if (projectId.isEmpty) {
      setState(() {
        _samples = [];
        _mirs = [];
        _sampleId = 'none';
        _mirNo = 'none';
      });
      return;
    }

    setState(() {
      _loadingSamples = true;
      _loadingMirs = true;
    });

    final samplesRes = await ApiClient.getSamplesByProject(projectId);
    final mirsRes = await ApiClient.getMirsByProject(projectId);
    if (!mounted) return;

    final samplesData = samplesRes['success'] == true ? samplesRes['data'] : [];
    final mirsData = mirsRes['success'] == true ? mirsRes['data'] : [];

    final sampleList = samplesData is List ? samplesData : const [];
    final mirList = mirsData is List ? mirsData : const [];

    setState(() {
      _samples = sampleList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      _mirs = mirList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      _loadingSamples = false;
      _loadingMirs = false;
      if (_sampleId != 'none' &&
          !_samples.any(
            (s) => (s['sample_id'] ?? s['id']).toString() == _sampleId,
          )) {
        _sampleId = 'none';
      }
      if (_mirNo != 'none' && !_mirs.any((m) => _mirValue(m) == _mirNo)) {
        _mirNo = 'none';
      }
    });
  }

  String _projectValue(Map<String, dynamic> p) =>
      (p['project_id'] ?? p['id'] ?? '').toString();

  String _projectLabel(Map<String, dynamic> p) {
    final id = _projectValue(p);
    final name = (p['project_name'] ?? p['name'] ?? '').toString();
    if (id.isEmpty) return name.isEmpty ? '-' : name;
    if (name.isEmpty) return '#$id';
    return '#$id - $name';
  }

  String _sampleValue(Map<String, dynamic> s) =>
      (s['sample_id'] ?? s['id'] ?? '').toString();

  String _sampleLabel(Map<String, dynamic> s) {
    final id = _sampleValue(s);
    final label =
        (s['work_done'] ??
                s['site_name'] ??
                s['building_name'] ??
                s['name'] ??
                '')
            .toString();
    if (id.isEmpty) return label.isEmpty ? '-' : label;
    if (label.isEmpty) return '#$id';
    return '#$id - $label';
  }

  String _mirValue(Map<String, dynamic> m) =>
      (m['mir_refrence_no'] ?? m['mir_id'] ?? m['id'] ?? '').toString();

  String _mirLabel(Map<String, dynamic> m) {
    final v = _mirValue(m);
    if (v.isEmpty) return '-';
    return v;
  }

  List<dynamic> _parseArrayField(dynamic value) {
    if (value is List) return value;
    if (value is String) {
      try {
        final parsed = jsonDecode(value);
        if (parsed is List) return parsed;
      } catch (_) {}
    }
    return const [];
  }

  List<_PRWizardItem> _mapSampleItemsToWizardItems(dynamic itemDescription) {
    final parsedItems = _parseArrayField(itemDescription);
    if (parsedItems.isEmpty) return [_PRWizardItem()];

    final mapped = parsedItems
        .whereType<Map>()
        .map((raw) {
          final item = Map<String, dynamic>.from(raw);
          final material =
              (item['material_description'] ??
                      item['description'] ??
                      item['item'] ??
                      item['name'] ??
                      '')
                  .toString()
                  .trim();
          final unit = (item['unit'] ?? item['uom'] ?? item['UOM'] ?? 'NOS')
              .toString()
              .trim();
          final reqQtyRaw =
              item['quantity'] ?? item['qty'] ?? item['req_qty'] ?? '';
          final reqQty = reqQtyRaw.toString().trim();
          final make = (item['make'] ?? item['brand'] ?? '').toString().trim();
          final place = (item['place_of_utilisation'] ?? item['place'] ?? '')
              .toString()
              .trim();

          return _PRWizardItem()
            ..materialDescription = material
            ..unit = unit.isEmpty ? 'NOS' : unit
            ..reqQty = reqQty
            ..make = make
            ..placeOfUtilisation = place;
        })
        .where(
          (item) =>
              item.materialDescription.isNotEmpty || item.reqQty.isNotEmpty,
        )
        .toList();

    return mapped.isNotEmpty ? mapped : [_PRWizardItem()];
  }

  void _applySampleItems(Map<String, dynamic> sample) {
    final mappedItems = _mapSampleItemsToWizardItems(
      sample['item_description'],
    );
    setState(() {
      _items
        ..clear()
        ..addAll(mappedItems);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${mappedItems.length} sample item${mappedItems.length == 1 ? '' : 's'} loaded.',
        ),
      ),
    );
  }

  Future<void> _handleSampleChanged(String? value) async {
    final sampleValue = (value ?? '').trim();
    if (sampleValue.isEmpty) {
      setState(() => _sampleId = 'none');
      return;
    }

    setState(() => _sampleId = sampleValue);

    final selectedSample = _samples.cast<Map<String, dynamic>?>().firstWhere(
      (s) => (s?['sample_id'] ?? s?['id'] ?? '').toString() == sampleValue,
      orElse: () => null,
    );
    if (selectedSample != null &&
        _parseArrayField(selectedSample['item_description']).isNotEmpty) {
      _applySampleItems(selectedSample);
      return;
    }

    setState(() => _loadingSampleItems = true);
    try {
      final result = await ApiClient.getSampleById(sampleValue);
      if (!mounted) return;
      if (result['success'] == true) {
        final sample = Map<String, dynamic>.from(
          (result['data'] as Map?) ?? const {},
        );
        _applySampleItems(sample);
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            (result['error'] ?? 'Failed to load sample items').toString(),
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load sample items')),
      );
    } finally {
      if (mounted) {
        setState(() => _loadingSampleItems = false);
      }
    }
  }

  Future<void> _pickDate() async {
    final current = DateTime.tryParse(_dateController.text) ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime(2035),
    );
    if (date != null) {
      setState(
        () => _dateController.text = DateFormat('yyyy-MM-dd').format(date),
      );
    }
  }

  Future<void> _uploadPrFile() async {
    final file = await FileService.pickFileWithSource(
      context: context,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'xls'],
    );
    if (file == null) return;
    setState(() {
      _uploadingPr = true;
      _prFileName = file.path.split(RegExp(r'[/\\]')).last;
    });
    final result = await ApiClient.uploadPrFile(file);
    if (!mounted) return;
    if (result['success'] == true) {
      setState(() {
        _prFilePath = _extractUploadedPath(result['data']);
        _uploadingPr = false;
      });
      return;
    }
    setState(() => _uploadingPr = false);
    MadDialog.alert(
      context: context,
      title: 'Upload failed',
      description: (result['error'] ?? 'Unable to upload file').toString(),
    );
  }

  Future<void> _uploadSignatureFile() async {
    final file = await FileService.pickFileWithSource(
      context: context,
      allowedExtensions: const ['png', 'jpg', 'jpeg', 'pdf'],
    );
    if (file == null) return;
    setState(() {
      _uploadingSig = true;
      _signatureFileName = file.path.split(RegExp(r'[/\\]')).last;
    });
    final result = await ApiClient.uploadPrSignature(file);
    if (!mounted) return;
    if (result['success'] == true) {
      setState(() {
        _signatureFilePath = _extractUploadedPath(result['data']);
        _uploadingSig = false;
      });
      return;
    }
    setState(() => _uploadingSig = false);
    MadDialog.alert(
      context: context,
      title: 'Upload failed',
      description: (result['error'] ?? 'Unable to upload signature').toString(),
    );
  }

  Map<String, dynamic> _buildPayload() {
    final projectIdInt = _parsePositiveIntOrNull(_projectId);
    final sampleIdStr = _sampleId == 'none' ? '' : _sampleId;
    final sampleIdInt = _parsePositiveIntOrNull(sampleIdStr);
    return {
      'project_id': projectIdInt ?? _projectId,
      'sample_id': sampleIdInt ?? (sampleIdStr.isEmpty ? null : sampleIdStr),
      'project_name': _projectNameController.text.trim(),
      'workorder_no': _workorderController.text.trim(),
      'location': _locationController.text.trim(),
      'mirno': _mirNo == 'none' ? '' : _mirNo,
      'urgency': _urgency,
      'date': _dateController.text.trim(),
      'approved_by': _approvedByController.text.trim(),
      'remarks': _remarksController.text.trim(),
      'pr_file_path': _prFilePath,
      'signature_file_path': _signatureFilePath,
      'items': _items.map((i) => i.toJson()).toList(),
    };
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (_projectId.trim().isEmpty ||
        _projectNameController.text.trim().isEmpty) {
      MadDialog.alert(
        context: context,
        title: 'Missing fields',
        description: 'Project is required.',
      );
      return;
    }
    setState(() => _submitting = true);
    final payload = _buildPayload();
    final result = await ApiClient.createPr(payload);
    if (!mounted) return;
    if (result['success'] == true) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Purchase request created')));
      Navigator.of(context).pop(true);
      return;
    }
    setState(() => _submitting = false);
    MadDialog.alert(
      context: context,
      title: 'Create failed',
      description: (result['error'] ?? 'Unable to create purchase request')
          .toString(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    final projectOptions = _projects
        .map(
          (p) => MadSelectOption<String>(
            value: _projectValue(p),
            label: _projectLabel(p),
          ),
        )
        .where((o) => o.value.isNotEmpty)
        .toList();

    final sampleOptions = _samples
        .map(
          (s) => MadSelectOption<String>(
            value: _sampleValue(s),
            label: _sampleLabel(s),
          ),
        )
        .where((o) => o.value.isNotEmpty)
        .toList();

    final mirOptions = _mirs
        .map(
          (m) =>
              MadSelectOption<String>(value: _mirValue(m), label: _mirLabel(m)),
        )
        .where((o) => o.value.isNotEmpty)
        .toList();

    return ProtectedRoute(
      title: 'Create Purchase Request',
      route: '/purchase-requests/create',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isMobile) ...[
            Text(
              'Create Purchase Request',
              style: TextStyle(
                fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                fontWeight: FontWeight.bold,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: MadButton(
                text: 'Back',
                icon: LucideIcons.arrowLeft,
                variant: ButtonVariant.outline,
                onPressed: () => Navigator.of(context).pop(false),
              ),
            ),
          ] else
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Create Purchase Request',
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
                ),
                const SizedBox(width: 12),
                MadButton(
                  text: 'Back',
                  icon: LucideIcons.arrowLeft,
                  variant: ButtonVariant.outline,
                  onPressed: () => Navigator.of(context).pop(false),
                ),
              ],
            ),
          const SizedBox(height: 16),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'PR Header',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (isMobile) ...[
                            MadSelect<String>(
                              labelText: 'Project ID *',
                              placeholder: _loadingProjects
                                  ? 'Loading...'
                                  : 'Select project',
                              searchable: true,
                              value: _projectId.isEmpty ? null : _projectId,
                              options: projectOptions,
                              onChanged: (v) async {
                                setState(() {
                                  _projectId = v ?? '';
                                  _sampleId = 'none';
                                  _mirNo = 'none';
                                });
                                _syncProjectNameFromList();
                                await _loadSamplesAndMirs();
                              },
                            ),
                            const SizedBox(height: 12),
                            MadInput(
                              controller: _projectNameController,
                              labelText: 'Project Name *',
                              hintText: 'Project name',
                            ),
                          ] else
                            Row(
                              children: [
                                Expanded(
                                  child: MadSelect<String>(
                                    labelText: 'Project ID *',
                                    placeholder: _loadingProjects
                                        ? 'Loading...'
                                        : 'Select project',
                                    searchable: true,
                                    value: _projectId.isEmpty
                                        ? null
                                        : _projectId,
                                    options: projectOptions,
                                    onChanged: (v) async {
                                      setState(() {
                                        _projectId = v ?? '';
                                        _sampleId = 'none';
                                        _mirNo = 'none';
                                      });
                                      _syncProjectNameFromList();
                                      await _loadSamplesAndMirs();
                                    },
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: MadInput(
                                    controller: _projectNameController,
                                    labelText: 'Project Name *',
                                    hintText: 'Project name',
                                  ),
                                ),
                              ],
                            ),
                          const SizedBox(height: 12),
                          if (isMobile) ...[
                            MadSelect<String>(
                              labelText: 'Sample ID',
                              placeholder: _loadingSamples
                                  ? 'Loading...'
                                  : 'Optional',
                              value: _sampleId == 'none' ? null : _sampleId,
                              options: sampleOptions,
                              clearable: true,
                              onChanged: _handleSampleChanged,
                            ),
                            if (_loadingSampleItems) ...[
                              const SizedBox(height: 8),
                              const Text('Loading sample items...'),
                            ],
                            const SizedBox(height: 12),
                            MadSelect<String>(
                              labelText: 'MIR No',
                              placeholder: _loadingMirs
                                  ? 'Loading...'
                                  : 'Optional',
                              value: _mirNo == 'none' ? null : _mirNo,
                              options: mirOptions,
                              clearable: true,
                              onChanged: (v) =>
                                  setState(() => _mirNo = v ?? 'none'),
                            ),
                          ] else
                            Row(
                              children: [
                                Expanded(
                                  child: MadSelect<String>(
                                    labelText: 'Sample ID',
                                    placeholder: _loadingSamples
                                        ? 'Loading...'
                                        : 'Optional',
                                    value: _sampleId == 'none'
                                        ? null
                                        : _sampleId,
                                    options: sampleOptions,
                                    clearable: true,
                                    searchable: true,
                                    onChanged: _handleSampleChanged,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: MadSelect<String>(
                                    labelText: 'MIR No',
                                    placeholder: _loadingMirs
                                        ? 'Loading...'
                                        : 'Optional',
                                    value: _mirNo == 'none' ? null : _mirNo,
                                    options: mirOptions,
                                    clearable: true,
                                    searchable: true,
                                    onChanged: (v) =>
                                        setState(() => _mirNo = v ?? 'none'),
                                  ),
                                ),
                              ],
                            ),
                          const SizedBox(height: 12),
                          if (isMobile) ...[
                            MadInput(
                              controller: _workorderController,
                              labelText: 'Work Order No',
                              hintText: 'WO number',
                            ),
                            const SizedBox(height: 12),
                            GestureDetector(
                              onTap: _pickDate,
                              child: AbsorbPointer(
                                child: MadInput(
                                  controller: _dateController,
                                  labelText: 'Date',
                                  hintText: 'Select date',
                                ),
                              ),
                            ),
                          ] else
                            Row(
                              children: [
                                Expanded(
                                  child: MadInput(
                                    controller: _workorderController,
                                    labelText: 'Work Order No',
                                    hintText: 'WO number',
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: GestureDetector(
                                    onTap: _pickDate,
                                    child: AbsorbPointer(
                                      child: MadInput(
                                        controller: _dateController,
                                        labelText: 'Date',
                                        hintText: 'Select date',
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          const SizedBox(height: 12),
                          MadInput(
                            controller: _locationController,
                            labelText: 'Location',
                            hintText: 'Location',
                          ),
                          const SizedBox(height: 12),
                          MadSelect<String>(
                            labelText: 'Urgency',
                            value: _urgency,
                            placeholder: 'Select urgency',
                            options: const [
                              MadSelectOption(value: 'High', label: 'High'),
                              MadSelectOption(value: 'Medium', label: 'Medium'),
                              MadSelectOption(value: 'Low', label: 'Low'),
                            ],
                            onChanged: (v) =>
                                setState(() => _urgency = v ?? 'Medium'),
                          ),
                          const SizedBox(height: 12),
                          MadInput(
                            controller: _approvedByController,
                            labelText: 'Approved By',
                            hintText: 'Optional',
                          ),
                          const SizedBox(height: 12),
                          MadTextarea(
                            controller: _remarksController,
                            labelText: 'Remarks',
                            hintText: 'Remarks',
                            minLines: 3,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Attachments',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: MadButton(
                                  text: _uploadingPr
                                      ? 'Uploading...'
                                      : 'Upload PR File',
                                  icon: LucideIcons.upload,
                                  variant: ButtonVariant.outline,
                                  disabled: _uploadingPr || _submitting,
                                  onPressed: _uploadPrFile,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: MadButton(
                                  text: _uploadingSig
                                      ? 'Uploading...'
                                      : 'Upload Signature',
                                  icon: LucideIcons.upload,
                                  variant: ButtonVariant.outline,
                                  disabled: _uploadingSig || _submitting,
                                  onPressed: _uploadSignatureFile,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'PR File: ${_prFileName ?? '-'}',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Signature: ${_signatureFileName ?? '-'}',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Items',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: isDark
                                      ? AppTheme.darkForeground
                                      : AppTheme.lightForeground,
                                ),
                              ),
                              MadButton(
                                text: 'Add Item',
                                icon: LucideIcons.plus,
                                size: ButtonSize.sm,
                                onPressed: () =>
                                    setState(() => _items.add(_PRWizardItem())),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          ...List.generate(_items.length, (i) {
                            final item = _items[i];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _PRItemRow(
                                key: ObjectKey(item),
                                item: item,
                                index: i,
                                canRemove: _items.length > 1,
                                onRemove: () =>
                                    setState(() => _items.removeAt(i)),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      MadButton(
                        text: _submitting ? 'Creating...' : 'Create PR',
                        icon: LucideIcons.save,
                        disabled: _submitting || _uploadingPr || _uploadingSig,
                        onPressed: _submit,
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PurchaseRequestEmailDialog extends StatefulWidget {
  final PurchaseRequest pr;

  const _PurchaseRequestEmailDialog({required this.pr});

  @override
  State<_PurchaseRequestEmailDialog> createState() =>
      _PurchaseRequestEmailDialogState();
}

class _PurchaseRequestEmailDialogState
    extends State<_PurchaseRequestEmailDialog> {
  bool _loadingVendors = false;
  bool _sending = false;
  bool _downloading = false;
  bool _vendorDropdownOpen = false;
  List<Map<String, dynamic>> _vendors = [];
  Set<String> _selectedVendorIds = {};
  List<File> _attachments = [];
  final TextEditingController _remarksController = TextEditingController();
  final TextEditingController _vendorSearchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadVendors();
  }

  @override
  void dispose() {
    _remarksController.dispose();
    _vendorSearchController.dispose();
    super.dispose();
  }

  String _vendorId(Map<String, dynamic> vendor) =>
      (vendor['vendor_id'] ?? vendor['id'] ?? '').toString();

  String _vendorName(Map<String, dynamic> vendor) =>
      (vendor['vendor_name'] ??
              vendor['vendor_company_name'] ??
              vendor['name'] ??
              'Vendor')
          .toString();

  String _vendorEmail(Map<String, dynamic> vendor) =>
      (vendor['vendor_email'] ?? '').toString();

  Future<void> _loadVendors() async {
    setState(() => _loadingVendors = true);
    try {
      final projectId = widget.pr.projectId;
      final result = projectId.isNotEmpty
          ? await ApiClient.getVendorsByProject(projectId)
          : await ApiClient.getVendors();
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final list = data is List ? data : const [];
        final vendors = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .where(
              (v) => _vendorEmail(v).trim().isNotEmpty,
            )
            .toList();
        setState(() {
          _vendors = vendors;
          _loadingVendors = false;
        });
        return;
      }
      setState(() {
        _vendors = [];
        _loadingVendors = false;
      });
      showToast(
        context,
        (result['error'] ?? 'Failed to load vendors').toString(),
        variant: ToastVariant.error,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _vendors = [];
        _loadingVendors = false;
      });
      showToast(
        context,
        'Failed to load vendors',
        variant: ToastVariant.error,
      );
    }
  }

  List<Map<String, dynamic>> get _filteredVendors {
    final query = _vendorSearchController.text.trim().toLowerCase();
    if (query.isEmpty) return _vendors;
    return _vendors.where((vendor) {
      final name = _vendorName(vendor).toLowerCase();
      final email = _vendorEmail(vendor).toLowerCase();
      return name.contains(query) || email.contains(query);
    }).toList();
  }

  void _toggleVendor(String vendorId, bool selected) {
    setState(() {
      final next = Set<String>.from(_selectedVendorIds);
      if (selected) {
        next.add(vendorId);
      } else {
        next.remove(vendorId);
      }
      _selectedVendorIds = next;
    });
  }

  void _toggleVendorDropdown() {
    setState(() => _vendorDropdownOpen = !_vendorDropdownOpen);
  }

  Future<void> _pickAttachments() async {
    final files = await FileService.pickMultipleFilesWithSource(
      context: context,
    );
    if (!mounted) return;
    if (files.isEmpty) return;
    setState(() {
      _attachments = [..._attachments, ...files];
    });
  }

  void _removeAttachment(File file) {
    setState(() {
      _attachments = _attachments.where((f) => f.path != file.path).toList();
    });
  }

  void _clearAttachments() {
    setState(() => _attachments = []);
  }

  String _formatDate(String? value) {
    if (value == null || value.isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return DateFormat('dd.MM.yyyy').format(parsed);
  }

  Future<void> _downloadPdf() async {
    if (_downloading) return;
    setState(() => _downloading = true);
    try {
      final pr = widget.pr;
      final prNumber = _formatPrNumber(pr);
      final doc = await PdfService.generatePurchaseRequestPdf(
        prNumber: prNumber,
        projectName: pr.projectName,
        workOrder: pr.workorderNo,
        location: pr.location,
        mirNo: pr.mirNo,
        urgency: pr.urgency,
        date: _formatDate(pr.date),
        approvedBy: pr.approvedBy,
        items: pr.items.map((i) => i.toJson()).toList(),
      );
      final file = await PdfService.saveToFile(
        doc,
        'Material-Request-$prNumber.pdf',
      );
      if (!mounted) return;
      if (file != null) {
        showToast(context, 'PDF saved to ${file.path}');
      } else {
        showToast(
          context,
          'Failed to save PDF',
          variant: ToastVariant.error,
        );
      }
    } catch (e) {
      if (!mounted) return;
      showToast(
        context,
        'Could not generate PDF',
        variant: ToastVariant.error,
      );
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _sendEmail() async {
    if (_sending) return;
    final selectedVendors = _vendors
        .where((v) => _selectedVendorIds.contains(_vendorId(v)))
        .toList();
    if (selectedVendors.isEmpty) {
      showToast(
        context,
        'Select at least one vendor with a valid email',
        variant: ToastVariant.error,
      );
      return;
    }

    setState(() => _sending = true);
    try {
      final pr = widget.pr;
      final result = await ApiClient.sendPrEmail(
        pr: {
          'pr_id': pr.id,
          'project_id': pr.projectId,
          'sample_id': pr.sampleId,
          'project_name': pr.projectName,
          'workorder_no': pr.workorderNo,
          'location': pr.location,
          'mirno': pr.mirNo,
          'urgency': pr.urgency,
          'date': pr.date,
          'approved_by': pr.approvedBy,
          'remarks': pr.remarks,
          'items': pr.items.map((i) => i.toJson()).toList(),
        },
        vendors: selectedVendors,
        message: _remarksController.text.trim(),
        attachments: _attachments,
      );
      if (!mounted) return;
      if (result['success'] == true) {
        showToast(context, 'PR email sent');
        Navigator.of(context).pop();
        return;
      }
      showToast(
        context,
        (result['error'] ?? 'Failed to send email').toString(),
        variant: ToastVariant.error,
      );
    } catch (e) {
      if (!mounted) return;
      showToast(
        context,
        'Failed to send email',
        variant: ToastVariant.error,
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pr = widget.pr;
    final selectedVendors = _vendors
        .where((v) => _selectedVendorIds.contains(_vendorId(v)))
        .toList();
    final muted = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;
    final border = isDark ? AppTheme.darkBorder : AppTheme.lightBorder;
    final maxHeight = MediaQuery.of(context).size.height * 0.85;
    final isMobile = Responsive(context).isMobile;

    return Dialog(
      insetPadding: const EdgeInsets.all(16),
      child: Container(
        constraints: BoxConstraints(maxWidth: 720, maxHeight: maxHeight),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.max,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Email Purchase Request',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Select vendors. The selected PR will be sent to their email addresses.',
              style: TextStyle(color: muted),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MadCard(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'PR: ${_formatPrNumber(pr)}',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Project: ${pr.projectName.isEmpty ? '-' : pr.projectName}',
                              style: TextStyle(color: muted, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Attachment (optional)',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: isDark
                            ? AppTheme.darkForeground
                            : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: _pickAttachments,
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: border.withOpacity(0.8)),
                          color: (isDark
                                  ? AppTheme.darkMuted
                                  : AppTheme.lightMuted)
                              .withOpacity(0.15),
                        ),
                        child: Column(
                          children: [
                            Icon(LucideIcons.upload, size: 20, color: muted),
                            const SizedBox(height: 8),
                            const Text(
                              'Drag and drop files here, or click to upload',
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Selected files will be attached when you send the email.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: muted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (_attachments.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      ..._attachments.map((file) {
                        final name = file.path.split(RegExp(r'[/\\\\]')).last;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: border.withOpacity(0.6)),
                            color: (isDark
                                    ? AppTheme.darkMuted
                                    : AppTheme.lightMuted)
                                .withOpacity(0.25),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  name,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              MadButton(
                                text: 'Remove',
                                variant: ButtonVariant.ghost,
                                size: ButtonSize.sm,
                                onPressed: () => _removeAttachment(file),
                              ),
                            ],
                          ),
                        );
                      }),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: MadButton(
                          text: 'Clear All',
                          variant: ButtonVariant.outline,
                          size: ButtonSize.sm,
                          onPressed: _clearAttachments,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    MadTextarea(
                      controller: _remarksController,
                      labelText: 'Remarks (optional)',
                      hintText: 'Add any note for vendors...',
                      minLines: 3,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Vendors',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: isDark
                            ? AppTheme.darkForeground
                            : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 8),
                    MadCard(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: _loadingVendors
                            ? Row(
                                children: [
                                  const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Loading vendors...',
                                    style: TextStyle(color: muted),
                                  ),
                                ],
                              )
                            : _vendors.isEmpty
                                ? Text(
                                    'No vendors with email found for this project.',
                                    style: TextStyle(color: muted),
                                  )
                                : Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      InkWell(
                                        onTap: _toggleVendorDropdown,
                                        borderRadius: BorderRadius.circular(10),
                                        child: Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 12,
                                          ),
                                          decoration: BoxDecoration(
                                            borderRadius:
                                                BorderRadius.circular(10),
                                            border: Border.all(
                                              color:
                                                  border.withOpacity(0.7),
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  _selectedVendorIds.isEmpty
                                                      ? 'Select Vendors'
                                                      : '${_selectedVendorIds.length} vendor(s) selected',
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              ),
                                              Icon(
                                                _vendorDropdownOpen
                                                    ? LucideIcons.chevronUp
                                                    : LucideIcons.chevronDown,
                                                size: 16,
                                                color: muted,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      if (_vendorDropdownOpen) ...[
                                        const SizedBox(height: 12),
                                        MadInput(
                                          controller: _vendorSearchController,
                                          labelText: 'Search vendors',
                                          hintText:
                                              'Search vendor name or email...',
                                        ),
                                        const SizedBox(height: 12),
                                        SizedBox(
                                          height: isMobile ? 180 : 220,
                                          child: ListView.separated(
                                            itemCount: _filteredVendors.length,
                                            separatorBuilder: (_, __) =>
                                                const SizedBox(height: 10),
                                            itemBuilder: (context, index) {
                                              final vendor =
                                                  _filteredVendors[index];
                                              final id = _vendorId(vendor);
                                              final checked =
                                                  _selectedVendorIds
                                                      .contains(id);
                                              return MadCheckbox(
                                                value: checked,
                                                label: _vendorName(vendor),
                                                description:
                                                    _vendorEmail(vendor),
                                                onChanged: (value) =>
                                                    _toggleVendor(
                                                  id,
                                                  value,
                                                ),
                                              );
                                            },
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 12),
                                      if (selectedVendors.isNotEmpty)
                                        Wrap(
                                          spacing: 8,
                                          runSpacing: 8,
                                          children:
                                              selectedVendors.map((vendor) {
                                            final id = _vendorId(vendor);
                                            return Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                horizontal: 10,
                                                vertical: 6,
                                              ),
                                              decoration: BoxDecoration(
                                                borderRadius:
                                                    BorderRadius.circular(16),
                                                color: (isDark
                                                        ? AppTheme.darkMuted
                                                        : AppTheme.lightMuted)
                                                    .withOpacity(0.35),
                                                border: Border.all(
                                                  color:
                                                      border.withOpacity(0.5),
                                                ),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Text(
                                                    _vendorName(vendor),
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  InkWell(
                                                    onTap: () =>
                                                        _toggleVendor(
                                                      id,
                                                      false,
                                                    ),
                                                    child: const Icon(
                                                      LucideIcons.x,
                                                      size: 12,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }).toList(),
                                        )
                                      else
                                        Text(
                                          'No vendor selected',
                                          style: TextStyle(
                                            color: muted,
                                            fontSize: 12,
                                          ),
                                        ),
                                    ],
                                  ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  MadButton(
                    text: 'Cancel',
                    variant: ButtonVariant.outline,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  MadButton(
                    text: _downloading ? 'Downloading...' : 'Download',
                    icon: LucideIcons.download,
                    variant: ButtonVariant.outline,
                    disabled: _downloading || _sending,
                    onPressed: _downloadPdf,
                  ),
                  MadButton(
                    text: _sending ? 'Sending...' : 'Send Email',
                    icon: LucideIcons.mail,
                    disabled: _sending ||
                        _loadingVendors ||
                        _selectedVendorIds.isEmpty,
                    onPressed: _sendEmail,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
