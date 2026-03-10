import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/vendor.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';

class VendorPriceListViewPage extends StatefulWidget {
  final String vendorId;
  final String priceListId;
  final String? projectId;

  const VendorPriceListViewPage({
    super.key,
    required this.vendorId,
    required this.priceListId,
    this.projectId,
  });

  @override
  State<VendorPriceListViewPage> createState() =>
      _VendorPriceListViewPageState();
}

class _VendorPriceListViewPageState extends State<VendorPriceListViewPage> {
  static const double _mmPerInch = 25.4;

  Vendor? _vendor;
  bool _isLoading = false;
  bool _saving = false;

  List<Map<String, String>> _items = [_emptyItem()];

  static Map<String, String> _emptyItem() => {
    'items_name': '',
    'hsn_code': '',
    'item_code': '',
    'category': '',
    'product_name': '',
    'size_inch': '',
    'size_mm': '',
    'size_unit': 'inch',
    'price_per_pic': '',
    'discount_price': '',
    'net_price': '',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
    });

    final vendorResult = await ApiClient.getVendorById(widget.vendorId);
    final detailResult = await ApiClient.getVendorPriceListById(
      widget.priceListId,
    );

    if (!mounted) return;

    if (vendorResult['success'] == true) {
      final data = vendorResult['data'];
      if (data is Map) {
        _vendor = Vendor.fromJson(Map<String, dynamic>.from(data));
      }
    }

    if (detailResult['success'] == true) {
      final raw = detailResult['data'];
      final map = raw is Map<String, dynamic> ? raw : <String, dynamic>{};

      final rawItems = map['items'];
      if (rawItems is List && rawItems.isNotEmpty) {
        _items = rawItems.map((row) {
          final source = row is Map
              ? Map<String, dynamic>.from(row)
              : <String, dynamic>{};
          return {
            'items_name': (source['items_name'] ?? '').toString(),
            'hsn_code': (source['hsn_code'] ?? '').toString(),
            'item_code': (source['item_code'] ?? '').toString(),
            'category': (source['category'] ?? '').toString(),
            'product_name': (source['product_name'] ?? '').toString(),
            'size_inch': (source['size_inch'] ?? '').toString(),
            'size_mm': (source['size_mm'] ?? '').toString(),
            'size_unit': (source['size_unit'] ?? '').toString(),
            'price_per_pic': (source['price_per_pic'] ?? '').toString(),
            'discount_price': (source['discount_price'] ?? '').toString(),
            'net_price': (source['net_price'] ?? '').toString(),
          };
        }).toList();
      } else {
        _items = [_emptyItem()];
      }
    } else {
      showToast(
        context,
        detailResult['error']?.toString() ?? 'Could not load price list',
        variant: ToastVariant.error,
      );
    }

    setState(() {
      _isLoading = false;
    });
  }

  void _addItemRow() {
    setState(() {
      _items = [..._items, _emptyItem()];
    });
  }

  void _removeItemRow(int index) {
    if (_items.length == 1) return;
    setState(() {
      _items = _items
          .asMap()
          .entries
          .where((entry) => entry.key != index)
          .map((entry) => entry.value)
          .toList();
    });
  }

  void _updateItem(int index, String key, String value) {
    final next = [..._items];
    next[index] = {...next[index], key: value};
    setState(() {
      _items = next;
    });
  }

  String _formatSizeValue(double value) {
    final fixed = value.toStringAsFixed(4);
    return fixed.replaceFirst(RegExp(r'\.?0+$'), '');
  }

  String _inferUnit(Map<String, String> row) {
    final explicit = (row['size_unit'] ?? '').toLowerCase();
    if (explicit == 'inch' || explicit == 'mm') return explicit;
    final sizeMm = (row['size_mm'] ?? '').trim();
    final sizeInch = (row['size_inch'] ?? '').trim();
    if (sizeMm.isNotEmpty && sizeInch.isEmpty) return 'mm';
    return 'inch';
  }

  String _sizeValueForUnit(Map<String, String> row, String unit) {
    return unit == 'mm' ? (row['size_mm'] ?? '') : (row['size_inch'] ?? '');
  }

  void _onSizeValueChanged(int index, String unit, String rawValue) {
    _updateItem(index, 'size_unit', unit);
    if (rawValue.isEmpty) {
      _updateItem(index, 'size_inch', '');
      _updateItem(index, 'size_mm', '');
      return;
    }

    final parsed = double.tryParse(rawValue);
    if (parsed == null) {
      if (unit == 'inch') {
        _updateItem(index, 'size_inch', rawValue);
        _updateItem(index, 'size_mm', '');
      } else {
        _updateItem(index, 'size_mm', rawValue);
        _updateItem(index, 'size_inch', '');
      }
      return;
    }

    if (unit == 'inch') {
      _updateItem(index, 'size_inch', rawValue);
      _updateItem(index, 'size_mm', _formatSizeValue(parsed * _mmPerInch));
    } else {
      _updateItem(index, 'size_mm', rawValue);
      _updateItem(index, 'size_inch', _formatSizeValue(parsed / _mmPerInch));
    }
  }

  void _onSizeUnitChanged(int index, String nextUnit) {
    final row = _items[index];
    final currentUnit = _inferUnit(row);
    final currentValue = _sizeValueForUnit(row, currentUnit);
    final parsed = double.tryParse(currentValue);

    _updateItem(index, 'size_unit', nextUnit);

    if (currentValue.isEmpty || parsed == null || currentUnit == nextUnit) {
      return;
    }

    if (currentUnit == 'inch' && nextUnit == 'mm') {
      _updateItem(index, 'size_mm', _formatSizeValue(parsed * _mmPerInch));
      _updateItem(index, 'size_inch', _formatSizeValue(parsed));
    } else if (currentUnit == 'mm' && nextUnit == 'inch') {
      _updateItem(index, 'size_inch', _formatSizeValue(parsed / _mmPerInch));
      _updateItem(index, 'size_mm', _formatSizeValue(parsed));
    }
  }

  Future<void> _saveChanges() async {
    setState(() {
      _saving = true;
    });
    final payload = {'items': _items};
    final result = await ApiClient.updateVendorPriceList(
      widget.priceListId,
      payload,
    );
    if (!mounted) return;
    setState(() {
      _saving = false;
    });
    if (result['success'] == true) {
      showToast(context, 'Price list updated');
      await _loadData();
    } else {
      showToast(
        context,
        result['error']?.toString() ?? 'Save failed',
        variant: ToastVariant.error,
      );
    }
  }

  Widget _itemField(
    int index,
    String key,
    String label, {
    TextInputType keyboardType = TextInputType.text,
  }) {
    return SizedBox(
      width: 220,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 6),
          TextFormField(
            key: ValueKey('view-item-$index-$key'),
            initialValue: _items[index][key] ?? '',
            keyboardType: keyboardType,
            onChanged: (value) => _updateItem(index, key, value),
            decoration: const InputDecoration(
              isDense: true,
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemCard(int index, bool isDark) {
    final row = _items[index];

    Widget sizeField() {
      final unit = _inferUnit(row);
      final value = _sizeValueForUnit(row, unit);

      return SizedBox(
        width: 300,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Size',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    key: ValueKey('view-item-$index-size-value-$unit'),
                    initialValue: value,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    onChanged: (next) => _onSizeValueChanged(index, unit, next),
                    decoration: const InputDecoration(
                      isDense: true,
                      hintText: 'Enter size',
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 9,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 96,
                  child: DropdownButtonFormField<String>(
                    key: ValueKey('view-item-$index-size-unit-$unit'),
                    initialValue: unit,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'inch', child: Text('Inch')),
                      DropdownMenuItem(value: 'mm', child: Text('MM')),
                    ],
                    onChanged: (next) {
                      if (next == null) return;
                      _onSizeUnitChanged(index, next);
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Item ${index + 1}',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              MadButton(
                text: 'Remove',
                icon: LucideIcons.trash2,
                variant: ButtonVariant.destructive,
                size: ButtonSize.sm,
                disabled: _items.length == 1,
                onPressed: () => _removeItemRow(index),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              _itemField(index, 'items_name', 'Item Name'),
              _itemField(index, 'product_name', 'Product Name'),
              _itemField(index, 'category', 'Category'),
              _itemField(index, 'item_code', 'Item Code'),
              _itemField(index, 'hsn_code', 'HSN Code'),
              sizeField(),
              _itemField(
                index,
                'price_per_pic',
                'Price Per Piece',
                keyboardType: TextInputType.number,
              ),
              _itemField(
                index,
                'discount_price',
                'Discount Price',
                keyboardType: TextInputType.number,
              ),
              _itemField(
                index,
                'net_price',
                'Net Price',
                keyboardType: TextInputType.number,
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final vendorName = _vendor?.name ?? 'Vendor';

    return ProtectedRoute(
      title: 'Price List Detail',
      route: '/vendors',
      child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      MadButton(
                        text: 'Back to Price Lists',
                        icon: LucideIcons.arrowLeft,
                        variant: ButtonVariant.outline,
                        onPressed: () => Navigator.pop(context),
                      ),
                      MadButton(
                        text: 'Reload',
                        icon: LucideIcons.refreshCw,
                        variant: ButtonVariant.outline,
                        onPressed: _loadData,
                      ),
                      MadButton(
                        text: _saving ? 'Saving...' : 'Save Changes',
                        icon: LucideIcons.save,
                        loading: _saving,
                        onPressed: _saving ? null : _saveChanges,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Text(
                        '$vendorName • Price List Detail',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  MadCard(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'Manual Item Entry',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const Spacer(),
                              MadButton(
                                text: 'Add Item',
                                icon: LucideIcons.plus,
                                variant: ButtonVariant.outline,
                                size: ButtonSize.sm,
                                onPressed: _addItemRow,
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ..._items.asMap().entries.map(
                            (entry) => _buildItemCard(entry.key, isDark),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
    );
  }
}
