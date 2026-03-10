import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/vendor.dart';
import '../models/vendor_price_list.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';

class VendorPriceListsPage extends StatefulWidget {
  final String vendorId;
  final String? projectId;
  final bool openLatestOnLoad;

  const VendorPriceListsPage({
    super.key,
    required this.vendorId,
    this.projectId,
    this.openLatestOnLoad = false,
  });

  @override
  State<VendorPriceListsPage> createState() => _VendorPriceListsPageState();
}

class _VendorPriceListsPageState extends State<VendorPriceListsPage> {
  static const List<String> _statusOptions = ['active', 'inactive', 'archived'];

  Vendor? _vendor;
  List<VendorPriceList> _priceLists = [];
  bool _isLoading = false;
  String? _error;
  bool _autoOpenedLatest = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final vendorResult = await ApiClient.getVendorById(widget.vendorId);
      final listResult = await ApiClient.getVendorPriceLists(widget.vendorId);

      if (!mounted) return;

      if (vendorResult['success'] == true) {
        final rawVendor = vendorResult['data'];
        if (rawVendor is Map) {
          _vendor = Vendor.fromJson(Map<String, dynamic>.from(rawVendor));
        }
      }

      if (listResult['success'] == true) {
        final raw = (listResult['data'] as List?) ?? const [];
        _priceLists = raw
            .whereType<Map>()
            .map(
              (row) => VendorPriceList.fromJson(Map<String, dynamic>.from(row)),
            )
            .toList();
      } else {
        _error =
            listResult['error']?.toString() ??
            'Could not load vendor price lists.';
      }
    } catch (_) {
      if (!mounted) return;
      _error = 'Could not load vendor price lists.';
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        _maybeOpenLatest();
      }
    }
  }

  void _maybeOpenLatest() {
    if (_autoOpenedLatest || !widget.openLatestOnLoad || _priceLists.isEmpty) {
      return;
    }
    _autoOpenedLatest = true;
    _openViewPage(_priceLists.first.id);
  }

  String _toTitle(String value) {
    if (value.isEmpty) return value;
    return value[0].toUpperCase() + value.substring(1).toLowerCase();
  }

  int get _totalItems {
    return _priceLists.fold<int>(0, (acc, row) => acc + row.itemsCount);
  }

  Future<void> _openCreatePage() async {
    final created = await Navigator.pushNamed(
      context,
      '/vendors/price-lists/create',
      arguments: {'vendorId': widget.vendorId, 'projectId': widget.projectId},
    );
    if (created == true && mounted) {
      await _loadData();
    }
  }

  Future<void> _openViewPage(String priceListId) async {
    await Navigator.pushNamed(
      context,
      '/vendors/price-lists/view',
      arguments: {
        'vendorId': widget.vendorId,
        'projectId': widget.projectId,
        'priceListId': priceListId,
      },
    );
    if (!mounted) return;
    await _loadData();
  }

  Future<void> _updateStatus(VendorPriceList row, String status) async {
    final result = await ApiClient.updateVendorPriceListStatus(row.id, status);
    if (!mounted) return;
    if (result['success'] == true) {
      showToast(context, 'Status updated');
      await _loadData();
    } else {
      showToast(
        context,
        result['error']?.toString() ?? 'Status update failed',
        variant: ToastVariant.error,
      );
    }
  }

  Future<void> _deletePriceList(VendorPriceList row) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Price List'),
        content: Text('Delete "${row.versionName}"? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final result = await ApiClient.deleteVendorPriceList(row.id);
    if (!mounted) return;
    if (result['success'] == true) {
      showToast(context, 'Price list deleted');
      await _loadData();
    } else {
      showToast(
        context,
        result['error']?.toString() ?? 'Delete failed',
        variant: ToastVariant.error,
      );
    }
  }

  Widget _buildRow(VendorPriceList row, bool isDark) {
    final createdLabel = row.createdAt == null
        ? 'Unknown date'
        : '${row.createdAt!.year}-${row.createdAt!.month.toString().padLeft(2, '0')}-${row.createdAt!.day.toString().padLeft(2, '0')}';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.versionName,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'ID: ${row.id} • Created: $createdLabel',
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
                SizedBox(
                  width: 160,
                  child: DropdownButtonFormField<String>(
                    initialValue: row.status.isEmpty
                        ? 'active'
                        : row.status.toLowerCase(),
                    decoration: const InputDecoration(isDense: true),
                    items: _statusOptions
                        .map(
                          (status) => DropdownMenuItem<String>(
                            value: status,
                            child: Text(_toTitle(status)),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null || value == row.status.toLowerCase()) {
                        return;
                      }
                      _updateStatus(row, value);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                    .withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                row.filePath?.isNotEmpty == true ? row.filePath! : '-',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${row.itemsCount} item(s)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
                const SizedBox(width: 12),
                Row(
                  children: [
                    MadButton(
                      variant: ButtonVariant.ghost,
                      size: ButtonSize.icon,
                      icon: LucideIcons.eye,
                      onPressed: () => _openViewPage(row.id),
                    ),
                    MadButton(
                      variant: ButtonVariant.ghost,
                      size: ButtonSize.icon,
                      icon: LucideIcons.trash2,
                      onPressed: () => _deletePriceList(row),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final title = _vendor?.name ?? 'Vendor ID ${widget.vendorId}';
    final subtitle = widget.projectId != null && widget.projectId!.isNotEmpty
        ? 'Project ${widget.projectId}'
        : 'All projects';

    return ProtectedRoute(
      title: 'Vendor Price Lists',
      route: '/vendors',
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    gradient: LinearGradient(
                      colors: isDark
                          ? [const Color(0xFF1C3557), const Color(0xFF0F213A)]
                          : [const Color(0xFFE8F3FF), const Color(0xFFF6FAFF)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    border: Border.all(
                      color: isDark
                          ? AppTheme.darkBorder.withValues(alpha: 0.6)
                          : AppTheme.lightBorder,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Vendor Price Lists',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '$title • $subtitle',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          MadButton(
                            text: 'Refresh',
                            icon: LucideIcons.refreshCw,
                            variant: ButtonVariant.outline,
                            onPressed: _loadData,
                          ),
                          MadButton(
                            text: 'Create Price List',
                            icon: LucideIcons.plus,
                            onPressed: _openCreatePage,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                LayoutBuilder(
                  builder: (context, statConstraints) {
                    const spacing = 10.0;
                    final rawWidth =
                        (statConstraints.maxWidth - (spacing * 2)) / 3;
                    final cardWidth = rawWidth.clamp(96.0, 180.0);
                    const cardHeight = 92.0;

                    return Wrap(
                      spacing: spacing,
                      runSpacing: spacing,
                      children: [
                        SizedBox(
                          width: cardWidth,
                          height: cardHeight,
                          child: StatCard(
                            title: 'Total Versions',
                            value: _priceLists.length.toString(),
                          ),
                        ),
                        SizedBox(
                          width: cardWidth,
                          height: cardHeight,
                          child: StatCard(
                            title: 'Total Items',
                            value: _totalItems.toString(),
                          ),
                        ),
                        SizedBox(
                          width: cardWidth,
                          height: cardHeight,
                          child: StatCard(
                            title: 'Latest Version',
                            value: _priceLists.isNotEmpty
                                ? _priceLists.first.versionName
                                : '-',
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 14),
                MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: _isLoading
                        ? const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 40),
                              child: CircularProgressIndicator(),
                            ),
                          )
                        : _priceLists.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 40),
                              child: Text(
                                _error ?? 'No versions found.',
                                style: TextStyle(
                                  color: isDark
                                      ? AppTheme.darkMutedForeground
                                      : AppTheme.lightMutedForeground,
                                ),
                              ),
                            ),
                          )
                        : ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _priceLists.length,
                            itemBuilder: (context, index) =>
                                _buildRow(_priceLists[index], isDark),
                          ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
