import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../services/api_client.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';
import '../utils/riverpod_context.dart';

/// Reports page
class ReportsPageFull extends StatefulWidget {
  const ReportsPageFull({super.key});
  @override
  State<ReportsPageFull> createState() => _ReportsPageFullState();
}

class _ReportsPageFullState extends State<ReportsPageFull> {
  bool _isLoading = true;
  Map<String, dynamic> _reportData = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadReports();
    });
  }

  Future<void> _loadReports() async {
    final projectId = context.appProject.selectedProjectId ?? '';
    
    if (projectId.isEmpty) {
      setState(() => _isLoading = false);
      return;
    }
    
    final result = await ApiClient.getReports(projectId);
    if (!mounted) return;
    if (result['success'] == true) {
      setState(() { _reportData = result['data'] as Map<String, dynamic>; _isLoading = false; });
    } else {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Reports',
      route: '/reports',
      child: _isLoading ? const Center(child: CircularProgressIndicator()) : SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Reports & Analytics', style: TextStyle(fontSize: responsive.value<double>(mobile: 22, tablet: 26, desktop: 28), fontWeight: FontWeight.bold, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
              const SizedBox(height: 4),
              Text('Project performance insights', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground), overflow: TextOverflow.ellipsis, maxLines: 1),
            ])),
            if (!isMobile) Row(children: [
              MadButton(text: 'Export PDF', icon: LucideIcons.download, variant: ButtonVariant.outline, onPressed: () {}),
              const SizedBox(width: 12),
              MadButton(text: 'Export Excel', icon: LucideIcons.fileSpreadsheet, onPressed: () {}),
            ]),
          ]),
          const SizedBox(height: 24),
          // Stats Row
          if (!isMobile) Row(children: [
            Expanded(child: StatCard(title: 'Total Value', value: _reportData['total_value'] ?? '₹0', icon: LucideIcons.indianRupee, iconColor: const Color(0xFF22C55E))),
            const SizedBox(width: 16),
            Expanded(child: StatCard(title: 'Active Orders', value: (_reportData['active_orders'] ?? 0).toString(), icon: LucideIcons.shoppingCart, iconColor: AppTheme.primaryColor)),
            const SizedBox(width: 16),
            Expanded(child: StatCard(title: 'Low Stock Items', value: (_reportData['low_stock_items'] ?? 0).toString(), icon: LucideIcons.triangleAlert, iconColor: const Color(0xFFF59E0B))),
            const SizedBox(width: 16),
            Expanded(child: StatCard(title: 'Total Materials', value: (_reportData['total_materials'] ?? 0).toString(), icon: LucideIcons.package, iconColor: const Color(0xFF8B5CF6))),
          ]),
          if (!isMobile) const SizedBox(height: 24),
          // Charts Row
          if (!isMobile) Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(flex: 2, child: _buildConsumptionChart(isDark)),
            const SizedBox(width: 16),
            Expanded(child: _buildCategoryBreakdown(isDark)),
          ]),
          if (isMobile) ...[_buildConsumptionChart(isDark), const SizedBox(height: 16), _buildCategoryBreakdown(isDark)],
          const SizedBox(height: 24),
          // Quick Reports
          Text('Quick Reports', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: isMobile ? 1 : 3,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: isMobile ? 3.5 : 2.5,
            children: [
              _buildReportCard('Inventory Summary', 'Stock levels and movements', LucideIcons.package, isDark),
              _buildReportCard('Purchase Analysis', 'PO trends and vendor performance', LucideIcons.shoppingCart, isDark),
              _buildReportCard('Consumption Report', 'Material usage by floor/area', LucideIcons.trendingDown, isDark),
              _buildReportCard('Budget vs Actual', 'Cost comparison analysis', LucideIcons.chartBar, isDark),
              _buildReportCard('Vendor Performance', 'Delivery and quality metrics', LucideIcons.users, isDark),
              _buildReportCard('Project Progress', 'Timeline and milestones', LucideIcons.calendar, isDark),
            ],
          ),
        ]),
      ),
    );
  }

  Widget _buildConsumptionChart(bool isDark) {
    final consumptionData = (_reportData['consumption_data'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('Material Consumption Trend', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
            MadSelect<String>(
              value: 'monthly',
              placeholder: 'Period',
              options: const [MadSelectOption(value: 'weekly', label: 'Weekly'), MadSelectOption(value: 'monthly', label: 'Monthly'), MadSelectOption(value: 'yearly', label: 'Yearly')],
              onChanged: (v) {},
            ),
          ]),
          const SizedBox(height: 24),
          SizedBox(
            height: 250,
            child: consumptionData.isEmpty ? Center(child: Text('No data available', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)))
                : BarChart(
                    BarChartData(
                      alignment: BarChartAlignment.spaceAround,
                      maxY: consumptionData.map((d) => (d['total'] as num).toDouble()).reduce((a, b) => a > b ? a : b) * 1.2,
                      barGroups: consumptionData.asMap().entries.map((entry) => BarChartGroupData(
                        x: entry.key,
                        barRods: [BarChartRodData(toY: (entry.value['total'] as num).toDouble(), color: AppTheme.primaryColor, width: 24, borderRadius: const BorderRadius.vertical(top: Radius.circular(4)))],
                      )).toList(),
                      titlesData: FlTitlesData(
                        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (value, meta) => Padding(padding: const EdgeInsets.only(top: 8), child: Text(consumptionData.length > value.toInt() ? consumptionData[value.toInt()]['name'] ?? '' : '', style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground))))),
                        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: (value, meta) => Text(value.toInt().toString(), style: TextStyle(fontSize: 10, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)))),
                        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      ),
                      gridData: FlGridData(show: true, drawVerticalLine: false, getDrawingHorizontalLine: (value) => FlLine(color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withValues(alpha: 0.5), strokeWidth: 1)),
                      borderData: FlBorderData(show: false),
                    ),
                  ),
          ),
        ]),
      ),
    );
  }

  Widget _buildCategoryBreakdown(bool isDark) {
    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Category Breakdown', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
          const SizedBox(height: 20),
          _buildCategoryItem('Civil', 45, const Color(0xFF3B82F6), isDark),
          const SizedBox(height: 12),
          _buildCategoryItem('Plumbing', 30, const Color(0xFF22C55E), isDark),
          const SizedBox(height: 12),
          _buildCategoryItem('Electrical', 15, const Color(0xFFF59E0B), isDark),
          const SizedBox(height: 12),
          _buildCategoryItem('Others', 10, const Color(0xFF8B5CF6), isDark),
        ]),
      ),
    );
  }

  Widget _buildCategoryItem(String name, double percentage, Color color, bool isDark) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(name, style: const TextStyle(fontSize: 14)),
        Text('$percentage%', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: color)),
      ]),
      const SizedBox(height: 6),
      ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: percentage / 100, backgroundColor: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.5), valueColor: AlwaysStoppedAnimation<Color>(color), minHeight: 8)),
    ]);
  }

  Widget _buildReportCard(String title, String description, IconData icon, bool isDark) {
    return MadCard(
      onTap: () {},
      hoverable: true,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(color: AppTheme.primaryColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: AppTheme.primaryColor),
          ),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(description, style: TextStyle(fontSize: 12, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
          ])),
          Icon(LucideIcons.chevronRight, size: 20, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
        ]),
      ),
    );
  }
}
