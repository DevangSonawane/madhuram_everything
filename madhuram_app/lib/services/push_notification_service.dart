import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
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
  static const AndroidNotificationChannel _androidChannel =
      AndroidNotificationChannel(
    'madhuram_high_importance',
    'Madhuram notifications',
    description: 'Push notifications and attendance reminders',
    importance: Importance.high,
  );
  static const String _webVapidKey = String.fromEnvironment(
    'FCM_VAPID_KEY',
    defaultValue: 'dRRFHUoe28ZA1uCYjBB5GyCE2cUEszpS1_73Dd2N6YY',
  );

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  StreamSubscription<AppState>? _storeSub;
  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _messageSub;
  StreamSubscription<RemoteMessage>? _messageOpenedSub;

  bool _firebaseReady = false;
  bool _listenersBound = false;
  bool _localNotificationsReady = false;
  String? _activeUserId;
  String? _activeAuthToken;
  String? _currentFcmToken;
  String? _deviceId;
  GlobalKey<NavigatorState>? _navigatorKey;
  String? _pendingRoute;
  Map<String, dynamic>? _pendingRouteArguments;

  Future<void> initialize(Store<AppState> store) async {
    debugPrint('[PushNotificationService] initialize()');
    _storeSub?.cancel();
    _storeSub = store.onChange.listen((state) {
      debugPrint('[PushNotificationService] store changed, checking auth state');
      _handleAuthStateChange(state.auth.user);
    });

    await _ensureLocalNotificationsReady();
    await _handleAuthStateChange(store.state.auth.user);
    await _processPendingNavigation();
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
    _localNotificationsReady = false;
    _activeUserId = null;
    _activeAuthToken = null;
    _currentFcmToken = null;
    _deviceId = null;
    _pendingRoute = null;
    _pendingRouteArguments = null;
  }

  void setNavigatorKey(GlobalKey<NavigatorState> navigatorKey) {
    _navigatorKey = navigatorKey;
  }

  Future<void> handleLogout() async {
    debugPrint('[PushNotificationService] handleLogout()');
    await _unregisterToken();
    _activeUserId = null;
    _activeAuthToken = null;
    _pendingRoute = null;
    _pendingRouteArguments = null;
  }

  Future<void> flushPendingNavigation() async {
    await _processPendingNavigation();
  }

  Future<void> _handleAuthStateChange(Map<String, dynamic>? user) async {
    final userId = _resolveUserId(user);
    final authToken = _resolveAuthToken(user);
    debugPrint(
      '[PushNotificationService] auth state userId=${userId ?? "null"} '
      'token=${authToken == null ? "null" : "present"}',
    );

    if (userId == _activeUserId && authToken == _activeAuthToken) {
      debugPrint('[PushNotificationService] auth unchanged, skipping');
      return;
    }

    _activeUserId = userId;
    _activeAuthToken = authToken;

    if (userId == null || userId.isEmpty || authToken == null || authToken.isEmpty) {
      debugPrint('[PushNotificationService] missing user or auth token, unregistering');
      await _unregisterToken();
      return;
    }

    if (!await _ensureFirebaseReady()) {
      return;
    }

    await _bindFirebaseListenersOnce();
    await _handleInitialMessage();
    await _registerCurrentToken();
  }

  Future<bool> _ensureFirebaseReady() async {
    if (_firebaseReady) return true;
    debugPrint('[PushNotificationService] marking Firebase ready');
    _firebaseReady = true;
    return true;
  }

  Future<void> _bindFirebaseListenersOnce() async {
    if (_listenersBound) return;
    _listenersBound = true;
    debugPrint('[PushNotificationService] binding Firebase listeners');

    final messaging = FirebaseMessaging.instance;
    await messaging.setAutoInitEnabled(true);
    await _ensureLocalNotificationsReady();

    _tokenRefreshSub = messaging.onTokenRefresh.listen((token) async {
      final userId = _activeUserId;
      final authToken = _activeAuthToken;
      if (userId == null || userId.isEmpty || authToken == null || authToken.isEmpty) {
        return;
      }
      await _registerToken(token);
    });

    _messageSub = FirebaseMessaging.onMessage.listen((message) {
      unawaited(_handleForegroundMessage(message));
    });

    _messageOpenedSub = FirebaseMessaging.onMessageOpenedApp.listen((message) {
      unawaited(_handleNotificationOpen(message, source: 'background'));
    });
  }

  Future<void> _ensureLocalNotificationsReady() async {
    if (_localNotificationsReady) return;

    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (response) {
        unawaited(_handleLocalNotificationResponse(response));
      },
    );

    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_androidChannel);

    _localNotificationsReady = true;

    final launchDetails = await _localNotifications.getNotificationAppLaunchDetails();
    final response = launchDetails?.notificationResponse;
    if (launchDetails?.didNotificationLaunchApp == true &&
        response?.payload != null &&
        response!.payload!.isNotEmpty) {
      await _handleLocalNotificationResponse(response);
    }
  }

  Future<void> _handleInitialMessage() async {
    try {
      final message = await FirebaseMessaging.instance.getInitialMessage();
      if (message == null) return;
      await _handleNotificationOpen(message, source: 'terminated');
    } catch (e) {
      debugPrint('[PushNotificationService] getInitialMessage failed: $e');
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    NotificationService.instance.refreshNotifications();
    debugPrint(
      '[PushNotificationService] Foreground message: ${_messageTitle(message)}',
    );
    await _showLocalNotification(message);
  }

  Future<void> _handleNotificationOpen(
    RemoteMessage message, {
    required String source,
  }) async {
    NotificationService.instance.refreshNotifications();
    debugPrint(
      '[PushNotificationService] Notification opened ($source): '
      '${_messageTitle(message)}',
    );
    await _navigateForMessage(message);
  }

  Future<void> _handleLocalNotificationResponse(
    NotificationResponse response,
  ) async {
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;

    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map<String, dynamic>) {
        await _navigateFromPayload(decoded);
      }
    } catch (e) {
      debugPrint('[PushNotificationService] Failed to parse local payload: $e');
    }
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    if (kIsWeb) return;
    if (!_localNotificationsReady) {
      await _ensureLocalNotificationsReady();
    }

    final title = _messageTitle(message);
    final body = _messageBody(message);
    final payload = jsonEncode({
      'route': _resolveRoute(message),
      'data': message.data,
    });

    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannel.id,
        _androidChannel.name,
        channelDescription: _androidChannel.description,
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
        playSound: true,
      ),
    );

    await _localNotifications.show(
      _stableNotificationId(message),
      title,
      body,
      details,
      payload: payload,
    );
  }

  Future<void> _registerCurrentToken() async {
    if (!_firebaseReady) return;

    final messaging = FirebaseMessaging.instance;
    debugPrint('[PushNotificationService] requesting notification permission');

    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      final androidPermission = await Permission.notification.request();
      debugPrint(
        '[PushNotificationService] Android permission status: '
        '${androidPermission.isGranted ? "granted" : androidPermission.toString()}',
      );
      if (!androidPermission.isGranted) {
        debugPrint('[PushNotificationService] Android notification permission denied.');
        return;
      }
    }

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
    debugPrint(
      '[PushNotificationService] FCM permission status: '
      '${permission.authorizationStatus}',
    );

    final token = await _getFcmToken(messaging);
    if (token == null || token.isEmpty) {
      debugPrint('[PushNotificationService] Unable to obtain FCM token.');
      return;
    }
    debugPrint('[PushNotificationService] obtained FCM token');
    debugPrint('[PushNotificationService] FCM token: $token');

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
      debugPrint('[PushNotificationService] token registration skipped, no active auth');
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
      debugPrint('[PushNotificationService] token registration success');
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
      debugPrint('[PushNotificationService] unregister skipped, no token stored');
      return;
    }

    debugPrint('[PushNotificationService] unregistering stored token');
    await ApiClient.removeFcmToken(token);
    _currentFcmToken = null;
    await _clearStoredRegisteredToken();
  }

  Future<void> _navigateForMessage(RemoteMessage message) async {
    await _navigateFromPayload({
      'route': _resolveRoute(message),
      'data': message.data,
    });
  }

  Future<void> _navigateFromPayload(Map<String, dynamic> payload) async {
    final route = payload['route']?.toString().trim() ?? '';
    if (route.isEmpty) return;

    final navigator = _navigatorKey?.currentState;
    if (navigator == null) {
      _pendingRoute = route;
      final data = payload['data'];
      _pendingRouteArguments = data is Map<String, dynamic>
          ? data
          : data is Map
              ? Map<String, dynamic>.from(data)
              : <String, dynamic>{};
      return;
    }

    navigator.pushNamed(route, arguments: payload['data']);
  }

  Future<void> _processPendingNavigation() async {
    final route = _pendingRoute;
    if (route == null || route.isEmpty) return;

    final navigator = _navigatorKey?.currentState;
    if (navigator == null) return;

    final arguments = _pendingRouteArguments ?? const <String, dynamic>{};
    _pendingRoute = null;
    _pendingRouteArguments = null;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigatorKey?.currentState?.pushNamed(route, arguments: arguments);
    });
  }

  static String? _resolveUserId(Map<String, dynamic>? user) {
    if (user == null) return null;
    final value = user['user_id'] ?? user['id'] ?? user['uid'];
    return value?.toString();
  }

  static String? _resolveAuthToken(Map<String, dynamic>? user) {
    if (user == null) return null;

    final direct = user['token'] ?? user['access_token'] ?? user['accessToken'];
    if (direct is String && direct.trim().isNotEmpty) {
      return direct;
    }

    final nested = user['data'];
    if (nested is Map) {
      final nestedToken =
          nested['token'] ?? nested['access_token'] ?? nested['accessToken'];
      if (nestedToken is String && nestedToken.trim().isNotEmpty) {
        return nestedToken;
      }
    }

    return null;
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

  String _messageTitle(RemoteMessage message) {
    return message.notification?.title ??
        message.data['title']?.toString() ??
        'Notification';
  }

  String _messageBody(RemoteMessage message) {
    return message.notification?.body ?? message.data['body']?.toString() ?? '';
  }

  int _stableNotificationId(RemoteMessage message) {
    final candidate = message.messageId ??
        '${_messageTitle(message)}-${_messageBody(message)}-${DateTime.now().millisecondsSinceEpoch}';
    return candidate.hashCode & 0x7fffffff;
  }

  String _resolveRoute(RemoteMessage message) {
    final data = message.data;
    final explicitRoute =
        data['route']?.toString() ??
        data['screen_route']?.toString() ??
        data['navigate_to']?.toString();
    if (explicitRoute != null && explicitRoute.trim().isNotEmpty) {
      return explicitRoute.trim();
    }

    final type = data['type']?.toString().toLowerCase();
    final entityType = data['entity_type']?.toString().toLowerCase();
    final reminderType = data['reminder_type']?.toString().toLowerCase();
    if (type == 'attendance_reminder' ||
        reminderType == 'attendance' ||
        entityType == 'attendance') {
      return '/attendance/my';
    }

    return '/dashboard';
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
