import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../theme/app_theme.dart';

class ChallanItemsDetailPage extends StatefulWidget {
  final List<Map<String, String>> poItems;
  final List<Map<String, String>> deliveryItems;

  const ChallanItemsDetailPage({
    super.key,
    required this.poItems,
    required this.deliveryItems,
  });

  @override
  State<ChallanItemsDetailPage> createState() => _ChallanItemsDetailPageState();
}

class _ChallanItemsDetailPageState extends State<ChallanItemsDetailPage> {
  static const _emptyItem = {
    'name': '',
    'description': '',
    'width': '',
    'length': '',
    'quantity': '',
    'price': '',
  };

  late final List<_DetailItemControllers> _deliveryItems;

  @override
  void initState() {
    super.initState();
    final incoming = widget.deliveryItems.where(_hasItemValue).toList();
    final initial = incoming.isNotEmpty
        ? widget.deliveryItems
        : _mapPoItemsToHalfDelivery(widget.poItems);
    _deliveryItems = initial.map(_DetailItemControllers.fromMap).toList();
  }

  @override
  void dispose() {
    for (final item in _deliveryItems) {
      item.dispose();
    }
    super.dispose();
  }

  bool _hasItemValue(Map<String, String> item) {
    const keys = ['name', 'description', 'width', 'length', 'quantity', 'price'];
    return keys.any((key) => (item[key] ?? '').trim().isNotEmpty);
  }

  Map<String, String> _mapPoItemToHalfDelivery(Map<String, String> item, int index) {
    final parsedQty = double.tryParse((item['quantity'] ?? '').trim());
    final qty = parsedQty == null ? '' : (parsedQty / 2).toString();
    return {
      'name': (item['name'] ?? '').isNotEmpty
          ? item['name']!
          : ((item['description'] ?? '').isNotEmpty ? item['description']! : 'Item ${index + 1}'),
      'description': item['description'] ?? '',
      'width': item['width'] ?? '',
      'length': item['length'] ?? '',
      'quantity': qty,
      'price': item['price'] ?? '',
    };
  }

  List<Map<String, String>> _mapPoItemsToHalfDelivery(List<Map<String, String>> poItems) {
    if (poItems.isEmpty) return [Map<String, String>.from(_emptyItem)];
    return poItems
        .asMap()
        .entries
        .map((entry) => _mapPoItemToHalfDelivery(entry.value, entry.key))
        .toList();
  }

  void _updateDeliveryItem(int index, String field, String value) {
    final item = _deliveryItems[index];
    switch (field) {
      case 'name':
        item.name.text = value;
        break;
      case 'description':
        item.description.text = value;
        break;
      case 'width':
        item.width.text = value;
        break;
      case 'length':
        item.length.text = value;
        break;
      case 'quantity':
        item.quantity.text = value;
        break;
      case 'price':
        item.price.text = value;
        break;
    }
  }

  void _removeDeliveryItem(int index) {
    setState(() {
      final removed = _deliveryItems.removeAt(index);
      removed.dispose();
      if (_deliveryItems.isEmpty) {
        _deliveryItems.add(_DetailItemControllers.fromMap(_emptyItem));
      }
    });
  }

  void _addBlankDeliveryItem() {
    setState(() {
      _deliveryItems.add(_DetailItemControllers.fromMap(_emptyItem));
    });
  }

  void _addPoItemToDelivery(Map<String, String> poItem, int index) {
    setState(() {
      _deliveryItems.add(
        _DetailItemControllers.fromMap(_mapPoItemToHalfDelivery(poItem, index)),
      );
    });
  }

  void _applyAndReturn() {
    Navigator.pop(
      context,
      _deliveryItems.map((item) => item.toMap()).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 1024;

    return ProtectedRoute(
      title: 'Challan Item Detail',
      route: '/challans/new/details',
      child: SingleChildScrollView(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1320),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  runSpacing: 12,
                  spacing: 12,
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    SizedBox(
                      width: isMobile ? screenWidth : 760,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Challan Item Detail',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Review PO items and prepare delivery item lines before applying them to the challan.',
                            style: TextStyle(
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        MadButton(
                          text: 'Back',
                          icon: LucideIcons.arrowLeft,
                          variant: ButtonVariant.outline,
                          onPressed: _applyAndReturn,
                        ),
                        MadButton(
                          text: 'Apply to Challan',
                          onPressed: _applyAndReturn,
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                if (isMobile) ...[
                  _buildPoItemsCard(isDark),
                  const SizedBox(height: 14),
                  _buildDeliveryItemsCard(isDark),
                ] else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: _buildPoItemsCard(isDark)),
                      const SizedBox(width: 14),
                      Expanded(child: _buildDeliveryItemsCard(isDark)),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPoItemsCard(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'PO Items',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                    ),
                  ),
                ),
                Text(
                  '${widget.poItems.length} item${widget.poItems.length == 1 ? '' : 's'}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Source items from selected purchase order',
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 12),
            if (widget.poItems.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                  ),
                ),
                child: Text(
                  'No PO items available. Go back and select a PO first.',
                  style: TextStyle(
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              )
            else
              ...widget.poItems.asMap().entries.map((entry) {
                final index = entry.key;
                final item = entry.value;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                    ),
                    color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                        .withValues(alpha: 0.2),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              (item['name'] ?? '').isNotEmpty
                                  ? item['name']!
                                  : 'Item ${index + 1}',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                            Text((item['description'] ?? '').isEmpty ? '-' : item['description']!),
                            const SizedBox(height: 2),
                            Text(
                              'W: ${(item['width'] ?? '').isEmpty ? '-' : item['width']} | '
                              'L: ${(item['length'] ?? '').isEmpty ? '-' : item['length']} | '
                              'Qty: ${(item['quantity'] ?? '').isEmpty ? '-' : item['quantity']} | '
                              'Price: ${(item['price'] ?? '').isEmpty ? '-' : item['price']}',
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
                      const SizedBox(width: 12),
                      MadButton(
                        text: 'Add',
                        variant: ButtonVariant.outline,
                        size: ButtonSize.sm,
                        onPressed: () => _addPoItemToDelivery(item, index),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildDeliveryItemsCard(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Delivery Items',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                MadButton(
                  text: 'Add Row',
                  icon: LucideIcons.plus,
                  variant: ButtonVariant.outline,
                  size: ButtonSize.sm,
                  onPressed: _addBlankDeliveryItem,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Edit delivery lines before applying to challan',
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 12),
            ..._deliveryItems.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MadInput(
                      hintText: 'Name',
                      controller: item.name,
                      onChanged: (value) => _updateDeliveryItem(index, 'name', value),
                    ),
                    const SizedBox(height: 8),
                    MadTextarea(
                      hintText: 'Description',
                      minLines: 2,
                      controller: item.description,
                      onChanged: (value) => _updateDeliveryItem(index, 'description', value),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: MadInput(
                            hintText: 'Width',
                            controller: item.width,
                            onChanged: (value) => _updateDeliveryItem(index, 'width', value),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: MadInput(
                            hintText: 'Length',
                            controller: item.length,
                            onChanged: (value) => _updateDeliveryItem(index, 'length', value),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: MadInput(
                            hintText: 'Quantity',
                            controller: item.quantity,
                            onChanged: (value) => _updateDeliveryItem(index, 'quantity', value),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: MadInput(
                            hintText: 'Price',
                            controller: item.price,
                            onChanged: (value) => _updateDeliveryItem(index, 'price', value),
                          ),
                        ),
                        const SizedBox(width: 8),
                        MadButton(
                          icon: LucideIcons.minus,
                          variant: ButtonVariant.outline,
                          size: ButtonSize.sm,
                          onPressed: () => _removeDeliveryItem(index),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _DetailItemControllers {
  final TextEditingController name;
  final TextEditingController description;
  final TextEditingController width;
  final TextEditingController length;
  final TextEditingController quantity;
  final TextEditingController price;

  _DetailItemControllers({
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

  factory _DetailItemControllers.fromMap(Map<String, String> map) {
    return _DetailItemControllers(
      name: map['name'] ?? '',
      description: map['description'] ?? '',
      width: map['width'] ?? '',
      length: map['length'] ?? '',
      quantity: map['quantity'] ?? '',
      price: map['price'] ?? '',
    );
  }

  Map<String, String> toMap() => {
        'name': name.text,
        'description': description.text,
        'width': width.text,
        'length': length.text,
        'quantity': quantity.text,
        'price': price.text,
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
