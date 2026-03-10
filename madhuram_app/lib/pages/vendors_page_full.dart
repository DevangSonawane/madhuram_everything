import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/vendor.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class VendorsPageFull extends StatefulWidget {
  const VendorsPageFull({super.key});

  @override
  State<VendorsPageFull> createState() => _VendorsPageFullState();
}

class _VendorsPageFullState extends State<VendorsPageFull> {
  static const List<String> _statusOptions = ['active', 'inactive', 'blocked'];

  final TextEditingController _searchController = TextEditingController();

  List<Vendor> _vendors = [];
  bool _isLoading = false;
  String? _error;

  String _query = '';
  String _statusFilter = 'all';
  String _projectFilter = 'all';

  String? _selectedProjectId;
  String? _lastLoadedProjectId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadVendors());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadVendors() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result =
          (_selectedProjectId != null && _selectedProjectId!.isNotEmpty)
          ? await ApiClient.getVendorsByProject(_selectedProjectId!)
          : await ApiClient.getVendors();

      if (!mounted) return;

      if (result['success'] == true) {
        final raw = (result['data'] as List?) ?? const [];
        setState(() {
          _vendors = raw
              .whereType<Map>()
              .map((row) => Vendor.fromJson(Map<String, dynamic>.from(row)))
              .toList();
          _isLoading = false;
        });
      } else {
        final message =
            result['error']?.toString() ?? 'Could not fetch vendor list.';
        setState(() {
          _vendors = [];
          _isLoading = false;
          _error = message;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _vendors = [];
        _isLoading = false;
        _error = 'Could not fetch vendor list.';
      });
    }
  }

  List<String> get _projectOptions {
    final set = _vendors
        .map((v) => v.projectId)
        .whereType<String>()
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();
    set.sort((a, b) {
      final intA = int.tryParse(a);
      final intB = int.tryParse(b);
      if (intA != null && intB != null) return intA.compareTo(intB);
      return a.compareTo(b);
    });
    return set;
  }

  List<Vendor> get _filteredVendors {
    final q = _query.trim().toLowerCase();

    return _vendors.where((vendor) {
      final name = vendor.name.toLowerCase();
      final company = (vendor.companyName ?? '').toLowerCase();
      final email = (vendor.email ?? '').toLowerCase();
      final phone = (vendor.phone ?? '').toLowerCase();
      final location = (vendor.location ?? '').toLowerCase();
      final status = vendor.status.toLowerCase();

      final matchesSearch =
          q.isEmpty ||
          name.contains(q) ||
          company.contains(q) ||
          email.contains(q) ||
          phone.contains(q) ||
          location.contains(q);

      final matchesStatus = _statusFilter == 'all' || status == _statusFilter;
      final matchesProject =
          _projectFilter == 'all' || vendor.projectId == _projectFilter;

      return matchesSearch && matchesStatus && matchesProject;
    }).toList();
  }

  int get _activeCount =>
      _vendors.where((v) => v.status.toLowerCase() == 'active').length;

  int get _blockedCount =>
      _vendors.where((v) => v.status.toLowerCase() == 'blocked').length;

  int get _projectsCovered => _vendors
      .map((v) => v.projectId)
      .whereType<String>()
      .where((id) => id.isNotEmpty)
      .toSet()
      .length;

  String _capitalize(String value) {
    if (value.isEmpty) return value;
    return value[0].toUpperCase() + value.substring(1).toLowerCase();
  }

  InputDecoration _selectDecoration(bool isDark, {String? labelText}) {
    return InputDecoration(
      labelText: labelText,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      filled: true,
      fillColor: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(
        alpha: 0.5,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(
          color: AppTheme.primaryColor.withValues(alpha: 0.4),
        ),
      ),
    );
  }

  void _showSnack(String text, {bool destructive = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: destructive ? const Color(0xFFDC2626) : null,
      ),
    );
  }

  Future<void> _goToAddVendorPage() async {
    final created = await Navigator.pushNamed(context, '/vendors/new');
    if (!mounted) return;
    if (created == true) {
      await _loadVendors();
    }
  }

  void _openVendorPriceLists(Vendor vendor, {bool openLatest = false}) {
    Navigator.pushNamed(
      context,
      openLatest ? '/vendors/view-price' : '/vendors/price-lists',
      arguments: {
        'vendorId': vendor.id,
        'projectId': vendor.projectId ?? _selectedProjectId,
        'openLatest': openLatest,
      },
    );
  }

  Future<void> _openVendorDialog({Vendor? vendor}) async {
    final isEditing = vendor != null;
    final nameController = TextEditingController(text: vendor?.name ?? '');
    final projectController = TextEditingController(
      text: vendor?.projectId ?? (_selectedProjectId ?? ''),
    );
    final companyController = TextEditingController(
      text: vendor?.companyName ?? '',
    );
    final emailController = TextEditingController(text: vendor?.email ?? '');
    final mobileController = TextEditingController(text: vendor?.phone ?? '');
    final locationController = TextEditingController(
      text: vendor?.location ?? '',
    );

    String selectedStatus = (vendor?.status.isNotEmpty == true)
        ? vendor!.status.toLowerCase()
        : 'active';
    bool submitting = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final isDark = Theme.of(dialogContext).brightness == Brightness.dark;

        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              insetPadding: const EdgeInsets.symmetric(
                horizontal: 24,
                vertical: 24,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isEditing ? 'Edit Vendor' : 'Create Vendor',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Update vendor details and status.',
                        style: TextStyle(
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Flexible(
                        child: SingleChildScrollView(
                          child: Column(
                            children: [
                              MadInput(
                                controller: nameController,
                                labelText: 'Vendor Name *',
                                hintText: 'Enter vendor name',
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: MadInput(
                                      controller: projectController,
                                      labelText: 'Project ID',
                                      hintText: 'Enter project ID',
                                      keyboardType: TextInputType.number,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: DropdownButtonFormField<String>(
                                      initialValue: selectedStatus,
                                      isExpanded: true,
                                      decoration: _selectDecoration(
                                        isDark,
                                        labelText: 'Status',
                                      ),
                                      items: _statusOptions
                                          .map(
                                            (status) =>
                                                DropdownMenuItem<String>(
                                                  value: status,
                                                  child: Text(status),
                                                ),
                                          )
                                          .toList(),
                                      onChanged: (value) {
                                        setDialogState(() {
                                          selectedStatus = value ?? 'active';
                                        });
                                      },
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: MadInput(
                                      controller: companyController,
                                      labelText: 'Company Name',
                                      hintText: 'Enter company name',
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: MadInput(
                                      controller: emailController,
                                      labelText: 'Email',
                                      hintText: 'Enter email address',
                                      keyboardType: TextInputType.emailAddress,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: MadInput(
                                      controller: mobileController,
                                      labelText: 'Mobile Number',
                                      hintText: 'Enter mobile number',
                                      keyboardType: TextInputType.phone,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: MadInput(
                                      controller: locationController,
                                      labelText: 'Location',
                                      hintText: 'Enter location',
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          MadButton(
                            text: 'Cancel',
                            variant: ButtonVariant.outline,
                            disabled: submitting,
                            onPressed: () => Navigator.of(dialogContext).pop(),
                          ),
                          const SizedBox(width: 10),
                          MadButton(
                            text: submitting
                                ? (isEditing ? 'Saving...' : 'Creating...')
                                : (isEditing
                                      ? 'Save Changes'
                                      : 'Create Vendor'),
                            loading: submitting,
                            disabled: submitting,
                            onPressed: () async {
                              final vendorName = nameController.text.trim();
                              if (vendorName.isEmpty) {
                                _showSnack(
                                  'Vendor name required',
                                  destructive: true,
                                );
                                return;
                              }

                              final projectText = projectController.text.trim();
                              final payload = <String, dynamic>{
                                'project_id': projectText.isEmpty
                                    ? null
                                    : int.tryParse(projectText),
                                'vendor_name': vendorName,
                                'vendor_company_name': companyController.text
                                    .trim(),
                                'vendor_email': emailController.text.trim(),
                                'mobile_number': mobileController.text.trim(),
                                'location': locationController.text.trim(),
                                'status': selectedStatus,
                              };

                              setDialogState(() => submitting = true);

                              try {
                                Map<String, dynamic> result;
                                if (isEditing) {
                                  final originalProject = int.tryParse(
                                    vendor.projectId ?? '',
                                  );
                                  final nextProject =
                                      payload['project_id'] as int?;
                                  final otherFieldsChanged =
                                      (vendor.name != payload['vendor_name']) ||
                                      ((vendor.companyName ?? '') !=
                                          payload['vendor_company_name']) ||
                                      ((vendor.email ?? '') !=
                                          payload['vendor_email']) ||
                                      ((vendor.phone ?? '') !=
                                          payload['mobile_number']) ||
                                      ((vendor.location ?? '') !=
                                          payload['location']) ||
                                      (originalProject != nextProject);
                                  final statusChanged =
                                      vendor.status.toLowerCase() !=
                                      selectedStatus;

                                  if (statusChanged && !otherFieldsChanged) {
                                    result = await ApiClient.updateVendorStatus(
                                      vendor.id,
                                      selectedStatus,
                                    );
                                  } else {
                                    result = await ApiClient.updateVendor(
                                      vendor.id,
                                      payload,
                                    );
                                  }
                                } else {
                                  result = await ApiClient.createVendor(
                                    payload,
                                  );
                                }

                                if (!mounted) return;

                                if (result['success'] == true) {
                                  if (dialogContext.mounted) {
                                    Navigator.of(dialogContext).pop();
                                  }
                                  _showSnack(
                                    isEditing
                                        ? 'Vendor updated'
                                        : 'Vendor created',
                                  );
                                  await _loadVendors();
                                } else {
                                  _showSnack(
                                    (result['error'] ??
                                            (isEditing
                                                ? 'Failed to update vendor'
                                                : 'Failed to create vendor'))
                                        .toString(),
                                    destructive: true,
                                  );
                                  setDialogState(() => submitting = false);
                                }
                              } catch (_) {
                                if (!mounted) return;
                                _showSnack(
                                  isEditing
                                      ? 'Something went wrong while saving vendor.'
                                      : 'Something went wrong while creating vendor.',
                                  destructive: true,
                                );
                                setDialogState(() => submitting = false);
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _openDeleteDialog(Vendor vendor) async {
    bool deleting = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              insetPadding: const EdgeInsets.symmetric(horizontal: 24),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Delete Vendor',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'This will permanently delete ${vendor.name.isEmpty ? 'this vendor' : vendor.name}. This action cannot be undone.',
                      ),
                      const SizedBox(height: 22),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          MadButton(
                            text: 'Cancel',
                            variant: ButtonVariant.outline,
                            disabled: deleting,
                            onPressed: () => Navigator.of(dialogContext).pop(),
                          ),
                          const SizedBox(width: 10),
                          MadButton(
                            text: deleting ? 'Deleting...' : 'Delete Vendor',
                            variant: ButtonVariant.destructive,
                            loading: deleting,
                            disabled: deleting,
                            onPressed: () async {
                              setDialogState(() => deleting = true);
                              try {
                                final result = await ApiClient.deleteVendor(
                                  vendor.id,
                                );
                                if (!mounted) return;

                                if (result['success'] == true) {
                                  if (dialogContext.mounted) {
                                    Navigator.of(dialogContext).pop();
                                  }
                                  _showSnack('Vendor deleted');
                                  await _loadVendors();
                                } else {
                                  _showSnack(
                                    (result['error'] ??
                                            'Could not delete vendor.')
                                        .toString(),
                                    destructive: true,
                                  );
                                  setDialogState(() => deleting = false);
                                }
                              } catch (_) {
                                if (!mounted) return;
                                _showSnack(
                                  'Something went wrong while deleting vendor.',
                                  destructive: true,
                                );
                                setDialogState(() => deleting = false);
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildHero(bool isDark, bool isMobile) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(isMobile ? 18 : 24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
        gradient: LinearGradient(
          colors: [
            const Color(0xFFECFEFF),
            const Color(0xFFE0F2FE),
            isDark ? AppTheme.darkCard : Colors.white,
          ],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
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
                      'Vendors',
                      style: TextStyle(
                        fontSize: isMobile ? 28 : 32,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: isDark
                            ? AppTheme.darkForeground
                            : AppTheme.lightForeground,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Manage project vendors in one place.',
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isMobile)
                MadButton(
                  text: 'Add Vendor',
                  icon: LucideIcons.plus,
                  onPressed: _goToAddVendorPage,
                ),
            ],
          ),
          if (isMobile) ...[
            const SizedBox(height: 14),
            MadButton(
              text: 'Add Vendor',
              icon: LucideIcons.plus,
              width: double.infinity,
              onPressed: _goToAddVendorPage,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatTile({
    required String title,
    required String value,
    required String subtitle,
    required double width,
  }) {
    return SizedBox(
      width: width,
      child: MadCard(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 13)),
              const SizedBox(height: 8),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  height: 1.0,
                ),
              ),
              const SizedBox(height: 8),
              Text(subtitle, style: const TextStyle(fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatsRow(Responsive responsive) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const spacing = 12.0;
        final availableWidth = constraints.maxWidth;

        int columns;
        if (responsive.isMobile) {
          columns = 1;
        } else if (responsive.isTablet) {
          columns = 2;
        } else {
          columns = 4;
        }

        final tileWidth =
            (availableWidth - (spacing * (columns - 1))) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            _buildStatTile(
              title: 'Total Vendors',
              value: _vendors.length.toString(),
              subtitle: 'Across loaded scope',
              width: tileWidth,
            ),
            _buildStatTile(
              title: 'Active',
              value: _activeCount.toString(),
              subtitle: 'Ready for procurement',
              width: tileWidth,
            ),
            _buildStatTile(
              title: 'Blocked',
              value: _blockedCount.toString(),
              subtitle: 'Need review before use',
              width: tileWidth,
            ),
            _buildStatTile(
              title: 'Projects Covered',
              value: _projectsCovered.toString(),
              subtitle: 'Distinct project mappings',
              width: tileWidth,
            ),
          ],
        );
      },
    );
  }

  Widget _buildStatusBadge(Vendor vendor) {
    final status = vendor.status.toLowerCase();

    Color textColor;
    Color bgColor;
    Color borderColor;

    switch (status) {
      case 'active':
        textColor = const Color(0xFF065F46);
        bgColor = const Color(0xFFD1FAE5);
        borderColor = const Color(0xFFA7F3D0);
        break;
      case 'inactive':
        textColor = const Color(0xFF92400E);
        bgColor = const Color(0xFFFEF3C7);
        borderColor = const Color(0xFFFCD34D);
        break;
      case 'blocked':
        textColor = const Color(0xFF9F1239);
        bgColor = const Color(0xFFFFE4E6);
        borderColor = const Color(0xFFFECDD3);
        break;
      default:
        textColor = const Color(0xFF374151);
        bgColor = const Color(0xFFF3F4F6);
        borderColor = const Color(0xFFE5E7EB);
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor),
      ),
      child: Text(
        _capitalize(status),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildHeaderCell(String text, {Alignment alignment = Alignment.centerLeft}) {
    return Container(
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Text(
        text,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _buildBodyCell(Widget child, {Alignment alignment = Alignment.centerLeft}) {
    return Container(
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: child,
    );
  }

  Widget _buildTableCell({required int flex, required Widget child}) {
    return Expanded(flex: flex, child: child);
  }

  Widget _buildVendorRow(Vendor vendor, bool isDark) {
    return Container(
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildTableCell(
            flex: 32,
            child: _buildBodyCell(
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          vendor.name.isEmpty ? '-' : vendor.name,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          (vendor.companyName == null ||
                                  vendor.companyName!.isEmpty)
                              ? '-'
                              : vendor.companyName!,
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
                  const SizedBox(width: 8),
                  _buildStatusBadge(vendor),
                ],
              ),
            ),
          ),
          _buildTableCell(
            flex: 14,
            child: _buildBodyCell(
              Text(
                vendor.projectId?.isNotEmpty == true
                    ? 'Project ${vendor.projectId}'
                    : '-',
              ),
            ),
          ),
          _buildTableCell(
            flex: 24,
            child: _buildBodyCell(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        LucideIcons.mail,
                        size: 12,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          vendor.email?.isNotEmpty == true ? vendor.email! : '-',
                          overflow: TextOverflow.ellipsis,
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
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(
                        LucideIcons.phone,
                        size: 12,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          vendor.phone?.isNotEmpty == true ? vendor.phone! : '-',
                          overflow: TextOverflow.ellipsis,
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
                ],
              ),
            ),
          ),
          _buildTableCell(
            flex: 18,
            child: _buildBodyCell(
              Row(
                children: [
                  Icon(
                    LucideIcons.mapPin,
                    size: 14,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      vendor.location?.isNotEmpty == true
                          ? vendor.location!
                          : '-',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _buildTableCell(
            flex: 18,
            child: _buildBodyCell(
              LayoutBuilder(
                builder: (context, constraints) {
                  // Four icon buttons need ~160px. Fallback to menu if tighter.
                  if (constraints.maxWidth < 160) {
                    return Align(
                      alignment: Alignment.centerRight,
                      child: MadDropdownMenuButton(
                        items: [
                          MadMenuItem(
                            label: 'Price Lists',
                            icon: LucideIcons.fileText,
                            onTap: () => _openVendorPriceLists(vendor),
                          ),
                          MadMenuItem(
                            label: 'View Latest',
                            icon: LucideIcons.eye,
                            onTap: () =>
                                _openVendorPriceLists(vendor, openLatest: true),
                          ),
                          MadMenuItem(
                            label: 'Edit',
                            icon: LucideIcons.pencil,
                            onTap: () => _openVendorDialog(vendor: vendor),
                          ),
                          MadMenuItem(
                            label: 'Delete',
                            icon: LucideIcons.trash2,
                            destructive: true,
                            onTap: () => _openDeleteDialog(vendor),
                          ),
                        ],
                      ),
                    );
                  }

                  return Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      MadButton(
                        variant: ButtonVariant.ghost,
                        size: ButtonSize.icon,
                        icon: LucideIcons.fileText,
                        onPressed: () => _openVendorPriceLists(vendor),
                      ),
                      MadButton(
                        variant: ButtonVariant.ghost,
                        size: ButtonSize.icon,
                        icon: LucideIcons.eye,
                        onPressed: () =>
                            _openVendorPriceLists(vendor, openLatest: true),
                      ),
                      MadButton(
                        variant: ButtonVariant.ghost,
                        size: ButtonSize.icon,
                        icon: LucideIcons.pencil,
                        onPressed: () => _openVendorDialog(vendor: vendor),
                      ),
                      const SizedBox(width: 4),
                      MadButton(
                        variant: ButtonVariant.ghost,
                        size: ButtonSize.icon,
                        icon: LucideIcons.trash2,
                        onPressed: () => _openDeleteDialog(vendor),
                      ),
                    ],
                  );
                },
              ),
              alignment: Alignment.centerRight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTable(bool isDark) {
    final filtered = _filteredVendors;

    return Container(
      decoration: BoxDecoration(
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Container(
            decoration: BoxDecoration(
              color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                  .withValues(alpha: 0.45),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(11),
              ),
            ),
            child: Row(
              children: [
                _buildTableCell(
                  flex: 32,
                  child: _buildHeaderCell('Vendor'),
                ),
                _buildTableCell(
                  flex: 14,
                  child: _buildHeaderCell('Project'),
                ),
                _buildTableCell(
                  flex: 24,
                  child: _buildHeaderCell('Contact'),
                ),
                _buildTableCell(
                  flex: 18,
                  child: _buildHeaderCell('Location'),
                ),
                _buildTableCell(
                  flex: 18,
                  child: _buildHeaderCell(
                    'Action',
                    alignment: Alignment.centerRight,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _isLoading
                ? Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
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
                        const SizedBox(width: 10),
                        Text(
                          'Loading vendors...',
                          style: TextStyle(
                            color: isDark
                                ? AppTheme.darkMutedForeground
                                : AppTheme.lightMutedForeground,
                          ),
                        ),
                      ],
                    ),
                  )
                : filtered.isEmpty
                ? Center(
                    child: Text(
                      _error ?? 'No vendors found for current filters.',
                      style: TextStyle(
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  )
                : ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, index) =>
                        _buildVendorRow(filtered[index], isDark),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompactVendorCard(Vendor vendor, bool isDark) {
    final mutedColor = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;

    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(14),
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
                      vendor.name.isEmpty ? '-' : vendor.name,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      (vendor.companyName == null || vendor.companyName!.isEmpty)
                          ? '-'
                          : vendor.companyName!,
                      style: TextStyle(fontSize: 12, color: mutedColor),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              _buildStatusBadge(vendor),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            vendor.projectId?.isNotEmpty == true
                ? 'Project ${vendor.projectId}'
                : 'No project linked',
            style: TextStyle(fontSize: 12, color: mutedColor),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.mail, size: 14, color: mutedColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  vendor.email?.isNotEmpty == true ? vendor.email! : '-',
                  style: TextStyle(fontSize: 13, color: mutedColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.phone, size: 14, color: mutedColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  vendor.phone?.isNotEmpty == true ? vendor.phone! : '-',
                  style: TextStyle(fontSize: 13, color: mutedColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.mapPin, size: 14, color: mutedColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  vendor.location?.isNotEmpty == true ? vendor.location! : '-',
                  style: TextStyle(fontSize: 13, color: mutedColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              MadButton(
                text: 'Price Lists',
                size: ButtonSize.sm,
                variant: ButtonVariant.outline,
                icon: LucideIcons.fileText,
                onPressed: () => _openVendorPriceLists(vendor),
              ),
              MadButton(
                text: 'View Latest',
                size: ButtonSize.sm,
                variant: ButtonVariant.outline,
                icon: LucideIcons.eye,
                onPressed: () => _openVendorPriceLists(vendor, openLatest: true),
              ),
              MadDropdownMenuButton(
                items: [
                  MadMenuItem(
                    label: 'Edit',
                    icon: LucideIcons.pencil,
                    onTap: () => _openVendorDialog(vendor: vendor),
                  ),
                  MadMenuItem(
                    label: 'Delete',
                    icon: LucideIcons.trash2,
                    destructive: true,
                    onTap: () => _openDeleteDialog(vendor),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCompactDirectory(bool isDark) {
    final filtered = _filteredVendors;

    if (_isLoading) {
      return Center(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
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
            const SizedBox(width: 10),
            Text(
              'Loading vendors...',
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
          ],
        ),
      );
    }

    if (filtered.isEmpty) {
      return Center(
        child: Text(
          _error ?? 'No vendors found for current filters.',
          style: TextStyle(
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
          textAlign: TextAlign.center,
        ),
      );
    }

    return ListView.separated(
      itemCount: filtered.length,
      itemBuilder: (context, index) =>
          _buildCompactVendorCard(filtered[index], isDark),
      separatorBuilder: (_, index) => const SizedBox(height: 10),
    );
  }

  Widget _buildDirectoryCard(
    bool isDark,
    Responsive responsive, {
    required bool fillHeight,
  }) {
    final isMobile = responsive.isMobile;

    return MadCard(
      child: Padding(
        padding: EdgeInsets.all(isMobile ? 14 : 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Vendor Directory',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              'Search and filter real vendor records.',
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                SizedBox(
                  width: isMobile
                      ? double.infinity
                      : responsive.value(
                          mobile: 320,
                          tablet: 360,
                          desktop: 420,
                        ),
                  child: MadSearchInput(
                    controller: _searchController,
                    hintText: 'Search by name, company, email, phone or city',
                    onChanged: (value) {
                      setState(() => _query = value);
                    },
                    onClear: () {
                      setState(() => _query = '');
                    },
                  ),
                ),
                SizedBox(
                  width: isMobile ? double.infinity : 180,
                  child: DropdownButtonFormField<String>(
                    initialValue: _statusFilter,
                    isExpanded: true,
                    decoration: _selectDecoration(isDark),
                    items: const [
                      DropdownMenuItem(
                        value: 'all',
                        child: Text('All statuses'),
                      ),
                      DropdownMenuItem(value: 'active', child: Text('Active')),
                      DropdownMenuItem(
                        value: 'inactive',
                        child: Text('Inactive'),
                      ),
                      DropdownMenuItem(
                        value: 'blocked',
                        child: Text('Blocked'),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _statusFilter = value ?? 'all'),
                  ),
                ),
                SizedBox(
                  width: isMobile ? double.infinity : 180,
                  child: DropdownButtonFormField<String>(
                    initialValue: _projectFilter,
                    isExpanded: true,
                    decoration: _selectDecoration(isDark),
                    items: [
                      const DropdownMenuItem(
                        value: 'all',
                        child: Text('All projects'),
                      ),
                      ..._projectOptions.map(
                        (pid) => DropdownMenuItem(
                          value: pid,
                          child: Text('Project $pid'),
                        ),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _projectFilter = value ?? 'all'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (responsive.isMobile || responsive.isTablet)
              SizedBox(
                height: responsive.isMobile ? 520 : 560,
                child: _buildCompactDirectory(isDark),
              )
            else if (fillHeight)
              Expanded(child: _buildTable(isDark))
            else
              SizedBox(
                height: 500,
                child: _buildTable(isDark),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);

    return StoreConnector<AppState, _VendorsViewModel>(
      converter: (store) =>
          _VendorsViewModel(projectId: store.state.project.selectedProjectId),
      builder: (context, vm) {
        _selectedProjectId = vm.projectId;

        if (_lastLoadedProjectId != _selectedProjectId) {
          _lastLoadedProjectId = _selectedProjectId;
          WidgetsBinding.instance.addPostFrameCallback((_) => _loadVendors());
        }

        final isCompact = responsive.isMobile || responsive.isTablet;
        return ProtectedRoute(
          title: 'Vendors',
          route: '/vendors',
          child: isCompact
              ? SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildHero(isDark, responsive.isMobile),
                      const SizedBox(height: 16),
                      _buildStatsRow(responsive),
                      const SizedBox(height: 16),
                      _buildDirectoryCard(
                        isDark,
                        responsive,
                        fillHeight: false,
                      ),
                    ],
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHero(isDark, responsive.isMobile),
                    const SizedBox(height: 16),
                    _buildStatsRow(responsive),
                    const SizedBox(height: 16),
                    Expanded(
                      child: _buildDirectoryCard(
                        isDark,
                        responsive,
                        fillHeight: true,
                      ),
                    ),
                  ],
                ),
        );
      },
    );
  }
}

class _VendorsViewModel {
  final String? projectId;

  const _VendorsViewModel({required this.projectId});
}
