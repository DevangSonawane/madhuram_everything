import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class AttendancePage extends StatefulWidget {
  const AttendancePage({super.key});

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> {
  final ImagePicker _picker = ImagePicker();
  File? _selfie;
  File? _siteImage;
  Position? _position;
  String? _locationName;
  DateTime? _locationCapturedAt;
  bool _locating = false;
  bool _submitting = false;

  Future<void> _captureSelfie() async {
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 85,
    );
    if (photo == null) return;
    setState(() => _selfie = File(photo.path));
  }

  Future<void> _captureSiteImage() async {
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      imageQuality: 85,
    );
    if (photo == null) return;
    setState(() => _siteImage = File(photo.path));
  }

  Future<void> _captureLocation() async {
    if (_locating) return;
    setState(() => _locating = true);
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          showToast(
            context,
            'Location services are disabled. Please enable them.',
            variant: ToastVariant.error,
          );
        }
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (mounted) {
          showToast(
            context,
            'Location permission is required to mark attendance.',
            variant: ToastVariant.error,
          );
        }
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      if (!mounted) return;
      setState(() {
        _position = position;
        _locationCapturedAt = DateTime.now();
        _locationName = null;
      });
      _resolveLocationName(position);
    } catch (_) {
      if (mounted) {
        showToast(
          context,
          'Unable to capture location',
          variant: ToastVariant.error,
        );
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _resolveLocationName(Position position) async {
    try {
      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );
      if (!mounted) return;
      if (placemarks.isEmpty) return;
      final place = placemarks.first;
      final parts = <String>[];
      final name = place.name?.trim();
      if (name != null && name.isNotEmpty) parts.add(name);
      final subLocality = place.subLocality?.trim();
      if (subLocality != null && subLocality.isNotEmpty) {
        parts.add(subLocality);
      }
      final locality = place.locality?.trim();
      if (locality != null && locality.isNotEmpty) parts.add(locality);
      final adminArea = place.administrativeArea?.trim();
      if (adminArea != null && adminArea.isNotEmpty) parts.add(adminArea);
      final postal = place.postalCode?.trim();
      if (postal != null && postal.isNotEmpty) parts.add(postal);
      setState(() {
        _locationName = parts.isEmpty ? null : parts.join(', ');
      });
    } catch (_) {
      // Silently ignore reverse geocoding failures.
    }
  }

  Future<void> _submitAttendance() async {
    if (_submitting) return;

    if (_selfie == null || _siteImage == null) {
      showToast(
        context,
        'Capture both selfie and site photo to mark attendance.',
        variant: ToastVariant.error,
      );
      return;
    }
    if (_position == null) {
      showToast(
        context,
        'Capture location to mark attendance.',
        variant: ToastVariant.error,
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await Future<void>.delayed(const Duration(milliseconds: 600));
      if (!mounted) return;
      showToast(context, 'Attendance captured. Pending admin sync.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _buildPhotoCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required VoidCallback onCapture,
    required File? photo,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;

    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: AppTheme.primaryColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(subtitle, style: TextStyle(color: muted, fontSize: 13)),
            const SizedBox(height: 12),
            Container(
              height: 160,
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                ),
                color:
                    (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                        .withValues(alpha: 0.12),
              ),
              child: photo == null
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(icon, size: 28, color: muted),
                          const SizedBox(height: 6),
                          Text(
                            'No photo captured',
                            style: TextStyle(color: muted, fontSize: 12),
                          ),
                        ],
                      ),
                    )
                  : ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(photo, fit: BoxFit.cover),
                    ),
            ),
            const SizedBox(height: 12),
            MadButton(
              text: 'Capture Photo',
              icon: LucideIcons.camera,
              onPressed: onCapture,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;

    final lat = _position?.latitude.toStringAsFixed(6) ?? '-';
    final lng = _position?.longitude.toStringAsFixed(6) ?? '-';
    final timestamp = _locationCapturedAt == null
        ? '-'
        : DateFormat('dd MMM yyyy, hh:mm a').format(_locationCapturedAt!);
    final locationLabel = _locationName ?? '-';

    return MadCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(LucideIcons.mapPin, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Location',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Capture your current site location.',
              style: TextStyle(color: muted, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                ),
                color:
                    (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                        .withValues(alpha: 0.12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Latitude: $lat', style: const TextStyle(fontSize: 13)),
                  const SizedBox(height: 4),
                  Text('Longitude: $lng', style: const TextStyle(fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(
                    'Location: $locationLabel',
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Captured at: $timestamp',
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            MadButton(
              text: _locating ? 'Capturing...' : 'Capture Location',
              icon: LucideIcons.locateFixed,
              disabled: _locating,
              onPressed: _captureLocation,
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
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Attendance',
      route: '/attendance',
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(isMobile ? 16 : 24),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                ),
                gradient: LinearGradient(
                  colors: isDark
                      ? const [Color(0xFF0F172A), Color(0xFF111827), Color(0xFF1F2937)]
                      : const [Color(0xFFE0F2FE), Color(0xFFECFEFF), Colors.white],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Attendance',
                    style: TextStyle(
                      fontSize: responsive.value(
                        mobile: 22,
                        tablet: 26,
                        desktop: 28,
                      ),
                      fontWeight: FontWeight.bold,
                      color: isDark
                          ? AppTheme.darkForeground
                          : AppTheme.lightForeground,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Capture selfie, site photo, and location to mark attendance.',
                    style: TextStyle(
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: isMobile ? double.infinity : 360,
                  child: _buildPhotoCard(
                    title: 'Selfie',
                    subtitle: 'Capture a clear selfie for attendance.',
                    icon: LucideIcons.user,
                    onCapture: _captureSelfie,
                    photo: _selfie,
                  ),
                ),
                SizedBox(
                  width: isMobile ? double.infinity : 360,
                  child: _buildPhotoCard(
                    title: 'Site Photo',
                    subtitle: 'Capture the current site image.',
                    icon: LucideIcons.building,
                    onCapture: _captureSiteImage,
                    photo: _siteImage,
                  ),
                ),
                SizedBox(
                  width: isMobile ? double.infinity : 360,
                  child: _buildLocationCard(),
                ),
              ],
            ),
            const SizedBox(height: 20),
            MadCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Submit Attendance',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Ensure both photos and location are captured before submission.',
                      style: TextStyle(
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                    const SizedBox(height: 12),
                    MadButton(
                      text: _submitting ? 'Submitting...' : 'Submit to Admin',
                      icon: LucideIcons.send,
                      disabled: _submitting,
                      onPressed: _submitAttendance,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
