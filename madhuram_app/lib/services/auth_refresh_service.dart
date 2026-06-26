import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'access_control_store.dart';
import 'api_client.dart';
import 'auth_storage.dart';
import '../providers/legacy_session_providers.dart';
import '../utils/state_signature.dart';

class AuthRefreshService {
  AuthRefreshService._();
  static final AuthRefreshService instance = AuthRefreshService._();

  ProviderContainer? _container;
  ProviderSubscription<AuthSessionView>? _authSubscription;
  Timer? _refreshTimer;

  String? _activeUserId;
  String? _activeToken;
  int _refreshGeneration = 0;

  Future<void> initialize(ProviderContainer container) async {
    _container = container;
    _authSubscription?.close();
    _authSubscription = container.listen<AuthSessionView>(
      authSessionProvider,
      (_, next) => _handleAuthStateChange(next.user),
    );

    _handleAuthStateChange(container.read(authSessionProvider).user);
  }

  Future<void> dispose() async {
    _authSubscription?.close();
    _authSubscription = null;
    _refreshTimer?.cancel();
    _refreshTimer = null;
    _container = null;
    _activeUserId = null;
    _activeToken = null;
    _refreshGeneration += 1;
  }

  void _handleAuthStateChange(Map<String, dynamic>? user) {
    final userId = _resolveUserId(user);
    final token = user?['token']?.toString();

    if (userId == _activeUserId && token == _activeToken) {
      return;
    }

    _activeUserId = userId;
    _activeToken = token;
    _refreshGeneration += 1;

    _refreshTimer?.cancel();
    _refreshTimer = null;

    if (userId == null || userId.isEmpty || token == null || token.isEmpty) {
      return;
    }

    _refreshTimer = Timer.periodic(
      const Duration(seconds: 2),
      (_) => refreshUser(),
    );

    // Immediate refresh to pick up newly assigned projects.
    refreshUser();
  }

  String? _resolveUserId(Map<String, dynamic>? user) {
    return user?['user_id']?.toString() ??
        user?['id']?.toString() ??
        user?['uid']?.toString();
  }

  Future<void> refreshUser({bool force = false}) async {
    final container = _container;
    if (container == null) return;
    final generationAtStart = _refreshGeneration;

    final current = container.read(authSessionProvider).user;
    final userId = _resolveUserId(current);
    final token = current?['token']?.toString();
    if (userId == null || userId.isEmpty || token == null || token.isEmpty) {
      return;
    }

    final userResult = await ApiClient.getUserById(userId);
    if (userResult['success'] != true) {
      return;
    }

    final data = userResult['data'];
    if (data is! Map<String, dynamic>) {
      return;
    }

    if (!force && generationAtStart != _refreshGeneration) {
      return;
    }

    final accessResult = await ApiClient.getAccessUser(userId);
    final accessControl =
        (accessResult['success'] == true &&
            accessResult['data'] is Map<String, dynamic>)
        ? Map<String, dynamic>.from(accessResult['data'] as Map)
        : null;

    if (!force && generationAtStart != _refreshGeneration) {
      return;
    }

    final currentUser = current ?? <String, dynamic>{};
    final mergedUser = {
      ...currentUser,
      ...data,
      'token': token,
    };
    final resolvedUser = AccessControlStore.resolveUserAccessControl(
      mergedUser,
      accessControl: accessControl,
    );

    if (sameMapState(current, resolvedUser)) {
      return;
    }

    await AuthStorage.setUser(resolvedUser);
    if (force || generationAtStart == _refreshGeneration) {
      container.read(authSessionProvider.notifier).sync(resolvedUser);
    }
  }

  Future<void> forceRefreshUser() async {
    await refreshUser(force: true);
  }
}
