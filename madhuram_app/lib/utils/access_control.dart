import '../constants/access_control_catalog.dart';

const alwaysAllowedPagePaths = <String>{'/profile', '/settings'};

Map<String, dynamic> buildDefaultAccessControl() {
  final pages = <String, bool>{};
  final functions = <String, bool>{};

  for (final page in accessControlCatalog) {
    pages[page.pagePath] = true;
    for (final fn in page.functions) {
      functions[fn.key] = true;
    }
  }

  return {'pages': pages, 'functions': functions};
}

Map<String, dynamic> normalizeAccessControl(dynamic rawAccessControl) {
  final fallback = buildDefaultAccessControl();

  final fallbackPages = Map<String, bool>.from(
    fallback['pages'] as Map<String, bool>,
  );
  final fallbackFunctions = Map<String, bool>.from(
    fallback['functions'] as Map<String, bool>,
  );

  final raw = rawAccessControl is Map ? rawAccessControl : <String, dynamic>{};
  final rawPages = raw['pages'];
  final rawFunctions = raw['functions'];

  if (rawPages is Map) {
    rawPages.forEach((key, value) {
      fallbackPages[key.toString()] = value == true;
    });
  }
  if (rawFunctions is Map) {
    rawFunctions.forEach((key, value) {
      fallbackFunctions[key.toString()] = value == true;
    });
  }

  return {'pages': fallbackPages, 'functions': fallbackFunctions};
}

String normalizeRouteForAccess(String route) {
  if (route.isEmpty || route == '/') return '/dashboard';
  if (accessControlPagePaths.contains(route)) return route;

  final segments = route.split('/').where((part) => part.isNotEmpty).toList();
  if (segments.isEmpty) {
    return '/dashboard';
  }
  final firstSegmentPath = '/${segments.first}';
  if (accessControlPagePaths.contains(firstSegmentPath))
    return firstSegmentPath;

  return route;
}

bool hasPageAccess(Map<String, dynamic>? user, String? pagePath) {
  if (pagePath == null || pagePath.isEmpty) return true;
  if (alwaysAllowedPagePaths.contains(pagePath)) return true;
  if (user?['role'] == 'admin') return true;

  final accessControl = user?['access_control'];
  if (accessControl is! Map) return true;
  final pages = accessControl['pages'];
  if (pages is! Map) return true;
  if (!pages.containsKey(pagePath)) return true;

  return pages[pagePath] == true;
}

bool hasFunctionAccess(Map<String, dynamic>? user, String? functionKey) {
  if (functionKey == null || functionKey.isEmpty) return true;
  if (user?['role'] == 'admin') return true;

  final accessControl = user?['access_control'];
  if (accessControl is! Map) return true;
  final functions = accessControl['functions'];
  if (functions is! Map) return true;
  if (!functions.containsKey(functionKey)) return true;

  return functions[functionKey] == true;
}

String? primaryFunctionKeyForPage(String? pagePath) {
  if (pagePath == null || pagePath.isEmpty) return null;
  final page = accessControlCatalog.where((p) => p.pagePath == pagePath);
  if (page.isEmpty) return null;
  final functions = page.first.functions;
  if (functions.isEmpty) return null;

  for (final fn in functions) {
    if (fn.key.endsWith('.view')) return fn.key;
  }
  return functions.first.key;
}

bool hasRouteAccess(Map<String, dynamic>? user, String? route) {
  if (route == null || route.isEmpty) return true;

  final normalizedRoute = normalizeRouteForAccess(route);
  if (!hasPageAccess(user, normalizedRoute)) return false;
  if (alwaysAllowedPagePaths.contains(normalizedRoute)) return true;

  final functionKey = primaryFunctionKeyForPage(normalizedRoute);
  if (functionKey == null) return true;
  return hasFunctionAccess(user, functionKey);
}
