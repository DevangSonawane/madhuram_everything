import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../models/purchase_order.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';

const _poDraftKey = 'po_draft';

double? _parsePoDecimal(dynamic value) {
  if (value == null) return null;
  final normalized = value.toString().replaceAll(',', '').trim();
  if (normalized.isEmpty) return null;
  return double.tryParse(normalized);
}

String? _normalizePoDateForApi(dynamic value) {
  if (value == null) return null;
  final raw = value.toString().trim();
  if (raw.isEmpty) return null;
  if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(raw)) return raw;

  final dayFirst = RegExp(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})').firstMatch(raw);
  if (dayFirst != null) {
    final day = int.tryParse(dayFirst.group(1)!);
    final month = int.tryParse(dayFirst.group(2)!);
    final year = int.tryParse(dayFirst.group(3)!);
    if (day != null && month != null && year != null) {
      final mm = month.toString().padLeft(2, '0');
      final dd = day.toString().padLeft(2, '0');
      return '$year-$mm-$dd';
    }
  }
  return null;
}

List<Map<String, dynamic>> _buildPoItemPayloads(dynamic itemsRaw) {
  if (itemsRaw is! List) return const [];
  return itemsRaw
      .asMap()
      .entries
      .map((entry) {
        final index = entry.key;
        final item = entry.value is Map
            ? Map<String, dynamic>.from(entry.value as Map)
            : <String, dynamic>{};
        final payload = <String, dynamic>{
          'srno': item['srNo'] ?? item['srno'] ?? (index + 1),
          'hsn': item['hsnCode'] ?? item['hsn'] ?? '',
          'description': item['description'] ?? '',
          'qty': item['qty'] ?? item['quantity'] ?? '',
          'UOM': item['uom'] ?? item['UOM'] ?? '',
          'Rate': item['rate'] ?? item['Rate'] ?? '',
          'Amount': item['amount'] ?? item['Amount'] ?? '',
          'remark': item['remarks'] ?? item['remark'] ?? '',
        };
        final hasContent =
            payload['description'].toString().isNotEmpty ||
            payload['hsn'].toString().isNotEmpty ||
            payload['qty'].toString().isNotEmpty ||
            payload['Rate'].toString().isNotEmpty ||
            payload['Amount'].toString().isNotEmpty;
        return hasContent ? payload : null;
      })
      .whereType<Map<String, dynamic>>()
      .toList();
}

Map<String, dynamic> _buildPoApiPayloadFromUi(
  Map<String, dynamic> poData, {
  int? projectId,
  String? statusOverride,
}) {
  final vendor = poData['vendor'] is Map
      ? Map<String, dynamic>.from(poData['vendor'] as Map)
      : <String, dynamic>{};
  final contacts = vendor['contacts'] is Map
      ? Map<String, dynamic>.from(vendor['contacts'] as Map)
      : <String, dynamic>{};
  final primary = contacts['primary'] is Map
      ? Map<String, dynamic>.from(contacts['primary'] as Map)
      : <String, dynamic>{};
  final secondary = contacts['secondary'] is Map
      ? Map<String, dynamic>.from(contacts['secondary'] as Map)
      : <String, dynamic>{};
  final summary = poData['summary'] is Map
      ? Map<String, dynamic>.from(poData['summary'] as Map)
      : <String, dynamic>{};
  final discount = poData['discount'] is Map
      ? Map<String, dynamic>.from(poData['discount'] as Map)
      : <String, dynamic>{};
  final taxes = poData['taxes'] is Map
      ? Map<String, dynamic>.from(poData['taxes'] as Map)
      : <String, dynamic>{};
  final cgst = taxes['cgst'] is Map
      ? Map<String, dynamic>.from(taxes['cgst'] as Map)
      : <String, dynamic>{};
  final sgst = taxes['sgst'] is Map
      ? Map<String, dynamic>.from(taxes['sgst'] as Map)
      : <String, dynamic>{};
  final notes = poData['notes'];
  final resolvedProjectId =
      projectId ?? int.tryParse('${poData['project_id'] ?? ''}');
  final sampleRaw = poData['sample_id'] ?? poData['sampleId'];
  final sampleId = int.tryParse('${sampleRaw ?? ''}');

  return {
    'project_id': resolvedProjectId,
    if (sampleId != null) 'sample_id': sampleId,
    'company_name': poData['companyName'] ?? poData['company_name'] ?? '',
    'company_subtitle':
        poData['companySubtitle'] ?? poData['company_subtitle'] ?? '',
    'company_email': poData['companyEmail'] ?? poData['company_email'] ?? '',
    'company_gst': poData['companyGstNo'] ?? poData['company_gst'] ?? '',
    'indent_no': poData['indentNo'] ?? poData['indent_no'] ?? '',
    'indent_date': _normalizePoDateForApi(
      poData['indentDate'] ?? poData['indent_date'],
    ),
    'order_no': poData['orderNo'] ?? poData['order_no'] ?? '',
    'po_date': _normalizePoDateForApi(poData['poDate'] ?? poData['po_date']),
    'vendor_name': vendor['name'] ?? poData['vendor_name'] ?? '',
    'site': vendor['site'] ?? poData['site'] ?? '',
    'contact_person': vendor['contactPerson'] ?? poData['contact_person'] ?? '',
    'vendor_address': vendor['address'] ?? poData['vendor_address'] ?? '',
    'primary_contact_name':
        primary['name'] ?? poData['primary_contact_name'] ?? '',
    'primary_contact_number':
        primary['number'] ??
        primary['phone'] ??
        poData['primary_contact_number'] ??
        '',
    'secondary_contact_name':
        secondary['name'] ?? poData['secondary_contact_name'] ?? '',
    'secondary_contact_number':
        secondary['number'] ??
        secondary['phone'] ??
        poData['secondary_contact_number'] ??
        '',
    'items': _buildPoItemPayloads(poData['items']),
    'discount': _parsePoDecimal(discount['percent'] ?? poData['discount']),
    'discount_amount': _parsePoDecimal(
      discount['amount'] ?? poData['discount_amount'],
    ),
    'after_discount': _parsePoDecimal(
      poData['afterDiscountAmount'] ?? poData['after_discount'],
    ),
    'cgst': _parsePoDecimal(cgst['percent'] ?? poData['cgst']),
    'cgst_amount': _parsePoDecimal(cgst['amount'] ?? poData['cgst_amount']),
    'sgst': _parsePoDecimal(sgst['percent'] ?? poData['sgst']),
    'sgst_amount': _parsePoDecimal(sgst['amount'] ?? poData['sgst_amount']),
    'total_amount': _parsePoDecimal(
      poData['totalAmount'] ?? poData['total_amount'],
    ),
    'delivery': summary['delivery'] ?? poData['delivery'] ?? '',
    'payment': summary['payment'] ?? poData['payment'] ?? '',
    'notes': notes is List ? notes.join('\n') : (notes?.toString() ?? ''),
    'status': statusOverride ?? poData['status'] ?? 'created',
  };
}

String _poReadString(dynamic value) => value?.toString() ?? '';

List<String> _poReadStringList(dynamic value) {
  if (value is List) {
    return value
        .map((e) => e.toString())
        .where((e) => e.trim().isNotEmpty)
        .toList();
  }
  if (value is String && value.trim().isNotEmpty) {
    return value
        .split('\n')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
  }
  return const [];
}

Map<String, dynamic> _normalizePoForPreview(Map<String, dynamic> raw) {
  final vendorRaw = raw['vendor'] is Map
      ? Map<String, dynamic>.from(raw['vendor'] as Map)
      : <String, dynamic>{};
  final contactsRaw = vendorRaw['contacts'] is Map
      ? Map<String, dynamic>.from(vendorRaw['contacts'] as Map)
      : <String, dynamic>{};
  final primaryRaw = contactsRaw['primary'] is Map
      ? Map<String, dynamic>.from(contactsRaw['primary'] as Map)
      : <String, dynamic>{};
  final secondaryRaw = contactsRaw['secondary'] is Map
      ? Map<String, dynamic>.from(contactsRaw['secondary'] as Map)
      : <String, dynamic>{};
  final discountRaw = raw['discount'] is Map
      ? Map<String, dynamic>.from(raw['discount'] as Map)
      : <String, dynamic>{};
  final taxesRaw = raw['taxes'] is Map
      ? Map<String, dynamic>.from(raw['taxes'] as Map)
      : <String, dynamic>{};
  final cgstRaw = taxesRaw['cgst'] is Map
      ? Map<String, dynamic>.from(taxesRaw['cgst'] as Map)
      : <String, dynamic>{};
  final sgstRaw = taxesRaw['sgst'] is Map
      ? Map<String, dynamic>.from(taxesRaw['sgst'] as Map)
      : <String, dynamic>{};
  final summaryRaw = raw['summary'] is Map
      ? Map<String, dynamic>.from(raw['summary'] as Map)
      : <String, dynamic>{};
  final itemsRaw = raw['items'] is List ? raw['items'] as List : const [];

  final normalizedItems = itemsRaw.map((item) {
    final m = item is Map
        ? Map<String, dynamic>.from(item)
        : <String, dynamic>{};
    return {
      'srNo': _poReadString(m['srNo'] ?? m['srno']),
      'hsnCode': _poReadString(m['hsnCode'] ?? m['hsn']),
      'description': _poReadString(m['description']),
      'qty': _poReadString(m['qty'] ?? m['quantity']),
      'uom': _poReadString(m['uom'] ?? m['UOM']),
      'rate': _poReadString(m['rate'] ?? m['Rate']),
      'amount': _poReadString(m['amount'] ?? m['Amount']),
      'remarks': _poReadString(m['remarks'] ?? m['remark']),
    };
  }).toList();

  return {
    'poId': _poReadString(raw['po_id'] ?? raw['id']),
    'companyName': _poReadString(raw['companyName'] ?? raw['company_name']),
    'companySubtitle': _poReadString(
      raw['companySubtitle'] ?? raw['company_subtitle'],
    ),
    'companyEmail': _poReadString(raw['companyEmail'] ?? raw['company_email']),
    'companyGstNo': _poReadString(raw['companyGstNo'] ?? raw['company_gst']),
    'indentNo': _poReadString(raw['indentNo'] ?? raw['indent_no']),
    'indentDate': _poReadString(raw['indentDate'] ?? raw['indent_date']),
    'orderNo': _poReadString(raw['orderNo'] ?? raw['order_no']),
    'poDate': _poReadString(raw['poDate'] ?? raw['po_date']),
    'vendor': {
      'name': _poReadString(vendorRaw['name'] ?? raw['vendor_name']),
      'site': _poReadString(vendorRaw['site'] ?? raw['site']),
      'contactPerson': _poReadString(
        vendorRaw['contactPerson'] ?? raw['contact_person'],
      ),
      'address': _poReadString(vendorRaw['address'] ?? raw['vendor_address']),
      'contacts': {
        'primary': {
          'name': _poReadString(
            primaryRaw['name'] ?? raw['primary_contact_name'],
          ),
          'phone': _poReadString(
            primaryRaw['phone'] ??
                primaryRaw['number'] ??
                raw['primary_contact_number'],
          ),
        },
        'secondary': {
          'name': _poReadString(
            secondaryRaw['name'] ?? raw['secondary_contact_name'],
          ),
          'phone': _poReadString(
            secondaryRaw['phone'] ??
                secondaryRaw['number'] ??
                raw['secondary_contact_number'],
          ),
        },
      },
    },
    'items': normalizedItems,
    'discount': {
      'percent': _poReadString(discountRaw['percent'] ?? raw['discount']),
      'amount': _poReadString(discountRaw['amount'] ?? raw['discount_amount']),
    },
    'afterDiscountAmount': _poReadString(
      raw['afterDiscountAmount'] ?? raw['after_discount'],
    ),
    'taxes': {
      'cgst': {
        'percent': _poReadString(cgstRaw['percent'] ?? raw['cgst']),
        'amount': _poReadString(cgstRaw['amount'] ?? raw['cgst_amount']),
      },
      'sgst': {
        'percent': _poReadString(sgstRaw['percent'] ?? raw['sgst']),
        'amount': _poReadString(sgstRaw['amount'] ?? raw['sgst_amount']),
      },
    },
    'totalAmount': _poReadString(raw['totalAmount'] ?? raw['total_amount']),
    'summary': {
      'delivery': _poReadString(summaryRaw['delivery'] ?? raw['delivery']),
      'payment': _poReadString(summaryRaw['payment'] ?? raw['payment']),
    },
    'notes': _poReadStringList(raw['notes'] ?? raw['po_notes']),
    'termsAndConditions': _poReadStringList(
      raw['termsAndConditions'] ?? raw['terms_and_conditions'],
    ),
    'status': _poReadString(raw['status']),
    'sourceFileName': _poReadString(
      raw['sourceFileName'] ?? raw['source_file_name'],
    ),
  };
}

/// Purchase Orders page with full implementation (tabbed: Upload & Extract, Manual Entry, Recent POs)
class PurchaseOrdersPageFull extends StatefulWidget {
  const PurchaseOrdersPageFull({super.key});

  @override
  State<PurchaseOrdersPageFull> createState() => _PurchaseOrdersPageFullState();
}

class _PurchaseOrdersPageFullState extends State<PurchaseOrdersPageFull> {
  bool _isLoading = true;
  String? _error;
  List<PurchaseOrder> _orders = [];
  String _lastLoadedProjectId = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;

  // Upload & Extract tab
  String _extractionMessage = '';
  bool _isUploading = false;

  Future<void> _pickAndUploadPOFile() async {
    if (_isUploading) return;
    final picked = await FileService.pickFile(
      context: context,
      allowedExtensions: ['pdf'],
    );
    if (picked == null || !mounted) return;

    setState(() {
      _extractionMessage = '';
      _isUploading = true;
    });

    final result = await ApiClient.uploadPOFile(picked);
    if (!mounted) return;

    setState(() => _isUploading = false);
    if (result['success'] == true) {
      await _loadOrders();
      if (!mounted) return;
      setState(() {
        _extractionMessage = 'Upload successful.';
      });
    } else {
      setState(() {
        _extractionMessage =
            result['error']?.toString() ?? 'Upload failed.';
      });
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadOrders();
    });
  }

  String _resolveCurrentProjectId() {
    final store = StoreProvider.of<AppState>(context);
    return store.state.project.selectedProjectId ??
        store.state.project.selectedProject?['project_id']?.toString() ??
        '';
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    final projectId = _resolveCurrentProjectId();
    _lastLoadedProjectId = projectId;

    if (projectId.isEmpty) {
      setState(() {
        _orders = [];
        _isLoading = false;
        _error = 'No project selected';
      });
      return;
    }

    try {
      final result = await ApiClient.getPOsByProject(projectId);
      if (!mounted) return;
      if (result['success'] == true) {
        final rawData = result['data'];
        final data = rawData is List
            ? rawData
            : (rawData is Map && rawData['data'] is List
                  ? rawData['data'] as List
                  : const []);
        final loaded = data
            .whereType<Map>()
            .map((e) => PurchaseOrder.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        setState(() {
          _orders = loaded;
          _isLoading = false;
        });
      } else {
        setState(() {
          _orders = [];
          _isLoading = false;
          _error =
              result['error']?.toString() ?? 'Failed to load purchase orders';
        });
      }
    } catch (e) {
      debugPrint('[PurchaseOrders] API error: $e');
      if (!mounted) return;
      setState(() {
        _orders = [];
        _isLoading = false;
        _error = 'Failed to load purchase orders';
      });
    }
  }

  List<PurchaseOrder> get _filteredOrders {
    return _orders;
  }

  List<PurchaseOrder> get _paginatedOrders {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final filtered = _filteredOrders;
    if (start >= filtered.length) return [];
    return filtered.sublist(
      start,
      end > filtered.length ? filtered.length : end,
    );
  }

  int get _totalPages => (_filteredOrders.length / _itemsPerPage).ceil();

  String _dateOnly(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return '-';

    final iso = RegExp(r'^\d{4}-\d{2}-\d{2}').firstMatch(value);
    if (iso != null) return iso.group(0)!;

    final slash = RegExp(r'^\d{2}/\d{2}/\d{4}').firstMatch(value);
    if (slash != null) return slash.group(0)!;

    final dash = RegExp(r'^\d{2}-\d{2}-\d{4}').firstMatch(value);
    if (dash != null) return dash.group(0)!;

    final parsed = DateTime.tryParse(value);
    if (parsed != null) return DateFormat('yyyy-MM-dd').format(parsed);

    final firstToken = value.split(' ').first.trim();
    return firstToken.isEmpty ? value : firstToken;
  }

  String _recentPoDate(PurchaseOrder order) {
    final date = order.poDate ?? order.indentDate ?? order.createdAt;
    if (date == null || date.trim().isEmpty) return '-';
    return _dateOnly(date);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;
    final currentProjectId = _resolveCurrentProjectId();

    if (currentProjectId != _lastLoadedProjectId && !_isLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadOrders();
      });
    }

    return ProtectedRoute(
      title: 'Purchase Orders',
      route: '/purchase-orders',
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
                      'Purchase Orders',
                      style: TextStyle(
                        fontSize: responsive.value(
                          mobile: 24,
                          tablet: 30,
                          desktop: 32,
                        ),
                        fontWeight: FontWeight.w800,
                        color: isDark
                            ? AppTheme.darkForeground
                            : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Upload and manage purchase orders.',
                      style: TextStyle(
                        fontSize: responsive.value(
                          mobile: 13,
                          tablet: 15,
                          desktop: 16,
                        ),
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
          const SizedBox(height: 16),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Create / Extract PO',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Upload a PO file directly from camera, gallery, or files.',
                            style: TextStyle(
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
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
                                onPressed: _isUploading ? null : _pickAndUploadPOFile,
                              ),
                              MadButton(
                                text: 'Manual Entry',
                                icon: LucideIcons.filePenLine,
                                variant: ButtonVariant.outline,
                                onPressed: _openCreatePOPage,
                              ),
                            ],
                          ),
                          if (_extractionMessage.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Text(
                              _extractionMessage,
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark
                                    ? AppTheme.darkMutedForeground
                                    : AppTheme.lightMutedForeground,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildRecentPOsTab(isDark, isMobile),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildManualEntryTab(bool isDark, bool isMobile, {Key? key}) {
    final store = StoreProvider.of<AppState>(context);
    final projectId =
        store.state.project.selectedProjectId ??
        store.state.project.selectedProject?['project_id']?.toString() ??
        '';
    return _ManualPOForm(
      key: key,
      projectId: projectId,
      isDark: isDark,
      onPreview: (data) => _showPOPreview(data),
      onSubmitted: _loadOrders,
    );
  }

  Widget _buildRecentPOsTab(bool isDark, bool isMobile) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Recent Purchase Orders',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 12),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(8),
                child: MadTableSkeleton(rows: 8, columns: 6),
              )
            else if (_error != null)
              _buildErrorState(isDark, _error!)
            else if (_filteredOrders.isEmpty)
              _buildEmptyState(isDark)
            else
              Column(
                children: [
                  if (!isMobile)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 13,
                      ),
                      decoration: BoxDecoration(
                        color:
                            (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                                .withOpacity(0.32),
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(12),
                        ),
                      ),
                      child: Row(
                        children: [
                          _buildHeaderCell(
                            'PO Number',
                            flex: 1,
                            isDark: isDark,
                          ),
                          _buildHeaderCell('Vendor', flex: 2, isDark: isDark),
                          _buildHeaderCell('Date', flex: 1, isDark: isDark),
                          _buildHeaderCell('Items', flex: 1, isDark: isDark),
                          _buildHeaderCell('Amount', flex: 1, isDark: isDark),
                          _buildHeaderCell('Status', flex: 1, isDark: isDark),
                          const SizedBox(width: 48),
                        ],
                      ),
                    ),
                  if (isMobile)
                    Column(
                      children: _paginatedOrders
                          .map(
                            (order) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _buildMobileOrderCard(order, isDark),
                            ),
                          )
                          .toList(),
                    )
                  else
                    Column(
                      children: List.generate(_paginatedOrders.length, (index) {
                        final order = _paginatedOrders[index];
                        final isLast = index == _paginatedOrders.length - 1;
                        return Column(
                          children: [
                            _buildTableRow(order, isDark, false),
                            if (!isLast)
                              Divider(
                                height: 1,
                                color:
                                    (isDark
                                            ? AppTheme.darkBorder
                                            : AppTheme.lightBorder)
                                        .withOpacity(0.5),
                              ),
                          ],
                        );
                      }),
                    ),
                  if (_totalPages > 1) _buildPagination(isDark),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMobileOrderCard(PurchaseOrder order, bool isDark) {
    return InkWell(
      onTap: () => _openPOPreviewPage(order),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF111827) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                .withOpacity(0.5),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    order.orderNo,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                ),
                MadBadge(
                  text: order.status,
                  variant:
                      order.status == 'Approved' || order.status == 'Completed'
                      ? BadgeVariant.default_
                      : BadgeVariant.secondary,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              order.vendorName ?? 'Unknown Vendor',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _buildMobileMeta('Date', _recentPoDate(order))),
                Expanded(
                  child: _buildMobileMeta('Items', '${order.items.length}'),
                ),
                Expanded(
                  child: _buildMobileMeta(
                    'Amount',
                    order.totalAmountValue != null
                        ? '₹${order.totalAmountValue!.toStringAsFixed(2)}'
                        : (order.totalAmount ?? '-'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: MadButton(
                    variant: ButtonVariant.outline,
                    size: ButtonSize.sm,
                    icon: LucideIcons.eye,
                    text: 'View',
                    onPressed: () => _openPOPreviewPage(order),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: MadButton(
                    variant: ButtonVariant.ghost,
                    size: ButtonSize.sm,
                    icon: LucideIcons.pencil,
                    text: 'Edit',
                    onPressed: () => _openEditPOPage(order),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: MadButton(
                    variant: ButtonVariant.outline,
                    size: ButtonSize.sm,
                    icon: LucideIcons.mail,
                    text: 'Email',
                    onPressed: () => _openEmailDialog(order),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMobileMeta(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ],
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

  Widget _buildTableRow(PurchaseOrder order, bool isDark, bool isMobile) {
    BadgeVariant statusVariant;
    switch (order.status) {
      case 'Submitted':
        statusVariant = BadgeVariant.default_;
        break;
      case 'Draft':
        statusVariant = BadgeVariant.secondary;
        break;
      case 'Approved':
        statusVariant = BadgeVariant.outline;
        break;
      case 'Completed':
        statusVariant = BadgeVariant.default_;
        break;
      default:
        statusVariant = BadgeVariant.secondary;
    }

    return InkWell(
      onTap: () => _openPOPreviewPage(order),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        child: Row(
          children: [
            Expanded(
              flex: 1,
              child: Text(
                order.orderNo,
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontFamily: 'monospace',
                  color: AppTheme.primaryColor,
                ),
              ),
            ),
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    order.vendorName ?? 'Unknown Vendor',
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  if (isMobile && order.totalAmountValue != null)
                    Text(
                      '₹${order.totalAmountValue!.toStringAsFixed(2)}',
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
                child: Text(
                  _recentPoDate(order),
                  style: TextStyle(
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              ),
              Expanded(flex: 1, child: Text('${order.items.length} items')),
              Expanded(
                flex: 1,
                child: Text(
                  order.totalAmountValue != null
                      ? '₹${order.totalAmountValue!.toStringAsFixed(2)}'
                      : (order.totalAmount ?? '-'),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
            Expanded(
              flex: 1,
              child: MadBadge(text: order.status, variant: statusVariant),
            ),
            MadDropdownMenuButton(
              items: [
                MadMenuItem(
                  label: 'View Details',
                  icon: LucideIcons.eye,
                  onTap: () => _openPOPreviewPage(order),
                ),
                MadMenuItem(
                  label: 'Edit',
                  icon: LucideIcons.pencil,
                  onTap: () => _openEditPOPage(order),
                ),
                MadMenuItem(
                  label: 'Email',
                  icon: LucideIcons.mail,
                  onTap: () => _openEmailDialog(order),
                ),
                MadMenuItem(
                  label: 'Download PDF',
                  icon: LucideIcons.download,
                  onTap: () {},
                ),
                MadMenuItem(
                  label: 'Duplicate',
                  icon: LucideIcons.copy,
                  onTap: () {},
                ),
                if (order.status == 'Draft')
                  MadMenuItem(
                    label: 'Submit',
                    icon: LucideIcons.send,
                    onTap: () {},
                  ),
                MadMenuItem(
                  label: 'Delete',
                  icon: LucideIcons.trash2,
                  destructive: true,
                  onTap: () => _showDeletePOConfirmation(order),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPagination(bool isDark) {
    final rangeText =
        'Showing ${(_currentPage - 1) * _itemsPerPage + 1}-${_currentPage * _itemsPerPage > _filteredOrders.length ? _filteredOrders.length : _currentPage * _itemsPerPage} of ${_filteredOrders.length}';
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 520;
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
          child: compact
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rangeText,
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                    const SizedBox(height: 10),
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
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      rangeText,
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
      },
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
              LucideIcons.shoppingCart,
              size: 64,
              color:
                  (isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground)
                      .withOpacity(0.3),
            ),
            const SizedBox(height: 24),
            Text(
              'No purchase orders yet',
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
              'Create your first purchase order to get started',
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 24),
            MadButton(
              text: 'Create PO',
              icon: LucideIcons.plus,
              onPressed: _openCreatePOPage,
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
              'Failed to load purchase orders',
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
              onPressed: _loadOrders,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openPOPreviewPage(PurchaseOrder order) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            _POViewPage(poId: order.id, fallbackData: order.toJson()),
      ),
    );
    if (mounted) _loadOrders();
  }

  void _openEmailDialog(PurchaseOrder order) {
    if (order.id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Save the PO before emailing.')),
      );
      return;
    }
    final projectId = _resolveCurrentProjectId();
    showDialog(
      context: context,
      builder: (context) => _PurchaseOrderEmailDialog(
        order: order,
        projectId: projectId,
      ),
    );
  }

  void _showPOPreview(Map<String, dynamic> poData) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final items = poData['items'] as List<dynamic>? ?? [];
    showDialog(
      context: context,
      builder: (ctx) {
        return Dialog(
          backgroundColor: isDark ? AppTheme.darkCard : Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 700,
              maxHeight: MediaQuery.of(context).size.height * 0.9,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: isDark
                            ? AppTheme.darkBorder
                            : AppTheme.lightBorder,
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'PO Preview - ${poData['order_no'] ?? 'Draft'}',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildPreviewSection('Company', isDark, [
                          _previewRow('Name', poData['companyName']),
                          _previewRow('Subtitle', poData['companySubtitle']),
                          _previewRow('Email', poData['companyEmail']),
                          _previewRow('GST', poData['companyGstNo']),
                        ]),
                        _buildPreviewSection('Order Details', isDark, [
                          _previewRow('Indent No', poData['indent_no']),
                          _previewRow('Indent Date', poData['indent_date']),
                          _previewRow('Order No', poData['order_no']),
                          _previewRow('PO Date', poData['po_date']),
                        ]),
                        _buildPreviewSection('Vendor', isDark, [
                          _previewRow('Name', poData['vendor']?['name']),
                          _previewRow('Site', poData['vendor']?['site']),
                          _previewRow(
                            'Contact Person',
                            poData['vendor']?['contactPerson'],
                          ),
                          _previewRow('Address', poData['vendor']?['address']),
                        ]),
                        const SizedBox(height: 16),
                        Text(
                          'Items',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (items.isEmpty)
                          Text(
                            'No items',
                            style: TextStyle(
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          )
                        else
                          Table(
                            columnWidths: const {
                              0: FlexColumnWidth(0.8),
                              1: FlexColumnWidth(1),
                              2: FlexColumnWidth(2),
                              3: FlexColumnWidth(0.8),
                              4: FlexColumnWidth(0.8),
                              5: FlexColumnWidth(1),
                              6: FlexColumnWidth(1),
                            },
                            children: [
                              TableRow(
                                decoration: BoxDecoration(
                                  color:
                                      (isDark
                                              ? AppTheme.darkMuted
                                              : AppTheme.lightMuted)
                                          .withOpacity(0.5),
                                ),
                                children: [
                                  _tableCell('Sr', isDark, bold: true),
                                  _tableCell('HSN', isDark, bold: true),
                                  _tableCell('Description', isDark, bold: true),
                                  _tableCell('Qty', isDark, bold: true),
                                  _tableCell('UOM', isDark, bold: true),
                                  _tableCell('Rate', isDark, bold: true),
                                  _tableCell('Amount', isDark, bold: true),
                                ],
                              ),
                              ...items.map<TableRow>((e) {
                                final m = e is Map
                                    ? e as Map<String, dynamic>
                                    : <String, dynamic>{};
                                final qty =
                                    double.tryParse(
                                      m['qty']?.toString() ?? '',
                                    ) ??
                                    0;
                                final rate =
                                    double.tryParse(
                                      m['Rate']?.toString() ??
                                          m['rate']?.toString() ??
                                          '',
                                    ) ??
                                    0;
                                final amt =
                                    m['Amount'] ??
                                    m['amount'] ??
                                    (qty * rate).toStringAsFixed(2);
                                return TableRow(
                                  children: [
                                    _tableCell(
                                      m['srno'] ?? m['srNo'] ?? '',
                                      isDark,
                                    ),
                                    _tableCell(m['hsn'] ?? '', isDark),
                                    _tableCell(m['description'] ?? '', isDark),
                                    _tableCell(m['qty'] ?? '', isDark),
                                    _tableCell(
                                      m['UOM'] ?? m['uom'] ?? '',
                                      isDark,
                                    ),
                                    _tableCell(
                                      m['Rate'] ?? m['rate'] ?? '',
                                      isDark,
                                    ),
                                    _tableCell(amt.toString(), isDark),
                                  ],
                                );
                              }),
                            ],
                          ),
                        const SizedBox(height: 16),
                        _buildPreviewSection('Totals', isDark, [
                          _previewRow(
                            'Discount %',
                            poData['discount']?['percent'],
                          ),
                          _previewRow(
                            'Discount Amount',
                            poData['discount']?['amount'],
                          ),
                          _previewRow(
                            'After Discount',
                            poData['afterDiscountAmount'],
                          ),
                          _previewRow(
                            'CGST %',
                            poData['taxes']?['cgst']?['percent'],
                          ),
                          _previewRow(
                            'CGST Amount',
                            poData['taxes']?['cgst']?['amount'],
                          ),
                          _previewRow(
                            'SGST %',
                            poData['taxes']?['sgst']?['percent'],
                          ),
                          _previewRow(
                            'SGST Amount',
                            poData['taxes']?['sgst']?['amount'],
                          ),
                          _previewRow(
                            'Total Amount',
                            poData['total_amount'] ?? poData['totalAmount'],
                            bold: true,
                          ),
                        ]),
                        _buildPreviewSection('Additional', isDark, [
                          _previewRow(
                            'Delivery terms',
                            poData['summary']?['delivery'],
                          ),
                          _previewRow(
                            'Payment terms',
                            poData['summary']?['payment'],
                          ),
                          _previewRow(
                            'Notes',
                            poData['notes'] is List
                                ? (poData['notes'] as List).join(', ')
                                : poData['notes']?.toString(),
                          ),
                        ]),
                      ],
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(
                        color: isDark
                            ? AppTheme.darkBorder
                            : AppTheme.lightBorder,
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      MadButton(
                        text: 'Edit',
                        variant: ButtonVariant.outline,
                        onPressed: () => Navigator.pop(ctx),
                      ),
                      const SizedBox(width: 12),
                      MadButton(
                        text: 'Submit PO',
                        onPressed: () async {
                          if ((poData['sample_id'] ?? poData['sampleId'])
                              ?.toString()
                              .trim()
                              .isEmpty ??
                              true) {
                            if (!ctx.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Sample ID is required for purchase order.',
                                ),
                              ),
                            );
                            return;
                          }
                          final store = StoreProvider.of<AppState>(context);
                          final projectIdRaw =
                              store.state.project.selectedProjectId ??
                              store.state.project.selectedProject?['project_id']
                                  ?.toString();
                          final projectId = int.tryParse('$projectIdRaw');
                          final payload = _buildPoApiPayloadFromUi(
                            poData,
                            projectId: projectId,
                          );
                          final result = await ApiClient.createPO(payload);
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx);
                          if (result['success'] == true) {
                            _loadOrders();
                          }
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

  Widget _buildPreviewSection(String title, bool isDark, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 8),
          ...rows,
        ],
      ),
    );
  }

  Widget _previewRow(String label, dynamic value, {bool bold = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final v = value?.toString() ?? '-';
    if (v == '-' || v.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
          ),
          Expanded(
            child: Text(
              v,
              style: TextStyle(
                fontSize: 13,
                fontWeight: bold ? FontWeight.w600 : null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tableCell(String text, bool isDark, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: bold ? FontWeight.w600 : null,
          color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
        ),
      ),
    );
  }

  Future<void> _openCreatePOPage() async {
    final store = StoreProvider.of<AppState>(context);
    final projectId =
        store.state.project.selectedProjectId ??
        store.state.project.selectedProject?['project_id']?.toString() ??
        '';

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _CreatePOFullPage(
          projectId: projectId,
          onPreview: _showPOPreview,
          initialPoData: null,
          editingPoId: null,
          onSubmitted: () {
            Navigator.of(context).pop();
            _loadOrders();
          },
        ),
      ),
    );
    if (mounted) _loadOrders();
  }

  Future<void> _openEditPOPage(PurchaseOrder order) async {
    final normalized = _normalizePoForPreview(order.toJson());
    final manualSeed = <String, dynamic>{
      'project_id': order.projectId,
      'companyName': normalized['companyName'],
      'companySubtitle': normalized['companySubtitle'],
      'companyEmail': normalized['companyEmail'],
      'companyGstNo': normalized['companyGstNo'],
      'indent_no': normalized['indentNo'],
      'indent_date': normalized['indentDate'],
      'order_no': normalized['orderNo'],
      'po_date': normalized['poDate'],
      'vendor': normalized['vendor'],
      'items': (normalized['items'] as List<dynamic>? ?? []).map((item) {
        final m = item is Map ? Map<String, dynamic>.from(item) : {};
        return {
          'srNo': m['srNo'],
          'hsn': m['hsnCode'],
          'description': m['description'],
          'qty': m['qty'],
          'uom': m['uom'],
          'rate': m['rate'],
          'amount': m['amount'],
          'remark': m['remarks'],
        };
      }).toList(),
      'discount': normalized['discount'],
      'afterDiscountAmount': normalized['afterDiscountAmount'],
      'taxes': normalized['taxes'],
      'summary': normalized['summary'],
      'notes': normalized['notes'],
      'status': normalized['status'],
    };

    if (!mounted) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _CreatePOFullPage(
          projectId: order.projectId ?? '',
          onPreview: _showPOPreview,
          initialPoData: manualSeed,
          editingPoId: order.id,
          onSubmitted: () {
            Navigator.of(context).pop();
            _loadOrders();
          },
        ),
      ),
    );
    if (mounted) _loadOrders();
  }

  void _showDeletePOConfirmation(PurchaseOrder order) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppTheme.darkCard : Colors.white,
        title: const Text('Delete Purchase Order'),
        content: Text(
          'Are you sure you want to delete "${order.orderNo}"? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final result = await ApiClient.deletePO(order.id);
              if (!mounted) return;
              if (result['success'] == true) {
                _loadOrders();
              }
            },
            child: Text(
              'Delete',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ],
      ),
    );
  }
}

class _POViewPage extends StatefulWidget {
  final String poId;
  final Map<String, dynamic>? fallbackData;

  const _POViewPage({required this.poId, this.fallbackData});

  @override
  State<_POViewPage> createState() => _POViewPageState();
}

class _POViewPageState extends State<_POViewPage> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _poData;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    if (widget.poId.isNotEmpty) {
      try {
        final result = await ApiClient.getPO(widget.poId);
        if (!mounted) return;
        if (result['success'] == true) {
          final raw = result['data'];
          Map<String, dynamic>? data;
          if (raw is Map<String, dynamic>) {
            if (raw['data'] is Map) {
              data = Map<String, dynamic>.from(raw['data'] as Map);
            } else {
              data = raw;
            }
          } else if (raw is Map) {
            data = Map<String, dynamic>.from(raw);
          }

          if (data != null) {
            setState(() {
              _poData = _normalizePoForPreview(data!);
              _isLoading = false;
            });
            return;
          }
        } else {
          _error = result['error']?.toString();
        }
      } catch (e) {
        _error = e.toString();
      }
    }

    if (widget.fallbackData != null) {
      setState(() {
        _poData = _normalizePoForPreview(widget.fallbackData!);
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _isLoading = false;
      _error = _error ?? 'Failed to load purchase order details.';
    });
  }

  Widget _section(String title, List<Widget> rows) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 10),
            ...rows,
          ],
        ),
      ),
    );
  }

  Widget _kv(String label, dynamic value) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final v = value?.toString().trim() ?? '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 170,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
          ),
          Expanded(
            child: Text(
              v.isEmpty ? '-' : v,
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final data = _poData;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Purchase Order Preview'),
        actions: [
          if (!_isLoading && data != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: MadBadge(
                  text: (data['status']?.toString().isNotEmpty ?? false)
                      ? data['status'].toString()
                      : 'Draft',
                  variant: BadgeVariant.secondary,
                ),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && data == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                    const SizedBox(height: 12),
                    MadButton(
                      text: 'Retry',
                      icon: LucideIcons.refreshCw,
                      onPressed: _loadDetails,
                    ),
                  ],
                ),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _section('Header Details', [
                    _kv('PO ID', data?['poId']),
                    _kv('Company Name', data?['companyName']),
                    _kv('Company Subtitle', data?['companySubtitle']),
                    _kv('Company Email', data?['companyEmail']),
                    _kv('Company GST No', data?['companyGstNo']),
                    _kv('Indent No', data?['indentNo']),
                    _kv('Indent Date', data?['indentDate']),
                    _kv('Order No', data?['orderNo']),
                    _kv('PO Date', data?['poDate']),
                    _kv('Source File', data?['sourceFileName']),
                  ]),
                  const SizedBox(height: 12),
                  _section('Vendor Details', [
                    _kv('Vendor Name', data?['vendor']?['name']),
                    _kv('Site', data?['vendor']?['site']),
                    _kv('Contact Person', data?['vendor']?['contactPerson']),
                    _kv('Vendor Address', data?['vendor']?['address']),
                    _kv(
                      'Primary Contact Name',
                      data?['vendor']?['contacts']?['primary']?['name'],
                    ),
                    _kv(
                      'Primary Contact Phone',
                      data?['vendor']?['contacts']?['primary']?['phone'],
                    ),
                    _kv(
                      'Secondary Contact Name',
                      data?['vendor']?['contacts']?['secondary']?['name'],
                    ),
                    _kv(
                      'Secondary Contact Phone',
                      data?['vendor']?['contacts']?['secondary']?['phone'],
                    ),
                  ]),
                  const SizedBox(height: 12),
                  _section(
                    'Items',
                    (data?['items'] as List<dynamic>? ?? const []).isEmpty
                        ? [_kv('Items', 'No items added yet')]
                        : (data?['items'] as List<dynamic>).map((item) {
                            final m = item is Map
                                ? Map<String, dynamic>.from(item)
                                : <String, dynamic>{};
                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color:
                                      (isDark
                                              ? AppTheme.darkBorder
                                              : AppTheme.lightBorder)
                                          .withOpacity(0.6),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _kv('Sr No', m['srNo']),
                                  _kv('HSN', m['hsnCode']),
                                  _kv('Description', m['description']),
                                  _kv('Qty', m['qty']),
                                  _kv('UOM', m['uom']),
                                  _kv('Rate', m['rate']),
                                  _kv('Amount', m['amount']),
                                  _kv('Remarks', m['remarks']),
                                ],
                              ),
                            );
                          }).toList(),
                  ),
                  const SizedBox(height: 12),
                  _section('Pricing & Terms', [
                    _kv('Discount %', data?['discount']?['percent']),
                    _kv('Discount Amount', data?['discount']?['amount']),
                    _kv('After Discount Amount', data?['afterDiscountAmount']),
                    _kv('CGST %', data?['taxes']?['cgst']?['percent']),
                    _kv('CGST Amount', data?['taxes']?['cgst']?['amount']),
                    _kv('SGST %', data?['taxes']?['sgst']?['percent']),
                    _kv('SGST Amount', data?['taxes']?['sgst']?['amount']),
                    _kv('Total Amount', data?['totalAmount']),
                    _kv('Delivery', data?['summary']?['delivery']),
                    _kv('Payment', data?['summary']?['payment']),
                    _kv(
                      'Notes',
                      (data?['notes'] as List<dynamic>? ?? const []).join('\n'),
                    ),
                    _kv(
                      'Terms & Conditions',
                      (data?['termsAndConditions'] as List<dynamic>? ??
                              const [])
                          .join('\n'),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  _section('Quick Preview', [
                    _kv('PO No', data?['orderNo']),
                    _kv('PO Date', data?['poDate']),
                    _kv('Vendor', data?['vendor']?['name']),
                    _kv('Total Amount', data?['totalAmount']),
                    _kv('Delivery', data?['summary']?['delivery']),
                    _kv('Payment', data?['summary']?['payment']),
                  ]),
                ],
              ),
            ),
    );
  }
}

class _CreatePOFullPage extends StatelessWidget {
  final String projectId;
  final void Function(Map<String, dynamic> poData) onPreview;
  final VoidCallback onSubmitted;
  final Map<String, dynamic>? initialPoData;
  final String? editingPoId;

  const _CreatePOFullPage({
    required this.projectId,
    required this.onPreview,
    required this.onSubmitted,
    this.initialPoData,
    this.editingPoId,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          editingPoId != null ? 'Edit Purchase Order' : 'Create Purchase Order',
        ),
      ),
      body: SafeArea(
        child: _ManualPOForm(
          projectId: projectId,
          isDark: isDark,
          onPreview: onPreview,
          onSubmitted: onSubmitted,
          initialPoData: initialPoData,
          editingPoId: editingPoId,
        ),
      ),
    );
  }
}

/// Manual PO entry form (company, order, vendor, items, totals, additional)
class _ManualPOForm extends StatefulWidget {
  final String projectId;
  final bool isDark;
  final void Function(Map<String, dynamic> poData) onPreview;
  final VoidCallback onSubmitted;
  final Map<String, dynamic>? initialPoData;
  final String? editingPoId;

  const _ManualPOForm({
    super.key,
    required this.projectId,
    required this.isDark,
    required this.onPreview,
    required this.onSubmitted,
    this.initialPoData,
    this.editingPoId,
  });

  @override
  State<_ManualPOForm> createState() => _ManualPOFormState();
}

class _ManualPOFormState extends State<_ManualPOForm> {
  final _companyName = TextEditingController();
  final _companySubtitle = TextEditingController();
  final _companyEmail = TextEditingController();
  final _companyGst = TextEditingController();
  final _indentNo = TextEditingController();
  final _indentDate = TextEditingController();
  final _orderNo = TextEditingController();
  final _poDate = TextEditingController();
  final _vendorName = TextEditingController();
  final _site = TextEditingController();
  final _contactPerson = TextEditingController();
  final _vendorAddress = TextEditingController();
  final _primaryContactName = TextEditingController();
  final _primaryContactNumber = TextEditingController();
  final _secondaryContactName = TextEditingController();
  final _secondaryContactNumber = TextEditingController();
  final _deliveryTerms = TextEditingController();
  final _paymentTerms = TextEditingController();
  final _notes = TextEditingController();
  final _subtotalAmount = TextEditingController();
  final _discountPercent = TextEditingController();
  final _discountAmount = TextEditingController();
  final _afterDiscountAmount = TextEditingController();
  final _cgstPercent = TextEditingController();
  final _cgstAmount = TextEditingController();
  final _sgstPercent = TextEditingController();
  final _sgstAmount = TextEditingController();
  final _totalAmount = TextEditingController();

  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _sampleOptions = [];
  List<Map<String, dynamic>> _prOptions = [];
  bool _loadingSamples = false;
  bool _loadingPrOptions = false;
  bool _loadingPrItems = false;
  String _selectedSampleId = '';
  String _selectedPrId = '';
  static int _itemId = 0;
  bool _isSubmitting = false;
  bool _isHydratingEditData = false;
  bool _isRecalculating = false;

  @override
  void initState() {
    super.initState();
    _discountPercent.addListener(_onDiscountPercentChanged);
    _cgstPercent.addListener(_onCgstPercentChanged);
    _cgstAmount.addListener(_onCgstAmountChanged);
    _sgstPercent.addListener(_onSgstPercentChanged);
    _sgstAmount.addListener(_onSgstAmountChanged);
    _loadSamples();
    _loadPrOptions();
    if (widget.initialPoData != null) {
      _applyFormData(widget.initialPoData!);
    } else {
      _loadDraft();
    }
    if (widget.editingPoId != null && widget.editingPoId!.isNotEmpty) {
      _hydrateEditData();
    }
  }

  Future<void> _loadDraft() async {
    final prefs = await SharedPreferences.getInstance();
    final key = widget.projectId.isEmpty
        ? _poDraftKey
        : '${_poDraftKey}_${widget.projectId}';
    final json = prefs.getString(key);
    if (json == null) return;
    try {
      final data = (jsonDecode(json) as Map<String, dynamic>);
      _applyFormData(data);
    } catch (_) {}
  }

  Future<void> _loadSamples() async {
    if (_loadingSamples) return;
    setState(() => _loadingSamples = true);
    try {
      final result = widget.projectId.isNotEmpty
          ? await ApiClient.getSamplesByProject(widget.projectId)
          : await ApiClient.getSamples();
      if (!mounted) return;
      if (result['success'] == true && result['data'] is List) {
        final list = (result['data'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        setState(() {
          _sampleOptions = list;
          _loadingSamples = false;
        });
        return;
      }
      setState(() {
        _sampleOptions = [];
        _loadingSamples = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _sampleOptions = [];
        _loadingSamples = false;
      });
    }
  }

  Future<void> _loadPrOptions() async {
    if (_loadingPrOptions) return;
    setState(() => _loadingPrOptions = true);
    try {
      final result = widget.projectId.isNotEmpty
          ? await ApiClient.getPRsByProject(widget.projectId)
          : await ApiClient.getPRs();
      if (!mounted) return;
      if (result['success'] == true && result['data'] is List) {
        final list = (result['data'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        setState(() {
          _prOptions = list;
          _loadingPrOptions = false;
        });
        return;
      }
      setState(() {
        _prOptions = [];
        _loadingPrOptions = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _prOptions = [];
        _loadingPrOptions = false;
      });
    }
  }

  String _formatPrNumber(Map<String, dynamic> pr) {
    final sourceDate =
        pr['date'] ?? pr['created_at'] ?? DateTime.now().toIso8601String();
    final parsed = DateTime.tryParse(sourceDate.toString());
    final datePart = parsed == null
        ? '0000-00-00'
        : '${parsed.year.toString().padLeft(4, '0')}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
    final sequence = pr['pr_id'] ?? pr['id'] ?? '0';
    final project = pr['project_id'] ?? pr['projectId'] ?? '0';
    return 'PR-$datePart-$sequence-$project';
  }

  List<Map<String, dynamic>> _mapPrItemsToPoItems(List<dynamic> items) {
    return items.asMap().entries.map((entry) {
      final idx = entry.key;
      final raw = entry.value is Map
          ? Map<String, dynamic>.from(entry.value as Map)
          : <String, dynamic>{};
      final make = (raw['make'] ?? '').toString().trim();
      final place = (raw['place_of_utilisation'] ?? '').toString().trim();
      final remarks = [
        if (make.isNotEmpty) 'Make: $make',
        if (place.isNotEmpty) 'Place: $place',
      ].join(' | ');
      return {
        '_id': ++_itemId,
        'srNo': '${idx + 1}',
        'hsn': '',
        'description': (raw['material_description'] ?? '').toString(),
        'qty': (raw['req_qty'] ?? '').toString(),
        'uom': (raw['unit'] ?? '').toString(),
        'rate': '',
        'amount': '',
        'remark': remarks,
      };
    }).toList();
  }

  void _applySelectedPrToPo(Map<String, dynamic> pr) {
    final itemsRaw = pr['items'];
    final itemsList = itemsRaw is List ? itemsRaw : const [];
    final mappedItems = _mapPrItemsToPoItems(itemsList);
    final sampleId = pr['sample_id']?.toString();
    setState(() {
      if (sampleId != null && sampleId.isNotEmpty) {
        _selectedSampleId = sampleId;
      }
      _items = mappedItems;
    });
    _recalculateTotals();
  }

  Future<void> _handlePrSelect(String? value) async {
    final next = value?.trim() ?? '';
    setState(() {
      _selectedPrId = next;
    });
    if (next.isEmpty) return;

    final selected =
        _prOptions.firstWhere((pr) => '${pr['pr_id'] ?? pr['id']}' == next,
            orElse: () => {});
    if (selected.isNotEmpty && selected['items'] is List) {
      _applySelectedPrToPo(selected);
      return;
    }

    setState(() => _loadingPrItems = true);
    try {
      final result = await ApiClient.getPRById(next);
      if (!mounted) return;
      if (result['success'] == true && result['data'] is Map) {
        _applySelectedPrToPo(Map<String, dynamic>.from(result['data']));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (result['error'] ?? 'Failed to load PR items').toString(),
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load PR items')),
      );
    } finally {
      if (mounted) setState(() => _loadingPrItems = false);
    }
  }

  void _applyFormData(Map<String, dynamic> data) {
    _isRecalculating = true;
    _selectedSampleId = (data['sample_id'] ?? data['sampleId'] ?? '').toString();
    _selectedPrId = (data['selectedPrId'] ?? '').toString();
    _companyName.text = data['companyName']?.toString() ?? '';
    _companySubtitle.text = data['companySubtitle']?.toString() ?? '';
    _companyEmail.text = data['companyEmail']?.toString() ?? '';
    _companyGst.text = data['companyGstNo']?.toString() ?? '';
    _indentNo.text = data['indent_no']?.toString() ?? '';
    _indentDate.text = data['indent_date']?.toString() ?? '';
    _orderNo.text = data['order_no']?.toString() ?? '';
    _poDate.text = data['po_date']?.toString() ?? '';
    final v = data['vendor'] as Map<String, dynamic>?;
    if (v != null) {
      _vendorName.text = v['name']?.toString() ?? '';
      _site.text = v['site']?.toString() ?? '';
      _contactPerson.text = v['contactPerson']?.toString() ?? '';
      _vendorAddress.text = v['address']?.toString() ?? '';
      final c = v['contacts'] as Map<String, dynamic>?;
      if (c != null) {
        final p = c['primary'] as Map<String, dynamic>?;
        final s = c['secondary'] as Map<String, dynamic>?;
        if (p != null) {
          _primaryContactName.text = p['name']?.toString() ?? '';
          _primaryContactNumber.text =
              (p['number'] ?? p['phone'])?.toString() ?? '';
        }
        if (s != null) {
          _secondaryContactName.text = s['name']?.toString() ?? '';
          _secondaryContactNumber.text =
              (s['number'] ?? s['phone'])?.toString() ?? '';
        }
      }
    }
    final sum = data['summary'] as Map<String, dynamic>?;
    if (sum != null) {
      _deliveryTerms.text = sum['delivery']?.toString() ?? '';
      _paymentTerms.text = sum['payment']?.toString() ?? '';
    }
    _notes.text =
        (data['notes'] is List
            ? (data['notes'] as List).join('\n')
            : data['notes']?.toString()) ??
        '';
    final disc = data['discount'] as Map<String, dynamic>?;
    if (disc != null) {
      _discountPercent.text = disc['percent']?.toString() ?? '';
      _discountAmount.text = disc['amount']?.toString() ?? '';
    }
    _afterDiscountAmount.text = data['afterDiscountAmount']?.toString() ?? '';
    final tax = data['taxes'] as Map<String, dynamic>?;
    if (tax != null) {
      _cgstPercent.text = (tax['cgst'] as Map?)?['percent']?.toString() ?? '';
      _cgstAmount.text = (tax['cgst'] as Map?)?['amount']?.toString() ?? '';
      _sgstPercent.text = (tax['sgst'] as Map?)?['percent']?.toString() ?? '';
      _sgstAmount.text = (tax['sgst'] as Map?)?['amount']?.toString() ?? '';
    }
    _totalAmount.text =
        (data['totalAmount'] ?? data['total_amount'])?.toString() ?? '';
    final list = data['items'] as List<dynamic>?;
    setState(() {
      _items = (list ?? const []).map((e) {
        final raw = Map<String, dynamic>.from(e as Map);
        if (!raw.containsKey('_id')) raw['_id'] = ++_itemId;
        return {
          '_id': raw['_id'],
          'srNo': raw['srNo'] ?? raw['srno'] ?? '',
          'hsn': raw['hsn'] ?? '',
          'description': raw['description'] ?? '',
          'qty': raw['qty'] ?? '',
          'uom': raw['uom'] ?? raw['UOM'] ?? '',
          'rate': raw['rate'] ?? raw['Rate'] ?? '',
          'amount': raw['amount'] ?? raw['Amount'] ?? '',
          'remark': raw['remark'] ?? raw['remarks'] ?? '',
        };
      }).toList();
    });
    _isRecalculating = false;
    _recalculateTotals();
  }

  Future<void> _hydrateEditData() async {
    if (_isHydratingEditData) return;
    _isHydratingEditData = true;
    try {
      final result = await ApiClient.getPO(widget.editingPoId!);
      if (!mounted || result['success'] != true || result['data'] is! Map) {
        return;
      }
      final raw = Map<String, dynamic>.from(result['data'] as Map);
      final record = raw['data'] is Map
          ? Map<String, dynamic>.from(raw['data'] as Map)
          : raw;
      final normalized = _normalizePoForPreview(record);
      final manualSeed = <String, dynamic>{
        'project_id': record['project_id']?.toString() ?? widget.projectId,
        'companyName': normalized['companyName'],
        'companySubtitle': normalized['companySubtitle'],
        'companyEmail': normalized['companyEmail'],
        'companyGstNo': normalized['companyGstNo'],
        'indent_no': normalized['indentNo'],
        'indent_date': normalized['indentDate'],
        'order_no': normalized['orderNo'],
        'po_date': normalized['poDate'],
        'vendor': normalized['vendor'],
        'items': (normalized['items'] as List<dynamic>? ?? []).map((item) {
          final m = item is Map ? Map<String, dynamic>.from(item) : {};
          return {
            'srNo': m['srNo'],
            'hsn': m['hsnCode'],
            'description': m['description'],
            'qty': m['qty'],
            'uom': m['uom'],
            'rate': m['rate'],
            'amount': m['amount'],
            'remark': m['remarks'],
          };
        }).toList(),
        'discount': normalized['discount'],
        'afterDiscountAmount': normalized['afterDiscountAmount'],
        'taxes': normalized['taxes'],
        'summary': normalized['summary'],
        'notes': normalized['notes'],
        'status': normalized['status'],
      };
      _applyFormData(manualSeed);
    } catch (_) {
      // Keep the instant fallback data loaded; background hydration is best-effort.
    } finally {
      _isHydratingEditData = false;
    }
  }

  @override
  void dispose() {
    _companyName.dispose();
    _companySubtitle.dispose();
    _companyEmail.dispose();
    _companyGst.dispose();
    _indentNo.dispose();
    _indentDate.dispose();
    _orderNo.dispose();
    _poDate.dispose();
    _vendorName.dispose();
    _site.dispose();
    _contactPerson.dispose();
    _vendorAddress.dispose();
    _primaryContactName.dispose();
    _primaryContactNumber.dispose();
    _secondaryContactName.dispose();
    _secondaryContactNumber.dispose();
    _deliveryTerms.dispose();
    _paymentTerms.dispose();
    _notes.dispose();
    _subtotalAmount.dispose();
    _discountPercent.dispose();
    _discountAmount.dispose();
    _afterDiscountAmount.dispose();
    _cgstPercent.dispose();
    _cgstAmount.dispose();
    _sgstPercent.dispose();
    _sgstAmount.dispose();
    _totalAmount.dispose();
    super.dispose();
  }

  Future<void> _pickDate(TextEditingController c) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2030),
    );
    if (date != null) c.text = DateFormat('yyyy-MM-dd').format(date);
  }

  double? _parseValue(String raw) {
    final normalized = raw.replaceAll(',', '').trim();
    if (normalized.isEmpty) return null;
    return double.tryParse(normalized);
  }

  String _formatCalc(num value) {
    final rounded = (value * 100).roundToDouble() / 100;
    return rounded
        .toStringAsFixed(2)
        .replaceFirst(RegExp(r'\.00$'), '')
        .replaceFirst(RegExp(r'(\.\d)0$'), r'$1');
  }

  void _setControllerText(TextEditingController c, String value) {
    if (c.text == value) return;
    c.text = value;
  }

  void _onDiscountPercentChanged() {
    if (_isRecalculating) return;
    _recalculateTotals(discountMode: 'percent');
  }

  void _syncLinkedTaxAndRecalculate({
    required TextEditingController sourceController,
    required TextEditingController linkedController,
    required String cgstMode,
    required String sgstMode,
  }) {
    if (_isRecalculating) return;
    _isRecalculating = true;
    _setControllerText(linkedController, sourceController.text);
    _isRecalculating = false;
    _recalculateTotals(cgstMode: cgstMode, sgstMode: sgstMode);
  }

  void _onCgstPercentChanged() {
    _syncLinkedTaxAndRecalculate(
      sourceController: _cgstPercent,
      linkedController: _sgstPercent,
      cgstMode: 'percent',
      sgstMode: 'percent',
    );
  }

  void _onCgstAmountChanged() {
    _syncLinkedTaxAndRecalculate(
      sourceController: _cgstAmount,
      linkedController: _sgstAmount,
      cgstMode: 'amount',
      sgstMode: 'amount',
    );
  }

  void _onSgstPercentChanged() {
    _syncLinkedTaxAndRecalculate(
      sourceController: _sgstPercent,
      linkedController: _cgstPercent,
      cgstMode: 'percent',
      sgstMode: 'percent',
    );
  }

  void _onSgstAmountChanged() {
    _syncLinkedTaxAndRecalculate(
      sourceController: _sgstAmount,
      linkedController: _cgstAmount,
      cgstMode: 'amount',
      sgstMode: 'amount',
    );
  }

  void _recalculateTotals({
    String discountMode = 'auto',
    String cgstMode = 'auto',
    String sgstMode = 'auto',
  }) {
    if (_isRecalculating) return;
    _isRecalculating = true;

    final subtotal = _items.fold<double>(0, (sum, item) {
      final qty = _parseValue(item['qty']?.toString() ?? '') ?? 0;
      final rate = _parseValue(item['rate']?.toString() ?? '') ?? 0;
      final amount = qty * rate;
      item['amount'] = amount > 0 ? _formatCalc(amount) : '';
      return sum + amount;
    });

    final discountPercentInput = _parseValue(_discountPercent.text);
    final discountAmountInput = _parseValue(_discountAmount.text);
    double? discountPercent = discountPercentInput;
    double discountAmount = 0;

    if (discountMode == 'amount') {
      discountAmount = discountAmountInput ?? 0;
      discountPercent = subtotal > 0 ? (discountAmount * 100) / subtotal : null;
    } else if (discountMode == 'percent') {
      discountAmount =
          discountPercentInput != null ? (subtotal * discountPercentInput) / 100 : 0;
    } else if (discountPercentInput != null) {
      discountAmount = (subtotal * discountPercentInput) / 100;
    } else if (discountAmountInput != null) {
      discountAmount = discountAmountInput;
      discountPercent = subtotal > 0 ? (discountAmount * 100) / subtotal : null;
    }

    final afterDiscount = subtotal - discountAmount;

    Map<String, double?> calcTax(
      double? percentInput,
      double? amountInput,
      String mode,
    ) {
      if (mode == 'amount') {
        final double amount = amountInput ?? 0.0;
        final percent =
            afterDiscount != 0 ? (amount * 100) / afterDiscount : null;
        return {'percent': percent, 'amount': amount};
      }
      if (mode == 'percent') {
        final double amount =
            percentInput != null ? (afterDiscount * percentInput) / 100 : 0.0;
        return {'percent': percentInput, 'amount': amount};
      }
      if (percentInput != null) {
        return {'percent': percentInput, 'amount': (afterDiscount * percentInput) / 100};
      }
      if (amountInput != null) {
        return {
          'percent': afterDiscount != 0 ? (amountInput * 100) / afterDiscount : null,
          'amount': amountInput,
        };
      }
      return {'percent': null, 'amount': 0.0};
    }

    final cgst = calcTax(
      _parseValue(_cgstPercent.text),
      _parseValue(_cgstAmount.text),
      cgstMode,
    );
    final sgst = calcTax(
      _parseValue(_sgstPercent.text),
      _parseValue(_sgstAmount.text),
      sgstMode,
    );
    final cgstAmount = cgst['amount'] ?? 0;
    final sgstAmount = sgst['amount'] ?? 0;
    final total = afterDiscount + cgstAmount + sgstAmount;

    _setControllerText(
      _subtotalAmount,
      subtotal > 0 ? _formatCalc(subtotal) : '',
    );
    _setControllerText(
      _discountPercent,
      discountPercent != null ? _formatCalc(discountPercent) : '',
    );
    _setControllerText(
      _discountAmount,
      discountAmount > 0 ? _formatCalc(discountAmount) : '',
    );
    _setControllerText(
      _afterDiscountAmount,
      subtotal > 0 ? _formatCalc(afterDiscount) : '',
    );
    _setControllerText(
      _cgstPercent,
      cgst['percent'] != null ? _formatCalc(cgst['percent']!) : '',
    );
    _setControllerText(
      _cgstAmount,
      cgstAmount > 0 ? _formatCalc(cgstAmount) : '',
    );
    _setControllerText(
      _sgstPercent,
      sgst['percent'] != null ? _formatCalc(sgst['percent']!) : '',
    );
    _setControllerText(
      _sgstAmount,
      sgstAmount > 0 ? _formatCalc(sgstAmount) : '',
    );
    _setControllerText(_totalAmount, total > 0 ? _formatCalc(total) : '');

    _isRecalculating = false;
  }

  Map<String, dynamic> _buildPOData() {
    final itemsPayload = <Map<String, dynamic>>[];
    double itemsTotal = 0;
    for (final item in _items) {
      final qty = double.tryParse(item['qty']?.toString() ?? '') ?? 0;
      final rate = double.tryParse(item['rate']?.toString() ?? '') ?? 0;
      final amount = qty * rate;
      itemsTotal += amount;
      itemsPayload.add({
        'srno': item['srNo']?.toString() ?? '',
        'hsn': item['hsn']?.toString() ?? '',
        'description': item['description']?.toString() ?? '',
        'qty': item['qty']?.toString() ?? '',
        'UOM': item['uom']?.toString() ?? '',
        'Rate': item['rate']?.toString() ?? '',
        'Amount': amount.toStringAsFixed(2),
        'remark': item['remark']?.toString(),
      });
    }
    final discountPct = _parseValue(_discountPercent.text);
    final discountAmt = _parseValue(_discountAmount.text) ?? 0;
    final afterDiscount = _parseValue(_afterDiscountAmount.text) ?? itemsTotal;
    final cgstPct = _parseValue(_cgstPercent.text);
    final sgstPct = _parseValue(_sgstPercent.text);
    final cgstAmt = _parseValue(_cgstAmount.text) ?? 0;
    final sgstAmt = _parseValue(_sgstAmount.text) ?? 0;
    final total = _parseValue(_totalAmount.text) ?? (afterDiscount + cgstAmt + sgstAmt);

    final notesText = _notes.text.trim();
    return {
      if (widget.projectId.isNotEmpty) 'project_id': widget.projectId,
      if (_selectedSampleId.trim().isNotEmpty)
        'sample_id': _selectedSampleId.trim(),
      if (_selectedSampleId.trim().isNotEmpty)
        'sampleId': _selectedSampleId.trim(),
      if (_selectedPrId.trim().isNotEmpty) 'selectedPrId': _selectedPrId.trim(),
      'companyName': _companyName.text.trim().isEmpty
          ? null
          : _companyName.text.trim(),
      'companySubtitle': _companySubtitle.text.trim().isEmpty
          ? null
          : _companySubtitle.text.trim(),
      'companyEmail': _companyEmail.text.trim().isEmpty
          ? null
          : _companyEmail.text.trim(),
      'companyGstNo': _companyGst.text.trim().isEmpty
          ? null
          : _companyGst.text.trim(),
      'indent_no': _indentNo.text.trim().isEmpty ? null : _indentNo.text.trim(),
      'indent_date': _indentDate.text.trim().isEmpty
          ? null
          : _indentDate.text.trim(),
      'order_no': _orderNo.text.trim().isEmpty ? null : _orderNo.text.trim(),
      'po_date': _poDate.text.trim().isEmpty ? null : _poDate.text.trim(),
      'vendor': {
        'name': _vendorName.text.trim().isEmpty
            ? null
            : _vendorName.text.trim(),
        'site': _site.text.trim().isEmpty ? null : _site.text.trim(),
        'contactPerson': _contactPerson.text.trim().isEmpty
            ? null
            : _contactPerson.text.trim(),
        'address': _vendorAddress.text.trim().isEmpty
            ? null
            : _vendorAddress.text.trim(),
        'contacts': {
          'primary': {
            'name': _primaryContactName.text.trim(),
            'number': _primaryContactNumber.text.trim(),
          },
          'secondary': {
            'name': _secondaryContactName.text.trim(),
            'number': _secondaryContactNumber.text.trim(),
          },
        },
      },
      'items': itemsPayload,
      'discount': {
        'percent': discountPct != null ? _formatCalc(discountPct) : null,
        'amount': discountAmt > 0 ? _formatCalc(discountAmt) : null,
      },
      'subtotalAmount': itemsTotal > 0 ? _formatCalc(itemsTotal) : null,
      'afterDiscountAmount': afterDiscount > 0 ? _formatCalc(afterDiscount) : null,
      'taxes': {
        'cgst': {
          'percent': cgstPct != null ? _formatCalc(cgstPct) : null,
          'amount': cgstAmt > 0 ? _formatCalc(cgstAmt) : null,
        },
        'sgst': {
          'percent': sgstPct != null ? _formatCalc(sgstPct) : null,
          'amount': sgstAmt > 0 ? _formatCalc(sgstAmt) : null,
        },
      },
      'totalAmount': total > 0 ? _formatCalc(total) : null,
      'total_amount': total > 0 ? _formatCalc(total) : null,
      'summary': {
        'delivery': _deliveryTerms.text.trim().isEmpty
            ? null
            : _deliveryTerms.text.trim(),
        'payment': _paymentTerms.text.trim().isEmpty
            ? null
            : _paymentTerms.text.trim(),
      },
      'notes': notesText.isEmpty ? null : notesText.split('\n'),
      'status': 'Draft',
    };
  }

  Future<void> _saveDraft() async {
    _recalculateTotals();
    final data = _buildPOData();
    final prefs = await SharedPreferences.getInstance();
    final key = widget.projectId.isEmpty
        ? _poDraftKey
        : '${_poDraftKey}_${widget.projectId}';
    await prefs.setString(key, jsonEncode(data));
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Draft saved.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    final isMobile = Responsive(context).isMobile;
    final selectedSampleMissing =
        _selectedSampleId.isNotEmpty &&
        !_sampleOptions.any(
          (s) =>
              '${s['sample_id'] ?? s['id'] ?? ''}' == _selectedSampleId,
        );
    final selectedPrMissing =
        _selectedPrId.isNotEmpty &&
        !_prOptions.any((p) => '${p['pr_id'] ?? p['id'] ?? ''}' == _selectedPrId);
    final sampleSelectOptions =
        _sampleOptions.map((sample) {
          final id = (sample['sample_id'] ?? sample['id'] ?? '').toString();
          final label =
              sample['work_done'] ??
              sample['site_name'] ??
              sample['building_name'] ??
              'Sample #$id';
          return MadSelectOption<String>(
            value: id,
            label: '#$id - $label',
          );
        }).toList();
    final prSelectOptions =
        _prOptions.map((pr) {
          final id = (pr['pr_id'] ?? pr['id'] ?? '').toString();
          final label =
              pr['workorder_no'] ?? pr['project_name'] ?? 'Purchase Request';
          return MadSelectOption<String>(
            value: id,
            label: '${_formatPrNumber(pr)} - $label',
          );
        }).toList();
    return SingleChildScrollView(
      padding: EdgeInsets.all(isMobile ? 12 : 24),
      child: MadCard(
        child: Padding(
          padding: EdgeInsets.all(isMobile ? 16 : 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Order Details',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTheme.darkForeground
                      : AppTheme.lightForeground,
                ),
              ),
              const SizedBox(height: 12),
              if (isMobile)
                Column(
                  children: [
                    MadSelect<String>(
                      value: _selectedSampleId.isEmpty
                          ? null
                          : _selectedSampleId,
                      labelText: 'Sample ID',
                      placeholder:
                          _loadingSamples
                              ? 'Loading samples...'
                              : 'Select sample (required)',
                      clearable: true,
                      onChanged: (value) => setState(() {
                        _selectedSampleId = value ?? '';
                      }),
                      options: [
                        if (selectedSampleMissing)
                          MadSelectOption(
                            value: _selectedSampleId,
                            label: 'Sample #$_selectedSampleId (current)',
                          ),
                        ...sampleSelectOptions,
                      ],
                    ),
                    const SizedBox(height: 12),
                    MadSelect<String>(
                      value: _selectedPrId.isEmpty ? null : _selectedPrId,
                      labelText: 'PR Number',
                      placeholder: _loadingPrOptions || _loadingPrItems
                          ? 'Loading PR...'
                          : 'Select PR Number',
                      clearable: true,
                      searchable: true,
                      searchHint: 'Search PR number...',
                      onChanged: (value) => _handlePrSelect(value),
                      options: [
                        if (selectedPrMissing)
                          MadSelectOption(
                            value: _selectedPrId,
                            label: 'PR #$_selectedPrId (current)',
                          ),
                        ...prSelectOptions,
                      ],
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Indent No',
                      hintText: 'Indent number',
                      controller: _indentNo,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Indent Date',
                      controller: _indentDate,
                      hintText: 'Select date',
                      suffix: IconButton(
                        icon: const Icon(Icons.calendar_today, size: 20),
                        onPressed: () => _pickDate(_indentDate),
                      ),
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Order No',
                      hintText: 'PO number',
                      controller: _orderNo,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'PO Date',
                      controller: _poDate,
                      hintText: 'Select date',
                      suffix: IconButton(
                        icon: const Icon(Icons.calendar_today, size: 20),
                        onPressed: () => _pickDate(_poDate),
                      ),
                    ),
                  ],
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: MadSelect<String>(
                        value: _selectedSampleId.isEmpty
                            ? null
                            : _selectedSampleId,
                        labelText: 'Sample ID',
                        placeholder: _loadingSamples
                            ? 'Loading samples...'
                            : 'Select sample (required)',
                        clearable: true,
                        onChanged: (value) => setState(() {
                          _selectedSampleId = value ?? '';
                        }),
                        options: [
                          if (selectedSampleMissing)
                            MadSelectOption(
                              value: _selectedSampleId,
                              label: 'Sample #$_selectedSampleId (current)',
                            ),
                          ...sampleSelectOptions,
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadSelect<String>(
                        value: _selectedPrId.isEmpty ? null : _selectedPrId,
                        labelText: 'PR Number',
                        placeholder: _loadingPrOptions || _loadingPrItems
                            ? 'Loading PR...'
                            : 'Select PR Number',
                        clearable: true,
                        searchable: true,
                        searchHint: 'Search PR number...',
                        onChanged: (value) => _handlePrSelect(value),
                        options: [
                          if (selectedPrMissing)
                            MadSelectOption(
                              value: _selectedPrId,
                              label: 'PR #$_selectedPrId (current)',
                            ),
                          ...prSelectOptions,
                        ],
                      ),
                    ),
                  ],
                ),
              if (!isMobile) const SizedBox(height: 16),
              if (!isMobile)
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        labelText: 'Indent No',
                        hintText: 'Indent number',
                        controller: _indentNo,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Indent Date',
                        controller: _indentDate,
                        hintText: 'Select date',
                        suffix: IconButton(
                          icon: const Icon(Icons.calendar_today, size: 20),
                          onPressed: () => _pickDate(_indentDate),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Order No',
                        hintText: 'PO number',
                        controller: _orderNo,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'PO Date',
                        controller: _poDate,
                        hintText: 'Select date',
                        suffix: IconButton(
                          icon: const Icon(Icons.calendar_today, size: 20),
                          onPressed: () => _pickDate(_poDate),
                        ),
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 24),
              Text(
                'Vendor Details',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTheme.darkForeground
                      : AppTheme.lightForeground,
                ),
              ),
              const SizedBox(height: 12),
              MadInput(
                labelText: 'Vendor Name',
                hintText: 'Vendor name',
                controller: _vendorName,
              ),
              const SizedBox(height: 12),
              if (isMobile)
                Column(
                  children: [
                    MadInput(
                      labelText: 'Site',
                      hintText: 'Site',
                      controller: _site,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Contact Person',
                      hintText: 'Contact person',
                      controller: _contactPerson,
                    ),
                  ],
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        labelText: 'Site',
                        hintText: 'Site',
                        controller: _site,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Contact Person',
                        hintText: 'Contact person',
                        controller: _contactPerson,
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 12),
              MadInput(
                labelText: 'Vendor Address',
                hintText: 'Address',
                controller: _vendorAddress,
                maxLines: 2,
              ),
              const SizedBox(height: 12),
              if (isMobile)
                Column(
                  children: [
                    MadInput(
                      labelText: 'Primary Contact Name',
                      hintText: 'Name',
                      controller: _primaryContactName,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Primary Contact Number',
                      hintText: 'Number',
                      controller: _primaryContactNumber,
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Secondary Contact Name',
                      hintText: 'Name',
                      controller: _secondaryContactName,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Secondary Contact Number',
                      hintText: 'Number',
                      controller: _secondaryContactNumber,
                      keyboardType: TextInputType.phone,
                    ),
                  ],
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        labelText: 'Primary Contact Name',
                        hintText: 'Name',
                        controller: _primaryContactName,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Primary Contact Number',
                        hintText: 'Number',
                        controller: _primaryContactNumber,
                        keyboardType: TextInputType.phone,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Secondary Contact Name',
                        hintText: 'Name',
                        controller: _secondaryContactName,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Secondary Contact Number',
                        hintText: 'Number',
                        controller: _secondaryContactNumber,
                        keyboardType: TextInputType.phone,
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Items',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isDark
                          ? AppTheme.darkForeground
                          : AppTheme.lightForeground,
                    ),
                  ),
                  MadButton(
                    size: ButtonSize.sm,
                    text: 'Add Item',
                    icon: LucideIcons.plus,
                    onPressed: () {
                      setState(() {
                        _items.add({
                          '_id': ++_itemId,
                          'srNo': '${_items.length + 1}',
                          'hsn': '',
                          'description': '',
                          'qty': '',
                          'uom': '',
                          'rate': '',
                          'amount': '',
                          'remark': '',
                        });
                        _recalculateTotals();
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ...List.generate(_items.length, (i) {
                return _POItemRow(
                  key: ValueKey(_items[i]['_id']),
                  isDark: isDark,
                  initialValues: _items[i],
                  onChanged: (m) => setState(() {
                    _items[i] = m;
                    _recalculateTotals();
                  }),
                  onRemove: () => setState(() {
                    _items.removeAt(i);
                    _recalculateTotals();
                  }),
                );
              }),
              const SizedBox(height: 24),
              Text(
                'Totals',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTheme.darkForeground
                      : AppTheme.lightForeground,
                ),
              ),
              const SizedBox(height: 12),
              if (isMobile)
                Column(
                  children: [
                    MadInput(
                      labelText: 'Subtotal Amount',
                      hintText: '0',
                      controller: _subtotalAmount,
                      enabled: false,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Discount %',
                      hintText: '0',
                      controller: _discountPercent,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Discount Amount',
                      hintText: '0',
                      controller: _discountAmount,
                      enabled: false,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'After Discount Amount',
                      hintText: '0',
                      controller: _afterDiscountAmount,
                      enabled: false,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'CGST %',
                      hintText: '0',
                      controller: _cgstPercent,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'CGST Amount',
                      hintText: '0',
                      controller: _cgstAmount,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'SGST %',
                      hintText: '0',
                      controller: _sgstPercent,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'SGST Amount',
                      hintText: '0',
                      controller: _sgstAmount,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Total Amount',
                      hintText: '0',
                      controller: _totalAmount,
                      enabled: false,
                    ),
                  ],
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        labelText: 'Subtotal Amount',
                        hintText: '0',
                        controller: _subtotalAmount,
                        enabled: false,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Discount %',
                        hintText: '0',
                        controller: _discountPercent,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Discount Amount',
                        hintText: '0',
                        controller: _discountAmount,
                        enabled: false,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'After Discount Amount',
                        hintText: '0',
                        controller: _afterDiscountAmount,
                        enabled: false,
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 12),
              if (!isMobile)
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        labelText: 'CGST %',
                        hintText: '0',
                        controller: _cgstPercent,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'CGST Amount',
                        hintText: '0',
                        controller: _cgstAmount,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'SGST %',
                        hintText: '0',
                        controller: _sgstPercent,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'SGST Amount',
                        hintText: '0',
                        controller: _sgstAmount,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Total Amount',
                        hintText: '0',
                        controller: _totalAmount,
                        enabled: false,
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 24),
              Text(
                'Additional',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTheme.darkForeground
                      : AppTheme.lightForeground,
                ),
              ),
              const SizedBox(height: 12),
              if (isMobile)
                Column(
                  children: [
                    MadInput(
                      labelText: 'Delivery terms',
                      hintText: 'e.g. 7 days',
                      controller: _deliveryTerms,
                    ),
                    const SizedBox(height: 12),
                    MadInput(
                      labelText: 'Payment terms',
                      hintText: 'e.g. 30 days',
                      controller: _paymentTerms,
                    ),
                  ],
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        labelText: 'Delivery terms',
                        hintText: 'e.g. 7 days',
                        controller: _deliveryTerms,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        labelText: 'Payment terms',
                        hintText: 'e.g. 30 days',
                        controller: _paymentTerms,
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 12),
              MadTextarea(
                labelText: 'Notes',
                hintText: 'Additional notes...',
                controller: _notes,
                minLines: 2,
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: MadButton(
                      text: 'Save Draft',
                      icon: LucideIcons.save,
                      variant: ButtonVariant.outline,
                      onPressed: _saveDraft,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: MadButton(
                      text: 'Preview',
                      icon: LucideIcons.eye,
                      variant: ButtonVariant.outline,
                      onPressed: () => widget.onPreview(_buildPOData()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: MadButton(
                  text: widget.editingPoId != null ? 'Update PO' : 'Submit PO',
                  icon: LucideIcons.send,
                  disabled: _isSubmitting,
                  onPressed: () async {
                    if (_selectedSampleId.trim().isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Sample ID is required for purchase order.'),
                        ),
                      );
                      return;
                    }
                    setState(() => _isSubmitting = true);
                    final data = _buildPOData();
                    final projectId = int.tryParse(widget.projectId);
                    final payload = _buildPoApiPayloadFromUi(
                      data,
                      projectId: projectId,
                      statusOverride: widget.editingPoId != null
                          ? null
                          : 'Submitted',
                    );
                    final result = widget.editingPoId != null
                        ? await ApiClient.updatePO(widget.editingPoId!, payload)
                        : await ApiClient.createPO(payload);
                    if (!mounted) return;
                    setState(() => _isSubmitting = false);
                    if (result['success'] == true) {
                      widget.onSubmitted();
                    }
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _POItemRow extends StatefulWidget {
  final bool isDark;
  final Map<String, dynamic> initialValues;
  final void Function(Map<String, dynamic>) onChanged;
  final VoidCallback onRemove;

  const _POItemRow({
    super.key,
    required this.isDark,
    required this.initialValues,
    required this.onChanged,
    required this.onRemove,
  });

  @override
  State<_POItemRow> createState() => _POItemRowState();
}

class _POItemRowState extends State<_POItemRow> {
  late TextEditingController _srNo;
  late TextEditingController _hsn;
  late TextEditingController _desc;
  late TextEditingController _qty;
  late TextEditingController _uom;
  late TextEditingController _rate;
  late TextEditingController _remark;

  @override
  void initState() {
    super.initState();
    final v = widget.initialValues;
    _srNo = TextEditingController(text: v['srNo']?.toString() ?? '');
    _hsn = TextEditingController(text: v['hsn']?.toString() ?? '');
    _desc = TextEditingController(text: v['description']?.toString() ?? '');
    _qty = TextEditingController(text: v['qty']?.toString() ?? '');
    _uom = TextEditingController(text: v['uom']?.toString() ?? '');
    _rate = TextEditingController(text: v['rate']?.toString() ?? '');
    _remark = TextEditingController(text: v['remark']?.toString() ?? '');
    _qty.addListener(_syncAmount);
    _rate.addListener(_syncAmount);
  }

  void _syncAmount() {
    final qty = double.tryParse(_qty.text) ?? 0;
    final rate = double.tryParse(_rate.text) ?? 0;
    widget.initialValues['qty'] = _qty.text;
    widget.initialValues['rate'] = _rate.text;
    widget.initialValues['amount'] = (qty * rate).toStringAsFixed(2);
    widget.onChanged(widget.initialValues);
  }

  @override
  void dispose() {
    _qty.removeListener(_syncAmount);
    _rate.removeListener(_syncAmount);
    _srNo.dispose();
    _hsn.dispose();
    _desc.dispose();
    _qty.dispose();
    _uom.dispose();
    _rate.dispose();
    _remark.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive(context).isMobile;
    final qty = double.tryParse(_qty.text) ?? 0;
    final rate = double.tryParse(_rate.text) ?? 0;
    final amount = qty * rate;

    if (isMobile) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: widget.isDark
                ? AppTheme.darkMuted.withOpacity(0.25)
                : AppTheme.lightMuted.withOpacity(0.35),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: widget.isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    'Item ${_srNo.text.isEmpty ? '-' : _srNo.text}',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: widget.isDark
                          ? AppTheme.darkForeground
                          : AppTheme.lightForeground,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline),
                    onPressed: widget.onRemove,
                    color: Theme.of(context).colorScheme.error,
                  ),
                ],
              ),
              MadInput(
                labelText: 'Sr No',
                controller: _srNo,
                hintText: 'Sr',
                onChanged: (_) => _updateMap(),
              ),
              const SizedBox(height: 10),
              MadInput(
                labelText: 'HSN',
                controller: _hsn,
                hintText: 'HSN',
                onChanged: (_) => _updateMap(),
              ),
              const SizedBox(height: 10),
              MadInput(
                labelText: 'Description',
                controller: _desc,
                hintText: 'Description',
                onChanged: (_) => _updateMap(),
              ),
              const SizedBox(height: 10),
              MadInput(
                labelText: 'Qty',
                controller: _qty,
                hintText: 'Qty',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                onChanged: (_) => _updateMap(),
              ),
              const SizedBox(height: 10),
              MadInput(
                labelText: 'UOM',
                controller: _uom,
                hintText: 'UOM',
                onChanged: (_) => _updateMap(),
              ),
              const SizedBox(height: 10),
              MadInput(
                labelText: 'Rate',
                controller: _rate,
                hintText: 'Rate',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                onChanged: (_) => _updateMap(),
              ),
              const SizedBox(height: 10),
              Text(
                'Amount: ${amount.toStringAsFixed(2)}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: widget.isDark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                ),
              ),
              const SizedBox(height: 10),
              MadInput(
                labelText: 'Remark',
                controller: _remark,
                hintText: 'Remark',
                onChanged: (_) => _updateMap(),
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: 700,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 48,
                child: MadInput(
                  controller: _srNo,
                  hintText: 'Sr',
                  onChanged: (_) => _updateMap(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 72,
                child: MadInput(
                  controller: _hsn,
                  hintText: 'HSN',
                  onChanged: (_) => _updateMap(),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: MadInput(
                  controller: _desc,
                  hintText: 'Description',
                  onChanged: (_) => _updateMap(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 64,
                child: MadInput(
                  controller: _qty,
                  hintText: 'Qty',
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  onChanged: (_) => _updateMap(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 56,
                child: MadInput(
                  controller: _uom,
                  hintText: 'UOM',
                  onChanged: (_) => _updateMap(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 80,
                child: MadInput(
                  controller: _rate,
                  hintText: 'Rate',
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  onChanged: (_) => _updateMap(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 88,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    amount.toStringAsFixed(2),
                    style: TextStyle(
                      fontSize: 14,
                      color: widget.isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 80,
                child: MadInput(
                  controller: _remark,
                  hintText: 'Remark',
                  onChanged: (_) => _updateMap(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.remove_circle_outline),
                onPressed: widget.onRemove,
                color: Theme.of(context).colorScheme.error,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _updateMap() {
    widget.initialValues['srNo'] = _srNo.text;
    widget.initialValues['hsn'] = _hsn.text;
    widget.initialValues['description'] = _desc.text;
    widget.initialValues['qty'] = _qty.text;
    widget.initialValues['uom'] = _uom.text;
    widget.initialValues['rate'] = _rate.text;
    widget.initialValues['remark'] = _remark.text;
    widget.onChanged(widget.initialValues);
  }
}

class _PurchaseOrderEmailDialog extends StatefulWidget {
  final PurchaseOrder order;
  final String projectId;

  const _PurchaseOrderEmailDialog({
    required this.order,
    required this.projectId,
  });

  @override
  State<_PurchaseOrderEmailDialog> createState() =>
      _PurchaseOrderEmailDialogState();
}

class _PurchaseOrderEmailDialogState
    extends State<_PurchaseOrderEmailDialog> {
  bool _loadingVendors = false;
  bool _sending = false;
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
      (vendor['vendor_email'] ?? vendor['email'] ?? '').toString();

  Future<void> _loadVendors() async {
    setState(() => _loadingVendors = true);
    try {
      final result = widget.projectId.isNotEmpty
          ? await ApiClient.getVendorsByProject(widget.projectId)
          : await ApiClient.getVendors();
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final list = data is List ? data : const [];
        final vendors = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .where((v) => _vendorEmail(v).trim().isNotEmpty)
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
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _vendors = [];
        _loadingVendors = false;
      });
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

  Future<void> _sendEmail() async {
    if (_sending) return;
    final selectedVendors = _vendors
        .where((v) => _selectedVendorIds.contains(_vendorId(v)))
        .toList();
    if (selectedVendors.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Select at least one vendor with a valid email.'),
        ),
      );
      return;
    }
    setState(() => _sending = true);
    try {
      final to = selectedVendors
          .map((v) => _vendorEmail(v))
          .where((e) => e.trim().isNotEmpty)
          .join(', ');
      final result = await ApiClient.sendPoEmail(
        poId: widget.order.id,
        to: to,
        message: _remarksController.text.trim(),
        attachmentFiles: _attachments,
      );
      if (!mounted) return;
      if (result['success'] == true) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('PO email sent')),
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            (result['error'] ?? 'Failed to send email').toString(),
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to send email')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;
    final border = isDark ? AppTheme.darkBorder : AppTheme.lightBorder;
    final maxHeight = MediaQuery.of(context).size.height * 0.85;
    final selectedVendors = _vendors
        .where((v) => _selectedVendorIds.contains(_vendorId(v)))
        .toList();

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
              'Email Purchase Order',
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
              'Select vendors. The selected PO will be sent to their email addresses.',
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
                              'PO: ${widget.order.orderNo}',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Vendor: ${widget.order.vendorName ?? '-'}',
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
                                          height: 220,
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
                    text: _sending ? 'Sending...' : 'Send Email',
                    icon: LucideIcons.mail,
                    disabled:
                        _sending || _loadingVendors || _selectedVendorIds.isEmpty,
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
