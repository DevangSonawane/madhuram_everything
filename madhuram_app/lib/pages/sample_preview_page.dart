import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:url_launcher/url_launcher.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../services/pdf_service.dart';
import '../theme/app_theme.dart';
import '../utils/app_navigation.dart';
import '../utils/responsive.dart';

class SamplePreviewPage extends StatefulWidget {
  final String sampleId;

  const SamplePreviewPage({super.key, required this.sampleId});

  @override
  State<SamplePreviewPage> createState() => _SamplePreviewPageState();
}

class _SamplePreviewPageState extends State<SamplePreviewPage> {
  bool _loading = true;
  bool _downloading = false;
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
    dynamic parseField(String key, dynamic fallback) {
      final val = raw[key];
      if (val is String && val.isNotEmpty) {
        try {
          return jsonDecode(val);
        } catch (_) {
          return fallback;
        }
      }
      return val ?? fallback;
    }

    final loc = parseField('location', <String, dynamic>{});
    final items = parseField('item_description', <dynamic>[]);
    final adds = parseField('add_fields', <dynamic>[]);

    return {
      'sample_id': raw['sample_id'] ?? raw['id'],
      'project_id': raw['project_id'],
      'building_name': raw['building_name'] ?? '',
      'site_name': raw['site_name'] ?? '',
      'work_done': raw['work_done'] ?? '',
      'sample_file': raw['sample_file'] ?? '',
      'flats': raw['flats'] ?? '',
      'floors': raw['floors'] ?? '',
      'location': (loc is Map)
          ? Map<String, dynamic>.from(loc)
          : <String, dynamic>{},
      'item_description': (items is List)
          ? List<dynamic>.from(items)
          : <dynamic>[],
      'add_fields': (adds is List) ? List<dynamic>.from(adds) : <dynamic>[],
      'created_at': raw['created_at'],
      'updated_at': raw['updated_at'],
    };
  }

  String _formatDate(dynamic value) {
    if (value == null) return '-';
    final text = value is DateTime
        ? value.toLocal().toString()
        : value.toString();
    final parsed = DateTime.tryParse(text);
    if (parsed == null) return text;
    return '${parsed.day.toString().padLeft(2, '0')} ${_monthName(parsed.month)} ${parsed.year}, ${_formatTime(parsed)}';
  }

  String _monthName(int month) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[(month - 1).clamp(0, 11)];
  }

  String _formatTime(DateTime value) {
    final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
    final minute = value.minute.toString().padLeft(2, '0');
    final amPm = value.hour >= 12 ? 'pm' : 'am';
    return '$hour:$minute $amPm';
  }

  int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    final cleaned = value.toString().replaceAll(RegExp(r'[^0-9-]'), '');
    return int.tryParse(cleaned) ?? 0;
  }

  double _toDouble(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    final cleaned = value.toString().replaceAll(',', '').trim();
    return double.tryParse(cleaned) ?? 0;
  }

  String _firstNonEmpty(Iterable<dynamic> values, [String fallback = '-']) {
    for (final value in values) {
      final text = value?.toString().trim() ?? '';
      if (text.isNotEmpty && text.toLowerCase() != 'null') return text;
    }
    return fallback;
  }

  int _getUsageValue(Map<String, dynamic> usage, String key) {
    final value = usage[key];
    if (value is List) {
      return value.fold<int>(0, (sum, item) => sum + _toInt(item));
    }
    return _toInt(value);
  }

  List<_SampleBoqRow> _buildBoqSummaryRows() {
    final sample = _sample;
    if (sample == null) return const [];

    final items = sample['item_description'] as List? ?? const [];
    final sourceItems = items
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();

    return sourceItems.asMap().entries.map((entry) {
      final index = entry.key;
      final row = entry.value;
      final fields = row['add_fields'] is List
          ? (row['add_fields'] as List)
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList()
          : <Map<String, dynamic>>[];
      dynamic fieldValue(String key) {
        for (final field in fields) {
          if (field['key']?.toString().trim() == key) {
            return field['value'];
          }
        }
        return null;
      }

      final usage = row['boq_usage'] is Map
          ? Map<String, dynamic>.from(row['boq_usage'] as Map)
          : <String, dynamic>{};
      final itemNo = _firstNonEmpty([
        row['item_no'],
        row['itemNo'],
        fieldValue('item_no'),
        fieldValue('itemNo'),
        row['boq_item_code'],
        row['boqItemCode'],
        row['boq_description'],
        row['description'],
        row['item_name'],
        row['itemName'],
      ]);
      final itemCode = _firstNonEmpty([
        row['item_code'],
        row['itemCode'],
        row['code'],
        fieldValue('item_code'),
        fieldValue('itemCode'),
        fieldValue('code'),
      ]);
      final description = _firstNonEmpty([
        row['boq_description'],
        row['description'],
        row['item_description'],
        row['itemDescription'],
        row['item_name'],
        row['itemName'],
      ]);
      final sampleUsage = _getUsageValue(usage, 'samples');
      final fallbackSampleUsage = _toDouble(
        row['total_qty'] ??
            row['quantity'] ??
            row['qty_per_flat'] ??
            row['selected_qty'] ??
            row['issued_qty'] ??
            row['boq_issued_qty'],
      ).toInt();

      return _SampleBoqRow(
        key:
            '${row['boq_id'] ?? row['boqId'] ?? row['sr_no'] ?? row['srNo'] ?? index}',
        itemNo: itemNo,
        itemCode: itemCode,
        description: description,
        samples: sampleUsage > 0 ? sampleUsage : fallbackSampleUsage,
        pr: _getUsageValue(usage, 'pr'),
        po: _getUsageValue(usage, 'po'),
        dc: _getUsageValue(usage, 'dc'),
        mir: _getUsageValue(usage, 'mir'),
        itr: _getUsageValue(usage, 'itr'),
      );
    }).toList();
  }

  Future<void> _downloadSamplePdf() async {
    final sample = _sample;
    if (sample == null) return;

    setState(() => _downloading = true);
    try {
      final doc = await PdfService.createDocument();
      final rows = _buildBoqSummaryRows();
      final filename =
          'Sample_${(sample['sample_id'] ?? widget.sampleId).toString().replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_')}.pdf';

      doc.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(32),
          header: (context) => PdfService.buildHeader(
            title: 'Sample Preview',
            subtitle: 'Detailed view and attachment inspection',
            projectName: sample['project_id']?.toString(),
            date: _formatDate(sample['created_at']),
          ),
          footer: PdfService.buildFooter,
          build: (context) => [
            pw.SizedBox(height: 16),
            pw.Container(
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                color: PdfColors.grey50,
                border: pw.Border.all(color: PdfColors.grey300),
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
              ),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          'Sample #${sample['sample_id'] ?? widget.sampleId}',
                          style: pw.TextStyle(
                            fontSize: 16,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          'Preview data synced from sample record',
                          style: const pw.TextStyle(
                            fontSize: 10,
                            color: PdfColors.grey700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: PdfColors.grey400),
                      borderRadius: const pw.BorderRadius.all(
                        pw.Radius.circular(999),
                      ),
                    ),
                    child: pw.Text(
                      'ID: ${sample['sample_id'] ?? widget.sampleId}',
                      style: const pw.TextStyle(fontSize: 9),
                    ),
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 16),
            PdfService.buildTable(
              headers: const [
                'Project',
                'Created',
                'Updated',
                'Building',
                'Site',
                'Flats',
                'Floors',
                'Work Done',
              ],
              rows: [
                [
                  sample['project_id']?.toString() ?? '-',
                  _formatDate(sample['created_at']),
                  _formatDate(sample['updated_at']),
                  sample['building_name']?.toString() ?? '-',
                  sample['site_name']?.toString() ?? '-',
                  sample['flats']?.toString() ?? '-',
                  _getFloorValue(sample) ?? '-',
                  sample['work_done']?.toString() ?? '-',
                ],
              ],
            ),
            pw.SizedBox(height: 20),
            pw.Container(
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColors.grey300),
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'Location',
                    style: pw.TextStyle(
                      fontSize: 12,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _pdfPill(
                        'Floor',
                        sample['location']?['floor']?.toString() ?? '-',
                      ),
                      _pdfPill(
                        'Block',
                        sample['location']?['block']?.toString() ?? '-',
                      ),
                      _pdfPill(
                        'Wing',
                        sample['location']?['wing']?.toString() ?? '-',
                      ),
                      _pdfPill(
                        'Coordinates',
                        sample['location']?['coordinates']?.toString() ?? '-',
                      ),
                    ],
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 20),
            pw.Container(
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColors.grey300),
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'BOQ Usage Summary',
                    style: pw.TextStyle(
                      fontSize: 12,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Text(
                    'PR, PO, DC, MIR, ITR, Sample usage, and total consumption for each BOQ item',
                    style: const pw.TextStyle(
                      fontSize: 9,
                      color: PdfColors.grey700,
                    ),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Text(
                    '${rows.length} item(s)',
                    style: const pw.TextStyle(
                      fontSize: 9,
                      color: PdfColors.grey600,
                    ),
                  ),
                  pw.SizedBox(height: 10),
                  if (rows.isEmpty)
                    pw.Padding(
                      padding: const pw.EdgeInsets.symmetric(vertical: 14),
                      child: pw.Center(
                        child: pw.Text(
                          'No BOQ items available for this sample.',
                          style: const pw.TextStyle(
                            fontSize: 10,
                            color: PdfColors.grey600,
                          ),
                        ),
                      ),
                    )
                  else
                    pw.TableHelper.fromTextArray(
                      headers: const [
                        'BOQ Item No',
                        'Item Code',
                        'Item Description',
                        'Samples',
                        'PR',
                        'PO',
                        'DC',
                        'MIR',
                        'ITR',
                      ],
                      data: rows
                          .map(
                            (row) => [
                              row.itemNo,
                              row.itemCode,
                              row.description,
                              row.samples.toString(),
                              row.pr.toString(),
                              row.po.toString(),
                              row.dc.toString(),
                              row.mir.toString(),
                              row.itr.toString(),
                            ],
                          )
                          .toList(),
                      headerStyle: pw.TextStyle(
                        fontSize: 9,
                        fontWeight: pw.FontWeight.bold,
                      ),
                      cellStyle: const pw.TextStyle(fontSize: 8),
                      headerDecoration: const pw.BoxDecoration(
                        color: PdfColors.grey200,
                      ),
                      cellHeight: 24,
                      columnWidths: const {
                        0: pw.FixedColumnWidth(90),
                        1: pw.FixedColumnWidth(80),
                        2: pw.FlexColumnWidth(3),
                      },
                    ),
                ],
              ),
            ),
          ],
        ),
      );

      final savedPath = await FileService.saveFileAs(
        filename: filename,
        bytes: await doc.save(),
      );

      if (!mounted) return;
      if (savedPath != null) {
        showToast(context, 'Sample PDF saved');
      } else {
        showToast(
          context,
          'PDF download cancelled',
          variant: ToastVariant.error,
        );
      }
    } catch (_) {
      if (!mounted) return;
      showToast(
        context,
        'Could not generate sample PDF',
        variant: ToastVariant.error,
      );
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  String? _getFloorValue(Map<String, dynamic> sample) {
    final floors = sample['floors']?.toString().trim() ?? '';
    if (floors.isNotEmpty) return floors;
    final location = sample['location'];
    if (location is Map) {
      final value = location['floor']?.toString().trim() ?? '';
      if (value.isNotEmpty) return value;
    }
    return null;
  }

  Future<void> _openAttachment(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        showToast(
          context,
          'Could not open attachment',
          variant: ToastVariant.error,
        );
      }
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
                  style: TextStyle(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              ),
          ],
        ),
      ),
      actions: [
        MadButton(
          text: 'Open',
          icon: LucideIcons.externalLink,
          onPressed: () => _openAttachment(url),
        ),
        MadButton(
          text: 'Close',
          variant: ButtonVariant.outline,
          onPressed: () => Navigator.pop(context),
        ),
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
    final fileUrl = filePath.isNotEmpty
        ? ApiClient.getApiFileUrl(filePath)
        : '';
    final lower = filePath.toLowerCase();
    final isImage =
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.gif') ||
        lower.endsWith('.webp');
    final isPdf = lower.endsWith('.pdf');
    final rows = _buildBoqSummaryRows();
    final idText = sample?['sample_id']?.toString() ?? widget.sampleId;

    return ProtectedRoute(
      title: 'Sample Preview',
      route: '/samples/preview',
      child: SingleChildScrollView(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    (isDark
                        ? AppTheme.darkBackground
                        : AppTheme.lightBackground),
                    (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                        .withValues(alpha: 0.45),
                  ],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                      .withValues(alpha: 0.8),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MadBadge(
                    text: 'Sample Management',
                    variant: BadgeVariant.outline,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Sample Preview',
                    style: TextStyle(
                      fontSize: responsive.value(
                        mobile: 24,
                        tablet: 28,
                        desktop: 32,
                      ),
                      fontWeight: FontWeight.bold,
                      color: isDark
                          ? AppTheme.darkForeground
                          : AppTheme.lightForeground,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Detailed view and attachment inspection',
                    style: TextStyle(
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      MadButton(
                        text: 'Back',
                        icon: LucideIcons.arrowLeft,
                        variant: ButtonVariant.outline,
                        onPressed: _goBack,
                      ),
                      MadButton(
                        text: _downloading ? 'Downloading...' : 'Download PDF',
                        icon: _downloading ? null : LucideIcons.download,
                        variant: ButtonVariant.outline,
                        loading: _downloading,
                        onPressed: sample == null || _downloading
                            ? null
                            : _downloadSamplePdf,
                      ),
                      MadButton(
                        text: 'Edit',
                        icon: LucideIcons.pencil,
                        onPressed: sample == null
                            ? null
                            : () => context.appGo(
                                '/samples/edit',
                                extra: widget.sampleId,
                              ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: _loading
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    : sample == null
                    ? Text(
                        'Sample not found',
                        style: TextStyle(
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      )
                    : Column(
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
                                      'Sample #$idText',
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Preview data synced from sample record',
                                      style: TextStyle(
                                        color: isDark
                                            ? AppTheme.darkMutedForeground
                                            : AppTheme.lightMutedForeground,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              MadBadge(
                                text: 'ID: $idText',
                                variant: BadgeVariant.outline,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final tileWidth = isMobile
                                  ? double.infinity
                                  : constraints.maxWidth / 3 - 10;
                              return Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  _infoTile(
                                    'Project',
                                    '${sample['project_id'] ?? '-'}',
                                    isDark,
                                    tileWidth,
                                  ),
                                  _infoTile(
                                    'Created',
                                    _formatDate(sample['created_at']),
                                    isDark,
                                    tileWidth,
                                  ),
                                  _infoTile(
                                    'Updated',
                                    _formatDate(sample['updated_at']),
                                    isDark,
                                    tileWidth,
                                  ),
                                  _infoTile(
                                    'Building',
                                    sample['building_name']?.toString() ?? '-',
                                    isDark,
                                    tileWidth,
                                  ),
                                  _infoTile(
                                    'Site',
                                    sample['site_name']?.toString() ?? '-',
                                    isDark,
                                    tileWidth,
                                  ),
                                  _infoTile(
                                    'Flats',
                                    sample['flats']?.toString() ?? '-',
                                    isDark,
                                    tileWidth,
                                  ),
                                  _infoTile(
                                    'Floors',
                                    _getFloorValue(sample) ?? '-',
                                    isDark,
                                    tileWidth,
                                  ),
                                  _infoTile(
                                    'Work Done',
                                    sample['work_done']?.toString() ?? '-',
                                    isDark,
                                    tileWidth,
                                  ),
                                ],
                              );
                            },
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Location',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                              _pill(
                                sample['location']?['floor']?.toString() ?? '-',
                                isDark,
                              ),
                              _pill(
                                sample['location']?['block']?.toString() ?? '-',
                                isDark,
                              ),
                              _pill(
                                sample['location']?['wing']?.toString() ?? '-',
                                isDark,
                              ),
                              _pill(
                                sample['location']?['coordinates']
                                        ?.toString() ??
                                    '-',
                                isDark,
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'BOQ Usage Summary',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'PR, PO, DC, MIR, ITR, Sample usage, and total consumption for each BOQ item',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                          const SizedBox(height: 10),
                          MadBadge(
                            text: '${rows.length} item(s)',
                            variant: BadgeVariant.outline,
                          ),
                          const SizedBox(height: 8),
                          _buildBoqUsageTable(rows, isDark),
                          const SizedBox(height: 20),
                          Text(
                            'Attachment',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 8),
                          if (fileUrl.isEmpty)
                            Text(
                              'No attachment found',
                              style: TextStyle(
                                color: isDark
                                    ? AppTheme.darkMutedForeground
                                    : AppTheme.lightMutedForeground,
                              ),
                            )
                          else
                            Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: [
                                MadButton(
                                  text: 'Preview Attachment',
                                  icon: LucideIcons.eye,
                                  onPressed: () => _showAttachmentDialog(
                                    fileUrl,
                                    isImage,
                                    isPdf,
                                  ),
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

  Widget _infoTile(String label, String value, bool isDark, double width) {
    return Container(
      width: width,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
        color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(
          alpha: 0.2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value.isEmpty ? '-' : value,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: isDark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(String text, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
      ),
      child: Text(
        text.isEmpty ? '-' : text,
        style: const TextStyle(fontSize: 12),
      ),
    );
  }

  pw.Widget _pdfPill(String label, String value) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: pw.BoxDecoration(
        borderRadius: pw.BorderRadius.circular(999),
        border: pw.Border.all(color: PdfColors.grey400),
      ),
      child: pw.Text(
        '$label: ${value.isEmpty ? '-' : value}',
        style: const pw.TextStyle(fontSize: 9),
      ),
    );
  }

  Widget _buildBoqUsageTable(List<_SampleBoqRow> rows, bool isDark) {
    const widths = [140.0, 140.0, 280.0, 100.0, 80.0, 80.0, 80.0, 80.0, 80.0];
    final tableWidth = widths.fold<double>(0, (sum, width) => sum + width) + 24;

    Widget headerCell(
      String text,
      double width, {
      TextAlign align = TextAlign.left,
    }) {
      return SizedBox(
        width: width,
        child: Text(
          text,
          textAlign: align,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
      );
    }

    Widget dataCell(
      String text,
      double width, {
      TextAlign align = TextAlign.left,
    }) {
      return SizedBox(
        width: width,
        child: Text(
          text.isEmpty ? '-' : text,
          textAlign: align,
          overflow: TextOverflow.ellipsis,
          maxLines: 2,
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: tableWidth,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                      .withValues(alpha: 0.35),
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(14),
                  ),
                ),
                child: Row(
                  children: [
                    headerCell('BOQ Item No', widths[0]),
                    headerCell('Item Code', widths[1]),
                    headerCell('Item Description', widths[2]),
                    headerCell('Samples', widths[3], align: TextAlign.center),
                    headerCell('PR', widths[4], align: TextAlign.center),
                    headerCell('PO', widths[5], align: TextAlign.center),
                    headerCell('DC', widths[6], align: TextAlign.center),
                    headerCell('MIR', widths[7], align: TextAlign.center),
                    headerCell('ITR', widths[8], align: TextAlign.center),
                  ],
                ),
              ),
              if (rows.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Text(
                    'No BOQ items available for this sample.',
                    style: TextStyle(
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                  ),
                )
              else
                ...rows.asMap().entries.map((entry) {
                  final row = entry.value;
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      border: Border(
                        top: BorderSide(
                          color: (isDark ? Colors.white : Colors.black)
                              .withValues(alpha: 0.06),
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        dataCell(row.itemNo, widths[0]),
                        dataCell(row.itemCode, widths[1]),
                        dataCell(row.description, widths[2]),
                        dataCell(
                          row.samples.toString(),
                          widths[3],
                          align: TextAlign.center,
                        ),
                        dataCell(
                          row.pr.toString(),
                          widths[4],
                          align: TextAlign.center,
                        ),
                        dataCell(
                          row.po.toString(),
                          widths[5],
                          align: TextAlign.center,
                        ),
                        dataCell(
                          row.dc.toString(),
                          widths[6],
                          align: TextAlign.center,
                        ),
                        dataCell(
                          row.mir.toString(),
                          widths[7],
                          align: TextAlign.center,
                        ),
                        dataCell(
                          row.itr.toString(),
                          widths[8],
                          align: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}

class _SampleBoqRow {
  final String key;
  final String itemNo;
  final String itemCode;
  final String description;
  final int samples;
  final int pr;
  final int po;
  final int dc;
  final int mir;
  final int itr;

  const _SampleBoqRow({
    required this.key,
    required this.itemNo,
    required this.itemCode,
    required this.description,
    required this.samples,
    required this.pr,
    required this.po,
    required this.dc,
    required this.mir,
    required this.itr,
  });
}
