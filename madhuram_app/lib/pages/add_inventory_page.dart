import 'package:flutter/material.dart' hide Material;
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/inventory.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../store/project_actions.dart';
import '../theme/app_theme.dart';
import '../utils/formatters.dart';
import '../utils/responsive.dart';

class AddInventoryPage extends StatefulWidget {
  const AddInventoryPage({super.key});

  @override
  State<AddInventoryPage> createState() => _AddInventoryPageState();
}

class _AddInventoryPageState extends State<AddInventoryPage> {
  final _brandController = TextEditingController();
  final _nameController = TextEditingController();
  final _quantityController = TextEditingController();
  final _priceController = TextEditingController();

  String? _activeProjectId;
  bool _stockIn = true;
  bool _billing = false;
  bool _loading = false;
  bool _saving = false;
  String _searchTerm = '';
  String _stockFilter = 'all';
  String _billingFilter = 'all';
  final Map<String, bool> _rowPending = <String, bool>{};
  List<InventoryItem> _items = [];

  bool _didInitLoad = false;
  int _loadRequestId = 0;
  String? _lastLoadedProjectId;

  @override
  void dispose() {
    _brandController.dispose();
    _nameController.dispose();
    _quantityController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _setRowBusy(String id, bool busy) {
    setState(() {
      if (busy) {
        _rowPending[id] = true;
      } else {
        _rowPending.remove(id);
      }
    });
  }

  String _projectLabel(List<Map<String, dynamic>> projects) {
    if (_activeProjectId == 'all') return 'All Projects';
    if (_activeProjectId == null || _activeProjectId!.isEmpty) {
      return 'Select a project';
    }

    final match = projects.where((project) {
      final id =
          project['id']?.toString() ?? project['project_id']?.toString() ?? '';
      return id == _activeProjectId;
    }).firstOrNull;

    if (match == null) return 'Project ${_activeProjectId!}';
    return match['name']?.toString() ??
        match['project_name']?.toString() ??
        'Project ${_activeProjectId!}';
  }

  Future<void> _loadItems() async {
    if (_activeProjectId == null || _activeProjectId!.isEmpty) {
      _lastLoadedProjectId = null;
      setState(() {
        _items = [];
        _loading = false;
      });
      return;
    }

    final requestId = ++_loadRequestId;
    _lastLoadedProjectId = _activeProjectId;

    setState(() => _loading = true);
    try {
      final result = _activeProjectId == 'all'
          ? await ApiClient.getInventories()
          : await ApiClient.getInventoriesByProject(_activeProjectId!);

      if (!mounted || requestId != _loadRequestId) return;

      if (result['success'] == true && result['data'] is List) {
        final rows = (result['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map(InventoryItem.fromJson)
            .toList();
        setState(() => _items = rows);
      } else {
        setState(() => _items = []);
      }
    } catch (_) {
      if (!mounted || requestId != _loadRequestId) return;
      setState(() => _items = []);
      showToast(context, 'Failed to load inventory items for this project.');
    } finally {
      if (mounted && requestId == _loadRequestId) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _createInventory() async {
    final projectId = _activeProjectId;
    if (projectId == null || projectId.isEmpty || projectId == 'all') {
      showToast(context, 'Select a project first');
      return;
    }

    if (_brandController.text.trim().isEmpty ||
        _nameController.text.trim().isEmpty) {
      showToast(context, 'Brand and item name are required');
      return;
    }

    setState(() => _saving = true);

    try {
      final result = await ApiClient.createInventory({
        'project_id': int.tryParse(projectId) ?? projectId,
        'brand': _brandController.text.trim(),
        'name': _nameController.text.trim(),
        'quantity': double.tryParse(_quantityController.text.trim()) ?? 0,
        'price': double.tryParse(_priceController.text.trim()) ?? 0,
        'stockin': _stockIn,
        'billing': _billing,
      });

      if (!mounted) return;

      if (result['success'] == true) {
        _brandController.clear();
        _nameController.clear();
        _quantityController.clear();
        _priceController.clear();
        setState(() {
          _stockIn = true;
          _billing = false;
        });
        await _loadItems();
        if (!mounted) return;
        showToast(context, 'Inventory item created successfully.');
      } else {
        showToast(
          context,
          (result['error'] ?? 'Failed to create inventory item.').toString(),
        );
      }
    } catch (_) {
      if (mounted) {
        showToast(context, 'Failed to create inventory item.');
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _toggleStock(InventoryItem item, bool value) async {
    final id = item.id;
    _setRowBusy(id, true);
    try {
      final result = await ApiClient.updateInventoryStockIn(id, value);
      if (!mounted) return;

      if (result['success'] == true && result['data'] is Map<String, dynamic>) {
        final updated = InventoryItem.fromJson(
          result['data'] as Map<String, dynamic>,
        );
        setState(() {
          _items = _items.map((row) => row.id == id ? updated : row).toList();
        });
      } else {
        showToast(
          context,
          (result['error'] ?? 'Failed to update stock status.').toString(),
        );
      }
    } catch (_) {
      if (mounted) {
        showToast(context, 'Failed to update stock status.');
      }
    } finally {
      if (mounted) _setRowBusy(id, false);
    }
  }

  Future<void> _toggleBilling(InventoryItem item, bool value) async {
    final id = item.id;
    _setRowBusy(id, true);
    try {
      final result = await ApiClient.updateInventoryBilling(id, value);
      if (!mounted) return;

      if (result['success'] == true && result['data'] is Map<String, dynamic>) {
        final updated = InventoryItem.fromJson(
          result['data'] as Map<String, dynamic>,
        );
        setState(() {
          _items = _items.map((row) => row.id == id ? updated : row).toList();
        });
      } else {
        showToast(
          context,
          (result['error'] ?? 'Failed to update billing status.').toString(),
        );
      }
    } catch (_) {
      if (mounted) {
        showToast(context, 'Failed to update billing status.');
      }
    } finally {
      if (mounted) _setRowBusy(id, false);
    }
  }

  Future<void> _openEdit(InventoryItem item) async {
    final id = item.id;
    _setRowBusy(id, true);

    try {
      final result = await ApiClient.getInventoryById(id);
      if (!mounted) return;

      if (result['success'] != true ||
          result['data'] is! Map<String, dynamic>) {
        showToast(
          context,
          (result['error'] ?? 'Failed to load inventory item.').toString(),
        );
        return;
      }

      final current = InventoryItem.fromJson(
        result['data'] as Map<String, dynamic>,
      );
      final brandController = TextEditingController(text: current.brand);
      final nameController = TextEditingController(text: current.name);
      final quantityController = TextEditingController(
        text: current.quantity.toString(),
      );
      final priceController = TextEditingController(
        text: current.price.toString(),
      );
      var stockIn = current.stockIn;
      var billing = current.billing;
      var saving = false;

      await MadDialog.show<void>(
        context: context,
        title: 'Edit Inventory Item #${current.id}',
        showCloseButton: true,
        content: StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MadInput(
                  controller: brandController,
                  labelText: 'Brand',
                  hintText: 'e.g. ACC',
                ),
                const SizedBox(height: 12),
                MadInput(
                  controller: nameController,
                  labelText: 'Item Name',
                  hintText: 'e.g. Cement Bag',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        controller: quantityController,
                        labelText: 'Quantity',
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MadInput(
                        controller: priceController,
                        labelText: 'Price',
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: MadSelect<String>(
                        labelText: 'Stock Status',
                        value: stockIn ? 'in' : 'out',
                        options: const [
                          MadSelectOption(value: 'in', label: 'In Stock'),
                          MadSelectOption(value: 'out', label: 'Out of Stock'),
                        ],
                        onChanged: (value) =>
                            setDialogState(() => stockIn = value == 'in'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MadSelect<String>(
                        labelText: 'Billing Status',
                        value: billing ? 'done' : 'pending',
                        options: const [
                          MadSelectOption(value: 'done', label: 'Billed'),
                          MadSelectOption(value: 'pending', label: 'Pending'),
                        ],
                        onChanged: (value) =>
                            setDialogState(() => billing = value == 'done'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    MadButton(
                      text: 'Cancel',
                      variant: ButtonVariant.outline,
                      disabled: saving,
                      onPressed: () => Navigator.of(dialogContext).pop(),
                    ),
                    const SizedBox(width: 8),
                    MadButton(
                      text: saving ? 'Saving...' : 'Save changes',
                      loading: saving,
                      disabled: saving,
                      onPressed: () async {
                        setDialogState(() => saving = true);
                        final update = await ApiClient.updateInventory(id, {
                          'brand': brandController.text.trim(),
                          'name': nameController.text.trim(),
                          'quantity':
                              double.tryParse(quantityController.text.trim()) ??
                              0,
                          'price':
                              double.tryParse(priceController.text.trim()) ?? 0,
                          'stockin': stockIn,
                          'billing': billing,
                        });
                        if (!mounted) return;
                        if (update['success'] == true) {
                          if (dialogContext.mounted) {
                            Navigator.of(dialogContext).pop();
                          }
                          await _loadItems();
                          if (!mounted) return;
                          showToast(context, 'Inventory item updated.');
                        } else {
                          if (mounted) {
                            showToast(
                              context,
                              (update['error'] ??
                                      'Failed to update inventory item.')
                                  .toString(),
                            );
                          }
                          if (dialogContext.mounted) {
                            setDialogState(() => saving = false);
                          }
                        }
                      },
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      );

      brandController.dispose();
      nameController.dispose();
      quantityController.dispose();
      priceController.dispose();
    } catch (_) {
      if (mounted) {
        showToast(context, 'Failed to load inventory item.');
      }
    } finally {
      if (mounted) _setRowBusy(id, false);
    }
  }

  Future<void> _removeItem(InventoryItem item) async {
    final confirm = await MadDialog.confirm(
      context: context,
      title: 'Delete inventory #${item.id}?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    );

    if (!confirm) return;

    _setRowBusy(item.id, true);
    try {
      final result = await ApiClient.deleteInventory(item.id);
      if (!mounted) return;

      if (result['success'] == true) {
        await _loadItems();
        if (!mounted) return;
        showToast(context, 'Inventory item deleted.');
      } else {
        showToast(
          context,
          (result['error'] ?? 'Failed to delete inventory item.').toString(),
        );
      }
    } catch (_) {
      if (mounted) {
        showToast(context, 'Failed to delete inventory item.');
      }
    } finally {
      if (mounted) _setRowBusy(item.id, false);
    }
  }

  List<InventoryItem> get _filteredItems {
    final query = _searchTerm.trim().toLowerCase();

    return _items.where((item) {
      final matchesSearch =
          query.isEmpty ||
          item.brand.toLowerCase().contains(query) ||
          item.name.toLowerCase().contains(query) ||
          item.id.toLowerCase().contains(query) ||
          item.projectId.toLowerCase().contains(query);

      final matchesStock =
          _stockFilter == 'all' ||
          (_stockFilter == 'in' && item.stockIn) ||
          (_stockFilter == 'out' && !item.stockIn);

      final matchesBilling =
          _billingFilter == 'all' ||
          (_billingFilter == 'billed' && item.billing) ||
          (_billingFilter == 'pending' && !item.billing);

      return matchesSearch && matchesStock && matchesBilling;
    }).toList();
  }

  double get _totalQuantity =>
      _filteredItems.fold(0, (sum, item) => sum + item.quantity);

  double get _totalValue =>
      _filteredItems.fold(0, (sum, item) => sum + (item.quantity * item.price));

  @override
  Widget build(BuildContext context) {
    final responsive = Responsive(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return StoreConnector<AppState, _InventoryViewModel>(
      converter: (store) => _InventoryViewModel(
        projects: store.state.project.projects,
        selectedProjectId: store.state.project.selectedProjectId,
      ),
      builder: (context, vm) {
        _activeProjectId ??= vm.selectedProjectId;

        if (!_didInitLoad) {
          _didInitLoad = true;
          WidgetsBinding.instance.addPostFrameCallback((_) => _loadItems());
        } else if (_activeProjectId != _lastLoadedProjectId && !_loading) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _loadItems());
        }

        final projectOptions = [
          const MadSelectOption<String>(value: 'all', label: 'All projects'),
          ...vm.projects.map((project) {
            final id =
                project['id']?.toString() ??
                project['project_id']?.toString() ??
                '';
            final name =
                project['name']?.toString() ??
                project['project_name']?.toString() ??
                'Project $id';
            return MadSelectOption<String>(value: id, label: name);
          }),
        ];

        return ProtectedRoute(
          title: 'Add Inventory',
          route: '/inventory/add',
          headerLeadingIcon: LucideIcons.arrowLeft,
          onHeaderLeadingPressed: () =>
              Navigator.pushReplacementNamed(context, '/projects'),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHero(isDark, vm.projects),
                SizedBox(
                  height: responsive.value(mobile: 14, tablet: 16, desktop: 20),
                ),
                _buildStats(isDark, responsive),
                SizedBox(
                  height: responsive.value(mobile: 14, tablet: 16, desktop: 20),
                ),
                if (responsive.isDesktop)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(width: 370, child: _buildForm(projectOptions)),
                      SizedBox(width: responsive.spacing),
                      Expanded(child: _buildInventoryPanel(isDark, responsive)),
                    ],
                  )
                else ...[
                  _buildForm(projectOptions),
                  SizedBox(
                    height: responsive.value(
                      mobile: 14,
                      tablet: 16,
                      desktop: 20,
                    ),
                  ),
                  _buildInventoryPanel(isDark, responsive),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHero(bool isDark, List<Map<String, dynamic>> projects) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
              .withValues(alpha: 0.6),
        ),
        gradient: LinearGradient(
          colors: isDark
              ? [AppTheme.darkCard, AppTheme.darkCard.withValues(alpha: 0.8)]
              : [Colors.white, AppTheme.lightMuted.withValues(alpha: 0.45)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const MadBadge(
            text: 'Inventory Workspace',
            variant: BadgeVariant.outline,
          ),
          const SizedBox(height: 10),
          Text(
            'Add Inventory',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: isDark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Create inventory entries for ${_projectLabel(projects)}.',
            style: TextStyle(
              fontSize: 13,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStats(bool isDark, Responsive responsive) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: responsive.value(mobile: 2, tablet: 2, desktop: 4),
      crossAxisSpacing: responsive.value(mobile: 8, tablet: 10, desktop: 14),
      mainAxisSpacing: responsive.value(mobile: 8, tablet: 10, desktop: 14),
      childAspectRatio: responsive.value(
        mobile: 1.52,
        tablet: 1.85,
        desktop: 2.15,
      ),
      children: [
        _statTile(
          title: 'Total Items',
          value: _filteredItems.length.toString(),
          subtitle: 'Matching current filters',
          isDark: isDark,
        ),
        _statTile(
          title: 'Total Quantity',
          value: Formatters.integer(_totalQuantity),
          subtitle: 'Units across visible rows',
          isDark: isDark,
        ),
        _statTile(
          title: 'Inventory Value',
          value: '₹${Formatters.indianNumber(_totalValue)}',
          subtitle: 'Quantity x price',
          isDark: isDark,
        ),
        _statTile(
          title: 'In Stock',
          value: _filteredItems.where((it) => it.stockIn).length.toString(),
          subtitle: 'Items currently available',
          isDark: isDark,
        ),
      ],
    );
  }

  Widget _statTile({
    required String title,
    required String value,
    required String subtitle,
    required bool isDark,
  }) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const Spacer(),
            Text(
              subtitle,
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
    );
  }

  Widget _buildForm(List<MadSelectOption<String>> projectOptions) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  LucideIcons.packagePlus,
                  size: 18,
                  color: AppTheme.primaryColor,
                ),
                const SizedBox(width: 8),
                const Text(
                  'New Item',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Mapped fields: project_id, brand, quantity, name, price, stockin, billing.',
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 16),
            MadSelect<String>(
              labelText: 'Project',
              placeholder: 'Select project',
              value: _activeProjectId,
              options: projectOptions,
              onChanged: (value) {
                setState(() => _activeProjectId = value);

                if (value != null && value != 'all') {
                  final store = StoreProvider.of<AppState>(context);
                  final match = store.state.project.projects.firstWhere(
                    (p) =>
                        (p['id']?.toString() ?? p['project_id']?.toString()) ==
                        value,
                    orElse: () => const {},
                  );
                  if (match.isNotEmpty) {
                    store.dispatch(SelectProject(match));
                  }
                }

                _loadItems();
              },
            ),
            const SizedBox(height: 12),
            MadInput(
              controller: _brandController,
              labelText: 'Brand',
              hintText: 'e.g. ACC',
            ),
            const SizedBox(height: 12),
            MadInput(
              controller: _nameController,
              labelText: 'Item Name',
              hintText: 'e.g. Cement Bag',
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MadInput(
                    controller: _quantityController,
                    labelText: 'Quantity',
                    hintText: '0',
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MadInput(
                    controller: _priceController,
                    labelText: 'Price',
                    hintText: '0.00',
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            MadSelect<String>(
              labelText: 'Stock Status',
              value: _stockIn ? 'in' : 'out',
              options: const [
                MadSelectOption(value: 'in', label: 'In Stock'),
                MadSelectOption(value: 'out', label: 'Out of Stock'),
              ],
              onChanged: (value) => setState(() => _stockIn = value == 'in'),
            ),
            const SizedBox(height: 12),
            MadSelect<String>(
              labelText: 'Billing Status',
              value: _billing ? 'done' : 'pending',
              options: const [
                MadSelectOption(value: 'done', label: 'Billed'),
                MadSelectOption(value: 'pending', label: 'Pending'),
              ],
              onChanged: (value) => setState(() => _billing = value == 'done'),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: MadButton(
                text: _saving ? 'Saving...' : '+ Add inventory',
                loading: _saving,
                disabled:
                    _saving ||
                    _activeProjectId == null ||
                    _activeProjectId!.isEmpty ||
                    _activeProjectId == 'all',
                onPressed: _saving ? null : _createInventory,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInventoryPanel(bool isDark, Responsive responsive) {
    final isMobile = responsive.isMobile;

    return MadCard(
      child: Padding(
        padding: EdgeInsets.all(isMobile ? 10 : 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isMobile)
              _buildInventoryHeaderMobile(isDark)
            else
              _buildInventoryHeaderDesktop(isDark),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(isMobile ? 10 : 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: (isDark ? Colors.white : Colors.black).withValues(
                    alpha: 0.08,
                  ),
                ),
              ),
              child: _buildInventoryCards(isDark),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInventoryHeaderMobile(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _inventoryTitle(isDark),
        const SizedBox(height: 12),
        MadInput(
          hintText: 'Search...',
          prefix: Icon(
            LucideIcons.search,
            size: 16,
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
          onChanged: (value) => setState(() => _searchTerm = value),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: MadSelect<String>(
                value: _stockFilter,
                options: const [
                  MadSelectOption(value: 'all', label: 'All'),
                  MadSelectOption(value: 'in', label: 'In Stock'),
                  MadSelectOption(value: 'out', label: 'Out Stock'),
                ],
                onChanged: (value) =>
                    setState(() => _stockFilter = value ?? 'all'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MadSelect<String>(
                value: _billingFilter,
                options: const [
                  MadSelectOption(value: 'all', label: 'All Billing'),
                  MadSelectOption(value: 'billed', label: 'Billed'),
                  MadSelectOption(value: 'pending', label: 'Pending'),
                ],
                onChanged: (value) =>
                    setState(() => _billingFilter = value ?? 'all'),
              ),
            ),
            const SizedBox(width: 8),
            MadButton(
              icon: LucideIcons.refreshCw,
              variant: ButtonVariant.outline,
              size: ButtonSize.icon,
              loading: _loading,
              disabled: _activeProjectId == null || _activeProjectId!.isEmpty,
              onPressed: _loading ? null : _loadItems,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildInventoryHeaderDesktop(bool isDark) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: _inventoryTitle(isDark)),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 220,
              child: MadInput(
                hintText: 'Search...',
                prefix: Icon(
                  LucideIcons.search,
                  size: 16,
                  color: isDark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                ),
                onChanged: (value) => setState(() => _searchTerm = value),
              ),
            ),
            SizedBox(
              width: 130,
              child: MadSelect<String>(
                value: _stockFilter,
                options: const [
                  MadSelectOption(value: 'all', label: 'All'),
                  MadSelectOption(value: 'in', label: 'In Stock'),
                  MadSelectOption(value: 'out', label: 'Out Stock'),
                ],
                onChanged: (value) =>
                    setState(() => _stockFilter = value ?? 'all'),
              ),
            ),
            SizedBox(
              width: 130,
              child: MadSelect<String>(
                value: _billingFilter,
                options: const [
                  MadSelectOption(value: 'all', label: 'All Billing'),
                  MadSelectOption(value: 'billed', label: 'Billed'),
                  MadSelectOption(value: 'pending', label: 'Pending'),
                ],
                onChanged: (value) =>
                    setState(() => _billingFilter = value ?? 'all'),
              ),
            ),
            MadButton(
              icon: LucideIcons.refreshCw,
              variant: ButtonVariant.outline,
              size: ButtonSize.icon,
              loading: _loading,
              disabled: _activeProjectId == null || _activeProjectId!.isEmpty,
              onPressed: _loading ? null : _loadItems,
            ),
          ],
        ),
      ],
    );
  }

  Widget _inventoryTitle(bool isDark) {
    final description = _activeProjectId == 'all'
        ? 'Showing items across all projects.'
        : 'Current items for the selected project.';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.boxes, size: 18, color: AppTheme.primaryColor),
            const SizedBox(width: 8),
            Text(
              'Inventory',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          description,
          style: TextStyle(
            fontSize: 12,
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
      ],
    );
  }

  Widget _buildInventoryCards(bool isDark) {
    if (_loading && _filteredItems.isEmpty) {
      return _emptyState('Loading items...', isDark);
    }

    if (_filteredItems.isEmpty) {
      return _emptyState('No inventory items found.', isDark);
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final twoColumn = constraints.maxWidth >= 880;

        if (!twoColumn) {
          return Column(
            children: [
              for (var i = 0; i < _filteredItems.length; i++) ...[
                _inventoryCard(_filteredItems[i], isDark),
                if (i != _filteredItems.length - 1) const SizedBox(height: 12),
              ],
            ],
          );
        }

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _filteredItems.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 1.65,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemBuilder: (context, index) {
            final item = _filteredItems[index];
            return _inventoryCard(item, isDark);
          },
        );
      },
    );
  }

  Widget _emptyState(String message, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 34),
      child: Center(
        child: Text(
          message,
          style: TextStyle(
            fontSize: 14,
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
      ),
    );
  }

  Widget _inventoryCard(InventoryItem item, bool isDark) {
    final pending = _rowPending[item.id] == true;

    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? AppTheme.darkCard.withValues(alpha: 0.65)
            : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
              .withValues(alpha: 0.7),
        ),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: isDark
                            ? AppTheme.darkForeground
                            : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${item.brand} • #${item.id} • P${item.projectId.isEmpty ? '-' : item.projectId}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
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
              if (pending)
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                  .withValues(alpha: 0.45),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _metric(
                    'Qty',
                    Formatters.integer(item.quantity),
                    isDark,
                  ),
                ),
                Expanded(
                  child: _metric(
                    'Unit Price',
                    '₹${Formatters.indianNumber(item.price)}',
                    isDark,
                  ),
                ),
                Expanded(
                  child: _metric(
                    'Total',
                    '₹${Formatters.indianNumber(item.value)}',
                    isDark,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Column(
            children: [
              _statusToggleStock(item, isDark, pending),
              const SizedBox(height: 8),
              _statusToggleBilling(item, isDark, pending),
            ],
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                MadButton(
                  text: 'Edit',
                  size: ButtonSize.sm,
                  variant: ButtonVariant.outline,
                  icon: LucideIcons.pencil,
                  disabled: pending,
                  onPressed: () => _openEdit(item),
                ),
                MadButton(
                  size: ButtonSize.sm,
                  variant: ButtonVariant.ghost,
                  icon: LucideIcons.trash2,
                  disabled: pending,
                  onPressed: () => _removeItem(item),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            letterSpacing: 0.35,
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
          ),
        ),
      ],
    );
  }

  Widget _statusToggleStock(InventoryItem item, bool isDark, bool pending) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
              .withValues(alpha: 0.7),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Stock',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              ),
              MadBadge(
                text: item.stockIn ? 'In' : 'Out',
                variant: item.stockIn
                    ? BadgeVariant.success
                    : BadgeVariant.secondary,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: MadButton(
                  text: 'In',
                  size: ButtonSize.sm,
                  variant: item.stockIn
                      ? ButtonVariant.primary
                      : ButtonVariant.outline,
                  disabled: pending || item.stockIn,
                  onPressed: () => _toggleStock(item, true),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: MadButton(
                  text: 'Out',
                  size: ButtonSize.sm,
                  variant: !item.stockIn
                      ? ButtonVariant.primary
                      : ButtonVariant.outline,
                  disabled: pending || !item.stockIn,
                  onPressed: () => _toggleStock(item, false),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statusToggleBilling(InventoryItem item, bool isDark, bool pending) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
              .withValues(alpha: 0.7),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Billing',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              ),
              MadBadge(
                text: item.billing ? 'Billed' : 'Pending',
                variant: item.billing
                    ? BadgeVariant.primary
                    : BadgeVariant.secondary,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: MadButton(
                  text: 'Billed',
                  size: ButtonSize.sm,
                  variant: item.billing
                      ? ButtonVariant.primary
                      : ButtonVariant.outline,
                  disabled: pending || item.billing,
                  onPressed: () => _toggleBilling(item, true),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: MadButton(
                  text: 'Pending',
                  size: ButtonSize.sm,
                  variant: !item.billing
                      ? ButtonVariant.primary
                      : ButtonVariant.outline,
                  disabled: pending || !item.billing,
                  onPressed: () => _toggleBilling(item, false),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InventoryViewModel {
  final List<Map<String, dynamic>> projects;
  final String? selectedProjectId;

  _InventoryViewModel({
    required this.projects,
    required this.selectedProjectId,
  });
}
