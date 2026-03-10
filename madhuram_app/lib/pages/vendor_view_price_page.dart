import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/vendor.dart';
import '../models/vendor_price_list.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';

class VendorViewPricePage extends StatefulWidget {
  final String vendorId;
  final String? projectId;

  const VendorViewPricePage({
    super.key,
    required this.vendorId,
    this.projectId,
  });

  @override
  State<VendorViewPricePage> createState() => _VendorViewPricePageState();
}

class _VendorViewPricePageState extends State<VendorViewPricePage> {
  Vendor? _vendor;
  List<VendorPriceList> _priceLists = [];
  List<Map<String, dynamic>> _latestItems = [];

  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  VendorPriceList? get _latestList => _priceLists.isNotEmpty ? _priceLists.first : null;

  String _titleCase(String value) {
    if (value.isEmpty) return value;
    return value[0].toUpperCase() + value.substring(1).toLowerCase();
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '-';
    final m = date.month.toString().padLeft(2, '0');
    final d = date.day.toString().padLeft(2, '0');
    final hh = date.hour.toString().padLeft(2, '0');
    final mm = date.minute.toString().padLeft(2, '0');
    return '${date.year}-$m-$d $hh:$mm';
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final vendorResult = await ApiClient.getVendorById(widget.vendorId);
      final listsResult = await ApiClient.getVendorPriceLists(widget.vendorId);
      if (!mounted) return;

      if (vendorResult['success'] == true && vendorResult['data'] is Map) {
        _vendor = Vendor.fromJson(
          Map<String, dynamic>.from(vendorResult['data'] as Map),
        );
      }

      if (listsResult['success'] == true) {
        final raw = (listsResult['data'] as List?) ?? const [];
        _priceLists = raw
            .whereType<Map>()
            .map((row) => VendorPriceList.fromJson(Map<String, dynamic>.from(row)))
            .toList();
      } else {
        _error = listsResult['error']?.toString() ?? 'Could not load vendor price lists.';
      }

      final latest = _latestList;
      if (_error == null && latest != null) {
        final detailResult = await ApiClient.getVendorPriceListById(latest.id);
        if (!mounted) return;
        if (detailResult['success'] == true) {
          final detail = detailResult['data'];
          final items = detail is Map ? detail['items'] : null;
          if (items is List) {
            _latestItems = items
                .whereType<Map>()
                .map((row) => Map<String, dynamic>.from(row))
                .toList();
          } else {
            _latestItems = [];
          }
        } else {
          _latestItems = [];
        }
      } else {
        _latestItems = [];
      }
    } catch (_) {
      if (!mounted) return;
      _error = 'Could not load vendor pricing data.';
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Widget _buildLatestSnapshot(bool isDark) {
    final latest = _latestList;
    if (latest == null) {
      return MadCard(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Text(
            'No price list found for this vendor.',
            style: TextStyle(
              color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
            ),
          ),
        ),
      );
    }

    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Latest Price Snapshot',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              'From the most recent vendor price list.',
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                MadBadge(text: latest.versionName, variant: BadgeVariant.default_),
                MadBadge(text: _titleCase(latest.status), variant: BadgeVariant.secondary),
                MadBadge(
                  text: 'Created ${_formatDate(latest.createdAt)}',
                  variant: BadgeVariant.outline,
                ),
              ],
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columnSpacing: 24,
                columns: const [
                  DataColumn(label: Text('Item')),
                  DataColumn(label: Text('HSN')),
                  DataColumn(label: Text('Product')),
                  DataColumn(label: Text('Price / Pc')),
                  DataColumn(label: Text('Discount')),
                  DataColumn(label: Text('Net')),
                ],
                rows: _latestItems.isEmpty
                    ? const [
                        DataRow(
                          cells: [
                            DataCell(Text('No item rows in latest price list.')),
                            DataCell(Text('-')),
                            DataCell(Text('-')),
                            DataCell(Text('-')),
                            DataCell(Text('-')),
                            DataCell(Text('-')),
                          ],
                        ),
                      ]
                    : _latestItems.map((item) {
                        return DataRow(
                          cells: [
                            DataCell(Text((item['items_name'] ?? '-').toString())),
                            DataCell(Text((item['hsn_code'] ?? '-').toString())),
                            DataCell(Text((item['product_name'] ?? '-').toString())),
                            DataCell(Text((item['price_per_pic'] ?? '-').toString())),
                            DataCell(Text((item['discount_price'] ?? '-').toString())),
                            DataCell(Text((item['net_price'] ?? '-').toString())),
                          ],
                        );
                      }).toList(),
              ),
            ),
            const SizedBox(height: 10),
            MadButton(
              text: 'Open Price List Detail',
              icon: LucideIcons.eye,
              variant: ButtonVariant.outline,
              onPressed: () {
                Navigator.pushNamed(
                  context,
                  '/vendors/price-lists/view',
                  arguments: {
                    'vendorId': widget.vendorId,
                    'projectId': widget.projectId,
                    'priceListId': latest.id,
                  },
                ).then((_) => _loadData());
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAllLists(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'All Price Lists',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            if (_priceLists.isEmpty)
              Text(
                'No price list records yet.',
                style: TextStyle(
                  color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                ),
              ),
            if (_priceLists.isNotEmpty)
              ..._priceLists.map((row) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              row.versionName,
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_titleCase(row.status)} • ${_formatDate(row.createdAt)}',
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
                      MadButton(
                        text: 'Price List View',
                        icon: LucideIcons.eye,
                        variant: ButtonVariant.outline,
                        size: ButtonSize.sm,
                        onPressed: () {
                          Navigator.pushNamed(
                            context,
                            '/vendors/price-lists/view',
                            arguments: {
                              'vendorId': widget.vendorId,
                              'projectId': widget.projectId,
                              'priceListId': row.id,
                            },
                          ).then((_) => _loadData());
                        },
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final vendorName = _vendor?.name ?? 'Vendor ID ${widget.vendorId}';

    return ProtectedRoute(
      title: 'View Price',
      route: '/vendors',
      child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    MadButton(
                      text: 'Vendor List',
                      icon: LucideIcons.arrowLeft,
                      variant: ButtonVariant.outline,
                      onPressed: () => Navigator.pushNamed(context, '/vendors'),
                    ),
                    MadButton(
                      text: 'Price List Page',
                      variant: ButtonVariant.outline,
                      onPressed: () {
                        Navigator.pushNamed(
                          context,
                          '/vendors/price-lists',
                          arguments: {
                            'vendorId': widget.vendorId,
                            'projectId': widget.projectId,
                          },
                        );
                      },
                    ),
                    MadButton(
                      text: 'Reload',
                      icon: LucideIcons.refreshCw,
                      variant: ButtonVariant.outline,
                      onPressed: _loadData,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'View Price',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Vendor: $vendorName',
                  style: TextStyle(
                    color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                  ),
                ),
                const SizedBox(height: 14),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Color(0xFFDC2626)),
                    ),
                  ),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildLatestSnapshot(isDark),
                        const SizedBox(height: 12),
                        _buildAllLists(isDark),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
