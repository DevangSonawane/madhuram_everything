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
  }

  void _handleAuthStateChange(Map<String, dynamic>? user) {
    final userId = _resolveUserId(user);
    final token = user?['token']?.toString();

    if (userId == _activeUserId && token == _activeToken) {
      return;
    }

    _activeUserId = userId;
    _activeToken = token;

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

  Future<void> refreshUser() async {
    final store = _store;
    if (store == null) return;

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

    final accessResult = await ApiClient.getAccessUser(userId);
    final accessControl = (accessResult['success'] == true &&
            accessResult['data'] is Map<String, dynamic>)
        ? Map<String, dynamic>.from(accessResult['data'] as Map)
        : null;

    final mergedUser = {...data, 'token': token};
    final resolvedUser = AccessControlStore.resolveUserAccessControl(
      mergedUser,
      accessControl: accessControl,
    );

    await AuthStorage.setUser(resolvedUser);
    store.dispatch(LoginSuccess(resolvedUser));
  }
}
