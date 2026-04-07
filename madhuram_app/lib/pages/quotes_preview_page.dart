import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class QuotesPreviewPage extends StatefulWidget {
  final String quotationId;

  const QuotesPreviewPage({
    super.key,
    required this.quotationId,
  });

  @override
  State<QuotesPreviewPage> createState() => _QuotesPreviewPageState();
}

class _QuotesPreviewPageState extends State<QuotesPreviewPage> {
  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _quote;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  DateTime? _tryParseDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      return DateTime.tryParse(trimmed);
    }
    return null;
  }

  String _formatDate(dynamic value) {
    final parsed = _tryParseDate(value);
    if (parsed == null) return '-';
    return DateFormat('dd MMM yyyy').format(parsed.toLocal());
  }

  String _resolveStatus(Map<String, dynamic> quote) {
    final status = quote['status']?.toString();
    if (status != null && status.trim().isNotEmpty) return status.trim();
    return 'pending';
  }

  BadgeVariant _statusVariant(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'accepted':
      case 'completed':
        return BadgeVariant.success;
      case 'rejected':
      case 'cancelled':
      case 'failed':
        return BadgeVariant.destructive;
      case 'draft':
      case 'pending':
      default:
        return BadgeVariant.warning;
    }
  }

  Future<void> _load({bool showToastOnError = false}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ApiClient.getQuotationById(widget.quotationId);
      if (!mounted) return;
      if (result['success'] != true) {
        final message = result['error']?.toString() ?? 'Unable to load quotation';
        setState(() => _error = message);
        if (showToastOnError) {
          showToast(context, message, variant: ToastVariant.error);
        }
        return;
      }
      final data = result['data'];
      if (data is Map<String, dynamic>) {
        setState(() => _quote = data);
      } else if (data is Map) {
        setState(() => _quote = Map<String, dynamic>.from(data));
      } else {
        setState(() => _error = 'Quotation not found.');
      }
    } catch (e) {
      if (!mounted) return;
      final message = 'Unable to load quotation. $e';
      setState(() => _error = message);
      if (showToastOnError) {
        showToast(context, message, variant: ToastVariant.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);

    final quote = _quote;
    final itemsRaw = quote?['items'];
    final items = <Map<String, dynamic>>[];
    if (itemsRaw is List) {
      for (final row in itemsRaw) {
        if (row is Map<String, dynamic>) {
          items.add(row);
        } else if (row is Map) {
          items.add(Map<String, dynamic>.from(row));
        }
      }
    }

    final status = quote == null ? 'pending' : _resolveStatus(quote);

    return ProtectedRoute(
      title: 'Quotation Preview',
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
                    child: Text(
                      'Quotation Preview',
                      style: TextStyle(
                        fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                        fontWeight: FontWeight.w800,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                    ),
                  ),
                  MadButton(
                    text: _loading ? 'Loading...' : 'Refresh',
                    icon: LucideIcons.refreshCw,
                    variant: ButtonVariant.outline,
                    disabled: _loading,
                    onPressed: _loading ? null : () => _load(showToastOnError: true),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_error != null) ...[
                MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.triangleAlert, color: Color(0xFFDC2626)),
                        const SizedBox(width: 10),
                        Expanded(child: Text(_error!)),
                      ],
                    ),
                  ),
                ),
              ] else if (_loading && quote == null) ...[
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ] else if (quote == null) ...[
                const SizedBox.shrink(),
              ] else ...[
                MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(LucideIcons.fileSpreadsheet, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Quotation #${quote['quotation_no']?.toString() ?? '-'}',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            MadBadge(
                              text: status,
                              variant: _statusVariant(status),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _MetaRow(label: 'Project', value: quote['project_name']),
                        _MetaRow(label: 'Client', value: quote['client_name']),
                        _MetaRow(
                          label: 'Quotation Date',
                          value: _formatDate(quote['quotation_date']),
                        ),
                        _MetaRow(
                          label: 'GST %',
                          value: quote['gst_percentage'] ?? quote['gstPercentage'],
                        ),
                        _MetaRow(
                          label: 'Revised Offer',
                          value: quote['is_revised_offer']?.toString(),
                        ),
                        _MetaRow(label: 'Notes', value: quote['notes']),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Items (${items.length})',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 10),
                        if (items.isEmpty)
                          Text(
                            'No items.',
                            style: TextStyle(
                              color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                            ),
                          )
                        else
                          ...items.asMap().entries.map((entry) {
                            final idx = entry.key + 1;
                            final item = entry.value;
                            final description = item['description'] ??
                                item['item_description'] ??
                                item['name'];
                            final unit = item['unit'];
                            final qty = item['quantity'] ?? item['qty'];
                            final rate = item['rate'] ?? item['basic_rate'] ?? item['basicRate'];
                            final amount = item['amount'] ?? item['total_amount'] ?? item['totalAmount'];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                                        .withValues(alpha: 0.5),
                                  ),
                                  color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                                      .withValues(alpha: 0.22),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Item $idx',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    _MetaRow(label: 'Description', value: description),
                                    _MetaRow(label: 'Unit', value: unit),
                                    _MetaRow(label: 'Qty', value: qty),
                                    _MetaRow(label: 'Rate', value: rate),
                                    _MetaRow(label: 'Amount', value: amount),
                                  ],
                                ),
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  final String label;
  final dynamic value;

  const _MetaRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = value == null ? '-' : value.toString().trim();
    final display = text.isEmpty ? '-' : text;
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
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
          ),
          Expanded(
            child: Text(
              display,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
