import 'dart:async';

import 'package:redux/redux.dart';

import '../store/app_state.dart';
import '../store/auth_actions.dart';
import 'access_control_store.dart';
import 'api_client.dart';
import 'auth_storage.dart';

class AuthRefreshService {
  AuthRefreshService._();
  static final AuthRefreshService instance = AuthRefreshService._();

  Store<AppState>? _store;
  StreamSubscription<AppState>? _storeSub;
  Timer? _refreshTimer;

  String? _activeUserId;
  String? _activeToken;
  int _refreshGeneration = 0;

  Future<void> initialize(Store<AppState> store) async {
    _store = store;
    _storeSub?.cancel();
    _storeSub = store.onChange.listen((state) {
      _handleAuthStateChange(state.auth.user);
    });

    _handleAuthStateChange(store.state.auth.user);
  }

  Future<void> dispose() async {
    _storeSub?.cancel();
    _storeSub = null;
    _refreshTimer?.cancel();
    _refreshTimer = null;
    _store = null;
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
    final store = _store;
    if (store == null) return;
    final generationAtStart = _refreshGeneration;

    final current = store.state.auth.user;
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

    final attendanceBlockResult =
        await ApiClient.getResolvedAttendanceBlockStatus({
          ...data,
          'token': token,
        });
    if (!force && generationAtStart != _refreshGeneration) {
      return;
    }
    final mergedUser = {
      ...data,
      'token': token,
      'attendance_blocked': attendanceBlockResult['blocked'] == true,
      'attendance_block_released': attendanceBlockResult['released'] == true,
      if (attendanceBlockResult['reason'] != null &&
          attendanceBlockResult['reason'].toString().trim().isNotEmpty)
        'attendance_block_reason': attendanceBlockResult['reason']
            .toString()
            .trim(),
      'attendance_block_history': attendanceBlockResult['history'] ?? const [],
    };
    final resolvedUser = AccessControlStore.resolveUserAccessControl(
      mergedUser,
      accessControl: accessControl,
    );

    await AuthStorage.setUser(resolvedUser);
    if (force || generationAtStart == _refreshGeneration) {
      store.dispatch(LoginSuccess(resolvedUser));
    }
  }

  Future<void> forceRefreshUser() async {
    await refreshUser(force: true);
  }
}
