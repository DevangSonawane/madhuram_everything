import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/challan.dart';
import '../models/purchase_order.dart';
import '../services/api_client.dart';
import '../services/file_service.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';
import '../utils/app_navigation.dart';

class ChallanDetailPage extends StatefulWidget {
  final String challanId;

  const ChallanDetailPage({super.key, required this.challanId});

  @override
  State<ChallanDetailPage> createState() => _ChallanDetailPageState();
}

class _ChallanDetailPageState extends State<ChallanDetailPage> {
  bool _loading = true;
  bool _saving = false;
  bool _loadingPos = false;

  Challan? _challan;
  List<PurchaseOrder> _projectPos = [];
  PurchaseOrder? _selectedPo;

  final _challanNumber = TextEditingController();
  final _challanDate = TextEditingController();
  final _workOrderNumber = TextEditingController();
  final _orderDate = TextEditingController();

  final List<_DCItemControllers> _items = [];

  String _attachmentPath = '';

  @override
  void initState() {
    super.initState();
    _loadChallan();
  }

  @override
  void dispose() {
    _challanNumber.dispose();
    _challanDate.dispose();
    _workOrderNumber.dispose();
    _orderDate.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  Future<void> _loadChallan() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.getChallanById(widget.challanId);
      if (!mounted) return;
      if (res['success'] == true && res['data'] != null) {
        final c = Challan.fromJson(res['data'] as Map<String, dynamic>);
        _challan = c;
        _hydrateForm(c);
        await _loadPos(c.projectId ?? '');
      } else {
        _challan = null;
      }
    } catch (_) {
      if (!mounted) return;
      _challan = null;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _hydrateForm(Challan c) {
    _challanNumber.text = c.challanNumber;
    _challanDate.text = c.challanDate ?? '';
    _workOrderNumber.text = c.workOrderNumber ?? '';
    _orderDate.text = c.orderDate ?? '';

    _items.clear();
    if (c.items.isEmpty) {
      _items.add(_DCItemControllers());
    } else {
      for (final item in c.items) {
        _items.add(_DCItemControllers(
          name: item.name,
          description: item.description,
          width: item.width,
          length: item.length,
          quantity: item.quantity,
          price: item.price,
        ));
      }
    }
  }

  Future<void> _loadPos(String projectId) async {
    if (projectId.isEmpty) return;
    setState(() => _loadingPos = true);
    try {
      final res = await ApiClient.getPOsByProject(projectId);
      if (!mounted) return;
      if (res['success'] == true && res['data'] is List) {
        final list = (res['data'] as List).map((e) => PurchaseOrder.fromJson(e)).toList();
        setState(() {
          _projectPos = list;
          _selectedPo = list.firstWhere(
            (p) => p.id == _challan?.poId || p.orderNo == _challan?.poNumber,
            orElse: () => PurchaseOrder(id: '', orderNo: ''),
          );
          if (_selectedPo?.id.isEmpty == true) _selectedPo = null;
        });
      }
    } catch (_) {
      if (!mounted) return;
    } finally {
      if (mounted) setState(() => _loadingPos = false);
    }
  }

  Future<void> _pickDate(TextEditingController c) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2035),
    );
    if (date != null) {
      c.text = '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _save() async {
    if (_challan == null) return;
    if (_challanNumber.text.trim().isEmpty) {
      showToast(context, 'Challan number is required', variant: ToastVariant.error);
      return;
    }
    final hasValidItem = _items.any((e) =>
        e.name.text.trim().isNotEmpty ||
        e.description.text.trim().isNotEmpty ||
        e.quantity.text.trim().isNotEmpty);
    if (!hasValidItem) {
      showToast(context, 'Add at least one challan item', variant: ToastVariant.error);
      return;
    }

    final payload = {
      'project_id': int.tryParse(_challan!.projectId ?? '') ?? _challan!.projectId,
      'challan_number': _challanNumber.text.trim(),
      'items': _items.map((e) => e.toJson()).toList(),
      if (_selectedPo?.id.isNotEmpty == true) 'po_id': int.tryParse(_selectedPo!.id) ?? _selectedPo!.id,
      if ((_selectedPo?.orderNo ?? '').isNotEmpty) 'po_number': _selectedPo!.orderNo,
      if (_challanDate.text.trim().isNotEmpty) 'challan_date': _challanDate.text.trim(),
      if (_workOrderNumber.text.trim().isNotEmpty) 'work_order_number': _workOrderNumber.text.trim(),
      if (_orderDate.text.trim().isNotEmpty) 'order_date': _orderDate.text.trim(),
    };

    setState(() => _saving = true);
    try {
      final res = await ApiClient.updateChallan(_challan!.id, payload);
      if (!mounted) return;
      if (res['success'] == true) {
        showToast(context, 'Challan updated');
        _loadChallan();
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

  Future<void> _uploadAttachment() async {
    final file = await FileService.pickFileWithSource(context: context);
    if (file == null) return;
    final res = await ApiClient.uploadChallanFile(file);
    if (!mounted) return;
    if (res['success'] == true) {
      final data = res['data'] as Map?;
      final filePath = data?['filePath']?.toString() ?? '';
      setState(() => _attachmentPath = filePath);
      showToast(context, 'Attachment uploaded');
    } else {
      showToast(context, res['error']?.toString() ?? 'Upload failed', variant: ToastVariant.error);
    }
  }

  Future<void> _openAttachment(String url) async {
    final uri = Uri.parse(url.startsWith('http') ? url : ApiClient.getApiFileUrl(url));
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) showToast(context, 'Could not open attachment', variant: ToastVariant.error);
    }
  }

  void _selectPoById(String? value) {
    if (value == null) {
      setState(() => _selectedPo = null);
      return;
    }
    final po = _projectPos.firstWhere((p) => p.id == value, orElse: () => PurchaseOrder(id: '', orderNo: ''));
    setState(() => _selectedPo = po.id.isEmpty ? null : po);
  }

  void _selectPoByNumber(String? value) {
    if (value == null) {
      setState(() => _selectedPo = null);
      return;
    }
    final po = value.startsWith('__poid__:')
        ? _projectPos.firstWhere(
            (p) => p.id == value.replaceFirst('__poid__:', ''),
            orElse: () => PurchaseOrder(id: '', orderNo: ''),
          )
        : _projectPos.firstWhere(
            (p) => p.orderNo == value,
            orElse: () => PurchaseOrder(id: '', orderNo: ''),
          );
    setState(() => _selectedPo = po.id.isEmpty ? null : po);
  }

  void _openMIR() {
    if (_challan == null) return;
    context.appPush('/mir', extra: {
      'challan_number': _challan!.challanNumber,
    });
  }

  void _openITR() {
    if (_challan == null) return;
    context.appPush('/itr', extra: {
      'challan_number': _challan!.challanNumber,
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Challan Details',
      route: '/challans/detail',
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
                        'Challan Details',
                        style: TextStyle(
                          fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'View and update delivery challan data',
                        style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                      ),
                    ],
                  ),
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    MadButton(text: 'Back', icon: LucideIcons.arrowLeft, variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
                    MadButton(text: 'Create MIR', icon: LucideIcons.clipboardCheck, variant: ButtonVariant.outline, onPressed: _openMIR),
                    MadButton(text: 'Create ITR', icon: LucideIcons.clipboardList, variant: ButtonVariant.outline, onPressed: _openITR),
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
                    : _challan == null
                        ? Text('Challan not found', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground))
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Challan #${_challan!.challanNumber}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 16),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  SizedBox(width: isMobile ? double.infinity : 260, child: MadInput(labelText: 'Challan Number', controller: _challanNumber)),
                                  SizedBox(
                                    width: isMobile ? double.infinity : 220,
                                    child: MadInput(
                                      labelText: 'Challan Date',
                                      controller: _challanDate,
                                      suffix: IconButton(icon: const Icon(Icons.calendar_today, size: 18), onPressed: () => _pickDate(_challanDate)),
                                    ),
                                  ),
                                  SizedBox(width: isMobile ? double.infinity : 260, child: MadInput(labelText: 'Work Order Number', controller: _workOrderNumber)),
                                  SizedBox(
                                    width: isMobile ? double.infinity : 220,
                                    child: MadInput(
                                      labelText: 'Order Date',
                                      controller: _orderDate,
                                      suffix: IconButton(icon: const Icon(Icons.calendar_today, size: 18), onPressed: () => _pickDate(_orderDate)),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  SizedBox(
                                    width: isMobile ? double.infinity : 240,
                                    child: MadSelect<String>(
                                      labelText: 'PO ID',
                                      value: _selectedPo?.id,
                                      placeholder: _loadingPos ? 'Loading PO...' : 'Select PO ID',
                                      clearable: true,
                                      options: _projectPos.map((po) => MadSelectOption(value: po.id, label: po.id)).toList(),
                                      onChanged: _selectPoById,
                                    ),
                                  ),
                                  SizedBox(
                                    width: isMobile ? double.infinity : 240,
                                    child: MadSelect<String>(
                                      labelText: 'PO Number',
                                      value: _selectedPo == null
                                          ? null
                                          : (_selectedPo!.orderNo.isEmpty ? '__poid__:${_selectedPo!.id}' : _selectedPo!.orderNo),
                                      placeholder: _loadingPos ? 'Loading PO...' : 'Select PO Number',
                                      clearable: true,
                                      options: _projectPos
                                          .map((po) => MadSelectOption(
                                                value: po.orderNo.isEmpty ? '__poid__:${po.id}' : po.orderNo,
                                                label: po.orderNo.isEmpty ? 'PO-${po.id}' : po.orderNo,
                                              ))
                                          .toList(),
                                      onChanged: _selectPoByNumber,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                              Text('Attachment', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  MadButton(text: 'Upload Attachment', icon: LucideIcons.upload, variant: ButtonVariant.outline, onPressed: _uploadAttachment),
                                  if (_attachmentPath.isNotEmpty)
                                    MadButton(text: 'Open', icon: LucideIcons.externalLink, onPressed: () => _openAttachment(_attachmentPath)),
                                  if (_attachmentPath.isNotEmpty)
                                    Text(_attachmentPath, style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Uploaded attachments are not persisted on the challan record. Keep the link for reference.',
                                style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                              ),
                              const SizedBox(height: 20),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('Challan Items', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
                                  MadButton(
                                    text: 'Add Item',
                                    icon: LucideIcons.plus,
                                    variant: ButtonVariant.outline,
                                    onPressed: () => setState(() => _items.add(_DCItemControllers())),
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
                                                  Expanded(child: MadInput(labelText: 'Name', controller: _items[i].name)),
                                                  const SizedBox(width: 12),
                                                  Expanded(child: MadInput(labelText: 'Width', controller: _items[i].width)),
                                                  const SizedBox(width: 12),
                                                  Expanded(child: MadInput(labelText: 'Length', controller: _items[i].length)),
                                                  const SizedBox(width: 12),
                                                  MadButton(
                                                    icon: LucideIcons.trash2,
                                                    size: ButtonSize.sm,
                                                    variant: ButtonVariant.outline,
                                                    onPressed: () => setState(() => _items.removeAt(i)),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 12),
                                              MadTextarea(labelText: 'Description', minLines: 2, controller: _items[i].description),
                                              const SizedBox(height: 12),
                                              Row(
                                                children: [
                                                  Expanded(child: MadInput(labelText: 'Quantity', controller: _items[i].quantity)),
                                                  const SizedBox(width: 12),
                                                  Expanded(child: MadInput(labelText: 'Price', controller: _items[i].price)),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  MadButton(text: _saving ? 'Saving...' : 'Save Changes', icon: LucideIcons.save, onPressed: _saving ? null : _save),
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

class _DCItemControllers {
  final TextEditingController name;
  final TextEditingController description;
  final TextEditingController width;
  final TextEditingController length;
  final TextEditingController quantity;
  final TextEditingController price;

  _DCItemControllers({
    String name = '',
    String description = '',
    String width = '',
    String length = '',
    String quantity = '',
    String price = '',
  })  : name = TextEditingController(text: name),
        description = TextEditingController(text: description),
        width = TextEditingController(text: width),
        length = TextEditingController(text: length),
        quantity = TextEditingController(text: quantity),
        price = TextEditingController(text: price);

  Map<String, dynamic> toJson() => {
        'name': name.text.trim(),
        'description': description.text.trim(),
        'width': double.tryParse(width.text.trim()) ?? 0,
        'length': double.tryParse(length.text.trim()) ?? 0,
        'quantity': double.tryParse(quantity.text.trim()) ?? 0,
        'price': double.tryParse(price.text.trim()) ?? 0,
      };

  void dispose() {
    name.dispose();
    description.dispose();
    width.dispose();
    length.dispose();
    quantity.dispose();
    price.dispose();
  }
}
