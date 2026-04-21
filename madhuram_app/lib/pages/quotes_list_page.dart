import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';
import 'quotes_preview_page.dart';

class QuotesListPage extends StatefulWidget {
  const QuotesListPage({super.key});

  @override
  State<QuotesListPage> createState() => _QuotesListPageState();
}

class _QuotesListPageState extends State<QuotesListPage> {
  final _searchController = TextEditingController();
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _quotes = const [];
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String? _resolveProjectId(Map<String, dynamic>? project) {
    return project?['id']?.toString() ?? project?['project_id']?.toString();
  }

  String _normalizeText(dynamic value) {
    return (value?.toString() ?? '').trim().toLowerCase();
  }

  DateTime? _tryParseDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      final parsed = DateTime.tryParse(trimmed);
      return parsed;
    }
    return null;
  }

  String _formatDate(dynamic value) {
    final parsed = _tryParseDate(value);
    if (parsed == null) return '-';
    return DateFormat('dd MMM yyyy').format(parsed.toLocal());
  }

  String _resolveStatus(Map<String, dynamic> item) {
    final status = item['status']?.toString();
    if (status != null && status.trim().isNotEmpty) return status.trim();
    return 'pending';
  }

  BadgeVariant _statusVariant(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'accepted':
      case 'present':
      case 'completed':
        return BadgeVariant.success;
      case 'rejected':
      case 'cancelled':
      case 'absent':
      case 'failed':
        return BadgeVariant.destructive;
      case 'draft':
      case 'pending':
      case 'submitted':
      default:
        return BadgeVariant.warning;
    }
  }

  String _resolveId(Map<String, dynamic> item) {
    return (item['id'] ?? item['quotation_id'] ?? item['quotationId'] ?? '')
        .toString();
  }

  Future<void> _load({bool showToastOnError = false}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ApiClient.getQuotations();
      if (!mounted) return;
      if (result['success'] != true) {
        final message =
            result['error']?.toString() ?? 'Unable to load quotations';
        setState(() => _error = message);
        if (showToastOnError) {
          showToast(context, message, variant: ToastVariant.error);
        }
        return;
      }

      final data = result['data'];
      final items = <Map<String, dynamic>>[];
      if (data is List) {
        for (final row in data) {
          if (row is Map<String, dynamic>) {
            items.add(row);
          } else if (row is Map) {
            items.add(Map<String, dynamic>.from(row));
          }
        }
      } else if (data is Map && data['data'] is List) {
        for (final row in (data['data'] as List)) {
          if (row is Map) items.add(Map<String, dynamic>.from(row));
        }
      }

      final store = StoreProvider.of<AppState>(context);
      final selectedProjectId =
          _resolveProjectId(store.state.project.selectedProject) ??
          store.state.project.selectedProjectId;

      final filtered =
          (selectedProjectId == null || selectedProjectId.trim().isEmpty)
          ? items
          : items.where((item) {
              final itemProjectId =
                  item['project_id']?.toString() ??
                  item['projectId']?.toString() ??
                  item['project_id_fk']?.toString();
              if (itemProjectId == null || itemProjectId.trim().isEmpty) {
                return true;
              }
              return itemProjectId.toString() == selectedProjectId.toString();
            }).toList();

      filtered.sort((a, b) {
        final aDate =
            _tryParseDate(a['quotation_date']) ??
            _tryParseDate(a['created_at']) ??
            _tryParseDate(a['updated_at']);
        final bDate =
            _tryParseDate(b['quotation_date']) ??
            _tryParseDate(b['created_at']) ??
            _tryParseDate(b['updated_at']);
        final aMillis = aDate?.millisecondsSinceEpoch ?? 0;
        final bMillis = bDate?.millisecondsSinceEpoch ?? 0;
        return bMillis.compareTo(aMillis);
      });

      setState(() => _quotes = filtered);
    } catch (e) {
      if (!mounted) return;
      final message = 'Unable to load quotations. $e';
      setState(() => _error = message);
      if (showToastOnError) {
        showToast(context, message, variant: ToastVariant.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _visibleQuotes {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _quotes;
    return _quotes.where((item) {
      final hay = [
        item['quotation_no'],
        item['project_name'],
        item['client_name'],
        item['status'],
      ].map(_normalizeText).join(' ');
      return hay.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Quotations',
      route: '/projects/quotes/add',
      showSidebar: false,
      headerLeadingIcon: LucideIcons.arrowLeft,
      onHeaderLeadingPressed: () =>
          Navigator.pushReplacementNamed(context, '/projects'),
      requireProject: true,
      child: RefreshIndicator(
        onRefresh: () => _load(showToastOnError: true),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 16),
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
                          'Quotations',
                          style: TextStyle(
                            fontSize: responsive.value(
                              mobile: 22,
                              tablet: 26,
                              desktop: 28,
                            ),
                            fontWeight: FontWeight.w800,
                            color: isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'View quotations and open preview. (View-only on mobile)',
                          style: TextStyle(
                            color: isDark
                                ? AppTheme.darkMutedForeground
                                : AppTheme.lightMutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                  MadButton(
                    text: _loading ? 'Loading...' : 'Refresh',
                    icon: LucideIcons.refreshCw,
                    disabled: _loading,
                    variant: ButtonVariant.outline,
                    onPressed: _loading
                        ? null
                        : () => _load(showToastOnError: true),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              MadCard(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Search',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _searchController,
                        onChanged: (value) => setState(() => _query = value),
                        decoration: InputDecoration(
                          hintText: 'Search quotation no, project, client...',
                          prefixIcon: const Icon(LucideIcons.search, size: 18),
                          suffixIconConstraints: const BoxConstraints(
                            minWidth: 40,
                            minHeight: 40,
                          ),
                          suffixIcon: SizedBox(
                            width: 40,
                            height: 40,
                            child: _query.trim().isEmpty
                                ? const SizedBox.shrink()
                                : IconButton(
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() => _query = '');
                                    },
                                    icon: const Icon(LucideIcons.x, size: 18),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints.tightFor(
                                      width: 40,
                                      height: 40,
                                    ),
                                  ),
                          ),
                          filled: true,
                          fillColor:
                              (isDark
                                      ? AppTheme.darkMuted
                                      : AppTheme.lightMuted)
                                  .withValues(alpha: 0.4),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (_error != null) ...[
                MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        const Icon(
                          LucideIcons.triangleAlert,
                          color: Color(0xFFDC2626),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(_error!)),
                      ],
                    ),
                  ),
                ),
              ] else if (_loading && _quotes.isEmpty) ...[
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ] else if (_visibleQuotes.isEmpty) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Center(
                    child: Text(
                      _quotes.isEmpty
                          ? 'No quotations found.'
                          : 'No matching quotations.',
                      style: TextStyle(
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ),
                ),
              ] else ...[
                ..._visibleQuotes.map((item) {
                  final status = _resolveStatus(item);
                  final id = _resolveId(item);
                  final quotationNo = item['quotation_no']?.toString().trim();
                  final projectName = item['project_name']?.toString().trim();
                  final clientName = item['client_name']?.toString().trim();
                  final quotationDate = _formatDate(item['quotation_date']);
                  final subtitle = [
                    if (projectName != null && projectName.isNotEmpty)
                      projectName,
                    if (clientName != null && clientName.isNotEmpty) clientName,
                    if (quotationDate != '-') quotationDate,
                  ].join(' • ');

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: MadCard(
                      onTap: (id.trim().isEmpty)
                          ? null
                          : () {
                              Navigator.push(
                                context,
                                MaterialPageRoute<void>(
                                  builder: (_) =>
                                      QuotesPreviewPage(quotationId: id),
                                ),
                              );
                            },
                      hoverable: true,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                color:
                                    (isDark
                                            ? AppTheme.darkMuted
                                            : AppTheme.lightMuted)
                                        .withValues(alpha: 0.55),
                              ),
                              child: const Center(
                                child: Icon(
                                  LucideIcons.fileSpreadsheet,
                                  size: 18,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    quotationNo == null || quotationNo.isEmpty
                                        ? 'Quotation'
                                        : 'Quotation #$quotationNo',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    subtitle.isEmpty ? '-' : subtitle,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isDark
                                          ? AppTheme.darkMutedForeground
                                          : AppTheme.lightMutedForeground,
                                    ),
                                  ),
                                  if (!isMobile && id.trim().isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      'Tap to preview',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark
                                            ? AppTheme.darkMutedForeground
                                            : AppTheme.lightMutedForeground,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            MadBadge(
                              text: status,
                              variant: _statusVariant(status),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
