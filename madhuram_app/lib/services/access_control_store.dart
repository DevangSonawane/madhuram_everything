import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class AccessControlStore {
  static const _storageKey = 'inventory_access_control_overrides';

  static Map<String, dynamic> _safeParseMap(String? value) {
    if (value == null || value.isEmpty) return <String, dynamic>{};
    try {
      final parsed = jsonDecode(value);
      if (parsed is Map<String, dynamic>) {
        return parsed;
      }
      return <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  static Future<Map<String, dynamic>> getAllAccessControlOverrides() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    return _safeParseMap(raw);
  }

  static Future<Map<String, dynamic>?> getUserAccessControlOverride(
    String? userId,
  ) async {
    if (userId == null || userId.isEmpty) return null;
    final all = await getAllAccessControlOverrides();
    final override = all[userId];
    if (override is Map<String, dynamic>) {
      return override;
    }
    return null;
  }

  static Future<void> saveUserAccessControlOverride(
    String userId,
    Map<String, dynamic> accessControl,
  ) async {
    if (userId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final all = await getAllAccessControlOverrides();
    all[userId] = accessControl;
    await prefs.setString(_storageKey, jsonEncode(all));
  }

  static Future<Map<String, dynamic>> resolveUserAccessControl(
    Map<String, dynamic> user,
  ) async {
    final userId = (user['user_id'] ?? user['id'] ?? '').toString();
    if (userId.isEmpty) return user;

    final override = await getUserAccessControlOverride(userId);
    if (override == null) return user;

    return {...user, 'access_control': override};
  }
}
