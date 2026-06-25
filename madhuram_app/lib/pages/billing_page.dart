import 'package:flutter/material.dart';
import '../utils/responsive.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../services/api_client.dart';
import '../models/billing.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/riverpod_context.dart';

/// Billing page with full implementation
class BillingPageFull extends StatefulWidget {
  const BillingPageFull({super.key});
  @override
  State<BillingPageFull> createState() => _BillingPageFullState();
}

class _BillingPageFullState extends State<BillingPageFull> {
  bool _isLoading = false;
  String? _error;
  List<Bill> _bills = [];
  String _searchQuery = '';
  int _currentPage = 1;
  final int _itemsPerPage = 10;
  final _searchController = TextEditingController();
  String? _statusFilter;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadBills();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadBills() async {
    final projectId = context.appProject.selectedProjectId ?? '';

    if (projectId.isEmpty) {
      setState(() {
        _bills = [];
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
      final result = await ApiClient.getBillingByProject(projectId);
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'] as List;
        final loaded = data.map((e) => Bill.fromJson(e)).toList();
        setState(() {
          _bills = loaded;
          _isLoading = false;
        });
      } else {
        setState(() {
          _bills = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load bills';
        });
      }
    } catch (e) {
      debugPrint('[Billing] API error: $e');
      if (!mounted) return;
      setState(() {
        _bills = [];
        _isLoading = false;
        _error = 'Failed to load bills';
      });
    }
  }

  List<Bill> get _filteredBills {
    List<Bill> result = _bills;
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result.where((b) => b.invoiceNo.toLowerCase().contains(query)).toList();
    }
    if (_statusFilter != null) result = result.where((b) => b.status == _statusFilter).toList();
    return result;
  }

  List<Bill> get _paginatedBills {
    final start = (_currentPage - 1) * _itemsPerPage;
    final end = start + _itemsPerPage;
    final filtered = _filteredBills;
    if (start >= filtered.length) return [];
    return filtered.sublist(start, end > filtered.length ? filtered.length : end);
  }

  int get _totalPages => (_filteredBills.length / _itemsPerPage).ceil();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Billing',
      route: '/billing',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Billing', style: TextStyle(fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28), fontWeight: FontWeight.bold, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground), overflow: TextOverflow.ellipsis),
            const SizedBox(height: 4),
            Text('Manage invoices and payments', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground), overflow: TextOverflow.ellipsis),
          ])),
          if (!isMobile) MadButton(text: 'Create Invoice', icon: LucideIcons.plus, onPressed: () => _showInvoiceDialog()),
        ]),
        const SizedBox(height: 24),
        if (!isMobile) Row(children: [
          Expanded(child: StatCard(title: 'Total Invoices', value: _bills.length.toString(), icon: LucideIcons.fileText, iconColor: AppTheme.primaryColor)),
          const SizedBox(width: 16),
          Expanded(child: StatCard(title: 'Pending', value: _bills.where((b) => b.status == 'Pending').length.toString(), icon: LucideIcons.clock, iconColor: const Color(0xFFF59E0B))),
          const SizedBox(width: 16),
          Expanded(child: StatCard(title: 'Paid', value: _bills.where((b) => b.status == 'Paid').length.toString(), icon: LucideIcons.circleCheck, iconColor: const Color(0xFF22C55E))),
        ]),
        if (!isMobile) const SizedBox(height: 24),
        Wrap(spacing: 12, runSpacing: 12, children: [
          SizedBox(width: isMobile ? double.infinity : 320, child: MadSearchInput(controller: _searchController, hintText: 'Search invoices...', onChanged: (v) => setState(() { _searchQuery = v; _currentPage = 1; }), onClear: () => setState(() { _searchQuery = ''; _currentPage = 1; }))),
          SizedBox(width: 150, child: MadSelect<String>(value: _statusFilter, placeholder: 'All Status', clearable: true, options: const [MadSelectOption(value: 'Pending', label: 'Pending'), MadSelectOption(value: 'Paid', label: 'Paid'), MadSelectOption(value: 'Overdue', label: 'Overdue')], onChanged: (v) => setState(() { _statusFilter = v; _currentPage = 1; }))),
          if (isMobile) MadButton(icon: LucideIcons.plus, text: 'Create', onPressed: () => _showInvoiceDialog()),
        ]),
        const SizedBox(height: 24),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? _buildErrorState(isDark, _error!)
                  : _filteredBills.isEmpty
                      ? _buildEmptyState(isDark)
                      : MadCard(
            child: Column(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(0.3), borderRadius: const BorderRadius.vertical(top: Radius.circular(12))),
                child: Row(children: [
                  _buildHeaderCell('Invoice #', flex: 1, isDark: isDark),
                  _buildHeaderCell('Amount', flex: 1, isDark: isDark),
                  if (!isMobile) _buildHeaderCell('Date', flex: 1, isDark: isDark),
                  _buildHeaderCell('Status', flex: 1, isDark: isDark),
                  const SizedBox(width: 48),
                ]),
              ),
              Expanded(child: ListView.separated(
                itemCount: _paginatedBills.length,
                separatorBuilder: (_, __) => Divider(height: 1, color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5)),
                itemBuilder: (context, index) => _buildTableRow(_paginatedBills[index], isDark, isMobile),
              )),
              if (_totalPages > 1) _buildPagination(isDark),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _buildHeaderCell(String text, {required int flex, required bool isDark}) => Expanded(flex: flex, child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)));

  Widget _buildTableRow(Bill bill, bool isDark, bool isMobile) {
    BadgeVariant variant = bill.status == 'Paid' ? BadgeVariant.default_ : bill.status == 'Overdue' ? BadgeVariant.destructive : BadgeVariant.secondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(children: [
        Expanded(flex: 1, child: Text(bill.invoiceNo, style: const TextStyle(fontWeight: FontWeight.w600, fontFamily: 'monospace'))),
        Expanded(flex: 1, child: Text(bill.amount, style: const TextStyle(fontWeight: FontWeight.w500))),
        if (!isMobile) Expanded(flex: 1, child: Text(bill.date ?? '-', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground))),
        Expanded(flex: 1, child: MadBadge(text: bill.status, variant: variant)),
        MadDropdownMenuButton(items: [
          MadMenuItem(label: 'View Details', icon: LucideIcons.eye, onTap: () {}),
          MadMenuItem(label: 'Download PDF', icon: LucideIcons.download, onTap: () {}),
          if (bill.status == 'Pending') MadMenuItem(label: 'Mark Paid', icon: LucideIcons.circleCheck, onTap: () => _markBillPaid(bill)),
          MadMenuItem(label: 'Delete', icon: LucideIcons.trash2, destructive: true, onTap: () => _confirmDeleteBill(bill)),
        ]),
      ]),
    );
  }

  Widget _buildPagination(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5)))),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text('Page $_currentPage of $_totalPages', style: TextStyle(fontSize: 13, color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
        Row(children: [
          MadButton(icon: LucideIcons.chevronLeft, variant: ButtonVariant.outline, size: ButtonSize.sm, disabled: _currentPage == 1, onPressed: () => setState(() => _currentPage--)),
          const SizedBox(width: 8),
          MadButton(icon: LucideIcons.chevronRight, variant: ButtonVariant.outline, size: ButtonSize.sm, disabled: _currentPage >= _totalPages, onPressed: () => setState(() => _currentPage++)),
        ]),
      ]),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(child: Padding(padding: const EdgeInsets.all(48), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(LucideIcons.receipt, size: 64, color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withOpacity(0.3)),
      const SizedBox(height: 24),
      Text('No invoices yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
      const SizedBox(height: 8),
      Text('Create your first invoice to get started', style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)),
      const SizedBox(height: 24),
      MadButton(text: 'Create Invoice', icon: LucideIcons.plus, onPressed: () => _showInvoiceDialog()),
    ])));
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
            Text('Failed to load bills', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground)),
            const SizedBox(height: 8),
            Text(message, style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            MadButton(text: 'Retry', icon: LucideIcons.refreshCw, onPressed: _loadBills),
          ],
        ),
      ),
    );
  }

  void _markBillPaid(Bill bill) {
    setState(() {
      final i = _bills.indexWhere((b) => b.id == bill.id);
      if (i >= 0) {
        final b = _bills[i];
        _bills[i] = Bill(
          id: b.id,
          projectId: b.projectId,
          invoiceNo: b.invoiceNo,
          amount: b.amount,
          date: b.date,
          status: 'Paid',
          description: b.description,
          vendor: b.vendor,
          createdAt: b.createdAt,
        );
      }
    });
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invoice marked as Paid')));
  }

  void _confirmDeleteBill(Bill bill) {
    MadDialog.confirm(
      context: context,
      title: 'Delete Invoice',
      description: 'Are you sure you want to delete invoice "${bill.invoiceNo}"? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    ).then((confirmed) {
      if (confirmed != true || !mounted) return;
      setState(() => _bills.removeWhere((b) => b.id == bill.id));
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invoice deleted')));
    });
  }

  void _showInvoiceDialog() {
    MadFormDialog.show(
      context: context,
      title: 'Create Invoice',
      maxWidth: 500,
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Expanded(child: MadInput(labelText: 'Invoice Number', hintText: 'INV-XXX')),
          const SizedBox(width: 16),
          Expanded(child: MadInput(labelText: 'Date', hintText: 'Select date')),
        ]),
        const SizedBox(height: 16),
        MadInput(labelText: 'Amount', hintText: '0.00', keyboardType: TextInputType.number),
        const SizedBox(height: 16),
        MadTextarea(labelText: 'Description', hintText: 'Invoice description...', minLines: 2),
      ]),
      actions: [
        MadButton(text: 'Cancel', variant: ButtonVariant.outline, onPressed: () => Navigator.pop(context)),
        MadButton(text: 'Create Invoice', onPressed: () { Navigator.pop(context); _loadBills(); }),
      ],
    );
  }
}
