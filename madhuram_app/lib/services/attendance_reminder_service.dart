import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:redux/redux.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';

import '../store/app_state.dart';
import 'api_client.dart';

class AttendanceReminderService {
  AttendanceReminderService._();

  static final AttendanceReminderService instance =
      AttendanceReminderService._();

  static const Duration _pollInterval = Duration(minutes: 30);
  static const String _sentPrefix = 'attendance_reminder_sent_';

  Store<AppState>? _store;
  StreamSubscription<AppState>? _storeSub;
  Timer? _pollTimer;
  bool _running = false;
  String? _lastScopeKey;

  Future<void> initialize(Store<AppState> store) async {
    _store = store;
    _storeSub?.cancel();
    _storeSub = store.onChange.listen((state) {
      unawaited(_evaluateAndSendIfNeeded(state));
    });

    await _evaluateAndSendIfNeeded(store.state);
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(_pollInterval, (_) {
      final currentStore = _store;
      if (currentStore == null) return;
      unawaited(_evaluateAndSendIfNeeded(currentStore.state));
    });
  }

  Future<void> dispose() async {
    _storeSub?.cancel();
    _storeSub = null;
    _pollTimer?.cancel();
    _pollTimer = null;
    _store = null;
    _lastScopeKey = null;
    _running = false;
  }

  Future<void> _evaluateAndSendIfNeeded(AppState state) async {
    if (_running) return;
    final user = state.auth.user;
    final role = (user?['role']?.toString() ?? '').toLowerCase();
    if (role != 'admin' && role != 'operational_manager') {
      return;
    }

    final sentBy = _currentUserId(user);
    if (sentBy == null || sentBy.isEmpty) return;

    final projectId = state.project.selectedProjectId?.trim();
    final projectName = state.project.selectedProjectName?.trim();
    final scopeKey = projectId != null && projectId.isNotEmpty
        ? 'project:$projectId'
        : 'all';

    if (_lastScopeKey != scopeKey) {
      _lastScopeKey = scopeKey;
    }

    final todayKey = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final sentKey = '$_sentPrefix$scopeKey';
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getString(sentKey) == todayKey) {
      return;
    }

    _running = true;
    try {
      final recipients = await _resolveRecipients(projectId: projectId);
      if (recipients.isEmpty) {
        debugPrint(
          '[AttendanceReminderService] No pending users for scope=$scopeKey',
        );
        return;
      }

      final title = projectName == null || projectName.isEmpty
          ? 'Attendance reminder'
          : 'Attendance reminder: $projectName';
      final body = projectName == null || projectName.isEmpty
          ? 'Please complete your check-in for today.'
          : 'Please complete your check-in for $projectName today.';

      final result = await ApiClient.sendBulkPushNotification(
        userIds: recipients,
        title: title,
        body: body,
        type: 'attendance_reminder',
        entityType: 'attendance',
        entityId: projectId,
        data: {
          'reminder_type': 'attendance',
          'project_id': projectId,
          'project_name': projectName,
          'target_count': recipients.length,
          'scope': scopeKey,
        },
        sentBy: sentBy,
        sentByName: _currentUserDisplayName(user),
      );

      if (result['success'] == true) {
        await prefs.setString(sentKey, todayKey);
        debugPrint(
          '[AttendanceReminderService] Sent reminder to ${recipients.length} users',
        );
      } else {
        debugPrint(
          '[AttendanceReminderService] Send failed: ${result['error'] ?? result['status'] ?? 'unknown'}',
        );
      }
    } catch (e) {
      debugPrint('[AttendanceReminderService] Evaluation failed: $e');
    } finally {
      _running = false;
    }
  }

  Future<List<String>> _resolveRecipients({String? projectId}) async {
    final usersResult = await ApiClient.getUsers();
    if (usersResult['success'] != true) {
      debugPrint(
        '[AttendanceReminderService] Failed to load users: ${usersResult['error'] ?? usersResult['status'] ?? 'unknown'}',
      );
      return const [];
    }

    final usersData = usersResult['data'];
    final users = <Map<String, dynamic>>[];
    if (usersData is List) {
      for (final item in usersData) {
        if (item is Map<String, dynamic>) {
          users.add(item);
        } else if (item is Map) {
          users.add(Map<String, dynamic>.from(item));
        }
      }
    }

    final attendanceResult = projectId != null && projectId.isNotEmpty
        ? await ApiClient.getAttendanceByProject(projectId)
        : await ApiClient.getAllAttendance();
    final checkedInUserIds = <String>{};
    if (attendanceResult['success'] == true) {
      final data = attendanceResult['data'];
      if (data is List) {
        final todayKey = DateFormat('yyyy-MM-dd').format(DateTime.now());
        for (final item in data) {
          if (item is! Map) continue;
          final row = Map<String, dynamic>.from(item);
          final dateKey = _resolveAttendanceDate(row);
          if (dateKey != todayKey) continue;

          final itemProjectId =
              row['project_id']?.toString() ?? row['projectId']?.toString();
          if (projectId != null &&
              projectId.isNotEmpty &&
              itemProjectId != null &&
              itemProjectId.trim().isNotEmpty &&
              itemProjectId.trim() != projectId) {
            continue;
          }

          final userId =
              row['user_id']?.toString() ??
              row['userId']?.toString() ??
              row['id']?.toString();
          if (userId == null || userId.trim().isEmpty) continue;
          checkedInUserIds.add(userId.trim());
        }
      }
    }

    final eligible = users.where((user) {
      final role = (user['role']?.toString() ?? '').toLowerCase();
      if (role == 'admin') return false;

      final userId = _resolveUserId(user);
      if (userId == null || userId.isEmpty) return false;
      if (checkedInUserIds.contains(userId)) return false;

      if (projectId != null && projectId.isNotEmpty) {
        final projectList = user['project_list'];
        if (projectList is List) {
          final projects = projectList.map((e) => e.toString()).toList();
          if (projects.isNotEmpty && !projects.contains(projectId)) {
            return false;
          }
        }
      }

      return true;
    }).map((user) => _resolveUserId(user)!).toList();

    eligible.sort();
    return eligible;
  }

  String? _resolveAttendanceDate(Map<String, dynamic> item) {
    final direct = item['date']?.toString();
    if (direct != null && direct.trim().isNotEmpty) return direct.trim();
    for (final key in const [
      'check_in_date',
      'created_at',
      'updated_at',
      'check_in_time',
      'checkin_time',
    ]) {
      final value = item[key];
      if (value == null) continue;
      final parsed = DateTime.tryParse(value.toString().trim());
      if (parsed != null) {
        return DateFormat('yyyy-MM-dd').format(parsed);
      }
    }
    return null;
  }

  static String? _currentUserId(Map<String, dynamic>? user) {
    if (user == null) return null;
    return (user['user_id'] ?? user['id'] ?? user['uid'])?.toString();
  }

  static String? _currentUserDisplayName(Map<String, dynamic>? user) {
    if (user == null) return null;
    final name = user['name']?.toString();
    if (name != null && name.trim().isNotEmpty) return name.trim();
    final email = user['email']?.toString();
    if (email != null && email.trim().isNotEmpty) return email.trim();
    return _currentUserId(user);
  }

  static String? _resolveUserId(Map<String, dynamic> user) {
    final value = user['user_id'] ?? user['id'] ?? user['uid'];
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}
