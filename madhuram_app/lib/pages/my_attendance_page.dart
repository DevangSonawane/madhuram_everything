import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../services/api_client.dart';
import '../store/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

class MyAttendancePage extends StatefulWidget {
  const MyAttendancePage({super.key});

  @override
  State<MyAttendancePage> createState() => _MyAttendancePageState();
}

class _MyAttendancePageState extends State<MyAttendancePage> {
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _records = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  String? _resolveUserId(Map<String, dynamic>? user) {
    return user?['user_id']?.toString() ??
        user?['id']?.toString() ??
        user?['uid']?.toString();
  }

  String? _resolveProjectId(Map<String, dynamic>? project) {
    return project?['id']?.toString() ?? project?['project_id']?.toString();
  }

  DateTime? _tryParseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      return DateTime.tryParse(trimmed);
    }
    return null;
  }

  DateTime? _tryParseDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return DateTime(value.year, value.month, value.day);
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      final parsed = DateTime.tryParse(trimmed);
      if (parsed != null) return DateTime(parsed.year, parsed.month, parsed.day);
      final formats = <DateFormat>[
        DateFormat('yyyy-MM-dd'),
        DateFormat('dd-MM-yyyy'),
        DateFormat('dd/MM/yyyy'),
      ];
      for (final format in formats) {
        try {
          final dt = format.parseStrict(trimmed);
          return DateTime(dt.year, dt.month, dt.day);
        } catch (_) {
          // Try next format.
        }
      }
    }
    return null;
  }

  String _resolveStatus(Map<String, dynamic> item) {
    final direct = item['status']?.toString();
    if (direct != null && direct.trim().isNotEmpty) {
      return direct.trim();
    }
    return 'pending';
  }

  BadgeVariant _statusVariant(String status) {
    switch (status.toLowerCase()) {
      case 'present':
      case 'approved':
      case 'completed':
        return BadgeVariant.success;
      case 'absent':
      case 'rejected':
      case 'failed':
        return BadgeVariant.destructive;
      case 'pending':
      case 'submitted':
        return BadgeVariant.warning;
      default:
        return BadgeVariant.secondary;
    }
  }

  String _formatDate(Map<String, dynamic> item) {
    final dateValue = item['date'];
    final parsed = _tryParseDate(dateValue) ??
        _tryParseDateTime(item['created_at']) ??
        _tryParseDateTime(item['updated_at']);
    if (parsed == null) return '-';
    return DateFormat('dd MMM yyyy').format(parsed);
  }

  String _formatTime(dynamic value) {
    final parsed = _tryParseDateTime(value);
    if (parsed == null) return '-';
    return DateFormat('hh:mm a').format(parsed.toLocal());
  }

  dynamic _resolveFirst(Map<String, dynamic> item, List<String> keys) {
    for (final key in keys) {
      final value = item[key];
      if (value == null) continue;
      if (value is String && value.trim().isEmpty) continue;
      return value;
    }
    return null;
  }

  dynamic _resolveCheckInTime(Map<String, dynamic> item) {
    return _resolveFirst(item, const [
      'check_in_time',
      'check_in_at',
      'checkin_time',
      'checkin_at',
      'checkin',
    ]);
  }

  dynamic _resolveCheckOutTime(Map<String, dynamic> item) {
    return _resolveFirst(item, const [
      'check_out_time',
      'check_out_at',
      'checkout_time',
      'checkout_at',
      'checkout',
    ]);
  }

  Future<void> _load({bool showToastOnError = false}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final store = StoreProvider.of<AppState>(context);
      final userId = _resolveUserId(store.state.auth.user);
      final projectId = _resolveProjectId(store.state.project.selectedProject);
      if (userId == null || userId.trim().isEmpty) {
        setState(() {
          _records = const [];
          _error = 'Missing user context. Please login again.';
        });
        if (showToastOnError && mounted) {
          showToast(
            context,
            _error!,
            variant: ToastVariant.error,
          );
        }
        return;
      }

      final result = await ApiClient.getAttendanceByUser(userId);
      if (result['success'] != true) {
        final message = result['error']?.toString() ?? 'Unable to load attendance';
        setState(() => _error = message);
        if (showToastOnError && mounted) {
          showToast(context, message, variant: ToastVariant.error);
        }
        return;
      }

      final data = result['data'];
      final items = <Map<String, dynamic>>[];
      if (data is List) {
        for (final item in data) {
          if (item is Map<String, dynamic>) {
            items.add(item);
          } else if (item is Map) {
            items.add(Map<String, dynamic>.from(item));
          }
        }
      }

      final filtered = projectId == null || projectId.trim().isEmpty
          ? items
          : items.where((item) {
              final itemProjectId =
                  item['project_id']?.toString() ?? item['projectId']?.toString();
              if (itemProjectId == null || itemProjectId.trim().isEmpty) {
                return true;
              }
              return itemProjectId.toString() == projectId.toString();
            }).toList();

      filtered.sort((a, b) {
        final aDate = _tryParseDate(a['date']) ??
            _tryParseDateTime(a['created_at']) ??
            _tryParseDateTime(a['updated_at']);
        final bDate = _tryParseDate(b['date']) ??
            _tryParseDateTime(b['created_at']) ??
            _tryParseDateTime(b['updated_at']);
        final aMillis = aDate?.millisecondsSinceEpoch ?? 0;
        final bMillis = bDate?.millisecondsSinceEpoch ?? 0;
        return bMillis.compareTo(aMillis);
      });

      setState(() => _records = filtered);
    } catch (e) {
      setState(() => _error = 'Unable to load attendance. $e');
      if (showToastOnError && mounted) {
        showToast(context, _error!, variant: ToastVariant.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    final presentCount =
        _records.where((e) => _resolveStatus(e).toLowerCase() == 'present').length;
    final absentCount =
        _records.where((e) => _resolveStatus(e).toLowerCase() == 'absent').length;
    final pendingCount = _records
        .where((e) => _resolveStatus(e).toLowerCase() == 'pending')
        .length;

    return ProtectedRoute(
      title: 'My Attendance',
      route: '/attendance',
      headerLeadingIcon: LucideIcons.arrowLeft,
      onHeaderLeadingPressed: () => Navigator.pop(context),
      child: RefreshIndicator(
        onRefresh: () => _load(showToastOnError: true),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
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
                          'My Attendance',
                          style: TextStyle(
                            fontSize: responsive.value(
                              mobile: 22,
                              tablet: 26,
                              desktop: 28,
                            ),
                            fontWeight: FontWeight.w700,
                            color: isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Your attendance history and admin-marked status.',
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
                  MadButton(
                    text: _loading ? 'Loading...' : 'Refresh',
                    icon: LucideIcons.refreshCw,
                    disabled: _loading,
                    variant: ButtonVariant.outline,
                    onPressed: _loading ? null : () => _load(showToastOnError: true),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  SizedBox(
                    width: isMobile ? double.infinity : 220,
                    height: 110,
                    child: StatCard(
                      title: 'Present',
                      value: presentCount.toString(),
                      icon: LucideIcons.badgeCheck,
                      iconColor: const Color(0xFF16A34A),
                      iconBackgroundColor:
                          (isDark ? const Color(0xFF065F46) : const Color(0xFFDCFCE7))
                              .withValues(alpha: isDark ? 0.35 : 1),
                    ),
                  ),
                  SizedBox(
                    width: isMobile ? double.infinity : 220,
                    height: 110,
                    child: StatCard(
                      title: 'Absent',
                      value: absentCount.toString(),
                      icon: LucideIcons.x,
                      iconColor: const Color(0xFFDC2626),
                      iconBackgroundColor:
                          (isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFEE2E2))
                              .withValues(alpha: isDark ? 0.35 : 1),
                    ),
                  ),
                  SizedBox(
                    width: isMobile ? double.infinity : 220,
                    height: 110,
                    child: StatCard(
                      title: 'Pending',
                      value: pendingCount.toString(),
                      icon: LucideIcons.clock3,
                      iconColor: const Color(0xFFF59E0B),
                      iconBackgroundColor:
                          (isDark ? const Color(0xFF78350F) : const Color(0xFFFEF3C7))
                              .withValues(alpha: isDark ? 0.35 : 1),
                    ),
                  ),
                  SizedBox(
                    width: isMobile ? double.infinity : 220,
                    height: 110,
                    child: StatCard(
                      title: 'Total',
                      value: _records.length.toString(),
                      icon: LucideIcons.calendar,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_error != null) ...[
                MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        const Icon(
                          LucideIcons.triangleAlert,
                          color: Color(0xFFDC2626),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ] else if (_loading && _records.isEmpty) ...[
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 36),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ] else if (_records.isEmpty) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      'No attendance records found.',
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  ),
                ),
              ] else ...[
                ..._records.map((item) {
                  final status = _resolveStatus(item);
                  final createdAt = item['created_at'];
                  final checkInTime = _resolveCheckInTime(item) ?? createdAt;
                  final checkOutTime = _resolveCheckOutTime(item);
                  final day = item['day']?.toString().trim();
                  final location = item['location']?.toString().trim();
                  final projectId =
                      item['project_id']?.toString() ?? item['projectId']?.toString();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: MadCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
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
                                        _formatDate(item),
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        [
                                          if (day != null && day.isNotEmpty) day,
                                          if (projectId != null &&
                                              projectId.trim().isNotEmpty)
                                            'Project: $projectId',
                                        ].join(' • '),
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
                                MadBadge(
                                  text: status,
                                  variant: _statusVariant(status),
                                ),
                              ],
                            ),
                            if (location != null && location.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Icon(
                                    LucideIcons.mapPin,
                                    size: 16,
                                    color: isDark
                                        ? AppTheme.darkMutedForeground
                                        : AppTheme.lightMutedForeground,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      location,
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
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 12,
                              runSpacing: 8,
                              children: [
                                _MetaChip(
                                  icon: LucideIcons.logIn,
                                  label: 'Check In',
                                  value: _formatTime(checkInTime),
                                ),
                                if (checkOutTime != null)
                                  _MetaChip(
                                    icon: LucideIcons.logOut,
                                    label: 'Check Out',
                                    value: _formatTime(checkOutTime),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 8),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _MetaChip({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppTheme.darkMuted : AppTheme.lightMuted;
    final fg = isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: bg.withValues(alpha: isDark ? 0.25 : 0.45),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
              .withValues(alpha: 0.6),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 6),
          Text(
            '$label: $value',
            style: TextStyle(
              fontSize: 12,
              color: fg,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
