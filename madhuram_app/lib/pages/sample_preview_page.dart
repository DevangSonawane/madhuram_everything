import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:printing/printing.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';
import '../utils/app_navigation.dart';

class SamplePreviewPage extends StatefulWidget {
  final String sampleId;

  const SamplePreviewPage({super.key, required this.sampleId});

  @override
  State<SamplePreviewPage> createState() => _SamplePreviewPageState();
}

class _SamplePreviewPageState extends State<SamplePreviewPage> {
  bool _loading = true;
  Map<String, dynamic>? _sample;

  Future<Uint8List> _loadPdfBytes(String url) async {
    final response = await http.get(Uri.parse(url));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Failed to load PDF');
    }
    return response.bodyBytes;
  }

  Future<void> _goBack() async {
    final popped = await Navigator.maybePop(context);
    if (!popped && mounted) {
      context.appGo('/samples');
    }
  }

  @override
  void initState() {
    super.initState();
    _loadSample();
  }

  Future<void> _loadSample() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.getSampleById(widget.sampleId);
      if (!mounted) return;
      if (res['success'] == true && res['data'] != null) {
        final raw = Map<String, dynamic>.from(res['data'] as Map);
        _sample = _normalizeSample(raw);
      } else {
        _sample = null;
      }
    } catch (_) {
      if (!mounted) return;
      _sample = null;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic> _normalizeSample(Map<String, dynamic> raw) {
    Map<String, dynamic> parseField(String key, dynamic fallback) {
      final val = raw[key];
      if (val is String && val.isNotEmpty) {
        try {
          return {'value': jsonDecode(val)};
        } catch (_) {
          return {'value': fallback};
        }
      }
      return {'value': val ?? fallback};
    }

    final loc = parseField('location', <String, dynamic>{})['value'];
    final items = parseField('item_description', <dynamic>[])['value'];
    final adds = parseField('add_fields', <dynamic>[])['value'];

    return {
      'sample_id': raw['sample_id'] ?? raw['id'],
      'project_id': raw['project_id'],
      'building_name': raw['building_name'] ?? '',
      'site_name': raw['site_name'] ?? '',
      'work_done': raw['work_done'] ?? '',
      'sample_file': raw['sample_file'] ?? '',
      'location': (loc is Map) ? Map<String, dynamic>.from(loc) : <String, dynamic>{},
      'item_description': (items is List) ? List<dynamic>.from(items) : <dynamic>[],
      'add_fields': (adds is List) ? List<dynamic>.from(adds) : <dynamic>[],
      'created_at': raw['created_at'],
      'updated_at': raw['updated_at'],
    };
  }

  String _formatDate(dynamic value) {
    if (value == null) return '-';
    if (value is DateTime) {
      return value.toLocal().toString();
    }
    final str = value.toString();
    final parsed = DateTime.tryParse(str);
    if (parsed == null) return str;
    return '${parsed.day.toString().padLeft(2, '0')}-${parsed.month.toString().padLeft(2, '0')}-${parsed.year} ${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _openAttachment(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) showToast(context, 'Could not open attachment', variant: ToastVariant.error);
    }
  }

  void _showAttachmentDialog(String url, bool isImage, bool isPdf) {
    MadDialog.show(
      context: context,
      title: 'Attachment Preview',
      content: SizedBox(
        width: 820,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isImage)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(url, fit: BoxFit.contain),
              )
            else if (isPdf)
              SizedBox(
                height: 620,
                child: PdfPreview(
                  canChangeOrientation: false,
                  canChangePageFormat: false,
                  canDebug: false,
                  allowPrinting: false,
                  allowSharing: false,
                  build: (_) => _loadPdfBytes(url),
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'Preview not available for this file type.',
                  style: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                ),
              ),
          ],
        ),
      ),
      actions: [
        MadButton(text: 'Open', icon: LucideIcons.externalLink, onPressed: () => _openAttachment(url)),
        MadButton(text: 'Close', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;
    final sample = _sample;

    final filePath = sample?['sample_file']?.toString() ?? '';
    final fileUrl = filePath.isNotEmpty ? ApiClient.getApiFileUrl(filePath) : '';
    final lower = filePath.toLowerCase();
    final isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
    final isPdf = lower.endsWith('.pdf');

    return ProtectedRoute(
      title: 'Sample Preview',
      route: '/samples/preview',
      child: SingleChildScrollView(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sample Preview',
                        style: TextStyle(
                          fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Detailed view and attachment inspection',
                        style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                      ),
                    ],
                  ),
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    MadButton(
                      text: 'Back',
                      icon: LucideIcons.arrowLeft,
                      variant: ButtonVariant.outline,
                      onPressed: _goBack,
                    ),
                    MadButton(
                      text: 'Edit',
                      icon: LucideIcons.pencil,
                      onPressed: sample == null
                          ? null
                          : () => context.appGo('/samples/edit', extra: widget.sampleId),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 24),

            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: _loading
                    ? const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
                    : sample == null
                        ? Text(
                            'Sample not found',
                            style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Sample #${sample['sample_id'] ?? widget.sampleId}',
                                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                  MadBadge(text: 'ID: ${sample['sample_id'] ?? widget.sampleId}', variant: BadgeVariant.outline),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  _infoTile('Project', '${sample['project_id'] ?? '-'}', isDark, isMobile),
                                  _infoTile('Created', _formatDate(sample['created_at']), isDark, isMobile),
                                  _infoTile('Updated', _formatDate(sample['updated_at']), isDark, isMobile),
                                  _infoTile('Building', sample['building_name']?.toString() ?? '-', isDark, isMobile),
                                  _infoTile('Site', sample['site_name']?.toString() ?? '-', isDark, isMobile),
                                  _infoTile('Work Done', sample['work_done']?.toString() ?? '-', isDark, isMobile),
                                ],
                              ),
                              const SizedBox(height: 20),
                              Text('Location', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  _pill(sample['location']?['floor']?.toString() ?? '-', isDark),
                                  _pill(sample['location']?['block']?.toString() ?? '-', isDark),
                                  _pill(sample['location']?['wing']?.toString() ?? '-', isDark),
                                  _pill(sample['location']?['coordinates']?.toString() ?? '-', isDark),
                                ],
                              ),
                              const SizedBox(height: 20),
                              Text('Item Description', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                              const SizedBox(height: 8),
                              _buildItemsTable(sample['item_description'] as List? ?? [], isDark, isMobile),
                              const SizedBox(height: 20),
                              Text('Additional Fields', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                              const SizedBox(height: 8),
                              _buildAdditional(sample['add_fields'] as List? ?? [], isDark),
                              const SizedBox(height: 20),
                              Text('Attachment', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                              const SizedBox(height: 8),
                              if (fileUrl.isEmpty)
                                Text('No attachment found', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground))
                              else
                                Wrap(
                                  spacing: 12,
                                  children: [
                                    MadButton(
                                      text: 'Preview',
                                      icon: LucideIcons.eye,
                                      onPressed: () => _showAttachmentDialog(fileUrl, isImage, isPdf),
                                    ),
                                    MadButton(
                                      text: 'Open',
                                      icon: LucideIcons.externalLink,
                                      variant: ButtonVariant.outline,
                                      onPressed: () => _openAttachment(fileUrl),
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

  Widget _infoTile(String label, String value, bool isDark, bool isMobile) {
    return Container(
      width: isMobile ? double.infinity : 200,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
        color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
        ],
      ),
    );
  }

  Widget _pill(String text, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
      ),
      child: Text(text, style: const TextStyle(fontSize: 12)),
    );
  }

  Widget _buildItemsTable(List items, bool isDark, bool isMobile) {
    return MadCard(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.3),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            ),
            child: Row(
              children: [
                _header('Sr No', flex: 1, isDark: isDark),
                _header('Description', flex: 3, isDark: isDark),
                if (!isMobile) _header('Quantity', flex: 1, isDark: isDark),
                if (!isMobile) _header('Value', flex: 1, isDark: isDark),
              ],
            ),
          ),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('No item rows available', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (context, index) => Divider(height: 1, color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withValues(alpha: 0.5)),
              itemBuilder: (context, index) {
                final row = items[index] as Map? ?? {};
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      Expanded(flex: 1, child: Text(row['sr_no']?.toString() ?? '-')),
                      Expanded(flex: 3, child: Text(row['description']?.toString() ?? '-')),
                      if (!isMobile) Expanded(flex: 1, child: Text(row['quantity']?.toString() ?? '-')),
                      if (!isMobile) Expanded(flex: 1, child: Text(row['value']?.toString() ?? '-')),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildAdditional(List fields, bool isDark) {
    if (fields.isEmpty) {
      return Text('No additional fields', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground));
    }
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: fields.map((f) {
        final field = f as Map? ?? {};
        return Container(
          width: 220,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(field['key']?.toString() ?? 'Field', style: TextStyle(fontSize: 11, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
              const SizedBox(height: 4),
              Text(field['value']?.toString() ?? '-', style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _header(String text, {required int flex, required bool isDark}) {
    return Expanded(
      flex: flex,
      child: Text(
        text,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
      ),
    );
  }
}
