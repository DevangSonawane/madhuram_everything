import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';

class VendorComparisonPageFull extends StatefulWidget {
  const VendorComparisonPageFull({super.key});

  @override
  State<VendorComparisonPageFull> createState() =>
      _VendorComparisonPageFullState();
}

class _VendorComparisonPageFullState extends State<VendorComparisonPageFull> {
  static final NumberFormat _currencyFormatter = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 2,
  );

  final TextEditingController _searchController = TextEditingController();

  Timer? _debounceTimer;
  String _debouncedSearchText = '';
  String? _selectedProjectId;

  bool _isLoading = false;
  String? _error;
  DateTime? _lastUpdated;

  List<_ComparisonGroup> _groups = [];
  int _resultCount = 0;
  int _groupCount = 0;

  bool get _hasSearchQuery => _debouncedSearchText.isNotEmpty;

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      final nextQuery = value.trim();
      if (nextQuery == _debouncedSearchText) return;

      setState(() {
        _debouncedSearchText = nextQuery;
      });

      if (nextQuery.isEmpty) {
        _resetResults();
        return;
      }
      _fetchComparisons(searchValue: nextQuery);
    });
  }

  void _resetResults() {
    if (!mounted) return;
    setState(() {
      _groups = [];
      _resultCount = 0;
      _groupCount = 0;
      _error = null;
      _isLoading = false;
      _lastUpdated = null;
    });
  }

  Future<void> _fetchComparisons({String? searchValue}) async {
    final query = (searchValue ?? _debouncedSearchText).trim();
    if (query.isEmpty) {
      _resetResults();
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final params = <String, dynamic>{
        'q': query,
        'limit': 500,
        'offset': 0,
      };
      if (_selectedProjectId != null && _selectedProjectId!.isNotEmpty) {
        params['project_id'] = _selectedProjectId;
      }

      final result = await ApiClient.compareVendorPriceListItems(params);
      if (!mounted) return;

      if (result['success'] != true) {
        setState(() {
          _error =
              result['error']?.toString() ?? 'Unable to load comparison data.';
          _groups = [];
          _resultCount = 0;
          _groupCount = 0;
          _isLoading = false;
        });
        return;
      }

      final payload = _normalizePayload(result['data']);
      final groupsRaw = payload['groups'];
      final groups = groupsRaw is List
          ? groupsRaw
                .whereType<Map>()
                .map((row) => _ComparisonGroup.fromJson(row))
                .toList()
          : <_ComparisonGroup>[];

      groups.sort((a, b) =>
          a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase()));

      setState(() {
        _groups = groups;
        _resultCount = _toInt(payload['count']) ?? groups.length;
        _groupCount = _toInt(payload['groups_count']) ?? groups.length;
        _lastUpdated = DateTime.now();
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to load comparison data.';
        _groups = [];
        _resultCount = 0;
        _groupCount = 0;
        _isLoading = false;
      });
    }
  }

  Map<String, dynamic> _normalizePayload(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    if (data is List) {
      return {
        'groups': data,
        'count': data.length,
        'groups_count': data.length,
      };
    }
    return const {};
  }

  int? _toInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    return int.tryParse(value.toString());
  }

  String _formatPrice(dynamic value) {
    final parsed = _toDouble(value);
    if (parsed == null) return '-';
    return _currencyFormatter.format(parsed);
  }

  double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  String _formatDateTime(String? value) {
    if (value == null || value.trim().isEmpty) return '-';
    final date = DateTime.tryParse(value);
    if (date == null) return '-';
    return DateFormat('dd MMM yyyy, hh:mm a').format(date.toLocal());
  }

  String _formatUpdatedTime() {
    if (_lastUpdated == null) return '-';
    return DateFormat('hh:mm:ss a').format(_lastUpdated!.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return StoreConnector<AppState, String?>(
      distinct: true,
      converter: (store) => store.state.project.selectedProjectId,
      builder: (context, projectId) {
        _selectedProjectId = projectId;

        return ProtectedRoute(
          title: 'Price List Comparison',
          route: '/vendor-comparison',
          showSidebar: false,
          requireProject: false,
          child: ListView(
            children: [
              _buildHero(isDark),
              const SizedBox(height: 16),
              _buildSearchCard(isDark),
              const SizedBox(height: 12),
              if (_error != null) _buildErrorCard(isDark),
              if (_error != null) const SizedBox(height: 12),
              _buildResultsBody(isDark),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHero(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: isDark
              ? const [Color(0xFF1E293B), Color(0xFF0F172A)]
              : const [Color(0xFFF8FAFC), Color(0xFFE0F2FE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Price List Comparison',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color:
                        isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Search once and compare latest vendor offers from active price lists.',
                  style: TextStyle(
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
            icon: LucideIcons.arrowLeft,
            text: 'Back',
            variant: ButtonVariant.outline,
            size: ButtonSize.sm,
            onPressed: () {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              } else {
                Navigator.pushNamed(context, '/projects');
              }
            },
          ),
          const SizedBox(width: 8),
          MadButton(
            icon: LucideIcons.refreshCw,
            text: 'Refresh',
            variant: ButtonVariant.outline,
            size: ButtonSize.sm,
            loading: _isLoading,
            disabled: !_hasSearchQuery,
            onPressed: () => _fetchComparisons(),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchCard(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Search',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              'Use one search bar to query compare results across vendors.',
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 12),
            MadInput(
              controller: _searchController,
              hintText:
                  'Search by item name, product name, code, category, HSN, size...',
              prefix: const Icon(Icons.search, size: 18),
              onChanged: _onSearchChanged,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                MadBadge(text: 'Items: $_resultCount', variant: BadgeVariant.outline),
                MadBadge(text: 'Groups: $_groupCount', variant: BadgeVariant.outline),
                MadBadge(
                  text:
                      'Project: ${(_selectedProjectId == null || _selectedProjectId!.isEmpty) ? 'All' : _selectedProjectId}',
                  variant: BadgeVariant.outline,
                ),
                const MadBadge(text: 'Status: active', variant: BadgeVariant.outline),
                MadBadge(
                  text: 'Updated: ${_formatUpdatedTime()}',
                  variant: BadgeVariant.outline,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorCard(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
        color: (isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFEF2F2))
            .withValues(alpha: 0.7),
      ),
      child: Text(
        _error ?? 'Unable to load comparison data.',
        style: TextStyle(
          color: isDark ? const Color(0xFFFCA5A5) : const Color(0xFF991B1B),
        ),
      ),
    );
  }

  Widget _buildResultsBody(bool isDark) {
    if (_isLoading) {
      return MadCard(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(48),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 10),
                Text(
                  'Loading comparison results...',
                  style: TextStyle(
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (!_hasSearchQuery) {
      return _buildStateCard(isDark, 'Search To Compare The Price');
    }

    if (_groups.isEmpty) {
      return _buildStateCard(isDark, 'No matching items found for this search.');
    }

    return ListView.separated(
      itemCount: _groups.length,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      separatorBuilder: (_, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) => _buildGroupCard(_groups[index], isDark),
    );
  }

  Widget _buildStateCard(bool isDark, String message) {
    return MadCard(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(48),
          child: Text(
            message,
            style: TextStyle(
              color:
                  isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }

  Widget _buildGroupCard(_ComparisonGroup group, bool isDark) {
    final sortedOffers = [...group.offers]
      ..sort((a, b) {
        final aPrice = _toDouble(a.netPrice);
        final bPrice = _toDouble(b.netPrice);
        if (aPrice == null && bPrice == null) return 0;
        if (aPrice == null) return 1;
        if (bPrice == null) return -1;
        return aPrice.compareTo(bPrice);
      });

    final lowestNetPrice = _lowestNetPrice(sortedOffers);

    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      group.displayName,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: isDark
                            ? AppTheme.darkForeground
                            : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${group.productNameOrDash} | ${group.categoryOrDash} | Code: ${group.itemCodeOrDash} | HSN: ${group.hsnCodeOrDash} | Inch: ${group.sizeInchOrDash} | MM: ${group.sizeMmOrDash}',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ],
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    MadBadge(
                      text: '${sortedOffers.length} offers',
                      variant: BadgeVariant.default_,
                      icon: const Icon(Icons.compare_arrows, size: 12),
                    ),
                    MadBadge(
                      text: 'Lowest Net: ${_formatPrice(lowestNetPrice)}',
                      variant: BadgeVariant.outline,
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildOffersTable(sortedOffers, lowestNetPrice, isDark),
          ],
        ),
      ),
    );
  }

  double? _lowestNetPrice(List<_ComparisonOffer> offers) {
    final prices = offers
        .map((offer) => _toDouble(offer.netPrice))
        .whereType<double>()
        .toList();
    if (prices.isEmpty) return null;
    prices.sort();
    return prices.first;
  }

  Widget _buildOffersTable(
    List<_ComparisonOffer> offers,
    double? lowestNetPrice,
    bool isDark,
  ) {
    if (offers.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
          ),
        ),
        child: Text(
          'No offers in this group.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color:
                isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
          ),
        ),
      );
    }

    const widths = <int, TableColumnWidth>{
      0: FixedColumnWidth(190),
      1: FixedColumnWidth(88),
      2: FixedColumnWidth(170),
      3: FixedColumnWidth(120),
      4: FixedColumnWidth(120),
      5: FixedColumnWidth(120),
      6: FixedColumnWidth(180),
    };

    final borderColor = isDark ? AppTheme.darkBorder : AppTheme.lightBorder;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Table(
        columnWidths: widths,
        border: TableBorder.all(color: borderColor),
        children: [
          TableRow(
            decoration: BoxDecoration(
              color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                  .withValues(alpha: 0.45),
            ),
            children: const [
              _HeaderCell('Vendor'),
              _HeaderCell('Project'),
              _HeaderCell('Version'),
              _HeaderCell('Price/Pic', alignRight: true),
              _HeaderCell('Discount', alignRight: true),
              _HeaderCell('Net Price', alignRight: true),
              _HeaderCell('Updated'),
            ],
          ),
          ...offers.map((offer) {
            final netPrice = _toDouble(offer.netPrice);
            final isLowest = netPrice != null &&
                lowestNetPrice != null &&
                (netPrice - lowestNetPrice).abs() < 0.0001;

            return TableRow(
              decoration: isLowest
                  ? BoxDecoration(
                      color: isDark
                          ? const Color(0xFF14532D).withValues(alpha: 0.35)
                          : const Color(0xFFECFDF5),
                    )
                  : null,
              children: [
                _DataCell(
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        offer.vendorNameOrDash,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        offer.vendorCompanyNameOrDash,
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
                _DataCell(Text(offer.projectIdOrDash)),
                _DataCell(
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        offer.versionNameOrDash,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Status: ${offer.priceListStatusOrDash}',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
                _DataCell(Text(_formatPrice(offer.pricePerPic), textAlign: TextAlign.right), alignRight: true),
                _DataCell(Text(_formatPrice(offer.discountPrice), textAlign: TextAlign.right), alignRight: true),
                _DataCell(
                  Text(
                    _formatPrice(offer.netPrice),
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isLowest
                          ? (isDark
                              ? const Color(0xFF6EE7B7)
                              : const Color(0xFF047857))
                          : null,
                    ),
                  ),
                  alignRight: true,
                ),
                _DataCell(Text(_formatDateTime(offer.priceListCreatedAt))),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _HeaderCell extends StatelessWidget {
  final String text;
  final bool alignRight;

  const _HeaderCell(this.text, {this.alignRight = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      child: Text(
        text,
        textAlign: alignRight ? TextAlign.right : TextAlign.left,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }
}

class _DataCell extends StatelessWidget {
  final Widget child;
  final bool alignRight;

  const _DataCell(this.child, {this.alignRight = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: alignRight ? Alignment.centerRight : Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      child: child,
    );
  }
}

class _ComparisonGroup {
  final String? compareKey;
  final String? itemsName;
  final String? productName;
  final String? category;
  final String? itemCode;
  final String? hsnCode;
  final String? sizeInch;
  final String? sizeMm;
  final List<_ComparisonOffer> offers;

  const _ComparisonGroup({
    required this.compareKey,
    required this.itemsName,
    required this.productName,
    required this.category,
    required this.itemCode,
    required this.hsnCode,
    required this.sizeInch,
    required this.sizeMm,
    required this.offers,
  });

  factory _ComparisonGroup.fromJson(Map<dynamic, dynamic> json) {
    final offersRaw = json['offers'];
    return _ComparisonGroup(
      compareKey: json['compare_key']?.toString(),
      itemsName: json['items_name']?.toString(),
      productName: json['product_name']?.toString(),
      category: json['category']?.toString(),
      itemCode: json['item_code']?.toString(),
      hsnCode: json['hsn_code']?.toString(),
      sizeInch: json['size_inch']?.toString(),
      sizeMm: json['size_mm']?.toString(),
      offers: offersRaw is List
          ? offersRaw
                .whereType<Map>()
                .map((row) => _ComparisonOffer.fromJson(row))
                .toList()
          : const <_ComparisonOffer>[],
    );
  }

  String get displayName {
    final primary = (itemsName ?? '').trim();
    if (primary.isNotEmpty) return primary;
    final fallback = (productName ?? '').trim();
    if (fallback.isNotEmpty) return fallback;
    return 'Unnamed Item';
  }

  String get productNameOrDash {
    final value = (productName ?? '').trim();
    return value.isEmpty ? '-' : value;
  }

  String get categoryOrDash {
    final value = (category ?? '').trim();
    return value.isEmpty ? '-' : value;
  }

  String get itemCodeOrDash {
    final value = (itemCode ?? '').trim();
    return value.isEmpty ? '-' : value;
  }

  String get hsnCodeOrDash {
    final value = (hsnCode ?? '').trim();
    return value.isEmpty ? '-' : value;
  }

  String get sizeInchOrDash {
    final value = (sizeInch ?? '').trim();
    return value.isEmpty ? '-' : value;
  }

  String get sizeMmOrDash {
    final value = (sizeMm ?? '').trim();
    return value.isEmpty ? '-' : value;
  }
}

class _ComparisonOffer {
  final dynamic vendorId;
  final dynamic priceListId;
  final dynamic itemId;
  final dynamic projectId;
  final String? vendorName;
  final String? vendorCompanyName;
  final String? versionName;
  final String? priceListStatus;
  final dynamic pricePerPic;
  final dynamic discountPrice;
  final dynamic netPrice;
  final String? priceListCreatedAt;

  const _ComparisonOffer({
    required this.vendorId,
    required this.priceListId,
    required this.itemId,
    required this.projectId,
    required this.vendorName,
    required this.vendorCompanyName,
    required this.versionName,
    required this.priceListStatus,
    required this.pricePerPic,
    required this.discountPrice,
    required this.netPrice,
    required this.priceListCreatedAt,
  });

  factory _ComparisonOffer.fromJson(Map<dynamic, dynamic> json) {
    return _ComparisonOffer(
      vendorId: json['vendor_id'],
      priceListId: json['price_list_id'],
      itemId: json['item_id'],
      projectId: json['project_id'],
      vendorName: json['vendor_name']?.toString(),
      vendorCompanyName: json['vendor_company_name']?.toString(),
      versionName: json['version_name']?.toString(),
      priceListStatus: json['price_list_status']?.toString(),
      pricePerPic: json['price_per_pic'],
      discountPrice: json['discount_price'],
      netPrice: json['net_price'],
      priceListCreatedAt: json['price_list_created_at']?.toString(),
    );
  }

  String get vendorNameOrDash {
    final value = (vendorName ?? '').trim();
    return value.isEmpty ? '-' : value;
  }

  String get vendorCompanyNameOrDash {
    final value = (vendorCompanyName ?? '').trim();
    return value.isEmpty ? '-' : value;
  }

  String get projectIdOrDash {
    if (projectId == null) return '-';
    final value = projectId.toString().trim();
    return value.isEmpty ? '-' : value;
  }

  String get versionNameOrDash {
    final value = (versionName ?? '').trim();
    return value.isEmpty ? '-' : value;
  }

  String get priceListStatusOrDash {
    final value = (priceListStatus ?? '').trim();
    return value.isEmpty ? '-' : value;
  }
}
