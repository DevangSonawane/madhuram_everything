import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';

/// Single cell data for vendor-product matrix
class VendorProductCell {
  final double unitPrice;
  final double quantity;
  final int deliveryDays;
  final String paymentTerms;
  final String warranty;

  const VendorProductCell({
    required this.unitPrice,
    this.quantity = 1,
    required this.deliveryDays,
    required this.paymentTerms,
    required this.warranty,
  });

  double get totalCost => unitPrice * quantity;
}

/// Vendor Comparison page - full matrix with multi-vendor product entry
class VendorComparisonPageFull extends StatefulWidget {
  const VendorComparisonPageFull({super.key});

  @override
  State<VendorComparisonPageFull> createState() => _VendorComparisonPageFullState();
}

class _VendorComparisonPageFullState extends State<VendorComparisonPageFull> {
  List<String> _vendors = [];
  List<String> _products = [];
  String? _error;

  /// [productIndex][vendorIndex] -> cell
  late List<List<VendorProductCell>> _matrix;

  @override
  void initState() {
    super.initState();
    _vendors = [
      'Astral Pipes Ltd',
      'Supreme Industries',
      'Ashirvad Pipes',
    ];
    _products = ['CPVC Pipe 2 inch'];
    _matrix = [
      const [
        VendorProductCell(
          unitPrice: 420,
          quantity: 5000,
          deliveryDays: 5,
          paymentTerms: '30 Days Credit',
          warranty: '5 Years',
        ),
        VendorProductCell(
          unitPrice: 435,
          quantity: 5000,
          deliveryDays: 3,
          paymentTerms: '15 Days Credit',
          warranty: '5 Years',
        ),
        VendorProductCell(
          unitPrice: 410,
          quantity: 5000,
          deliveryDays: 7,
          paymentTerms: '45 Days Credit',
          warranty: '3 Years',
        ),
      ],
    ];
    _error = null;
  }

  void _addVendor() {
    setState(() {
      _vendors.add('New Vendor ${_vendors.length + 1}');
      for (var i = 0; i < _matrix.length; i++) {
        _matrix[i].add(const VendorProductCell(
          unitPrice: 0,
          deliveryDays: 0,
          paymentTerms: '-',
          warranty: '-',
        ));
      }
    });
  }

  void _addProduct() {
    setState(() {
      _products.add('New Product ${_products.length + 1}');
      _matrix.add(
        List.generate(_vendors.length, (_) => const VendorProductCell(
          unitPrice: 0,
          deliveryDays: 0,
          paymentTerms: '-',
          warranty: '-',
        )),
      );
    });
  }

  /// Best vendor index for lowest total cost across products (overall recommendation)
  int get _recommendedVendorIndex {
    if (_vendors.isEmpty || _products.isEmpty) return 0;
    var bestIdx = 0;
    var bestTotal = double.infinity;
    for (var v = 0; v < _vendors.length; v++) {
      var total = 0.0;
      for (var p = 0; p < _products.length; p++) {
        if (p < _matrix.length && v < _matrix[p].length) {
          total += _matrix[p][v].totalCost;
        }
      }
      if (total < bestTotal) {
        bestTotal = total;
        bestIdx = v;
      }
    }
    return bestIdx;
  }

  /// For each product row, which vendor has lowest price
  int? _bestVendorForPrice(int productIndex) {
    if (productIndex >= _matrix.length || _matrix[productIndex].isEmpty) return null;
    final row = _matrix[productIndex];
    var best = 0;
    for (var v = 1; v < row.length; v++) {
      if (row[v].unitPrice < row[best].unitPrice) best = v;
    }
    return best;
  }

  /// For each product row, which vendor has fastest delivery
  int? _bestVendorForDelivery(int productIndex) {
    if (productIndex >= _matrix.length || _matrix[productIndex].isEmpty) return null;
    final row = _matrix[productIndex];
    var best = 0;
    for (var v = 1; v < row.length; v++) {
      if (row[v].deliveryDays < row[best].deliveryDays) best = v;
    }
    return best;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    if (_error != null) {
      return ProtectedRoute(
        title: 'Vendor Comparison',
        route: '/vendor-comparison',
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(48),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 64,
                  color: Colors.red.withValues(alpha: 0.5),
                ),
                const SizedBox(height: 16),
                Text(
                  _error!,
                  style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return ProtectedRoute(
      title: 'Vendor Comparison',
      route: '/vendor-comparison',
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
                      'Vendor Comparison',
                      style: TextStyle(
                        fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Compare vendor quotations side by side',
                      style: TextStyle(
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isMobile)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    MadButton(
                      icon: LucideIcons.fileDown,
                      text: 'Export PDF',
                      variant: ButtonVariant.outline,
                      size: ButtonSize.sm,
                      onPressed: null,
                    ),
                    const SizedBox(width: 8),
                    MadButton(
                      icon: LucideIcons.fileSpreadsheet,
                      text: 'Export Excel',
                      variant: ButtonVariant.outline,
                      size: ButtonSize.sm,
                      onPressed: null,
                    ),
                    const SizedBox(width: 8),
                    MadButton(
                      icon: LucideIcons.send,
                      text: 'Request New Quotes',
                      variant: ButtonVariant.outline,
                      size: ButtonSize.sm,
                      onPressed: null,
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 24),

          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              MadButton(
                icon: LucideIcons.plus,
                text: 'Add Vendor',
                variant: ButtonVariant.outline,
                size: ButtonSize.sm,
                onPressed: _addVendor,
              ),
              MadButton(
                icon: LucideIcons.plus,
                text: 'Add Product',
                variant: ButtonVariant.outline,
                size: ButtonSize.sm,
                onPressed: _addProduct,
              ),
              if (isMobile)
                MadButton(
                  icon: LucideIcons.fileDown,
                  size: ButtonSize.icon,
                  variant: ButtonVariant.outline,
                  onPressed: null,
                ),
              if (isMobile)
                MadButton(
                  icon: LucideIcons.fileSpreadsheet,
                  size: ButtonSize.icon,
                  variant: ButtonVariant.outline,
                  onPressed: null,
                ),
              if (isMobile)
                MadButton(
                  icon: LucideIcons.send,
                  size: ButtonSize.icon,
                  variant: ButtonVariant.outline,
                  onPressed: null,
                ),
            ],
          ),
          const SizedBox(height: 24),

          // Recommendation card
          if (_vendors.isNotEmpty && _recommendedVendorIndex < _vendors.length) ...[
            _buildRecommendationCard(
              isDark,
              _vendors[_recommendedVendorIndex],
              'Based on overall lowest total cost',
            ),
            const SizedBox(height: 24),
          ],

          // Matrix + comparison table
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SingleChildScrollView(
                child: _buildComparisonTable(isDark, isMobile),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendationCard(bool isDark, String vendorName, String subtitle) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(LucideIcons.award, color: AppTheme.primaryColor),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Recommended Vendor',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                  ),
                          Text(
                            vendorName,
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComparisonTable(bool isDark, bool isMobile) {
    if (_vendors.isEmpty || _products.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(48),
        child: Text(
          'Add vendors and products to compare.',
          style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
        ),
      );
    }

    const cellWidth = 140.0;
    const productColWidth = 160.0;

    return MadCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Text(
              'Comparison Matrix',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
          ),
          Divider(height: 1, color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
          Table(
            border: TableBorder(
              horizontalInside: BorderSide(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
              verticalInside: BorderSide(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
            ),
            columnWidths: {
              0: const FixedColumnWidth(productColWidth),
              ...Map.fromIterables(
                List.generate(_vendors.length, (i) => i + 1),
                List.generate(_vendors.length, (_) => const FixedColumnWidth(cellWidth * 1.2)),
              ),
            },
            children: [
              // Header row: Product | Vendor1 | Vendor2 | ...
              TableRow(
                decoration: BoxDecoration(
                  color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                      .withValues(alpha: 0.5),
                ),
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Text(
                      'Product',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                    ),
                  ),
                  ...List.generate(_vendors.length, (v) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _vendors[v],
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Unit Price · Total · Delivery · Terms · Warranty',
                            style: TextStyle(
                              fontSize: 10,
                              color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
              // Data rows
              ...List.generate(_products.length, (p) {
                final row = p < _matrix.length ? _matrix[p] : <VendorProductCell>[];
                final bestPrice = _bestVendorForPrice(p);
                final bestDelivery = _bestVendorForDelivery(p);
                return TableRow(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Text(
                        _products[p],
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                        ),
                      ),
                    ),
                    ...List.generate(_vendors.length, (v) {
                      final cell = v < row.length ? row[v] : const VendorProductCell(
                        unitPrice: 0,
                        deliveryDays: 0,
                        paymentTerms: '-',
                        warranty: '-',
                      );
                      final isBestPrice = bestPrice == v && _vendors.length > 1;
                      final isBestDelivery = bestDelivery == v && _vendors.length > 1;
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '₹${cell.unitPrice.toStringAsFixed(0)}',
                                  style: TextStyle(
                                    fontWeight: isBestPrice ? FontWeight.bold : FontWeight.w500,
                                    color: isBestPrice ? const Color(0xFF22C55E) : (isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
                                  ),
                                ),
                                if (isBestPrice) ...[
                                  const SizedBox(width: 4),
                                  MadBadge(text: 'Best', variant: BadgeVariant.success),
                                ],
                              ],
                            ),
                            Text(
                              'Total: ₹${cell.totalCost.toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '${cell.deliveryDays} days',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isBestDelivery ? FontWeight.w600 : FontWeight.normal,
                                    color: isBestDelivery ? AppTheme.primaryColor : (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                                  ),
                                ),
                                if (isBestDelivery) ...[
                                  const SizedBox(width: 4),
                                  MadBadge(text: 'Fast', variant: BadgeVariant.default_),
                                ],
                              ],
                            ),
                            Text(
                              cell.paymentTerms,
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                              ),
                            ),
                            Text(
                              cell.warranty,
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                              ),
                            ),
                            const SizedBox(height: 6),
                            MadButton(
                              text: 'Select Vendor',
                              variant: ButtonVariant.outline,
                              size: ButtonSize.sm,
                              onPressed: () => showToast(context, 'Select vendor ${_vendors[v]} – creates PO (placeholder)'),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                );
              }),
            ],
          ),
        ],
      ),
    );
  }
}
