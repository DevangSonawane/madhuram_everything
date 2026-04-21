import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';

class QuotesSearchPage extends StatefulWidget {
  const QuotesSearchPage({super.key});

  @override
  State<QuotesSearchPage> createState() => _QuotesSearchPageState();
}

class _QuotesSearchPageState extends State<QuotesSearchPage> {
  final TextEditingController _queryController = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  bool _searched = false;
  List<Map<String, dynamic>> _items = [];

  @override
  void dispose() {
    _debounce?.cancel();
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _runSearch(String value) async {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _items = [];
        _searched = false;
      });
      return;
    }

    setState(() {
      _loading = true;
      _searched = true;
    });

    final store = StoreProvider.of<AppState>(context);
    final projectId =
        store.state.project.selectedProject?['project_id']?.toString() ??
        store.state.project.selectedProjectId;

    try {
      final result = await ApiClient.searchInventoryTrace(
        query: trimmed,
        projectId: projectId,
      );
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final list = data is Map && data['items'] is List
            ? data['items'] as List
            : (data is List ? data : const []);
        final seen = <String, Map<String, dynamic>>{};
        for (final row in list.whereType<Map>()) {
          final map = Map<String, dynamic>.from(row);
          final key =
              (map['inventory_id'] ??
                      map['id'] ??
                      '${map['name']}-${map['brand']}')
                  .toString();
          seen[key] = map;
        }
        setState(() {
          _items = seen.values.toList();
          _loading = false;
        });
        return;
      }
      setState(() {
        _items = [];
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _items = [];
        _loading = false;
      });
    }
  }

  String _priceFor(Map<String, dynamic> row) {
    final raw =
        row['price'] ??
        row['unit_price'] ??
        row['rate'] ??
        row['unit_rate'] ??
        0;
    final value = double.tryParse(raw.toString()) ?? 0;
    return '₹${value.toStringAsFixed(2)}';
  }

  String _projectLabel(Map<String, dynamic> row) {
    final name = row['project_name']?.toString();
    if (name != null && name.trim().isNotEmpty) return name;
    final sameProject =
        row['same_project'] == true ||
        row['same_project']?.toString() == 'true';
    return sameProject ? 'Same project' : 'Other project';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ProtectedRoute(
      title: 'Search Inventory',
      route: '/projects/quotes/search',
      showSidebar: false,
      requireProject: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 16),
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
                      const Text(
                        'Search Inventory',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Search inventory items and verify their source chain.',
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
                  text: 'Back',
                  icon: LucideIcons.arrowLeft,
                  variant: ButtonVariant.outline,
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Search',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Type an item name to search inventory.',
                      style: TextStyle(
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: 420,
                      child: TextField(
                        controller: _queryController,
                        onChanged: (value) {
                          _debounce?.cancel();
                          _debounce = Timer(
                            const Duration(milliseconds: 350),
                            () => _runSearch(value),
                          );
                        },
                        decoration: InputDecoration(
                          hintText: 'Search inventory...',
                          prefixIcon: const Icon(Icons.search, size: 18),
                          suffixIconConstraints: const BoxConstraints(
                            minWidth: 40,
                            minHeight: 40,
                          ),
                          suffixIcon: SizedBox(
                            width: 40,
                            height: 40,
                            child: _loading
                                ? const Center(
                                    child: SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  )
                                : const SizedBox.shrink(),
                          ),
                          filled: true,
                          fillColor:
                              (isDark
                                      ? AppTheme.darkMuted
                                      : AppTheme.lightMuted)
                                  .withValues(alpha: 0.4),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minWidth: 980),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color:
                                (isDark
                                        ? AppTheme.darkMuted
                                        : AppTheme.lightMuted)
                                    .withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              SizedBox(width: 220, child: Text('Item')),
                              SizedBox(width: 140, child: Text('Brand')),
                              SizedBox(width: 120, child: Text('Unit')),
                              SizedBox(
                                width: 90,
                                child: Align(
                                  alignment: Alignment.centerRight,
                                  child: Text('Qty'),
                                ),
                              ),
                              SizedBox(
                                width: 130,
                                child: Align(
                                  alignment: Alignment.centerRight,
                                  child: Text('Price'),
                                ),
                              ),
                              const SizedBox(width: 16),
                              SizedBox(width: 180, child: Text('Project')),
                              SizedBox(width: 240, child: Text('Source Chain')),
                            ],
                          ),
                        ),
                        if (!_searched)
                          const SizedBox.shrink()
                        else if (_loading)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Text('Searching inventory...'),
                          )
                        else if (_items.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Text('No items found.'),
                          )
                        else
                          ..._items.map((item) {
                            return Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(
                                    color:
                                        (isDark
                                                ? AppTheme.darkBorder
                                                : AppTheme.lightBorder)
                                            .withValues(alpha: 0.3),
                                  ),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  SizedBox(
                                    width: 220,
                                    child: Text(
                                      item['name']?.toString() ?? '-',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 140,
                                    child: Text(
                                      item['brand']?.toString() ?? '-',
                                    ),
                                  ),
                                  SizedBox(
                                    width: 120,
                                    child: Text(
                                      item['units']?.toString() ?? '-',
                                    ),
                                  ),
                                  SizedBox(
                                    width: 90,
                                    child: Align(
                                      alignment: Alignment.centerRight,
                                      child: Text(
                                        item['available_qty']?.toString() ??
                                            '0',
                                      ),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 130,
                                    child: Align(
                                      alignment: Alignment.centerRight,
                                      child: Text(_priceFor(item)),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  SizedBox(
                                    width: 180,
                                    child: Text(_projectLabel(item)),
                                  ),
                                  SizedBox(
                                    width: 240,
                                    child: Text(
                                      item['source_chain_label']?.toString() ??
                                          '-',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: isDark
                                            ? AppTheme.darkMutedForeground
                                            : AppTheme.lightMutedForeground,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
