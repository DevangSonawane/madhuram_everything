import '../constants/access_control_catalog.dart';

const alwaysAllowedPagePaths = <String>{
  '/profile',
  '/settings',
  '/attendance',
};

Map<String, dynamic> buildNoAccessControl() {
  final pages = <String, bool>{};
  final functions = <String, bool>{};

  for (final page in accessControlCatalog) {
    pages[page.pagePath] = false;
    for (final fn in page.functions) {
      functions[fn.key] = false;
    }
  }

  return {'pages': pages, 'functions': functions};
}

Map<String, dynamic> buildDefaultAccessControl() {
  return buildNoAccessControl();
}

Map<String, dynamic> normalizeAccessControl(dynamic rawAccessControl) {
  final fallback = buildNoAccessControl();

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
      final rawKey = key.toString();
      final normalizedKey =
          rawKey.startsWith('/') ? rawKey : '/${rawKey.trim()}';
      fallbackPages[normalizedKey] = value == true;
    });
  }
  if (rawPages is Map && rawPages.containsKey('/')) {
    fallbackPages['/dashboard'] = rawPages['/'] == true;
  }
  if (rawPages is Map && rawPages.containsKey('/dashboard')) {
    fallbackPages['/dashboard'] = rawPages['/dashboard'] == true;
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
  if (segments.isEmpty) return '/dashboard';

  final fullPath = '/${segments.join('/')}';
  if (accessControlPagePaths.contains(fullPath)) return fullPath;

  if (segments.length > 1) {
    final twoSegmentPath = '/${segments.take(2).join('/')}';
    if (accessControlPagePaths.contains(twoSegmentPath)) return twoSegmentPath;
  }

  if (segments.length > 2) {
    final secondThirdPath = '/${segments[1]}/${segments[2]}';
    if (accessControlPagePaths.contains(secondThirdPath)) return secondThirdPath;
  }

  if (segments.length > 1) {
    final secondSegmentPath = '/${segments[1]}';
    if (accessControlPagePaths.contains(secondSegmentPath)) return secondSegmentPath;
  }

  final firstSegmentPath = '/${segments.first}';
  if (accessControlPagePaths.contains(firstSegmentPath)) return firstSegmentPath;

  return '/dashboard';
}

bool hasPageAccess(Map<String, dynamic>? user, String? pagePath) {
  if (pagePath == null || pagePath.isEmpty) return true;
  if (alwaysAllowedPagePaths.contains(pagePath)) return true;
  if (user?['role'] == 'admin') return true;

  final accessControl = user?['access_control'];
  if (accessControl is! Map) return false;
  final pages = accessControl['pages'];
  if (pages is! Map) return false;
  if (!pages.containsKey(pagePath)) return false;

  return pages[pagePath] == true;
}

bool hasFunctionAccess(Map<String, dynamic>? user, String? functionKey) {
  if (functionKey == null || functionKey.isEmpty) return true;
  if (user?['role'] == 'admin') return true;

  final accessControl = user?['access_control'];
  if (accessControl is! Map) return false;
  final functions = accessControl['functions'];
  if (functions is! Map) return false;
  if (!functions.containsKey(functionKey)) return false;

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
