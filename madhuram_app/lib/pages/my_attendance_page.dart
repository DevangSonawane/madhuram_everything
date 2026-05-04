import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../components/layout/main_layout.dart';
import '../components/ui/components.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
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
  bool _leaveGranting = false;
  String? _leaveBanner;
  late Future<String?> _leaveBannerFuture;
  List<Map<String, dynamic>> _leaveRequests = const [];

  @override
  void initState() {
    super.initState();
    _leaveBannerFuture = AuthStorage.getLeaveGrantedBanner();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _load();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Ensure we re-check persisted banner after route changes.
    _leaveBannerFuture = AuthStorage.getLeaveGrantedBanner();
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
      if (parsed != null)
        return DateTime(parsed.year, parsed.month, parsed.day);
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
    final parsed =
        _tryParseDate(dateValue) ??
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

  DateTime? _tryParseDateOnly(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return DateTime(value.year, value.month, value.day);
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      // Prefer yyyy-MM-dd
      final parsed = DateTime.tryParse(trimmed);
      if (parsed != null)
        return DateTime(parsed.year, parsed.month, parsed.day);
    }
    return null;
  }

  bool _dateInRange(DateTime day, DateTime from, DateTime to) {
    final d = DateTime(day.year, day.month, day.day);
    final f = DateTime(from.year, from.month, from.day);
    final t = DateTime(to.year, to.month, to.day);
    return !d.isBefore(f) && !d.isAfter(t);
  }

  String? _buildActiveLeaveBanner() {
    if (_leaveRequests.isEmpty) return null;
    final today = DateTime.now();
    final fmt = DateFormat('yyyy-MM-dd');
    for (final item in _leaveRequests) {
      final status = item['status']?.toString().toLowerCase() ?? '';
      if (status != 'approved') continue;
      final from = _tryParseDateOnly(item['from_date']);
      final to = _tryParseDateOnly(item['to_date']);
      if (from == null || to == null) continue;
      if (!_dateInRange(today, from, to)) continue;
      final leaveType = item['leave_type']?.toString() ?? '';
      final reason = item['reason']?.toString();
      final label = leaveType.isNotEmpty ? leaveType : 'leave';
      final reasonPart = (reason != null && reason.trim().isNotEmpty)
          ? ' • ${reason.trim()}'
          : '';
      return 'Leave granted (${label}): ${fmt.format(from)} → ${fmt.format(to)}$reasonPart';
    }
    return null;
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
          showToast(context, _error!, variant: ToastVariant.error);
        }
        return;
      }

      // Fetch leave requests for this user (so Flutter can reflect leave granted from web).
      try {
        final leaveRes = await ApiClient.getLeavesByUser(userId);
        if (leaveRes['success'] == true) {
          final data = leaveRes['data'];
          final list = data is List ? data : const [];
          final items = list
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
          if (mounted) {
            setState(() => _leaveRequests = items);
          } else {
            _leaveRequests = items;
          }
          final derivedBanner = _buildActiveLeaveBanner();
          if (derivedBanner != null && derivedBanner.trim().isNotEmpty) {
            setState(() {
              _leaveBanner = derivedBanner;
              _leaveBannerFuture = Future.value(derivedBanner);
            });
          }
        }
      } catch (_) {
        // Leave fetch is non-blocking.
      }

      final result = await ApiClient.getAttendanceByUser(userId);
      if (result['success'] != true) {
        final message =
            result['error']?.toString() ?? 'Unable to load attendance';
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

      // Show all attendance for this user across projects.
      final filtered = items;

      filtered.sort((a, b) {
        final aDate =
            _tryParseDate(a['date']) ??
            _tryParseDateTime(a['created_at']) ??
            _tryParseDateTime(a['updated_at']);
        final bDate =
            _tryParseDate(b['date']) ??
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

  Future<void> _openGrantLeaveDialog() async {
    if (_leaveGranting) return;
    setState(() => _leaveGranting = true);
    List<User> users = const [];
    try {
      final result = await ApiClient.getUsers();
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final list = data is List ? data : const [];
        users =
            list
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .map((e) => User.fromJson(e))
                .toList()
              ..sort(
                (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
              );
      } else {
        showToast(
          context,
          result['error']?.toString() ?? 'Failed to load users',
          variant: ToastVariant.error,
        );
        return;
      }
    } catch (e) {
      if (!mounted) return;
      showToast(context, 'Failed to load users', variant: ToastVariant.error);
      return;
    } finally {
      if (mounted) setState(() => _leaveGranting = false);
    }

    if (!mounted) return;
    if (users.isEmpty) {
      showToast(context, 'No users found', variant: ToastVariant.error);
      return;
    }

    final reasonController = TextEditingController();
    User selectedUser = users.first;
    DateTime fromDate = DateTime.now();
    DateTime toDate = DateTime.now();
    bool saving = false;

    Future<void> pickFromDate(StateSetter setDialogState) async {
      final picked = await showDatePicker(
        context: context,
        initialDate: fromDate,
        firstDate: DateTime(2020),
        lastDate: DateTime(2100),
      );
      if (picked == null) return;
      setDialogState(() {
        fromDate = picked;
        if (toDate.isBefore(fromDate)) toDate = fromDate;
      });
    }

    Future<void> pickToDate(StateSetter setDialogState) async {
      final picked = await showDatePicker(
        context: context,
        initialDate: toDate,
        firstDate: DateTime(2020),
        lastDate: DateTime(2100),
      );
      if (picked == null) return;
      setDialogState(() => toDate = picked);
    }

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final fromLabel = DateFormat('dd MMM yyyy').format(fromDate);
            final toLabel = DateFormat('dd MMM yyyy').format(toDate);
            return AlertDialog(
              title: const Text('Leave'),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      value: selectedUser.id,
                      items: users
                          .map(
                            (u) => DropdownMenuItem(
                              value: u.id,
                              child: Text(u.name.isNotEmpty ? u.name : u.email),
                            ),
                          )
                          .toList(),
                      onChanged: saving
                          ? null
                          : (value) {
                              final next = users.firstWhere(
                                (u) => u.id == value,
                                orElse: () => users.first,
                              );
                              setDialogState(() => selectedUser = next);
                            },
                      decoration: const InputDecoration(
                        labelText: 'User',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: saving
                                ? null
                                : () => pickFromDate(setDialogState),
                            child: Text('From: $fromLabel'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: saving
                                ? null
                                : () => pickToDate(setDialogState),
                            child: Text('To: $toLabel'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: reasonController,
                      enabled: !saving,
                      decoration: const InputDecoration(
                        labelText: 'Reason',
                        border: OutlineInputBorder(),
                      ),
                      textInputAction: TextInputAction.done,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: saving ? null : () => Navigator.pop(dialogContext),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: saving
                      ? null
                      : () async {
                          final reason = reasonController.text.trim();
                          setDialogState(() => saving = true);
                          try {
                            final fmt = DateFormat('yyyy-MM-dd');
                            final res = await ApiClient.grantLeaveAdmin(
                              userId: selectedUser.id,
                              userName: selectedUser.name,
                              fromDate: fmt.format(fromDate),
                              toDate: fmt.format(toDate),
                              reason: reason.isEmpty ? 'Leave' : reason,
                            );
                            if (!mounted) return;
                            if (res['success'] == true) {
                              final bannerMessage =
                                  'Leave granted for ${selectedUser.name}: ${fmt.format(fromDate)} → ${fmt.format(toDate)}';
                              setState(() {
                                _leaveBanner = bannerMessage;
                                _leaveBannerFuture = Future.value(
                                  bannerMessage,
                                );
                              });
                              await AuthStorage.setLeaveGrantedBanner(
                                bannerMessage,
                              );
                              await _load();
                              showToast(
                                context,
                                'Leave granted',
                                variant: ToastVariant.success,
                              );
                              Navigator.pop(dialogContext);
                            } else {
                              showToast(
                                context,
                                res['error']?.toString() ??
                                    'Leave grant failed',
                                variant: ToastVariant.error,
                              );
                            }
                          } catch (_) {
                            if (!mounted) return;
                            showToast(
                              context,
                              'Leave grant failed',
                              variant: ToastVariant.error,
                            );
                          } finally {
                            if (mounted) setDialogState(() => saving = false);
                          }
                        },
                  child: saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Grant'),
                ),
              ],
            );
          },
        );
      },
    );

    reasonController.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;
    final store = StoreProvider.of<AppState>(context);
    final authUser = store.state.auth.user;
    final isAdmin =
        (authUser?['role']?.toString() ?? '').toLowerCase() == 'admin';

    final presentCount = _records
        .where((e) => _resolveStatus(e).toLowerCase() == 'present')
        .length;
    final absentCount = _records
        .where((e) => _resolveStatus(e).toLowerCase() == 'absent')
        .length;
    int activeLeaveCount = 0;
    final today = DateTime.now();
    for (final item in _leaveRequests) {
      final status = item['status']?.toString().toLowerCase() ?? '';
      if (status != 'approved') continue;
      final from = _tryParseDateOnly(item['from_date']);
      final to = _tryParseDateOnly(item['to_date']);
      if (from == null || to == null) continue;
      if (_dateInRange(today, from, to)) activeLeaveCount += 1;
    }

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
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      if (isAdmin)
                        MadButton(
                          text: _leaveGranting ? 'Loading...' : 'Leave',
                          icon: LucideIcons.calendarPlus,
                          disabled: _leaveGranting,
                          onPressed: _leaveGranting
                              ? null
                              : _openGrantLeaveDialog,
                        ),
                      MadButton(
                        text: _loading ? 'Loading...' : 'Refresh',
                        icon: LucideIcons.refreshCw,
                        disabled: _loading,
                        variant: ButtonVariant.outline,
                        onPressed: _loading
                            ? null
                            : () => _load(showToastOnError: true),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              FutureBuilder<String?>(
                future: _leaveBannerFuture,
                builder: (context, snapshot) {
                  final banner = (_leaveBanner?.trim().isNotEmpty ?? false)
                      ? _leaveBanner
                      : snapshot.data;
                  if (banner == null || banner.trim().isEmpty) {
                    return const SizedBox.shrink();
                  }
                  return Column(
                    children: [
                      MadCard(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              const Icon(
                                LucideIcons.badgeCheck,
                                color: Color(0xFF16A34A),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  banner,
                                  style: TextStyle(
                                    color: isDark
                                        ? AppTheme.darkForeground
                                        : AppTheme.lightForeground,
                                  ),
                                ),
                              ),
                              IconButton(
                                onPressed: () async {
                                  setState(() {
                                    _leaveBanner = null;
                                    _leaveBannerFuture = Future.value(null);
                                  });
                                  await AuthStorage.clearLeaveGrantedBanner();
                                },
                                icon: Icon(
                                  LucideIcons.x,
                                  size: 18,
                                  color: isDark
                                      ? AppTheme.darkMutedForeground
                                      : AppTheme.lightMutedForeground,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                  );
                },
              ),
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
                          (isDark
                                  ? const Color(0xFF065F46)
                                  : const Color(0xFFDCFCE7))
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
                          (isDark
                                  ? const Color(0xFF7F1D1D)
                                  : const Color(0xFFFEE2E2))
                              .withValues(alpha: isDark ? 0.35 : 1),
                    ),
                  ),
                  SizedBox(
                    width: isMobile ? double.infinity : 220,
                    height: 110,
                    child: StatCard(
                      title: 'Leave',
                      value: activeLeaveCount.toString(),
                      icon: LucideIcons.calendarX2,
                      iconColor: const Color(0xFFF59E0B),
                      iconBackgroundColor:
                          (isDark
                                  ? const Color(0xFF78350F)
                                  : const Color(0xFFFEF3C7))
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
                      item['project_id']?.toString() ??
                      item['projectId']?.toString();
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
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
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
                                          if (day != null && day.isNotEmpty)
                                            day,
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
    final fg = isDark
        ? AppTheme.darkMutedForeground
        : AppTheme.lightMutedForeground;

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
