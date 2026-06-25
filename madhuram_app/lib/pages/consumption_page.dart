import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../services/api_client.dart';
import '../models/stock_area.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';
import '../utils/riverpod_context.dart';

/// Consumption tracking page matching React's Consumption page
class ConsumptionPage extends StatefulWidget {
  const ConsumptionPage({super.key});

  @override
  State<ConsumptionPage> createState() => _ConsumptionPageState();
}

class _ConsumptionPageState extends State<ConsumptionPage> {
  bool _isLoading = false;
  String? _error;
  List<Consumption> _consumptions = [];
  String _searchQuery = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;
  final _searchController = TextEditingController();
  String? _floorFilter;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadConsumptions();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadConsumptions() async {
    final projectId = context.appProject.selectedProjectId ?? '';

    if (projectId.isEmpty) {
      setState(() {
        _consumptions = [];
        _isLoading = false;
        _error = 'No project selected';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ApiClient.getConsumption(projectId);

      if (!mounted) return;

      if (result['success'] == true) {
        final data = result['data'] as List;
        final loaded = data.map((e) => Consumption.fromJson(e)).toList();
        setState(() {
          _consumptions = loaded;
          _isLoading = false;
        });
      } else {
        setState(() {
          _consumptions = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load consumption';
        });
      }
    } catch (e) {
      debugPrint('[Consumption] API error: $e');
      if (!mounted) return;
      setState(() {
        _consumptions = [];
        _isLoading = false;
        _error = 'Failed to load consumption';
      });
    }
  }

  List<Consumption> get _filteredConsumptions {
    List<Consumption> result = _consumptions;

    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result.where((c) {
        return c.material.toLowerCase().contains(query);
      }).toList();
    }

    if (_floorFilter != null) {
      result = result.where((c) => c.floor == _floorFilter).toList();
    }

    return result;
  }

  List<Consumption> get _paginatedConsumptions {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final filtered = _filteredConsumptions;
    if (start >= filtered.length) return [];
    return filtered.sublist(start, end > filtered.length ? filtered.length : end);
  }

  int get _totalPages => (_filteredConsumptions.length / _itemsPerPage).ceil();

  double get _totalQuantity => _consumptions.fold(0, (sum, c) => sum + c.quantity);

  List<String> get _floors {
    return _consumptions
        .where((c) => c.floor != null)
        .map((c) => c.floor!)
        .toSet()
        .toList();
  }

  List<Map<String, dynamic>> get _consumptionByFloor {
    final totals = <String, double>{};
    for (final c in _consumptions) {
      final floor = (c.floor ?? 'Unknown').toString();
      totals[floor] = (totals[floor] ?? 0) + c.quantity;
    }
    return totals.entries
        .map((e) => {'floor': e.key, 'value': e.value})
        .toList();
  }

  String get _topDepartmentFloor {
    final data = _consumptionByFloor;
    if (data.isEmpty) return '-';
    var max = data.first;
    for (final e in data) {
      if ((e['value'] as double) > (max['value'] as double)) max = e;
    }
    return max['floor'] as String;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Consumption',
      route: '/consumption',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Consumption',
                      style: TextStyle(
                        fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Track material consumption across floors',
                      style: TextStyle(
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isMobile)
                MadButton(
                  text: 'Record Consumption',
                  icon: LucideIcons.plus,
                  onPressed: () => _showConsumptionDialog(),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // Consumption by floor bar chart
          _buildConsumptionByFloorChart(isDark, isMobile),
          const SizedBox(height: 24),

          // Stats cards
          if (!isMobile)
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Total Records',
                    value: _consumptions.length.toString(),
                    icon: LucideIcons.clipboardList,
                    iconColor: AppTheme.primaryColor,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Total Consumed',
                    value: _totalQuantity.toStringAsFixed(0),
                    icon: LucideIcons.packageMinus,
                    iconColor: const Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Floors',
                    value: _floors.length.toString(),
                    icon: LucideIcons.building2,
                    iconColor: const Color(0xFF8B5CF6),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Top Department/Floor',
                    value: _topDepartmentFloor,
                    icon: LucideIcons.trendingUp,
                    iconColor: const Color(0xFF22C55E),
                  ),
                ),
              ],
            ),
          if (!isMobile) const SizedBox(height: 24),

          // Search and filters
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              SizedBox(
                width: isMobile ? double.infinity : 320,
                child: MadSearchInput(
                  controller: _searchController,
                  hintText: 'Search consumption records...',
                  onChanged: (value) => setState(() {
                    _searchQuery = value;
                    _currentPage = 1;
                  }),
                  onClear: () => setState(() {
                    _searchQuery = '';
                    _currentPage = 1;
                  }),
                ),
              ),
              if (_floors.isNotEmpty)
                SizedBox(
                  width: isMobile ? double.infinity : 150,
                  child: MadSelect<String>(
                    value: _floorFilter,
                    placeholder: 'All Floors',
                    clearable: true,
                    options: _floors.map((f) => MadSelectOption(value: f, label: f)).toList(),
                    onChanged: (value) => setState(() {
                      _floorFilter = value;
                      _currentPage = 1;
                    }),
                  ),
                ),
              if (isMobile)
                MadButton(
                  icon: LucideIcons.plus,
                  text: 'Record',
                  onPressed: () => _showConsumptionDialog(),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // Data table
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? _buildErrorState(isDark, _error!)
                    : _filteredConsumptions.isEmpty
                        ? _buildEmptyState(isDark)
                        : MadCard(
                            child: Column(
                              children: [
                            // Table header
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                              decoration: BoxDecoration(
                                color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(0.3),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                              ),
                              child: Row(
                                children: [
                                  _buildHeaderCell('Date', flex: 1, isDark: isDark),
                                  _buildHeaderCell('Material', flex: 2, isDark: isDark),
                                  if (!isMobile) ...[
                                    _buildHeaderCell('Quantity', flex: 1, isDark: isDark),
                                    _buildHeaderCell('Unit', flex: 1, isDark: isDark),
                                    _buildHeaderCell('Floor', flex: 1, isDark: isDark),
                                  ],
                                  const SizedBox(width: 48),
                                ],
                              ),
                            ),
                            // Table rows
                            Expanded(
                              child: ListView.separated(
                                itemCount: _paginatedConsumptions.length,
                                separatorBuilder: (_, __) => Divider(
                                  height: 1,
                                  color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5),
                                ),
                                itemBuilder: (context, index) {
                                  return _buildTableRow(_paginatedConsumptions[index], isDark, isMobile);
                                },
                              ),
                            ),
                            // Pagination
                            if (_totalPages > 1)
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  border: Border(
                                    top: BorderSide(
                                      color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5),
                                    ),
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Showing ${(_currentPage - 1) * _itemsPerPage + 1}-${_currentPage * _itemsPerPage > _filteredConsumptions.length ? _filteredConsumptions.length : _currentPage * _itemsPerPage} of ${_filteredConsumptions.length}',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                                      ),
                                    ),
                                    Row(
                                      children: [
                                        MadButton(
                                          icon: LucideIcons.chevronLeft,
                                          variant: ButtonVariant.outline,
                                          size: ButtonSize.sm,
                                          disabled: _currentPage == 1,
                                          onPressed: () => setState(() => _currentPage--),
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 12),
                                          child: Text('$_currentPage of $_totalPages'),
                                        ),
                                        MadButton(
                                          icon: LucideIcons.chevronRight,
                                          variant: ButtonVariant.outline,
                                          size: ButtonSize.sm,
                                          disabled: _currentPage >= _totalPages,
                                          onPressed: () => setState(() => _currentPage++),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildConsumptionByFloorChart(bool isDark, bool isMobile) {
    final data = _consumptionByFloor;
    final maxY = data.map((e) => e['value'] as double).reduce((a, b) => a > b ? a : b) * 1.2;

    return MadCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MadCardHeader(
            title: MadCardTitle(
              'Consumption by Department/Floor',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            subtitle: const MadCardDescription('Material consumption by floor.'),
          ),
          MadCardContent(
            child: SizedBox(
              height: isMobile ? 200 : 240,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: maxY,
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        if (groupIndex < data.length) {
                          return BarTooltipItem(
                            '${data[groupIndex]['floor']}\n${(rod.toY).toInt()}',
                            const TextStyle(color: Colors.white, fontSize: 12),
                          );
                        }
                        return null;
                      },
                    ),
                  ),
                  titlesData: FlTitlesData(
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          if (value.toInt() >= 0 && value.toInt() < data.length) {
                            return Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                data[value.toInt()]['floor'] as String,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                                ),
                              ),
                            );
                          }
                          return const Text('');
                        },
                      ),
                    ),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 36,
                        getTitlesWidget: (value, meta) => Text(
                          value.toInt().toString(),
                          style: TextStyle(
                            fontSize: 10,
                            color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                          ),
                        ),
                      ),
                    ),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    getDrawingHorizontalLine: (value) => FlLine(
                      color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5),
                      strokeWidth: 1,
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                  barGroups: data.asMap().entries.map((e) {
                    return BarChartGroupData(
                      x: e.key,
                      barRods: [
                        BarChartRodData(
                          toY: e.value['value'] as double,
                          color: AppTheme.primaryColor,
                          width: isMobile ? 24 : 32,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCell(String text, {required int flex, required bool isDark}) {
    return Expanded(
      flex: flex,
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
        ),
      ),
    );
  }

  Widget _buildTableRow(Consumption consumption, bool isDark, bool isMobile) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          Expanded(
            flex: 1,
            child: Text(
              consumption.date ?? '-',
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(consumption.material, style: const TextStyle(fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis),
                if (isMobile && consumption.floor != null)
                  Text(
                    '${consumption.quantity} ${consumption.unit} - ${consumption.floor}',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                  ),
              ],
            ),
          ),
          if (!isMobile) ...[
            Expanded(
              flex: 1,
              child: Text(
                consumption.quantity.toStringAsFixed(0),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Expanded(flex: 1, child: Text(consumption.unit, overflow: TextOverflow.ellipsis)),
            Expanded(
              flex: 1,
              child: consumption.floor != null
                  ? MadBadge(text: consumption.floor!, variant: BadgeVariant.secondary)
                  : const Text('-'),
            ),
          ],
          MadDropdownMenuButton(
            items: [
              MadMenuItem(label: 'View Details', icon: LucideIcons.eye, onTap: () {}),
              MadMenuItem(label: 'Edit', icon: LucideIcons.pencil, onTap: () => _showEditConsumptionDialog(consumption)),
              MadMenuItem(label: 'Delete', icon: LucideIcons.trash2, destructive: true, onTap: () => _confirmDeleteConsumption(consumption)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              LucideIcons.packageMinus,
              size: 64,
              color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withOpacity(0.3),
            ),
            const SizedBox(height: 24),
            Text(
              _searchQuery.isEmpty ? 'No consumption records yet' : 'No records found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchQuery.isEmpty
                  ? 'Record material consumption to track usage'
                  : 'Try a different search term',
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
            if (_searchQuery.isEmpty) ...[
              const SizedBox(height: 24),
              MadButton(
                text: 'Record Consumption',
                icon: LucideIcons.plus,
                onPressed: () => _showConsumptionDialog(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(bool isDark, String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red.withOpacity(0.5)),
            const SizedBox(height: 16),
            Text(
              'Failed to load consumption',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            MadButton(text: 'Retry', icon: LucideIcons.refreshCw, onPressed: _loadConsumptions),
          ],
        ),
      ),
    );
  }

  void _showEditConsumptionDialog(Consumption consumption) {
    const materialOptions = [
      MadSelectOption(value: 'cement', label: 'Cement OPC 53'),
      MadSelectOption(value: 'pvc', label: 'PVC Pipe 4"'),
      MadSelectOption(value: 'sand', label: 'River Sand'),
    ];
    const unitOptions = [
      MadSelectOption(value: 'bags', label: 'Bags'),
      MadSelectOption(value: 'meters', label: 'Meters'),
      MadSelectOption(value: 'kg', label: 'KG'),
      MadSelectOption(value: 'liters', label: 'Liters'),
    ];
    const floorOptions = [
      MadSelectOption(value: 'ground', label: 'Ground Floor'),
      MadSelectOption(value: '1st', label: '1st Floor'),
      MadSelectOption(value: '2nd', label: '2nd Floor'),
      MadSelectOption(value: '3rd', label: '3rd Floor'),
    ];
    String materialValue = materialOptions.any((o) => o.label == consumption.material)
        ? materialOptions.firstWhere((o) => o.label == consumption.material).value
        : materialOptions.first.value;
    String unitValue = unitOptions.any((o) => o.label == consumption.unit || o.value == consumption.unit)
        ? unitOptions.where((o) => o.label == consumption.unit || o.value == consumption.unit).first.value
        : unitOptions.first.value;
    String? floorValue = consumption.floor;
    final quantityController = TextEditingController(text: consumption.quantity.toStringAsFixed(0));
    final dateController = TextEditingController(text: consumption.date ?? '');

    MadFormDialog.show(
      context: context,
      title: 'Edit Consumption',
      maxWidth: 500,
      content: StatefulBuilder(
        builder: (context, setDialogState) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              MadSelect<String>(
                labelText: 'Material',
                placeholder: 'Select material',
                value: materialValue,
                searchable: true,
                options: materialOptions,
                onChanged: (value) => setDialogState(() => materialValue = value ?? materialValue),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: MadInput(
                      labelText: 'Quantity',
                      hintText: 'Enter quantity',
                      controller: quantityController,
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: MadSelect<String>(
                      labelText: 'Unit',
                      placeholder: 'Select',
                      value: unitValue,
                      options: unitOptions,
                      onChanged: (value) => setDialogState(() => unitValue = value ?? unitValue),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              MadSelect<String>(
                labelText: 'Floor',
                placeholder: 'Select floor',
                value: floorValue,
                options: floorOptions,
                onChanged: (value) => setDialogState(() => floorValue = value),
              ),
              const SizedBox(height: 16),
              MadInput(
                labelText: 'Date',
                hintText: 'Date',
                controller: dateController,
              ),
            ],
          );
        },
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () => Navigator.pop(context),
        ),
        MadButton(
          text: 'Save',
          onPressed: () {
            if (!mounted) return;
            final quantity = double.tryParse(quantityController.text) ?? consumption.quantity;
            final materialLabel = materialOptions.firstWhere((o) => o.value == materialValue, orElse: () => materialOptions.first).label;
            final unitLabel = unitOptions.firstWhere((o) => o.value == unitValue, orElse: () => unitOptions.first).label;
            setState(() {
              final i = _consumptions.indexWhere((c) => c.id == consumption.id);
              if (i >= 0) {
                _consumptions[i] = Consumption(
                  id: consumption.id,
                  material: materialLabel,
                  quantity: quantity,
                  unit: unitLabel,
                  date: dateController.text.isEmpty ? null : dateController.text,
                  floor: floorValue,
                  remarks: consumption.remarks,
                );
              }
            });
            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Consumption updated')));
          },
        ),
      ],
    );
  }

  void _confirmDeleteConsumption(Consumption consumption) {
    MadDialog.confirm(
      context: context,
      title: 'Delete Consumption',
      description: 'Are you sure you want to delete this consumption record (${consumption.material})? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    ).then((confirmed) {
      if (confirmed != true || !mounted) return;
      setState(() => _consumptions.removeWhere((c) => c.id == consumption.id));
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Consumption record deleted')));
    });
  }

  void _showConsumptionDialog() {
    MadFormDialog.show(
      context: context,
      title: 'Record Consumption',
      maxWidth: 500,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MadSelect<String>(
            labelText: 'Material',
            placeholder: 'Select material',
            searchable: true,
            options: const [
              MadSelectOption(value: 'cement', label: 'Cement OPC 53'),
              MadSelectOption(value: 'pvc', label: 'PVC Pipe 4"'),
              MadSelectOption(value: 'sand', label: 'River Sand'),
            ],
            onChanged: (value) {},
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: MadInput(
                  labelText: 'Quantity',
                  hintText: 'Enter quantity',
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: MadSelect<String>(
                  labelText: 'Unit',
                  placeholder: 'Select',
                  options: const [
                    MadSelectOption(value: 'bags', label: 'Bags'),
                    MadSelectOption(value: 'meters', label: 'Meters'),
                    MadSelectOption(value: 'kg', label: 'KG'),
                    MadSelectOption(value: 'liters', label: 'Liters'),
                  ],
                  onChanged: (value) {},
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          MadSelect<String>(
            labelText: 'Floor',
            placeholder: 'Select floor',
            options: const [
              MadSelectOption(value: 'ground', label: 'Ground Floor'),
              MadSelectOption(value: '1st', label: '1st Floor'),
              MadSelectOption(value: '2nd', label: '2nd Floor'),
              MadSelectOption(value: '3rd', label: '3rd Floor'),
            ],
            onChanged: (value) {},
          ),
          const SizedBox(height: 16),
          MadTextarea(
            labelText: 'Remarks',
            hintText: 'Optional remarks...',
            minLines: 2,
          ),
        ],
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () => Navigator.pop(context),
        ),
        MadButton(
          text: 'Record',
          onPressed: () {
            Navigator.pop(context);
            _loadConsumptions();
          },
        ),
      ],
    );
  }
}
