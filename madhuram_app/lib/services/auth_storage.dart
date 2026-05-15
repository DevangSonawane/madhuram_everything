import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class AuthStorage {
  static const _key = 'inventory_user';
  static const _selectedProjectKey = 'selected_project_id';
  static const _lastAttendanceIdKey = 'last_attendance_id';
  static const _lastAttendanceDateKey = 'last_attendance_date';
  static const _lastAttendanceUserKey = 'last_attendance_user';
  static const _lastAttendanceProjectKey = 'last_attendance_project';
  static const _dailyAttendanceByProjectKey = 'daily_attendance_by_project_v1';
  static const _leaveBannerKey = 'leave_granted_banner';

  static Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_key);
    if (value == null) return null;
    try {
      return jsonDecode(value) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<void> setUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(user));
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
    await prefs.remove(_selectedProjectKey);
    await prefs.remove(_lastAttendanceIdKey);
    await prefs.remove(_lastAttendanceDateKey);
    await prefs.remove(_lastAttendanceUserKey);
    await prefs.remove(_lastAttendanceProjectKey);
    await prefs.remove(_dailyAttendanceByProjectKey);
    await prefs.remove(_leaveBannerKey);
  }

  static Future<String?> getToken() async {
    final user = await getUser();
    if (user == null) return null;
    final direct = user['token'] ?? user['access_token'] ?? user['accessToken'];
    if (direct is String && direct.trim().isNotEmpty) return direct;
    final nested = user['data'];
    if (nested is Map) {
      final dataToken =
          nested['token'] ?? nested['access_token'] ?? nested['accessToken'];
      if (dataToken is String && dataToken.trim().isNotEmpty) return dataToken;
    }
    return null;
  }

  static Future<bool> hasUser() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(_key);
  }

  // ============================================================================
  // Selected Project Persistence (like React app's localStorage)
  // ============================================================================
  static Future<void> setSelectedProjectId(String projectId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_selectedProjectKey, projectId);
  }

  static Future<String?> getSelectedProjectId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_selectedProjectKey);
  }

  static Future<void> clearSelectedProject() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_selectedProjectKey);
  }

  // ============================================================================
  // Attendance Persistence
  // ============================================================================
  static Future<void> setLastAttendanceContext({
    required String attendanceId,
    required String date,
    String? userId,
    String? projectId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lastAttendanceIdKey, attendanceId);
    await prefs.setString(_lastAttendanceDateKey, date);
    if (userId != null && userId.trim().isNotEmpty) {
      await prefs.setString(_lastAttendanceUserKey, userId);
    } else {
      await prefs.remove(_lastAttendanceUserKey);
    }
    if (projectId != null && projectId.trim().isNotEmpty) {
      await prefs.setString(_lastAttendanceProjectKey, projectId);
    } else {
      await prefs.remove(_lastAttendanceProjectKey);
    }
  }

  static Future<Map<String, String?>> getLastAttendanceContext() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'attendance_id': prefs.getString(_lastAttendanceIdKey),
      'date': prefs.getString(_lastAttendanceDateKey),
      'user_id': prefs.getString(_lastAttendanceUserKey),
      'project_id': prefs.getString(_lastAttendanceProjectKey),
    };
  }

  static Future<void> clearLastAttendanceContext() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_lastAttendanceIdKey);
    await prefs.remove(_lastAttendanceDateKey);
    await prefs.remove(_lastAttendanceUserKey);
    await prefs.remove(_lastAttendanceProjectKey);
  }

  // ============================================================================
  // Attendance Persistence (Per Project, Per Day)
  // ============================================================================
  // Shape:
  // {
  //   "<userId>": {
  //     "<yyyy-MM-dd>": {
  //       "<projectId>": { "attendance_id": "...", "checked_out": true/false }
  //     }
  //   }
  // }
  static Future<Map<String, dynamic>> _getDailyAttendanceMap() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_dailyAttendanceByProjectKey);
    if (raw == null || raw.trim().isEmpty) return {};
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {
      // ignore
    }
    return {};
  }

  static Future<void> _setDailyAttendanceMap(Map<String, dynamic> value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dailyAttendanceByProjectKey, jsonEncode(value));
  }

  static Future<Map<String, dynamic>?> getDailyAttendanceEntry({
    required String userId,
    required String date,
    required String projectId,
  }) async {
    if (userId.trim().isEmpty || date.trim().isEmpty || projectId.trim().isEmpty)
      return null;
    final map = await _getDailyAttendanceMap();
    final userNode = map[userId];
    if (userNode is! Map) return null;
    final dateNode = userNode[date];
    if (dateNode is! Map) return null;
    final projectNode = dateNode[projectId];
    if (projectNode is! Map) return null;
    return Map<String, dynamic>.from(projectNode);
  }

  static Future<void> setDailyAttendanceEntry({
    required String userId,
    required String date,
    required String projectId,
    required String attendanceId,
    bool checkedOut = false,
  }) async {
    if (userId.trim().isEmpty ||
        date.trim().isEmpty ||
        projectId.trim().isEmpty ||
        attendanceId.trim().isEmpty) {
      return;
    }
    final map = await _getDailyAttendanceMap();
    final userNode = (map[userId] is Map)
        ? Map<String, dynamic>.from(map[userId] as Map)
        : <String, dynamic>{};
    final dateNode = (userNode[date] is Map)
        ? Map<String, dynamic>.from(userNode[date] as Map)
        : <String, dynamic>{};
    dateNode[projectId] = {
      'attendance_id': attendanceId,
      'checked_out': checkedOut,
    };
    userNode[date] = dateNode;
    map[userId] = userNode;
    await _setDailyAttendanceMap(map);
  }

  static Future<void> clearDailyAttendanceForDate({
    required String userId,
    required String date,
  }) async {
    if (userId.trim().isEmpty || date.trim().isEmpty) return;
    final map = await _getDailyAttendanceMap();
    final userNode = map[userId];
    if (userNode is! Map) return;
    final nextUserNode = Map<String, dynamic>.from(userNode);
    nextUserNode.remove(date);
    map[userId] = nextUserNode;
    await _setDailyAttendanceMap(map);
  }

  // ============================================================================
  // Leave Banner Persistence
  // ============================================================================
  static Future<void> setLeaveGrantedBanner(String message) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_leaveBannerKey, message);
  }

  static Future<String?> getLeaveGrantedBanner() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_leaveBannerKey);
  }

  static Future<void> clearLeaveGrantedBanner() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_leaveBannerKey);
  }
}
