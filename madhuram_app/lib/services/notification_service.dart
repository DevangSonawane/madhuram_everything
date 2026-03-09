import 'dart:async';
import 'dart:convert';

import 'package:redux/redux.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../store/app_state.dart';
import '../store/notification_actions.dart';
import 'api_client.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();
  static const bool _enableRealtimeSocket = bool.fromEnvironment(
    'ENABLE_DASHBOARD_SOCKET',
    defaultValue: false,
  );

  Store<AppState>? _store;
  StreamSubscription<AppState>? _storeSub;
  WebSocketChannel? _channel;
  StreamSubscription? _socketSub;
  Timer? _heartbeat;
  Timer? _pollTimer;
  Timer? _reconnectTimer;

  String? _activeUserId;
  String? _activeToken;

  Future<void> initialize(Store<AppState> store) async {
    _store = store;
    _storeSub?.cancel();
    _storeSub = store.onChange.listen((state) {
      _handleAuthStateChange(state.auth.user);
    });

    await _handleAuthStateChange(store.state.auth.user);
    _startPolling();
  }

  Future<void> dispose() async {
    _storeSub?.cancel();
    _storeSub = null;
    _pollTimer?.cancel();
    _pollTimer = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _disconnectSocket();
    _store = null;
    _activeUserId = null;
    _activeToken = null;
  }

  Future<void> refreshNotifications() async {
    final store = _store;
    if (store == null) return;

    final user = store.state.auth.user;
    final userId = _resolveUserId(user);
    if (userId == null || userId.isEmpty) {
      store.dispatch(FetchNotificationsSuccess(const []));
      return;
    }

    store.dispatch(FetchNotificationsStart());
    final result = await ApiClient.getNotifications(
      userId: userId,
      limit: 30,
      offset: 0,
    );
    if (result['success'] != true) {
      store.dispatch(FetchNotificationsSuccess(const []));
      return;
    }

    final data = result['data'];
    final payloadList = _extractNotifications(data);
    final items = payloadList.map(_toNotificationItem).toList();
    store.dispatch(FetchNotificationsSuccess(items));
  }

  Future<void> markAsRead(String notificationId) async {
    final store = _store;
    if (store == null || notificationId.isEmpty) return;
    store.dispatch(MarkNotificationAsRead(notificationId));
    final result = await ApiClient.markNotificationRead(notificationId);
    if (result['success'] != true) {
      await refreshNotifications();
    }
  }

  Future<void> markAllAsRead() async {
    final store = _store;
    if (store == null) return;
    final userId = _resolveUserId(store.state.auth.user);
    if (userId == null || userId.isEmpty) return;
    store.dispatch(MarkAllNotificationsAsRead());
    final result = await ApiClient.markAllNotificationsRead(userId: userId);
    if (result['success'] != true) {
      await refreshNotifications();
    }
  }

  Future<void> deleteNotification(String notificationId) async {
    final store = _store;
    if (store == null || notificationId.isEmpty) return;
    store.dispatch(RemoveNotification(notificationId));
    final result = await ApiClient.deleteNotification(notificationId);
    if (result['success'] != true) {
      await refreshNotifications();
    }
  }

  Future<void> _handleAuthStateChange(Map<String, dynamic>? user) async {
    final userId = _resolveUserId(user);
    final token = user?['token']?.toString();

    if (userId == _activeUserId && token == _activeToken) {
      return;
    }

    _activeUserId = userId;
    _activeToken = token;

    if (userId == null || userId.isEmpty || token == null || token.isEmpty) {
      _disconnectSocket();
      _store?.dispatch(ClearNotifications());
      return;
    }

    await refreshNotifications();
    _connectSocket();
  }

  void _connectSocket() {
    if (!_enableRealtimeSocket) return;
    _disconnectSocket();

    final userId = _activeUserId;
    final token = _activeToken;
    if (userId == null || token == null) return;

    final socketUrl = ApiClient.getDashboardSocketUrl(
      userId: userId,
      token: token,
    );
    if (socketUrl == null || socketUrl.isEmpty) return;
    final socketUri = Uri.tryParse(socketUrl);
    if (socketUri == null ||
        socketUri.host.isEmpty ||
        !(socketUri.scheme == 'ws' || socketUri.scheme == 'wss') ||
        (socketUri.hasPort && socketUri.port == 0)) {
      return;
    }

    try {
      _channel = WebSocketChannel.connect(socketUri);
      _socketSub = _channel!.stream.listen(
        _handleSocketMessage,
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
      );

      _heartbeat = Timer.periodic(const Duration(seconds: 30), (_) {
        _channel?.sink.add(jsonEncode({'type': 'ping'}));
      });
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _disconnectSocket() {
    _heartbeat?.cancel();
    _heartbeat = null;
    _socketSub?.cancel();
    _socketSub = null;
    _channel?.sink.close();
    _channel = null;
  }

  void _scheduleReconnect() {
    if (!_enableRealtimeSocket) return;
    _heartbeat?.cancel();
    _heartbeat = null;
    _socketSub?.cancel();
    _socketSub = null;
    _channel = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), _connectSocket);
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      refreshNotifications();
    });
  }

  void _handleSocketMessage(dynamic raw) {
    final store = _store;
    if (store == null || raw == null) return;

    Map<String, dynamic>? msg;
    try {
      if (raw is String) {
        msg = jsonDecode(raw) as Map<String, dynamic>;
      } else if (raw is Map<String, dynamic>) {
        msg = raw;
      }
    } catch (_) {
      return;
    }
    if (msg == null) return;

    final type = msg['type']?.toString();
    if (type == 'NEW_NOTIFICATION') {
      final data = msg['data'];
      if (data is! Map<String, dynamic>) return;
      final next = _toNotificationItem(data);
      if (_activeUserId != null &&
          next.id.isNotEmpty &&
          data['user_id'] != null &&
          data['user_id'].toString() != _activeUserId) {
        return;
      }
      store.dispatch(UpsertNotification(next));
    }
  }

  static String? _resolveUserId(Map<String, dynamic>? user) {
    if (user == null) return null;
    final value = user['user_id'] ?? user['id'] ?? user['uid'];
    return value?.toString();
  }

  static List<Map<String, dynamic>> _extractNotifications(dynamic data) {
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    if (data is Map<String, dynamic>) {
      final notifications = data['notifications'];
      if (notifications is List) {
        return notifications.whereType<Map<String, dynamic>>().toList();
      }
    }
    return const [];
  }

  static NotificationItem _toNotificationItem(Map<String, dynamic> map) {
    final entityType = map['entity_type']?.toString();
    final action = map['action']?.toString();
    final fallbackTitle = [
      if (entityType != null && entityType.isNotEmpty) entityType.toUpperCase(),
      if (action != null && action.isNotEmpty) action,
    ].join(' ').trim();

    return NotificationItem(
      id: (map['notification_id'] ?? map['id'] ?? '').toString(),
      title: (map['title']?.toString().trim().isNotEmpty ?? false)
          ? map['title'].toString()
          : (fallbackTitle.isEmpty ? 'Notification' : fallbackTitle),
      message: map['message']?.toString() ?? '',
      time: _formatNotifTime(map['created_at']),
      read: map['is_read'] == true || map['read'] == true,
    );
  }

  static String _formatNotifTime(dynamic createdAt) {
    if (createdAt == null) return '';
    try {
      final dt = DateTime.parse(createdAt.toString()).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return createdAt.toString();
    }
  }
}
