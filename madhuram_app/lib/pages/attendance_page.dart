// CAMERA COMPATIBILITY NOTE:
// Requires image_picker >= 0.8.9 for stable Android camera device selection.
// If camera fails on any device, first check pubspec.yaml:
//   image_picker: ^0.8.9  (or latest)
// Known problematic devices: Motorola Edge series (MediaTek), Xiaomi MIUI 14+,
// Realme UI 4+, some Samsung One UI 6 builds.
// Root cause: preferredCameraDevice uses EXTRA_CAMERA_FACING which is non-standard
// and may be ignored by manufacturer camera HALs.

import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_redux/flutter_redux.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/project.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../store/app_state.dart';
import '../store/project_actions.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class AttendancePage extends StatefulWidget {
  const AttendancePage({super.key});

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage>
    with WidgetsBindingObserver {
  final ImagePicker _picker = ImagePicker();
  File? _selfie;
  File? _siteImage;
  Position? _position;
  String? _locationName;
  DateTime? _locationCapturedAt;
  String? _lastAttendanceId;
  File? _checkoutSelfie;
  File? _checkoutSiteImage;
  Position? _checkoutPosition;
  String? _checkoutLocationName;
  DateTime? _checkoutLocationCapturedAt;
  String? _userName;
  String? _userId;
  String? _userPhone;
  String? _projectId;
  bool _locating = false;
  bool _submitting = false;
  bool _checkoutSubmitting = false;
  _AttendanceMode _mode = _AttendanceMode.select;
  PermissionStatus? _lastCameraPermissionStatus;
  static const double _attendanceAllowedRadiusMeters = 100.0;
  static const bool _debugGeoFence = true;
  bool _hydratingProjectLocation = false;
  String? _hydratedProjectId;
  Future<void>? _projectHydrationFuture;

  double? _asDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    final text = value.toString().trim();
    if (text.isEmpty) return null;
    return double.tryParse(text);
  }

  ({double lat, double lng})? _resolveProjectLatLng(Map<String, dynamic>? project) {
    if (project == null) return null;
    final locationData = project['location_data'];
    if (locationData is Map) {
      final lat = _asDouble(locationData['latitude']);
      final lng = _asDouble(locationData['longitude']);
      if (lat != null && lng != null) return (lat: lat, lng: lng);
    }

    final lat = _asDouble(project['location_latitude']);
    final lng = _asDouble(project['location_longitude']);
    if (lat != null && lng != null) return (lat: lat, lng: lng);

    final locationText = (project['location_name'] ?? project['location'])?.toString();
    if (locationText != null && locationText.trim().isNotEmpty) {
      final match = RegExp(
        r'lat\s*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*lng\s*([+-]?\d+(?:\.\d+)?)',
        caseSensitive: false,
      ).firstMatch(locationText);
      if (match != null) {
        final parsedLat = _asDouble(match.group(1));
        final parsedLng = _asDouble(match.group(2));
        if (parsedLat != null && parsedLng != null) return (lat: parsedLat, lng: parsedLng);
      }
    }
    return null;
  }

  double _haversineDistanceMeters({
    required double lat1,
    required double lng1,
    required double lat2,
    required double lng2,
  }) {
    const earthRadius = 6371000.0; // meters
    final dLat = _degToRad(lat2 - lat1);
    final dLon = _degToRad(lng2 - lng1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_degToRad(lat1)) *
            math.cos(_degToRad(lat2)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadius * c;
  }

  double _degToRad(double deg) => deg * (math.pi / 180.0);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_refreshCameraPermissionStatus());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _refreshCameraPermissionStatus() async {
    try {
      final status = await Permission.camera.status;
      if (!mounted) {
        _lastCameraPermissionStatus = status;
        return;
      }
      setState(() => _lastCameraPermissionStatus = status);
    } catch (e) {
      debugPrint('[Attendance] Failed to read camera permission status: $e');
    }
  }

  Future<void> _handleCameraPermissionOnResume() async {
    try {
      final status = await Permission.camera.status;
      final previouslyDenied =
          _lastCameraPermissionStatus != null &&
          !_lastCameraPermissionStatus!.isGranted;
      if (!mounted) {
        _lastCameraPermissionStatus = status;
        return;
      }
      if (status.isGranted && previouslyDenied) {
        setState(() => _lastCameraPermissionStatus = status);
      } else {
        _lastCameraPermissionStatus = status;
      }
    } catch (e) {
      debugPrint('[Attendance] Failed to re-check camera permission: $e');
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    unawaited(_handleCameraPermissionOnResume());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncUserContext();
    unawaited(_ensureSelectedProjectHasLocationData());
  }

  Future<void> _ensureSelectedProjectHasLocationData() async {
    if (_projectHydrationFuture != null) return _projectHydrationFuture;
    final store = StoreProvider.of<AppState>(context);
    final selected = store.state.project.selectedProject;
    final projectId = selected?['project_id']?.toString() ?? selected?['id']?.toString();
    if (projectId == null || projectId.trim().isEmpty) return;
    if (_hydratedProjectId == projectId) return;

    // Fast path: if the full project list is already in Redux, use it without any network call.
    final cached = store.state.project.projects;
    if (cached.isNotEmpty) {
      final match = cached.firstWhere(
        (p) => (p['project_id']?.toString() ?? p['id']?.toString() ?? '') == projectId,
        orElse: () => <String, dynamic>{},
      );
      if (match.isNotEmpty) {
        final hydrated = Project.fromJson(match).toMap();
        final rawLocationData = match['location_data'];
        if (rawLocationData is Map) {
          hydrated['location_data'] = Map<String, dynamic>.from(rawLocationData);
        }
        final hydratedLatLng = _resolveProjectLatLng(hydrated);
        if (hydratedLatLng != null) {
          if (_debugGeoFence) {
            debugPrint('[Attendance][GeoFence] Hydrated from cached projects projectId=$projectId '
                'lat=${hydratedLatLng.lat} lng=${hydratedLatLng.lng}');
          }
          store.dispatch(SelectProject(hydrated));
          _hydratedProjectId = projectId;
          if (mounted) setState(() {});
          return;
        }
      }
    }

    final existing = _resolveProjectLatLng(selected);
    if (existing != null) {
      if (_debugGeoFence) {
        debugPrint('[Attendance][GeoFence] Selected project already has location_data '
            'projectId=$projectId lat=${existing.lat} lng=${existing.lng}');
      }
      _hydratedProjectId = projectId;
      return;
    }

    final future = () async {
      _hydratingProjectLocation = true;
    if (_debugGeoFence) {
      debugPrint('[Attendance][GeoFence] Hydrating project location from backend projectId=$projectId '
          'selectedKeys=${selected?.keys.toList()}');
    }
    try {
      final res = await ApiClient.getProject(projectId).timeout(const Duration(seconds: 6));
      if (_debugGeoFence) {
        debugPrint('[Attendance][GeoFence] getProject($projectId) => success=${res['success']} '
            'dataType=${res['data']?.runtimeType}');
        final data = res['data'];
        if (data is Map) {
          debugPrint('[Attendance][GeoFence] getProject($projectId) keys=${data.keys.toList()} '
              'location_data=${data['location_data']?.runtimeType}');
        }
      }
      if (res['success'] == true && res['data'] is Map<String, dynamic>) {
        final data = Map<String, dynamic>.from(res['data'] as Map);
        final hydrated = Project.fromJson(data).toMap();
        final rawLocationData = data['location_data'];
        if (rawLocationData is Map) {
          hydrated['location_data'] = Map<String, dynamic>.from(rawLocationData);
        }
        if (_debugGeoFence) {
          final hydratedLatLng = _resolveProjectLatLng(hydrated);
          debugPrint('[Attendance][GeoFence] Hydrated project map keys=${hydrated.keys.toList()} '
              'latLng=${hydratedLatLng == null ? 'null' : '${hydratedLatLng.lat},${hydratedLatLng.lng}'}');
        }
        final hydratedLatLng = _resolveProjectLatLng(hydrated);
        if (hydratedLatLng != null) {
          store.dispatch(SelectProject(hydrated));
          _hydratedProjectId = projectId;
          if (mounted) setState(() {});
          return;
        }
      }

      // Fallback: some deployments return full `location_data` only in the project list.
      // If Redux already has projects, don't refetch the whole list again.
      if (store.state.project.projects.isNotEmpty) return;

      final listRes = await ApiClient.getProjects().timeout(const Duration(seconds: 8));
      if (_debugGeoFence) {
        debugPrint('[Attendance][GeoFence] getProjects() fallback => success=${listRes['success']} '
            'dataType=${listRes['data']?.runtimeType}');
      }
      if (listRes['success'] == true && listRes['data'] is List) {
        final list = (listRes['data'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        // Cache for subsequent pages / fast-path hydration.
        store.dispatch(FetchProjectsSuccess(list));
        final match = list.firstWhere(
          (p) =>
              (p['project_id']?.toString() ?? p['id']?.toString() ?? '') == projectId,
          orElse: () => <String, dynamic>{},
        );
        if (match.isNotEmpty) {
          final hydrated = Project.fromJson(match).toMap();
          final rawLocationData = match['location_data'];
          if (rawLocationData is Map) {
            hydrated['location_data'] = Map<String, dynamic>.from(rawLocationData);
          }
          final hydratedLatLng = _resolveProjectLatLng(hydrated);
          if (_debugGeoFence) {
            debugPrint('[Attendance][GeoFence] getProjects() hydrated keys=${hydrated.keys.toList()} '
                'latLng=${hydratedLatLng == null ? 'null' : '${hydratedLatLng.lat},${hydratedLatLng.lng}'}');
          }
          if (hydratedLatLng != null) {
            store.dispatch(SelectProject(hydrated));
            _hydratedProjectId = projectId;
            if (mounted) setState(() {});
            return;
          }
        }
      }
      if (_debugGeoFence) {
        debugPrint('[Attendance][GeoFence] Hydration finished but still no lat/lng for projectId=$projectId');
      }
    } on TimeoutException catch (e) {
      debugPrint('[Attendance][GeoFence] Hydration timeout projectId=$projectId: $e');
    } catch (e) {
      debugPrint('[Attendance] Failed to hydrate project location: $e');
    } finally {
      _hydratingProjectLocation = false;
      _projectHydrationFuture = null;
    }
    }();

    _projectHydrationFuture = future;
    return future;
  }

  Future<XFile?> _pickCameraImage({
    CameraDevice? preferredCameraDevice,
    required String label,
    bool fallbackToAnyCamera = false,
  }) async {
    PlatformException? lastPlatformError;
    Object? lastUnknownError;
    try {
      final cameraStatus = await Permission.camera.request();
      if (mounted) {
        setState(() => _lastCameraPermissionStatus = cameraStatus);
      } else {
        _lastCameraPermissionStatus = cameraStatus;
      }
      if (!cameraStatus.isGranted) {
        if (!mounted) return null;
        showToast(
          context,
          cameraStatus.isPermanentlyDenied
              ? "Camera permission denied. Tap 'Open Settings' to enable it."
              : 'Camera permission is required to capture $label.',
          variant: ToastVariant.error,
          actionLabel: cameraStatus.isPermanentlyDenied ? 'Open Settings' : null,
          action: cameraStatus.isPermanentlyDenied ? openAppSettings : null,
        );
        return null;
      }

      // Tier 1: Try with preferredCameraDevice (if provided).
      if (preferredCameraDevice != null) {
        try {
          return await _picker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: preferredCameraDevice,
            imageQuality: 85,
          );
        } on PlatformException catch (e) {
          lastPlatformError = e;
          // Preserve existing logs.
          debugPrint('[Attendance] pickImage failed ($label): ${e.code} ${e.message}');
          debugPrint(
            '[Attendance] pickImage failed tier 1 ($label): ${e.code} ${e.message}',
          );
          if (!fallbackToAnyCamera) {
            // Fall through to the final error toast below.
          } else {
            // Continue to Tier 2.
          }
        } catch (e) {
          lastUnknownError = e;
          debugPrint('[Attendance] pickImage failed tier 1 ($label): $e');
          if (!fallbackToAnyCamera) {
            // Fall through to the final error toast below.
          } else {
            // Continue to Tier 2.
          }
        }
      }

      final shouldAttemptTier2 = preferredCameraDevice == null || fallbackToAnyCamera;
      if (shouldAttemptTier2) {
        // Tier 2: Retry without preferredCameraDevice.
        try {
          return await _picker.pickImage(
            source: ImageSource.camera,
            imageQuality: 85,
          );
        } on PlatformException catch (e) {
          lastPlatformError = e;
          // Preserve existing logs.
          debugPrint('[Attendance] pickImage failed ($label): ${e.code} ${e.message}');
          if (preferredCameraDevice != null) {
            debugPrint(
              '[Attendance] pickImage fallback failed ($label): ${e.code} ${e.message}',
            );
          }
          debugPrint(
            '[Attendance] pickImage failed tier 2 ($label): ${e.code} ${e.message}',
          );
        } catch (e) {
          lastUnknownError = e;
          if (preferredCameraDevice != null) {
            // Preserve existing logs.
            debugPrint('[Attendance] pickImage fallback failed ($label): $e');
          }
          debugPrint('[Attendance] pickImage failed tier 2 ($label): $e');
        }
      }

      final shouldAttemptTier3 = preferredCameraDevice == null || fallbackToAnyCamera;
      if (shouldAttemptTier3) {
        // Tier 3: Bare minimum camera intent (no extra params at all).
        try {
          return await _picker.pickImage(source: ImageSource.camera);
        } on PlatformException catch (e) {
          lastPlatformError = e;
          debugPrint(
            '[Attendance] pickImage failed ($label): ${e.code} ${e.message}',
          );
          debugPrint(
            '[Attendance] pickImage failed tier 3 ($label): ${e.code} ${e.message}',
          );
        } catch (e) {
          lastUnknownError = e;
          debugPrint('[Attendance] pickImage failed tier 3 ($label): $e');
        }
      }

      // Fall through to error toast after all tiers fail.
    } catch (e) {
      lastUnknownError = e;
      debugPrint('[Attendance] pickImage failed ($label): $e');
    }

    if (!mounted) return null;
    final code = lastPlatformError?.code;
    final rawMessage = lastPlatformError?.message;
    if (code != null) {
      debugPrint('[Attendance] Camera open error ($label): $code $rawMessage');
    } else if (lastUnknownError != null) {
      debugPrint('[Attendance] Camera open error ($label): $lastUnknownError');
    }
    final message = switch (code) {
      'camera_access_denied' =>
        "Camera permission denied. Tap 'Open Settings' to enable it.",
      'camera_access_restricted' => 'Camera access is restricted on this device.',
      'no_available_camera' => 'No camera was found on this device.',
      'channel_error' => 'Camera could not be opened. Please restart the app.',
      _ => 'Camera failed to open. Please try again or restart the app.',
    };
    showToast(
      context,
      message,
      description: rawMessage,
      variant: ToastVariant.error,
      actionLabel: code == 'camera_access_denied' ? 'Open Settings' : null,
      action: code == 'camera_access_denied' ? openAppSettings : null,
    );
    return null;
  }

  Future<void> _captureSelfie() async {
    final photo = await _pickCameraImage(
      preferredCameraDevice: CameraDevice.front,
      label: 'selfie',
      fallbackToAnyCamera: true,
    );
    if (photo == null) return;
    setState(() => _selfie = File(photo.path));
  }

  Future<void> _captureSiteImage() async {
    final photo = await _pickCameraImage(
      preferredCameraDevice: CameraDevice.rear,
      label: 'site photo',
      fallbackToAnyCamera: true,
    );
    if (photo == null) return;
    setState(() => _siteImage = File(photo.path));
  }

  Future<void> _captureLocation() async {
    if (_locating) return;
    _syncUserContext(force: true);
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

      final store = StoreProvider.of<AppState>(context);
      final project = store.state.project.selectedProject;
      final projectLatLng = _resolveProjectLatLng(project);
      if (projectLatLng == null) {
        unawaited(_ensureSelectedProjectHasLocationData());
        if (!_hydratingProjectLocation) {
          showToast(
            context,
            'Project location is not configured. Please contact admin.',
            variant: ToastVariant.error,
          );
        }
      } else {
        final distanceMeters = _haversineDistanceMeters(
          lat1: position.latitude,
          lng1: position.longitude,
          lat2: projectLatLng.lat,
          lng2: projectLatLng.lng,
        );
        if (distanceMeters > _attendanceAllowedRadiusMeters) {
          await showDialog<void>(
            context: context,
            builder: (dialogContext) {
              return AlertDialog(
                title: const Text('Outside site radius'),
                content: Text(
                  'You are ~${distanceMeters.toStringAsFixed(0)}m away from the site.\n\nPlease move within 100m to mark attendance.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(dialogContext).pop(),
                    child: const Text('OK'),
                  ),
                ],
              );
            },
          );
        } else {
          showToast(
            context,
            'You are within the site radius.',
            description: 'Distance: ${distanceMeters.toStringAsFixed(0)}m (≤ 100m)',
            variant: ToastVariant.success,
          );
        }
      }

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

  void _syncUserContext({bool force = false}) {
    final store = StoreProvider.of<AppState>(context);
    final user = store.state.auth.user;
    final project = store.state.project.selectedProject;
    final resolvedName = _resolveUserName(user);
    final resolvedUserId = _resolveUserId(user);
    final resolvedPhone = _resolveUserPhone(user);
    final resolvedProjectId = _resolveProjectId(project);
    if (!force &&
        resolvedName == _userName &&
        resolvedUserId == _userId &&
        resolvedPhone == _userPhone &&
        resolvedProjectId == _projectId) {
      return;
    }
    setState(() {
      _userName = resolvedName;
      _userId = resolvedUserId;
      _userPhone = resolvedPhone;
      _projectId = resolvedProjectId;
    });
  }

  String? _resolveAttendanceId(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data['attendance_id']?.toString() ??
          data['attendanceId']?.toString() ??
          data['id']?.toString();
    }
    return null;
  }

  DateTime? _tryParseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is int) {
      final parsed = DateTime.fromMillisecondsSinceEpoch(value);
      return parsed;
    }
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      final parsed = DateTime.tryParse(trimmed);
      if (parsed != null) return parsed;
      final hhmm = RegExp(r'^(\d{1,2}):(\d{2})(?::(\d{2}))?$');
      final match = hhmm.firstMatch(trimmed);
      if (match != null) {
        final hours = int.tryParse(match.group(1) ?? '');
        final minutes = int.tryParse(match.group(2) ?? '');
        if (hours != null && minutes != null) {
          final now = DateTime.now();
          return DateTime(
            now.year,
            now.month,
            now.day,
            hours,
            minutes,
          );
        }
      }
    }
    return null;
  }

  String? _resolveAttendanceDate(Map<String, dynamic> item) {
    final direct = item['date']?.toString();
    if (direct != null && direct.trim().isNotEmpty) {
      return direct.trim();
    }
    for (final key in ['check_in_date', 'created_at', 'updated_at']) {
      final parsed = _tryParseDateTime(item[key]);
      if (parsed != null) {
        return DateFormat('yyyy-MM-dd').format(parsed);
      }
    }
    return null;
  }

  Future<void> _cacheLastAttendanceId(
    String attendanceId, {
    String? userId,
    String? projectId,
  }) async {
    final todayKey = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await AuthStorage.setLastAttendanceContext(
      attendanceId: attendanceId,
      date: todayKey,
      userId: userId,
      projectId: projectId,
    );
    _lastAttendanceId = attendanceId;
  }

  Future<String?> _resolveCheckoutAttendanceId() async {
    if (_lastAttendanceId != null && _lastAttendanceId!.trim().isNotEmpty) {
      return _lastAttendanceId;
    }

    final todayKey = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final stored = await AuthStorage.getLastAttendanceContext();
    final storedId = stored['attendance_id'];
    final storedDate = stored['date'];
    final storedUser = stored['user_id'];
    final storedProject = stored['project_id'];
    debugPrint(
      '[Attendance] Stored attendance context: id=$storedId date=$storedDate user=$storedUser project=$storedProject',
    );

    if (storedId != null &&
        storedId.trim().isNotEmpty &&
        storedDate == todayKey &&
        (storedUser == null || storedUser == _userId) &&
        (storedProject == null || storedProject == _projectId)) {
      _lastAttendanceId = storedId;
      return storedId;
    }

    final userId = _userId;
    if (userId == null || userId.trim().isEmpty) {
      return null;
    }

    final result = await ApiClient.getAttendanceByUser(userId);
    debugPrint('[Attendance] getAttendanceByUser response: $result');
    if (result['success'] != true) {
      return null;
    }
    final data = result['data'];
    if (data is! List) return null;

    final projectId = _projectId;
    final matches = <Map<String, dynamic>>[];
    final recent = <Map<String, dynamic>>[];
    final now = DateTime.now();
    for (final item in data) {
      if (item is! Map<String, dynamic>) continue;
      final dateKey = _resolveAttendanceDate(item);
      if (projectId != null && projectId.trim().isNotEmpty) {
        final itemProjectId =
            item['project_id']?.toString() ?? item['projectId']?.toString();
        if (itemProjectId != null &&
            itemProjectId.trim().isNotEmpty &&
            itemProjectId != projectId) {
          continue;
        }
      }
      if (dateKey == todayKey) {
        matches.add(item);
      }
      final parsed = _tryParseDateTime(
        item['created_at'] ??
            item['updated_at'] ??
            item['check_in_time'] ??
            item['check_in_at'],
      );
      if (parsed != null) {
        final hours = now.difference(parsed).inHours;
        if (hours.abs() <= 24) {
          recent.add(item);
        }
      }
    }

    debugPrint(
      '[Attendance] Attendance matches today=${matches.length} recent=${recent.length}',
    );

    final candidates = matches.isNotEmpty ? matches : recent;
    if (candidates.isEmpty) return null;

    candidates.sort((a, b) {
      final aTime = _tryParseDateTime(
        a['check_out_time'] ??
            a['checkout_time'] ??
            a['check_in_time'] ??
            a['created_at'] ??
            a['updated_at'],
      );
      final bTime = _tryParseDateTime(
        b['check_out_time'] ??
            b['checkout_time'] ??
            b['check_in_time'] ??
            b['created_at'] ??
            b['updated_at'],
      );
      final aMillis = aTime?.millisecondsSinceEpoch ?? 0;
      final bMillis = bTime?.millisecondsSinceEpoch ?? 0;
      return bMillis.compareTo(aMillis);
    });

    final latest = candidates.first;
    final resolvedId = _resolveAttendanceId(latest);
    if (resolvedId == null || resolvedId.trim().isEmpty) {
      return null;
    }

    await _cacheLastAttendanceId(
      resolvedId,
      userId: userId,
      projectId: projectId,
    );
    return resolvedId;
  }

  String? _resolveUserId(Map<String, dynamic>? user) {
    return user?['user_id']?.toString() ??
        user?['id']?.toString() ??
        user?['uid']?.toString();
  }

  String? _resolveUserName(Map<String, dynamic>? user) {
    final name =
        user?['name']?.toString() ?? user?['user_name']?.toString();
    if (name == null) return null;
    final trimmed = name.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  String? _resolveUserPhone(Map<String, dynamic>? user) {
    final phone =
        user?['phone_number']?.toString() ?? user?['phone']?.toString();
    if (phone == null) return null;
    final trimmed = phone.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  String? _resolveProjectId(Map<String, dynamic>? project) {
    return project?['id']?.toString() ??
        project?['project_id']?.toString();
  }

  String? _resolveFilePath(dynamic data) {
    if (data is Map<String, dynamic>) {
      final direct = data['filePath'] ??
          data['file_path'] ??
          data['path'] ??
          data['url'];
      if (direct != null && direct.toString().trim().isNotEmpty) {
        return direct.toString();
      }
      final nested = data['data'];
      if (nested is Map<String, dynamic>) {
        final nestedPath = nested['filePath'] ??
            nested['file_path'] ??
            nested['path'] ??
            nested['url'];
        if (nestedPath != null && nestedPath.toString().trim().isNotEmpty) {
          return nestedPath.toString();
        }
      }
    }
    return null;
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

    final store = StoreProvider.of<AppState>(context);
    final project = store.state.project.selectedProject;
    final projectLatLng = _resolveProjectLatLng(project);
    if (_debugGeoFence) {
      debugPrint('[Attendance][GeoFence] Check-in submit: projectId=${project?['project_id'] ?? project?['id']} '
          'hasLatLng=${projectLatLng != null} '
          'pos=${_position?.latitude},${_position?.longitude}');
    }
    if (projectLatLng == null) {
      unawaited(_ensureSelectedProjectHasLocationData());
      showToast(
        context,
        _hydratingProjectLocation
            ? 'Fetching project location… try again in a moment.'
            : 'Project location is not configured. Please contact admin.',
        variant: ToastVariant.error,
      );
      return;
    }
    final distanceMeters = _haversineDistanceMeters(
      lat1: _position!.latitude,
      lng1: _position!.longitude,
      lat2: projectLatLng.lat,
      lng2: projectLatLng.lng,
    );
    if (_debugGeoFence) {
      debugPrint('[Attendance][GeoFence] Check-in distanceMeters=${distanceMeters.toStringAsFixed(2)} '
          'allowed=$_attendanceAllowedRadiusMeters');
    }
    if (distanceMeters > _attendanceAllowedRadiusMeters) {
      showToast(
        context,
        'Go inside the 100m radius to mark attendance.',
        description: 'You are ~${distanceMeters.toStringAsFixed(0)}m away from the site.',
        variant: ToastVariant.error,
      );
      return;
    }

    final shouldSubmit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Submit Attendance?'),
          content: const Text(
            'This will upload photos and send your attendance to admin.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Submit'),
            ),
          ],
        );
      },
    );

    if (shouldSubmit != true) return;

    setState(() => _submitting = true);
    try {
      final user = store.state.auth.user;
      final userId = _resolveUserId(user);
      final userName = _resolveUserName(user);
      final userPhone = _resolveUserPhone(user);
      final projectId = _resolveProjectId(project);

      final selfieUpload = await ApiClient.uploadAttendanceImage(
        _selfie!,
        userId: userId,
        userName: userName,
      );
      if (selfieUpload['success'] != true) {
        showToast(
          context,
          selfieUpload['error']?.toString() ?? 'Unable to upload selfie.',
          variant: ToastVariant.error,
        );
        return;
      }
      final selfiePath = _resolveFilePath(selfieUpload['data']);
      if (selfiePath == null || selfiePath.trim().isEmpty) {
        showToast(
          context,
          'Selfie upload did not return a file path.',
          variant: ToastVariant.error,
        );
        return;
      }

      final siteUpload = await ApiClient.uploadAttendanceImage(
        _siteImage!,
        userId: userId,
        userName: userName,
      );
      if (siteUpload['success'] != true) {
        showToast(
          context,
          siteUpload['error']?.toString() ?? 'Unable to upload site photo.',
          variant: ToastVariant.error,
        );
        return;
      }
      final sitePath = _resolveFilePath(siteUpload['data']);
      if (sitePath == null || sitePath.trim().isEmpty) {
        showToast(
          context,
          'Site photo upload did not return a file path.',
          variant: ToastVariant.error,
        );
        return;
      }

      final now = DateTime.now();
      final payload = <String, dynamic>{
        'photo_selfie': selfiePath,
        'photo_site': sitePath,
        'location': _locationName,
        'latitude': _position?.latitude,
        'longitude': _position?.longitude,
        'user_name': userName,
        'phone_number': userPhone,
        'date': DateFormat('yyyy-MM-dd').format(now),
        'day': DateFormat('EEEE').format(now),
        'project_id': projectId == null ? null : int.tryParse(projectId),
        'user_id': userId,
      };

      payload.removeWhere(
        (_, value) => value == null || value.toString().trim().isEmpty,
      );

      final createResult = await ApiClient.createAttendance(payload);
      if (createResult['success'] == true) {
        final createdId = _resolveAttendanceId(createResult['data']);
        if (createdId != null && createdId.trim().isNotEmpty) {
          await _cacheLastAttendanceId(
            createdId,
            userId: userId,
            projectId: projectId,
          );
        } else {
          await _resolveCheckoutAttendanceId();
        }
        if (mounted) {
          await showDialog<void>(
            context: context,
            builder: (dialogContext) {
              return AlertDialog(
                title: const Text('Attendance Submitted'),
                content: const Text('Attendance submitted successfully.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(dialogContext).pop(),
                    child: const Text('OK'),
                  ),
                ],
              );
            },
          );
        }
        if (mounted) {
          setState(() {
            _selfie = null;
            _siteImage = null;
            _position = null;
            _locationName = null;
            _locationCapturedAt = null;
            _mode = _AttendanceMode.select;
          });
        }
      } else {
        showToast(
          context,
          createResult['error']?.toString() ??
              'Failed to create attendance record.',
          variant: ToastVariant.error,
        );
      }
      if (!mounted) return;
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _captureCheckoutSelfie() async {
    final photo = await _pickCameraImage(
      preferredCameraDevice: CameraDevice.front,
      label: 'checkout selfie',
      fallbackToAnyCamera: true,
    );
    if (photo == null) return;
    setState(() => _checkoutSelfie = File(photo.path));
  }

  Future<void> _captureCheckoutSiteImage() async {
    final photo = await _pickCameraImage(
      preferredCameraDevice: CameraDevice.rear,
      label: 'checkout site photo',
      fallbackToAnyCamera: true,
    );
    if (photo == null) return;
    setState(() => _checkoutSiteImage = File(photo.path));
  }

  Future<void> _captureCheckoutLocation() async {
    if (_locating) return;
    _syncUserContext(force: true);
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
            'Location permission is required to check out.',
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
        _checkoutPosition = position;
        _checkoutLocationCapturedAt = DateTime.now();
        _checkoutLocationName = null;
      });

      final store = StoreProvider.of<AppState>(context);
      final project = store.state.project.selectedProject;
      final projectLatLng = _resolveProjectLatLng(project);
      if (projectLatLng == null) {
        unawaited(_ensureSelectedProjectHasLocationData());
        if (!_hydratingProjectLocation) {
          showToast(
            context,
            'Project location is not configured. Please contact admin.',
            variant: ToastVariant.error,
          );
        }
      } else {
        final distanceMeters = _haversineDistanceMeters(
          lat1: position.latitude,
          lng1: position.longitude,
          lat2: projectLatLng.lat,
          lng2: projectLatLng.lng,
        );
        if (distanceMeters > _attendanceAllowedRadiusMeters) {
          await showDialog<void>(
            context: context,
            builder: (dialogContext) {
              return AlertDialog(
                title: const Text('Outside site radius'),
                content: Text(
                  'You are ~${distanceMeters.toStringAsFixed(0)}m away from the site.\n\nPlease move within 100m to check out.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(dialogContext).pop(),
                    child: const Text('OK'),
                  ),
                ],
              );
            },
          );
        } else {
          showToast(
            context,
            'You are within the site radius.',
            description: 'Distance: ${distanceMeters.toStringAsFixed(0)}m (≤ 100m)',
            variant: ToastVariant.success,
          );
        }
      }

      _resolveCheckoutLocationName(position);
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

  Future<void> _resolveCheckoutLocationName(Position position) async {
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
        _checkoutLocationName = parts.isEmpty ? null : parts.join(', ');
      });
    } catch (_) {
      // Silently ignore reverse geocoding failures.
    }
  }

  Future<void> _submitCheckout() async {
    if (_checkoutSubmitting) return;
    _syncUserContext(force: true);
    if (_checkoutSelfie == null || _checkoutSiteImage == null) {
      showToast(
        context,
        'Capture both selfie and site photo to check out.',
        variant: ToastVariant.error,
      );
      return;
    }
    if (_checkoutPosition == null) {
      showToast(
        context,
        'Capture location to check out.',
        variant: ToastVariant.error,
      );
      return;
    }

    final store = StoreProvider.of<AppState>(context);
    final project = store.state.project.selectedProject;
    final projectLatLng = _resolveProjectLatLng(project);
    if (_debugGeoFence) {
      debugPrint('[Attendance][GeoFence] Checkout submit: projectId=${project?['project_id'] ?? project?['id']} '
          'hasLatLng=${projectLatLng != null} '
          'pos=${_checkoutPosition?.latitude},${_checkoutPosition?.longitude}');
    }
    if (projectLatLng == null) {
      unawaited(_ensureSelectedProjectHasLocationData());
      showToast(
        context,
        _hydratingProjectLocation
            ? 'Fetching project location… try again in a moment.'
            : 'Project location is not configured. Please contact admin.',
        variant: ToastVariant.error,
      );
      return;
    }
    final distanceMeters = _haversineDistanceMeters(
      lat1: _checkoutPosition!.latitude,
      lng1: _checkoutPosition!.longitude,
      lat2: projectLatLng.lat,
      lng2: projectLatLng.lng,
    );
    if (_debugGeoFence) {
      debugPrint('[Attendance][GeoFence] Checkout distanceMeters=${distanceMeters.toStringAsFixed(2)} '
          'allowed=$_attendanceAllowedRadiusMeters');
    }
    if (distanceMeters > _attendanceAllowedRadiusMeters) {
      showToast(
        context,
        'Go inside the 100m radius to check out.',
        description: 'You are ~${distanceMeters.toStringAsFixed(0)}m away from the site.',
        variant: ToastVariant.error,
      );
      return;
    }

    final shouldSubmit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Submit Checkout?'),
          content: const Text(
            'This will upload photos and send your checkout to admin.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Submit'),
            ),
          ],
        );
      },
    );
    if (shouldSubmit != true) return;

    setState(() => _checkoutSubmitting = true);
    debugPrint('[Attendance] Checkout submit started');
    debugPrint('[Attendance] Checkout userId=$_userId projectId=$_projectId');
    final attendanceId = await _resolveCheckoutAttendanceId();
    debugPrint('[Attendance] Checkout resolved attendanceId=$attendanceId');
    if (attendanceId == null || attendanceId.trim().isEmpty) {
      if (mounted) {
        showToast(
          context,
          'Unable to find today\'s check-in. Please check in again.',
          variant: ToastVariant.error,
        );
        setState(() => _checkoutSubmitting = false);
      }
      return;
    }
    try {
      final user = store.state.auth.user;
      final userId = _resolveUserId(user);
      final userName = _resolveUserName(user);
      final userIdValue = userId;
      debugPrint('[Attendance] Checkout payload userId=$userIdValue name=$userName');

      final selfieUpload = await ApiClient.uploadAttendanceImage(
        _checkoutSelfie!,
        userId: userIdValue,
        userName: userName,
      );
      debugPrint('[Attendance] Checkout selfie upload response: $selfieUpload');
      if (selfieUpload['success'] != true) {
        showToast(
          context,
          selfieUpload['error']?.toString() ?? 'Unable to upload selfie.',
          variant: ToastVariant.error,
        );
        return;
      }
      final selfiePath = _resolveFilePath(selfieUpload['data']);
      if (selfiePath == null || selfiePath.trim().isEmpty) {
        showToast(
          context,
          'Selfie upload did not return a file path.',
          variant: ToastVariant.error,
        );
        return;
      }

      final siteUpload = await ApiClient.uploadAttendanceImage(
        _checkoutSiteImage!,
        userId: userIdValue,
        userName: userName,
      );
      debugPrint('[Attendance] Checkout site upload response: $siteUpload');
      if (siteUpload['success'] != true) {
        showToast(
          context,
          siteUpload['error']?.toString() ?? 'Unable to upload site photo.',
          variant: ToastVariant.error,
        );
        return;
      }
      final sitePath = _resolveFilePath(siteUpload['data']);
      if (sitePath == null || sitePath.trim().isEmpty) {
        showToast(
          context,
          'Site photo upload did not return a file path.',
          variant: ToastVariant.error,
        );
        return;
      }

      final payload = <String, dynamic>{
        'photo_selfie': selfiePath,
        'photo_site': sitePath,
        'location': _checkoutLocationName,
        'latitude': _checkoutPosition?.latitude,
        'longitude': _checkoutPosition?.longitude,
        'user_id': userIdValue,
      };

      payload.removeWhere(
        (_, value) => value == null || value.toString().trim().isEmpty,
      );

      debugPrint('[Attendance] Checkout request payload: $payload');
      final createResult =
          await ApiClient.checkoutAttendance(attendanceId, payload);
      debugPrint('[Attendance] Checkout response: $createResult');
      if (createResult['success'] == true) {
        await _cacheLastAttendanceId(
          attendanceId,
          userId: userIdValue,
          projectId: _projectId,
        );
        if (mounted) {
          await showDialog<void>(
            context: context,
            builder: (dialogContext) {
              return AlertDialog(
                title: const Text('Checkout Submitted'),
                content: const Text('Checkout submitted successfully.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(dialogContext).pop(),
                    child: const Text('OK'),
                  ),
                ],
              );
            },
          );
        }
        if (mounted) {
          setState(() {
            _checkoutSelfie = null;
            _checkoutSiteImage = null;
            _checkoutPosition = null;
            _checkoutLocationName = null;
            _checkoutLocationCapturedAt = null;
            _mode = _AttendanceMode.select;
          });
        }
      } else {
        showToast(
          context,
          createResult['error']?.toString() ??
              'Failed to submit checkout.',
          variant: ToastVariant.error,
        );
      }
    } finally {
      if (mounted) setState(() => _checkoutSubmitting = false);
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
            if (_lastCameraPermissionStatus ==
                PermissionStatus.permanentlyDenied) ...[
              InkWell(
                onTap: openAppSettings,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      const Icon(
                        LucideIcons.triangleAlert,
                        size: 16,
                        color: Color(0xFFF59E0B),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Camera permission denied. Tap here to open Settings.',
                          style: TextStyle(color: muted, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
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

    final store = StoreProvider.of<AppState>(context);
    final project = store.state.project.selectedProject;
    final projectLatLng = _resolveProjectLatLng(project);
    final distanceMeters = (projectLatLng != null && _position != null)
        ? _haversineDistanceMeters(
            lat1: _position!.latitude,
            lng1: _position!.longitude,
            lat2: projectLatLng.lat,
            lng2: projectLatLng.lng,
          )
        : null;
    final withinRadius = distanceMeters != null &&
        distanceMeters <= _attendanceAllowedRadiusMeters;
    final distanceColor = distanceMeters == null
        ? muted
        : withinRadius
            ? const Color(0xFF16A34A)
            : const Color(0xFFDC2626);

    final lat = _position?.latitude.toStringAsFixed(6) ?? '-';
    final lng = _position?.longitude.toStringAsFixed(6) ?? '-';
    final timestamp = _locationCapturedAt == null
        ? '-'
        : DateFormat('dd MMM yyyy, hh:mm a').format(_locationCapturedAt!);
    final locationLabel = _locationName ?? '-';
    final userLabel = _userName ?? '-';

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
                    'Name: $userLabel',
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Captured at: $timestamp',
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    distanceMeters == null
                        ? (projectLatLng == null
                            ? (_hydratingProjectLocation
                                ? 'Distance: fetching project location…'
                                : 'Distance: project location not set')
                            : 'Distance: capture location to compute')
                        : 'Distance from site: ${distanceMeters.toStringAsFixed(0)} m',
                    style: TextStyle(color: distanceColor, fontSize: 12, fontWeight: FontWeight.w600),
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

  Widget _buildCheckoutLocationCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;

    final store = StoreProvider.of<AppState>(context);
    final project = store.state.project.selectedProject;
    final projectLatLng = _resolveProjectLatLng(project);
    final distanceMeters = (projectLatLng != null && _checkoutPosition != null)
        ? _haversineDistanceMeters(
            lat1: _checkoutPosition!.latitude,
            lng1: _checkoutPosition!.longitude,
            lat2: projectLatLng.lat,
            lng2: projectLatLng.lng,
          )
        : null;
    final withinRadius = distanceMeters != null &&
        distanceMeters <= _attendanceAllowedRadiusMeters;
    final distanceColor = distanceMeters == null
        ? muted
        : withinRadius
            ? const Color(0xFF16A34A)
            : const Color(0xFFDC2626);

    final lat = _checkoutPosition?.latitude.toStringAsFixed(6) ?? '-';
    final lng = _checkoutPosition?.longitude.toStringAsFixed(6) ?? '-';
    final timestamp = _checkoutLocationCapturedAt == null
        ? '-'
        : DateFormat('dd MMM yyyy, hh:mm a')
            .format(_checkoutLocationCapturedAt!);
    final locationLabel = _checkoutLocationName ?? '-';
    final userLabel = _userName ?? '-';

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
              'Capture your current checkout location.',
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
                    'Name: $userLabel',
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Captured at: $timestamp',
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    distanceMeters == null
                        ? (projectLatLng == null
                            ? (_hydratingProjectLocation
                                ? 'Distance: fetching project location…'
                                : 'Distance: project location not set')
                            : 'Distance: capture location to compute')
                        : 'Distance from site: ${distanceMeters.toStringAsFixed(0)} m',
                    style: TextStyle(color: distanceColor, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            MadButton(
              text: _locating ? 'Capturing...' : 'Capture Location',
              icon: LucideIcons.locateFixed,
              disabled: _locating,
              onPressed: _captureCheckoutLocation,
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

    final store = StoreProvider.of<AppState>(context);
    final selectedProject = store.state.project.selectedProject;
    final projectLatLng = _resolveProjectLatLng(selectedProject);
    if (projectLatLng == null) {
      unawaited(_ensureSelectedProjectHasLocationData());
    }
    final canSubmitCheckIn = () {
      if (_submitting) return false;
      if (_selfie == null || _siteImage == null || _position == null) return false;
      if (projectLatLng == null) return false;
      final d = _haversineDistanceMeters(
        lat1: _position!.latitude,
        lng1: _position!.longitude,
        lat2: projectLatLng.lat,
        lng2: projectLatLng.lng,
      );
      return d <= _attendanceAllowedRadiusMeters;
    }();
    final canSubmitCheckOut = () {
      if (_checkoutSubmitting) return false;
      if (_checkoutSelfie == null || _checkoutSiteImage == null || _checkoutPosition == null) return false;
      if (projectLatLng == null) return false;
      final d = _haversineDistanceMeters(
        lat1: _checkoutPosition!.latitude,
        lng1: _checkoutPosition!.longitude,
        lat2: projectLatLng.lat,
        lng2: projectLatLng.lng,
      );
      return d <= _attendanceAllowedRadiusMeters;
    }();

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
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _mode == _AttendanceMode.select
                              ? 'Attendance'
                              : _mode == _AttendanceMode.checkIn
                                  ? 'Check In'
                                  : 'Check Out',
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
                          _mode == _AttendanceMode.checkIn
                              ? 'Capture selfie, site photo, and location to mark attendance.'
                              : _mode == _AttendanceMode.checkOut
                                  ? 'Capture selfie, site photo, and location to check out.'
                                  : 'Choose an action to continue.',
                          style: TextStyle(
                            color: isDark
                                ? AppTheme.darkMutedForeground
                                : AppTheme.lightMutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_mode != _AttendanceMode.select)
                    MadButton(
                      text: 'Back',
                      variant: ButtonVariant.outline,
                      icon: LucideIcons.arrowLeft,
                      onPressed: () {
                        setState(() {
                          _mode = _AttendanceMode.select;
                        });
                      },
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if (_mode == _AttendanceMode.select) ...[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 16,
                    runSpacing: 16,
                    children: [
                      SizedBox(
                        width: isMobile ? double.infinity : 320,
                        child: MadCard(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(LucideIcons.logIn, size: 24),
                                const SizedBox(height: 12),
                                const Text(
                                  'Check In',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Capture selfie, site photo, and location.',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: isDark
                                        ? AppTheme.darkMutedForeground
                                        : AppTheme.lightMutedForeground,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                MadButton(
                                  text: 'Start Check In',
                                  icon: LucideIcons.arrowRight,
                                  onPressed: () {
                                    setState(() {
                                      _mode = _AttendanceMode.checkIn;
                                      _selfie = null;
                                      _siteImage = null;
                                      _position = null;
                                      _locationName = null;
                                      _locationCapturedAt = null;
                                    });
                                  },
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: isMobile ? double.infinity : 320,
                        child: MadCard(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(LucideIcons.logOut, size: 24),
                                const SizedBox(height: 12),
                                const Text(
                                  'Check Out',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Capture selfie, site photo, and location.',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: isDark
                                        ? AppTheme.darkMutedForeground
                                        : AppTheme.lightMutedForeground,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                MadButton(
                                  text: 'Start Check Out',
                                  icon: LucideIcons.arrowRight,
                                  onPressed: () {
                                    setState(() {
                                      _mode = _AttendanceMode.checkOut;
                                      _checkoutSelfie = null;
                                      _checkoutSiteImage = null;
                                      _checkoutPosition = null;
                                      _checkoutLocationName = null;
                                      _checkoutLocationCapturedAt = null;
                                    });
                                  },
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: isMobile ? double.infinity : 320,
                    child: MadCard(
                      child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Icon(
                              LucideIcons.calendarCheck2,
                              size: 24,
                              color: AppTheme.primaryColor,
                            ),
                                const SizedBox(height: 12),
                            const Text(
                              'View My Attendance',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'See your attendance status (present/absent) marked by admin.',
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark
                                    ? AppTheme.darkMutedForeground
                                    : AppTheme.lightMutedForeground,
                              ),
                            ),
                            const SizedBox(height: 12),
                            MadButton(
                              text: 'View Attendance',
                              icon: LucideIcons.arrowRight,
                              onPressed: () {
                                Navigator.pushNamed(context, '/attendance/my');
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ] else if (_mode == _AttendanceMode.checkOut) ...[
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  SizedBox(
                    width: isMobile ? double.infinity : 360,
                    child: _buildPhotoCard(
                      title: 'Selfie',
                      subtitle: 'Capture a clear selfie for checkout.',
                      icon: LucideIcons.user,
                      onCapture: _captureCheckoutSelfie,
                      photo: _checkoutSelfie,
                    ),
                  ),
                  SizedBox(
                    width: isMobile ? double.infinity : 360,
                    child: _buildPhotoCard(
                      title: 'Site Photo',
                      subtitle: 'Capture the current site image.',
                      icon: LucideIcons.building,
                      onCapture: _captureCheckoutSiteImage,
                      photo: _checkoutSiteImage,
                    ),
                  ),
                  SizedBox(
                    width: isMobile ? double.infinity : 360,
                    child: _buildCheckoutLocationCard(),
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
                        'Submit Check Out',
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
                        text: _checkoutSubmitting ? 'Submitting...' : 'Submit to Admin',
                        icon: LucideIcons.send,
                        disabled: !canSubmitCheckOut,
                        onPressed: _submitCheckout,
                      ),
                    ],
                  ),
                ),
              ),
            ] else ...[
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
                        disabled: !canSubmitCheckIn,
                        onPressed: _submitAttendance,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

enum _AttendanceMode { select, checkIn, checkOut }
