import '../utils/access_control.dart';

class AccessControlStore {
  static Map<String, dynamic>? _extractAccessControl(
    Map<String, dynamic> source,
  ) {
    if (source['access_control'] is Map<String, dynamic>) {
      return Map<String, dynamic>.from(
        source['access_control'] as Map<String, dynamic>,
      );
    }

    if (source['page_map'] is Map || source['function_map'] is Map) {
      return {
        'pages': source['page_map'] ?? <String, dynamic>{},
        'functions': source['function_map'] ?? <String, dynamic>{},
      };
    }

    if (source['pages'] is Map || source['functions'] is Map) {
      return {
        'pages': source['pages'] ?? <String, dynamic>{},
        'functions': source['functions'] ?? <String, dynamic>{},
      };
    }

    return null;
  }

  static Map<String, dynamic> resolveUserAccessControl(
    Map<String, dynamic> user, {
    Map<String, dynamic>? accessControl,
  }) {
    final source = accessControl != null
        ? (_extractAccessControl(accessControl) ?? accessControl)
        : _extractAccessControl(user);
    if (source == null) return user;

    final normalized = normalizeAccessControl(source);
    return {...user, 'access_control': normalized};
  }
}
