import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:printing/printing.dart';
import 'package:url_launcher/url_launcher.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../utils/app_navigation.dart';
import '../utils/responsive.dart';

class SampleEditPage extends StatefulWidget {
  final String sampleId;

  const SampleEditPage({super.key, required this.sampleId});

  @override
  State<SampleEditPage> createState() => _SampleEditPageState();
}

class _SampleEditPageState extends State<SampleEditPage> {
  bool _loading = true;
  bool _saving = false;

  final _building = TextEditingController();
  final _site = TextEditingController();
  final _workDone = TextEditingController();
  final _sampleFile = TextEditingController();
  final _floor = TextEditingController();
  final _block = TextEditingController();
  final _wing = TextEditingController();
  final _coordinates = TextEditingController();

  final List<_ItemControllers> _items = [];
  final List<_AdditionalControllers> _additional = [];

  void _goToPreview() {
    context.appGo('/samples/preview', extra: widget.sampleId);
  }

  Future<Uint8List> _loadPdfBytes(String url) async {
    final response = await http.get(Uri.parse(url));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Failed to load PDF');
    }
    return response.bodyBytes;
  }

  @override
  void initState() {
    super.initState();
    _loadSample();
  }

  @override
  void dispose() {
    _building.dispose();
    _site.dispose();
    _workDone.dispose();
    _sampleFile.dispose();
    _floor.dispose();
    _block.dispose();
    _wing.dispose();
    _coordinates.dispose();
    for (final item in _items) {
      item.dispose();
    }
    for (final field in _additional) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> _loadSample() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.getSampleById(widget.sampleId);
      if (!mounted) return;
      if (res['success'] == true && res['data'] != null) {
        final raw = Map<String, dynamic>.from(res['data'] as Map);
        final normalized = _normalizeSample(raw);

        _building.text = normalized['building_name'] ?? '';
        _site.text = normalized['site_name'] ?? '';
        _workDone.text = normalized['work_done'] ?? '';
        _sampleFile.text = normalized['sample_file'] ?? '';
        _floor.text = normalized['location']?['floor']?.toString() ?? '';
        _block.text = normalized['location']?['block']?.toString() ?? '';
        _wing.text = normalized['location']?['wing']?.toString() ?? '';
        _coordinates.text = normalized['location']?['coordinates']?.toString() ?? '';

        _items.clear();
        final items = normalized['item_description'] as List? ?? [];
        if (items.isEmpty) {
          _items.add(_ItemControllers());
        } else {
          for (final row in items) {
            final r = row as Map? ?? {};
            _items.add(_ItemControllers(
              srNo: r['sr_no']?.toString() ?? '',
              description: r['description']?.toString() ?? '',
              quantity: r['quantity']?.toString() ?? '',
              value: r['value']?.toString() ?? '',
            ));
          }
        }

        _additional.clear();
        final adds = normalized['add_fields'] as List? ?? [];
        for (final f in adds) {
          final field = f as Map? ?? {};
          _additional.add(_AdditionalControllers(
            keyText: field['key']?.toString() ?? '',
            valueText: field['value']?.toString() ?? '',
          ));
        }
      }
    } catch (_) {
      if (!mounted) return;
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
      'building_name': raw['building_name'] ?? '',
      'site_name': raw['site_name'] ?? '',
      'work_done': raw['work_done'] ?? '',
      'sample_file': raw['sample_file'] ?? '',
      'location': (loc is Map) ? Map<String, dynamic>.from(loc) : <String, dynamic>{},
      'item_description': (items is List) ? List<dynamic>.from(items) : <dynamic>[],
      'add_fields': (adds is List) ? List<dynamic>.from(adds) : <dynamic>[],
    };
  }

  Map<String, dynamic> _buildPayload() {
    return {
      'building_name': _building.text.trim(),
      'site_name': _site.text.trim(),
      'work_done': _workDone.text.trim(),
      'sample_file': _sampleFile.text.trim(),
      'location': {
        'floor': _floor.text.trim(),
        'block': _block.text.trim(),
        'wing': _wing.text.trim(),
        'coordinates': _coordinates.text.trim(),
      },
      'item_description': _items.map((e) => e.toJson()).toList(),
      'add_fields': _additional.map((e) => e.toJson()).toList(),
    };
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final res = await ApiClient.updateSample(widget.sampleId, _buildPayload());
      if (!mounted) return;
      if (res['success'] == true) {
        showToast(context, 'Sample updated');
        _goToPreview();
      } else {
        showToast(context, res['error']?.toString() ?? 'Update failed', variant: ToastVariant.error);
      }
    } catch (_) {
      if (!mounted) return;
      showToast(context, 'Update failed', variant: ToastVariant.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
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

    final filePath = _sampleFile.text.trim();
    final fileUrl = filePath.isNotEmpty ? ApiClient.getApiFileUrl(filePath) : '';
    final lower = filePath.toLowerCase();
    final isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
    final isPdf = lower.endsWith('.pdf');

    return ProtectedRoute(
      title: 'Edit Sample',
      route: '/samples/edit',
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
                        'Edit Sample',
                        style: TextStyle(
                          fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Update sample details and save changes',
                        style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                      ),
                    ],
                  ),
                ),
                MadButton(
                  text: 'Back to Preview',
                  icon: LucideIcons.arrowLeft,
                  variant: ButtonVariant.outline,
                  onPressed: _goToPreview,
                ),
              ],
            ),
            const SizedBox(height: 24),

            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: _loading
                    ? const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Sample #${widget.sampleId}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 16),
                          MadInput(labelText: 'Building Name', controller: _building),
                          const SizedBox(height: 12),
                          MadInput(labelText: 'Site Name', controller: _site),
                          const SizedBox(height: 12),
                          MadInput(labelText: 'Work Done', controller: _workDone),
                          const SizedBox(height: 12),
                          Text('Attachment', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                          const SizedBox(height: 8),
                          if (fileUrl.isEmpty)
                            Text('No attachment found', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground))
                          else
                            Wrap(
                              spacing: 8,
                              children: [
                                MadButton(text: 'Preview', icon: LucideIcons.eye, variant: ButtonVariant.outline, onPressed: () => _showAttachmentDialog(fileUrl, isImage, isPdf)),
                                MadButton(text: 'Open', icon: LucideIcons.externalLink, variant: ButtonVariant.outline, onPressed: () => _openAttachment(fileUrl)),
                              ],
                            ),
                          const SizedBox(height: 16),
                          Text('Location', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                              SizedBox(width: isMobile ? double.infinity : 220, child: MadInput(labelText: 'Floor', controller: _floor)),
                              SizedBox(width: isMobile ? double.infinity : 220, child: MadInput(labelText: 'Block', controller: _block)),
                              SizedBox(width: isMobile ? double.infinity : 220, child: MadInput(labelText: 'Wing', controller: _wing)),
                              SizedBox(width: isMobile ? double.infinity : 220, child: MadInput(labelText: 'Coordinates', controller: _coordinates)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Item Description', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                              MadButton(
                                text: 'Add Row',
                                icon: LucideIcons.plus,
                                variant: ButtonVariant.outline,
                                onPressed: () => setState(() => _items.add(_ItemControllers())),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Column(
                            children: [
                              for (int i = 0; i < _items.length; i++)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: MadCard(
                                    child: Padding(
                                      padding: const EdgeInsets.all(12),
                                      child: Column(
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(child: MadInput(labelText: 'Sr No', controller: _items[i].srNo)),
                                              const SizedBox(width: 12),
                                              Expanded(child: MadInput(labelText: 'Quantity', controller: _items[i].quantity)),
                                              const SizedBox(width: 12),
                                              Expanded(child: MadInput(labelText: 'Value', controller: _items[i].value)),
                                              const SizedBox(width: 12),
                                              MadButton(
                                                icon: LucideIcons.trash2,
                                                variant: ButtonVariant.outline,
                                                size: ButtonSize.sm,
                                                onPressed: () => setState(() => _items.removeAt(i)),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 12),
                                          MadTextarea(labelText: 'Description', minLines: 2, controller: _items[i].description),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Additional Fields', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                              MadButton(
                                text: 'Add',
                                icon: LucideIcons.plus,
                                variant: ButtonVariant.outline,
                                onPressed: () => setState(() => _additional.add(_AdditionalControllers())),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Column(
                            children: [
                              for (int i = 0; i < _additional.length; i++)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Row(
                                    children: [
                                      Expanded(child: MadInput(labelText: 'Key', controller: _additional[i].keyText)),
                                      const SizedBox(width: 12),
                                      Expanded(child: MadInput(labelText: 'Value', controller: _additional[i].valueText)),
                                      const SizedBox(width: 8),
                                      MadButton(
                                        icon: LucideIcons.trash2,
                                        size: ButtonSize.sm,
                                        variant: ButtonVariant.outline,
                                        onPressed: () => setState(() => _additional.removeAt(i)),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: _goToPreview),
                              const SizedBox(width: 12),
                              MadButton(text: _saving ? 'Saving...' : 'Save', icon: LucideIcons.save, onPressed: _saving ? null : _save),
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
}

class _ItemControllers {
  final TextEditingController srNo;
  final TextEditingController description;
  final TextEditingController quantity;
  final TextEditingController value;

  _ItemControllers({
    String srNo = '',
    String description = '',
    String quantity = '',
    String value = '',
  })  : srNo = TextEditingController(text: srNo),
        description = TextEditingController(text: description),
        quantity = TextEditingController(text: quantity),
        value = TextEditingController(text: value);

  Map<String, dynamic> toJson() => {
        'sr_no': srNo.text.trim(),
        'description': description.text.trim(),
        'quantity': quantity.text.trim(),
        'value': value.text.trim(),
      };

  void dispose() {
    srNo.dispose();
    description.dispose();
    quantity.dispose();
    value.dispose();
  }
}

class _AdditionalControllers {
  final TextEditingController keyText;
  final TextEditingController valueText;

  _AdditionalControllers({String keyText = '', String valueText = ''})
      : keyText = TextEditingController(text: keyText),
        valueText = TextEditingController(text: valueText);

  Map<String, dynamic> toJson() => {
        'key': keyText.text.trim(),
        'value': valueText.text.trim(),
      };

  void dispose() {
    keyText.dispose();
    valueText.dispose();
  }
}
