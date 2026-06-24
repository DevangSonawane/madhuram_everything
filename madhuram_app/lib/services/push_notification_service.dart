import 'dart:async';
import 'dart:math';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:redux/redux.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../store/app_state.dart';
import 'api_client.dart';
import 'notification_service.dart';

class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  static const String _deviceIdKey = 'push_device_id';
  static const String _registeredTokenKey = 'push_registered_fcm_token';
  static const String _webVapidKey = String.fromEnvironment('FCM_VAPID_KEY');

  StreamSubscription<AppState>? _storeSub;
  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _messageSub;
  StreamSubscription<RemoteMessage>? _messageOpenedSub;

  bool _firebaseReady = false;
  bool _listenersBound = false;
  String? _activeUserId;
  String? _activeAuthToken;
  String? _currentFcmToken;
  String? _deviceId;

  Future<void> initialize(Store<AppState> store) async {
    _storeSub?.cancel();
    _storeSub = store.onChange.listen((state) {
      _handleAuthStateChange(state.auth.user);
    });

    await _handleAuthStateChange(store.state.auth.user);
  }

  Future<void> dispose() async {
    _storeSub?.cancel();
    _storeSub = null;
    await _tokenRefreshSub?.cancel();
    _tokenRefreshSub = null;
    await _messageSub?.cancel();
    _messageSub = null;
    await _messageOpenedSub?.cancel();
    _messageOpenedSub = null;
    _firebaseReady = false;
    _listenersBound = false;
    _activeUserId = null;
    _activeAuthToken = null;
    _currentFcmToken = null;
    _deviceId = null;
  }

  Future<void> handleLogout() async {
    await _unregisterToken();
    _activeUserId = null;
    _activeAuthToken = null;
  }

  Future<void> _handleAuthStateChange(Map<String, dynamic>? user) async {
    final userId = _resolveUserId(user);
    final authToken = user?['token']?.toString();

    if (userId == _activeUserId && authToken == _activeAuthToken) {
      return;
    }

    _activeUserId = userId;
    _activeAuthToken = authToken;

    if (userId == null || userId.isEmpty || authToken == null || authToken.isEmpty) {
      await _unregisterToken();
      return;
    }

    if (!await _ensureFirebaseReady()) {
      return;
    }

    await _bindFirebaseListenersOnce();
    await _registerCurrentToken();
  }

  Future<bool> _ensureFirebaseReady() async {
    if (_firebaseReady) return true;
    _firebaseReady = true;
    return true;
  }

  Future<void> _bindFirebaseListenersOnce() async {
    if (_listenersBound) return;
    _listenersBound = true;

    final messaging = FirebaseMessaging.instance;
    await messaging.setAutoInitEnabled(true);

    _tokenRefreshSub = messaging.onTokenRefresh.listen((token) async {
      final userId = _activeUserId;
      final authToken = _activeAuthToken;
      if (userId == null || userId.isEmpty || authToken == null || authToken.isEmpty) {
        return;
      }
      await _registerToken(token);
    });

    _messageSub = FirebaseMessaging.onMessage.listen((message) {
      NotificationService.instance.refreshNotifications();
      debugPrint(
        '[PushNotificationService] Foreground message: '
        '${message.notification?.title ?? message.data['title'] ?? 'Notification'}',
      );
    });

    _messageOpenedSub = FirebaseMessaging.onMessageOpenedApp.listen((message) {
      NotificationService.instance.refreshNotifications();
      debugPrint(
        '[PushNotificationService] Notification opened: '
        '${message.notification?.title ?? message.data['title'] ?? 'Notification'}',
      );
    });
  }

  Future<void> _registerCurrentToken() async {
    if (!_firebaseReady) return;

    final messaging = FirebaseMessaging.instance;
    final permission = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
    );

    if (permission.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[PushNotificationService] Push permission denied.');
      return;
    }

    final token = await _getFcmToken(messaging);
    if (token == null || token.isEmpty) {
      debugPrint('[PushNotificationService] Unable to obtain FCM token.');
      return;
    }

    await _registerToken(token);
  }

  Future<String?> _getFcmToken(FirebaseMessaging messaging) async {
    try {
      if (kIsWeb && _webVapidKey.isNotEmpty) {
        return await messaging.getToken(vapidKey: _webVapidKey);
      }
      return await messaging.getToken();
    } catch (e) {
      debugPrint('[PushNotificationService] getToken failed: $e');
      return null;
    }
  }

  Future<void> _registerToken(String token) async {
    final userId = _activeUserId;
    final authToken = _activeAuthToken;
    if (userId == null || userId.isEmpty || authToken == null || authToken.isEmpty) {
      return;
    }

    final previousToken = await _getStoredRegisteredToken();
    if (previousToken != null &&
        previousToken.isNotEmpty &&
        previousToken != token) {
      await ApiClient.removeFcmToken(previousToken);
    }

    final response = await ApiClient.registerFcmToken(
      userId: userId,
      fcmToken: token,
      platform: _platformName,
      deviceId: await _getDeviceId(),
    );

    if (response['success'] == true) {
      _currentFcmToken = token;
      await _setStoredRegisteredToken(token);
      return;
    }

    debugPrint(
      '[PushNotificationService] Token registration failed: '
      '${response['error'] ?? response['status'] ?? 'unknown error'}',
    );
  }

  Future<void> _unregisterToken() async {
    final token = _currentFcmToken ?? await _getStoredRegisteredToken();
    if (token == null || token.isEmpty) {
      return;
    }

    await ApiClient.removeFcmToken(token);
    _currentFcmToken = null;
    await _clearStoredRegisteredToken();
  }

  static String? _resolveUserId(Map<String, dynamic>? user) {
    if (user == null) return null;
    final value = user['user_id'] ?? user['id'] ?? user['uid'];
    return value?.toString();
  }

  static String get _platformName {
    if (kIsWeb) return 'web';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.macOS:
        return 'macos';
      case TargetPlatform.windows:
        return 'windows';
      case TargetPlatform.linux:
        return 'linux';
      case TargetPlatform.fuchsia:
        return 'fuchsia';
    }
  }

  Future<String> _getDeviceId() async {
    if (_deviceId != null && _deviceId!.isNotEmpty) {
      return _deviceId!;
    }

    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_deviceIdKey);
    if (stored != null && stored.isNotEmpty) {
      _deviceId = stored;
      return stored;
    }

    final generated = _generateDeviceId();
    _deviceId = generated;
    await prefs.setString(_deviceIdKey, generated);
    return generated;
  }

  Future<void> _setStoredRegisteredToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_registeredTokenKey, token);
  }

  Future<String?> _getStoredRegisteredToken() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_registeredTokenKey);
    if (token != null && token.isNotEmpty) {
      return token;
    }
    return null;
  }

  Future<void> _clearStoredRegisteredToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_registeredTokenKey);
  }

  String _generateDeviceId() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return bytes
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
  }
}
