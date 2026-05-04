import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class AuthStorage {
  static const _key = 'inventory_user';
  static const _selectedProjectKey = 'selected_project_id';
  static const _lastAttendanceIdKey = 'last_attendance_id';
  static const _lastAttendanceDateKey = 'last_attendance_date';
  static const _lastAttendanceUserKey = 'last_attendance_user';
  static const _lastAttendanceProjectKey = 'last_attendance_project';
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
