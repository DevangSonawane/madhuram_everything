import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/scheduler.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/purchase_order.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class NewChallanPage extends StatefulWidget {
  const NewChallanPage({super.key});

  @override
  State<NewChallanPage> createState() => _NewChallanPageState();
}

class _NewChallanPageState extends State<NewChallanPage> {
  static final Map<String, List<PurchaseOrder>> _poCacheByProject = {};
  static final Map<String, DateTime> _poCacheAt = {};
  static const Duration _poCacheTtl = Duration(minutes: 5);

  final _challanNumber = TextEditingController();
  final _challanDate = TextEditingController();
  final _workOrderNumber = TextEditingController();
  final _orderDate = TextEditingController();

  List<PurchaseOrder> _projectPos = [];
  PurchaseOrder? _selectedPo;
  bool _loadingPos = false;
  bool _saving = false;
  String _projectId = '';

  final List<_DCItemControllers> _items = [_DCItemControllers()];
  bool _loadPosQueued = false;

  void _safeSetState(VoidCallback fn) {
    if (!mounted) return;
    final phase = SchedulerBinding.instance.schedulerPhase;
    final isBuildPhase = phase == SchedulerPhase.persistentCallbacks ||
        phase == SchedulerPhase.midFrameMicrotasks;
    if (isBuildPhase) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(fn);
      });
      return;
    }
    setState(fn);
  }

  void _queueLoadPos() {
    if (_loadPosQueued) return;
    _loadPosQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _loadPosQueued = false;
      if (!mounted) return;
      await _loadPos();
    });
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

  Future<void> _loadPos() async {
    if (_projectId.isEmpty) {
      _safeSetState(() {
        _projectPos = [];
        _loadingPos = false;
      });
      return;
    }

    final cached = _poCacheByProject[_projectId];
    final cachedAt = _poCacheAt[_projectId];
    final cacheFresh = cached != null &&
        cachedAt != null &&
        DateTime.now().difference(cachedAt) <= _poCacheTtl;

    if (cacheFresh) {
      _safeSetState(() {
        _projectPos = cached;
        _loadingPos = false;
      });
      return;
    }

    if (cached != null && cached.isNotEmpty) {
      _safeSetState(() {
        _projectPos = cached;
        _loadingPos = false;
      });
    } else {
      _safeSetState(() => _loadingPos = true);
    }

    try {
      final res = await ApiClient.getPOsByProject(_projectId);
      if (!mounted) return;

      final raw = res['data'];
      final data = raw is List
          ? raw
          : (raw is Map && raw['data'] is List ? raw['data'] as List : const []);

      if (res['success'] == true && data.isNotEmpty) {
        final list = data
            .map((e) => PurchaseOrder.fromJson(e as Map<String, dynamic>))
            .toList();
        _poCacheByProject[_projectId] = list;
        _poCacheAt[_projectId] = DateTime.now();
        _safeSetState(() {
          _projectPos = list;
          _loadingPos = false;
        });
      } else {
        _safeSetState(() => _loadingPos = false);
      }
    } catch (e) {
      if (!mounted) return;
      _safeSetState(() => _loadingPos = false);
    } finally {
      if (mounted) _safeSetState(() => _loadingPos = false);
    }
  }

  void _selectPo(PurchaseOrder? po) {
    setState(() {
      _selectedPo = po;
    });
  }

  Future<void> _pickDate(TextEditingController c) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2035),
    );
    if (date != null) {
      c.text =
          '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }
  }

  void _goToChallans() {
    Navigator.pushReplacementNamed(context, '/challans');
  }

  bool _hasItemValue(Map<String, String> item) {
    const keys = ['name', 'description', 'width', 'length', 'quantity', 'price'];
    return keys.any((key) => (item[key] ?? '').trim().isNotEmpty);
  }

  List<Map<String, String>> _currentDeliveryItems() {
    return _items.map((item) {
      return {
        'name': item.name.text,
        'description': item.description.text,
        'width': item.width.text,
        'length': item.length.text,
        'quantity': item.quantity.text,
        'price': item.price.text,
      };
    }).toList();
  }

  List<Map<String, String>> _poItemsForDetail() {
    return _selectedPoItems.map((item) => item.toJson()).toList();
  }

  void _applyDeliveryItemsFromDetail(dynamic rawItems) {
    if (rawItems is! List) return;
    final parsed = rawItems.whereType<Map>().map((item) {
      final map = Map<String, dynamic>.from(item);
      return {
        'name': map['name']?.toString() ?? '',
        'description': map['description']?.toString() ?? '',
        'width': map['width']?.toString() ?? '',
        'length': map['length']?.toString() ?? '',
        'quantity': map['quantity']?.toString() ?? '',
        'price': map['price']?.toString() ?? '',
      };
    }).toList();

    if (parsed.isEmpty) return;

    final meaningful = parsed.where(_hasItemValue).toList();
    final target = meaningful.isNotEmpty
        ? parsed
        : [
            {
              'name': '',
              'description': '',
              'width': '',
              'length': '',
              'quantity': '',
              'price': '',
            },
          ];

    setState(() {
      for (final item in _items) {
        item.dispose();
      }
      _items
        ..clear()
        ..addAll(
          target.map(
            (item) => _DCItemControllers(
              name: item['name'] ?? '',
              description: item['description'] ?? '',
              width: item['width'] ?? '',
              length: item['length'] ?? '',
              quantity: item['quantity'] ?? '',
              price: item['price'] ?? '',
            ),
          ),
        );
    });
  }

  Future<void> _openItemDetail() async {
    if (_selectedPoItems.isEmpty) return;
    final result = await Navigator.pushNamed(
      context,
      '/challans/new/details',
      arguments: {
        'poItems': _poItemsForDetail(),
        'deliveryItems': _currentDeliveryItems(),
      },
    );
    _applyDeliveryItemsFromDetail(result);
  }

  Future<void> _save() async {
    if (_projectId.isEmpty) {
      showToast(context, 'Select a project first', variant: ToastVariant.error);
      return;
    }
    if (_challanNumber.text.trim().isEmpty) {
      showToast(context, 'Challan number is required', variant: ToastVariant.error);
      return;
    }
    if (_items.isEmpty) {
      showToast(context, 'Add at least one challan item', variant: ToastVariant.error);
      return;
    }

    final payload = {
      'project_id': int.tryParse(_projectId) ?? _projectId,
      'challan_number': _challanNumber.text.trim(),
      'items': _items.map((e) => e.toJson()).toList(),
      if (_selectedPo?.id.isNotEmpty == true)
        'po_id': int.tryParse(_selectedPo!.id) ?? _selectedPo!.id,
      if ((_selectedPo?.orderNo ?? '').isNotEmpty)
        'po_number': _selectedPo!.orderNo,
      if (_challanDate.text.trim().isNotEmpty)
        'challan_date': _challanDate.text.trim(),
      if (_workOrderNumber.text.trim().isNotEmpty)
        'work_order_number': _workOrderNumber.text.trim(),
      if (_orderDate.text.trim().isNotEmpty) 'order_date': _orderDate.text.trim(),
    };

    setState(() => _saving = true);
    try {
      final res = await ApiClient.createChallan(payload);
      if (!mounted) return;
      if (res['success'] == true) {
        showToast(context, 'Delivery challan saved');
        _goToChallans();
      } else {
        showToast(
          context,
          res['error']?.toString() ?? 'Failed to create challan',
          variant: ToastVariant.error,
        );
      }
    } catch (e) {
      if (!mounted) return;
      showToast(context, 'Failed to create challan', variant: ToastVariant.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  List<_PoPreviewItem> get _selectedPoItems {
    final po = _selectedPo;
    if (po == null || po.items.isEmpty) return [];
    return po.items.asMap().entries.map((entry) {
      final idx = entry.key;
      final item = entry.value;
      return _PoPreviewItem(
        name: item.description.isNotEmpty ? item.description : 'Item ${idx + 1}',
        description: (item.remarks ?? '').isNotEmpty ? item.remarks! : item.description,
        width: '',
        length: '',
        quantity: item.quantity,
        price: item.rate,
      );
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return StoreConnector<AppState, String>(
      converter: (store) => store.state.project.selectedProjectId ?? '',
      onInit: (store) {
        _projectId = store.state.project.selectedProjectId ?? '';
        _queueLoadPos();
      },
      onWillChange: (prev, next) {
        if (prev != next) {
          _projectId = next;
          _queueLoadPos();
        }
      },
      builder: (context, selectedProjectId) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final responsive = Responsive(context);
        final isMobile = responsive.isMobile;

        return ProtectedRoute(
          title: 'New Delivery Challan',
          route: '/challans/new',
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'New Delivery Challan',
                            style: TextStyle(
                              fontSize:
                                  responsive.value(mobile: 22, tablet: 26, desktop: 28),
                              fontWeight: FontWeight.bold,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Select PO, review PO items (view only), then add challan items.',
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
                      text: 'Back to Challans',
                      icon: LucideIcons.arrowLeft,
                      variant: ButtonVariant.outline,
                      onPressed: _goToChallans,
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Challan Details',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            SizedBox(
                              width: isMobile ? double.infinity : 260,
                              child: MadInput(
                                labelText: 'Challan Number',
                                controller: _challanNumber,
                              ),
                            ),
                            SizedBox(
                              width: isMobile ? double.infinity : 300,
                              child: MadSelect<String>(
                                labelText: 'PO Number',
                                value: _selectedPo == null
                                    ? null
                                    : (_selectedPo!.orderNo.isEmpty
                                        ? '__poid__:${_selectedPo!.id}'
                                        : _selectedPo!.orderNo),
                                placeholder:
                                    _loadingPos ? 'Loading PO...' : 'Select PO Number',
                                clearable: true,
                                options: _projectPos
                                    .map(
                                      (po) => MadSelectOption(
                                        value: po.orderNo.isEmpty
                                            ? '__poid__:${po.id}'
                                            : po.orderNo,
                                        label: po.orderNo.isEmpty
                                            ? 'PO-${po.id}'
                                            : po.orderNo,
                                      ),
                                    )
                                    .toList(),
                                onChanged: (value) {
                                  final po = value != null &&
                                          value.startsWith('__poid__:')
                                      ? _projectPos.firstWhere(
                                          (p) =>
                                              p.id == value.replaceFirst('__poid__:', ''),
                                          orElse: () =>
                                              const PurchaseOrder(id: '', orderNo: ''),
                                        )
                                      : _projectPos.firstWhere(
                                          (p) => p.orderNo == value,
                                          orElse: () =>
                                              const PurchaseOrder(id: '', orderNo: ''),
                                        );
                                  _selectPo(po.id.isEmpty ? null : po);
                                },
                              ),
                            ),
                            SizedBox(
                              width: isMobile ? double.infinity : 220,
                              child: MadInput(
                                labelText: 'Challan Date',
                                controller: _challanDate,
                                suffix: IconButton(
                                  icon: const Icon(Icons.calendar_today, size: 18),
                                  onPressed: () => _pickDate(_challanDate),
                                ),
                              ),
                            ),
                            SizedBox(
                              width: isMobile ? double.infinity : 260,
                              child: MadInput(
                                labelText: 'Work Order Number',
                                controller: _workOrderNumber,
                              ),
                            ),
                            SizedBox(
                              width: isMobile ? double.infinity : 220,
                              child: MadInput(
                                labelText: 'Order Date',
                                controller: _orderDate,
                                suffix: IconButton(
                                  icon: const Icon(Icons.calendar_today, size: 18),
                                  onPressed: () => _pickDate(_orderDate),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                Align(
                  alignment: Alignment.centerRight,
                  child: MadButton(
                    text: 'View in Detail',
                    variant: ButtonVariant.secondary,
                    disabled: _selectedPoItems.isEmpty,
                    onPressed: _selectedPoItems.isEmpty ? null : _openItemDetail,
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
                          'PO Items (View Only)',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (_selectedPoItems.isEmpty)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isDark
                                    ? AppTheme.darkBorder
                                    : AppTheme.lightBorder,
                              ),
                            ),
                            child: Text(
                              'Select a PO to view linked PO items.',
                              style: TextStyle(
                                color: isDark
                                    ? AppTheme.darkMutedForeground
                                    : AppTheme.lightMutedForeground,
                              ),
                            ),
                          )
                        else ...[
                          if (!isMobile)
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                              child: Row(
                                children: [
                                  _previewHeader('Name', flex: 2, isDark: isDark),
                                  _previewHeader('Description', flex: 3, isDark: isDark),
                                  _previewHeader('Width', flex: 1, isDark: isDark),
                                  _previewHeader('Length', flex: 1, isDark: isDark),
                                  _previewHeader('Quantity', flex: 1, isDark: isDark),
                                  _previewHeader('Price', flex: 1, isDark: isDark),
                                ],
                              ),
                            ),
                          const SizedBox(height: 6),
                          ..._selectedPoItems.map(
                            (item) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isDark
                                      ? AppTheme.darkBorder
                                      : AppTheme.lightBorder,
                                ),
                                color: (isDark
                                        ? AppTheme.darkMuted
                                        : AppTheme.lightMuted)
                                    .withValues(alpha: 0.2),
                              ),
                              child: isMobile
                                  ? Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(item.name,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w600)),
                                        const SizedBox(height: 4),
                                        Text(item.description.isEmpty
                                            ? '-'
                                            : item.description),
                                        const SizedBox(height: 6),
                                        Text(
                                            'W: ${item.width.isEmpty ? '-' : item.width}  L: ${item.length.isEmpty ? '-' : item.length}'),
                                        const SizedBox(height: 2),
                                        Text(
                                            'Qty: ${item.quantity.isEmpty ? '-' : item.quantity}  Price: ${item.price.isEmpty ? '-' : item.price}'),
                                      ],
                                    )
                                  : Row(
                                      children: [
                                        _previewCell(item.name, flex: 2),
                                        _previewCell(item.description, flex: 3),
                                        _previewCell(item.width, flex: 1),
                                        _previewCell(item.length, flex: 1),
                                        _previewCell(item.quantity, flex: 1),
                                        _previewCell(item.price, flex: 1),
                                      ],
                                    ),
                            ),
                          ),
                        ],
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
                          'Challan Items',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (!isMobile)
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: Row(
                              children: [
                                _previewHeader('Name', flex: 2, isDark: isDark),
                                _previewHeader('Description', flex: 3, isDark: isDark),
                                _previewHeader('Width', flex: 1, isDark: isDark),
                                _previewHeader('Length', flex: 1, isDark: isDark),
                                _previewHeader('Quantity', flex: 1, isDark: isDark),
                                _previewHeader('Price', flex: 1, isDark: isDark),
                                const SizedBox(width: 44),
                              ],
                            ),
                          ),
                        ..._items.asMap().entries.map((entry) {
                          final i = entry.key;
                          final item = entry.value;
                          if (isMobile) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: MadCard(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    children: [
                                      MadInput(labelText: 'Name', controller: item.name),
                                      const SizedBox(height: 8),
                                      MadTextarea(
                                        labelText: 'Description',
                                        minLines: 2,
                                        controller: item.description,
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: MadInput(
                                                labelText: 'Width',
                                                controller: item.width),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: MadInput(
                                                labelText: 'Length',
                                                controller: item.length),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: MadInput(
                                                labelText: 'Quantity',
                                                controller: item.quantity),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: MadInput(
                                                labelText: 'Price',
                                                controller: item.price),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: MadButton(
                                          icon: LucideIcons.minus,
                                          variant: ButtonVariant.outline,
                                          size: ButtonSize.sm,
                                          onPressed: () {
                                            setState(() {
                                              if (_items.length > 1) {
                                                final removed = _items.removeAt(i);
                                                removed.dispose();
                                              }
                                            });
                                          },
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: MadInput(
                                    hintText: 'Name',
                                    controller: item.name,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 3,
                                  child: MadTextarea(
                                    hintText: 'Description',
                                    minLines: 2,
                                    controller: item.description,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 1,
                                  child: MadInput(
                                    hintText: 'Width',
                                    controller: item.width,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 1,
                                  child: MadInput(
                                    hintText: 'Length',
                                    controller: item.length,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 1,
                                  child: MadInput(
                                    hintText: 'Quantity',
                                    controller: item.quantity,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 1,
                                  child: MadInput(
                                    hintText: 'Price',
                                    controller: item.price,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                MadButton(
                                  icon: LucideIcons.minus,
                                  variant: ButtonVariant.outline,
                                  size: ButtonSize.sm,
                                  onPressed: () {
                                    setState(() {
                                      if (_items.length > 1) {
                                        final removed = _items.removeAt(i);
                                        removed.dispose();
                                      }
                                    });
                                  },
                                ),
                              ],
                            ),
                          );
                        }),
                        MadButton(
                          text: 'Add Item',
                          icon: LucideIcons.plus,
                          variant: ButtonVariant.outline,
                          size: ButtonSize.sm,
                          onPressed: () => setState(() => _items.add(_DCItemControllers())),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    MadButton(
                      text: 'Cancel',
                      variant: ButtonVariant.outline,
                      onPressed: _goToChallans,
                    ),
                    const SizedBox(width: 12),
                    MadButton(
                      text: _saving ? 'Saving...' : 'Save Challan',
                      onPressed: _saving || _challanNumber.text.trim().isEmpty || _items.isEmpty
                          ? null
                          : _save,
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _previewHeader(String text, {required int flex, required bool isDark}) {
    return Expanded(
      flex: flex,
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
        ),
      ),
    );
  }

  Widget _previewCell(String text, {required int flex}) {
    return Expanded(
      flex: flex,
      child: Text(text.isEmpty ? '-' : text, overflow: TextOverflow.ellipsis),
    );
  }
}

class _PoPreviewItem {
  final String name;
  final String description;
  final String width;
  final String length;
  final String quantity;
  final String price;

  const _PoPreviewItem({
    required this.name,
    required this.description,
    required this.width,
    required this.length,
    required this.quantity,
    required this.price,
  });

  Map<String, String> toJson() => {
        'name': name,
        'description': description,
        'width': width,
        'length': length,
        'quantity': quantity,
        'price': price,
      };
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
