import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';

import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class VendorCreatePage extends StatefulWidget {
  const VendorCreatePage({super.key});

  @override
  State<VendorCreatePage> createState() => _VendorCreatePageState();
}

class _VendorCreatePageState extends State<VendorCreatePage> {
  final _nameController = TextEditingController();
  final _projectController = TextEditingController();
  final _companyController = TextEditingController();
  final _emailController = TextEditingController();
  final _mobileController = TextEditingController();
  final _locationController = TextEditingController();

  String _status = 'active';
  bool _submitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _projectController.dispose();
    _companyController.dispose();
    _emailController.dispose();
    _mobileController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  InputDecoration _selectDecoration(bool isDark) {
    return InputDecoration(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      filled: true,
      fillColor: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withValues(alpha: 0.5),
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
        borderSide: BorderSide(color: AppTheme.primaryColor.withValues(alpha: 0.4)),
      ),
    );
  }

  Future<void> _saveVendor() async {
    final vendorName = _nameController.text.trim();
    if (vendorName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vendor name required'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final payload = <String, dynamic>{
        'vendor_name': vendorName,
        'vendor_company_name': _companyController.text.trim(),
        'vendor_email': _emailController.text.trim(),
        'mobile_number': _mobileController.text.trim(),
        'location': _locationController.text.trim(),
        'status': _status,
      };

      final result = await ApiClient.createVendor(payload);
      if (!mounted) return;

      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vendor created')),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text((result['error'] ?? 'Failed to create vendor').toString()),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
        setState(() => _submitting = false);
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Something went wrong while creating vendor.'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return StoreConnector<AppState, String?>(
      distinct: true,
      converter: (store) => store.state.project.selectedProjectId,
      builder: (context, selectedProjectId) {
        if (_projectController.text.isEmpty && (selectedProjectId?.isNotEmpty ?? false)) {
          _projectController.text = selectedProjectId!;
        }

        return ProtectedRoute(
          title: 'Add Vendor',
          route: '/vendors',
          headerLeadingIcon: Icons.arrow_back,
          onHeaderLeadingPressed: () => Navigator.pop(context),
          child: SingleChildScrollView(
            child: MadCard(
              child: Padding(
                padding: EdgeInsets.all(isMobile ? 16 : 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Create Vendor',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Add a new vendor record.',
                      style: TextStyle(
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                    ),
                    const SizedBox(height: 16),
                    MadInput(
                      controller: _nameController,
                      labelText: 'Vendor Name *',
                      hintText: 'Enter vendor name',
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: MadInput(
                            controller: _projectController,
                            labelText: 'Project ID',
                            hintText: 'Enter project ID',
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Status',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                                ),
                              ),
                              const SizedBox(height: 8),
                              DropdownButtonFormField<String>(
                                initialValue: _status,
                                isExpanded: true,
                                decoration: _selectDecoration(isDark),
                                items: const [
                                  DropdownMenuItem(value: 'active', child: Text('active')),
                                  DropdownMenuItem(value: 'inactive', child: Text('inactive')),
                                  DropdownMenuItem(value: 'blocked', child: Text('blocked')),
                                ],
                                onChanged: (value) {
                                  setState(() => _status = value ?? 'active');
                                },
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    MadInput(
                      controller: _companyController,
                      labelText: 'Company Name',
                      hintText: 'Enter company name',
                    ),
                    const SizedBox(height: 14),
                    MadInput(
                      controller: _emailController,
                      labelText: 'Email',
                      hintText: 'Enter email address',
                      keyboardType: TextInputType.emailAddress,
                    ),
                    const SizedBox(height: 14),
                    MadInput(
                      controller: _mobileController,
                      labelText: 'Mobile Number',
                      hintText: 'Enter mobile number',
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 14),
                    MadInput(
                      controller: _locationController,
                      labelText: 'Location',
                      hintText: 'Enter location',
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        MadButton(
                          text: 'Cancel',
                          variant: ButtonVariant.outline,
                          disabled: _submitting,
                          onPressed: () => Navigator.pop(context),
                        ),
                        const SizedBox(width: 10),
                        MadButton(
                          text: _submitting ? 'Creating...' : 'Create Vendor',
                          loading: _submitting,
                          disabled: _submitting,
                          onPressed: _saveVendor,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
