import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../store/app_state.dart';
import '../utils/state_signature.dart';

class AuthSessionView {
  final Map<String, dynamic>? user;
  final bool isAuthenticated;
  final String signature;

  const AuthSessionView({
    required this.user,
    required this.isAuthenticated,
    required this.signature,
  });

  factory AuthSessionView.fromUser(Map<String, dynamic>? user) {
    return AuthSessionView(
      user: user,
      isAuthenticated: user != null && user.isNotEmpty,
      signature: stateSignature(user ?? const <String, dynamic>{}),
    );
  }

  String? get userName => user?['name'] as String?;
  String? get userEmail => user?['email'] as String?;
  String? get userPhone => user?['phone']?.toString() ?? user?['phone_number']?.toString();
  String? get userRole => user?['role'] as String?;
  bool get isAdmin => userRole == 'admin';
}

class ProjectSessionView {
  final List<Map<String, dynamic>> projects;
  final Map<String, dynamic>? selectedProject;
  final bool isLoading;
  final String signature;

  const ProjectSessionView({
    required this.projects,
    required this.selectedProject,
    required this.isLoading,
    required this.signature,
  });

  factory ProjectSessionView.fromState({
    required List<Map<String, dynamic>> projects,
    required Map<String, dynamic>? selectedProject,
    required bool isLoading,
  }) {
    return ProjectSessionView(
      projects: projects,
      selectedProject: selectedProject,
      isLoading: isLoading,
      signature: stateSignature({
        'projects': projects,
        'selectedProject': selectedProject,
        'isLoading': isLoading,
      }),
    );
  }

  String? get selectedProjectId =>
      selectedProject?['id']?.toString() ??
      selectedProject?['project_id']?.toString();

  String? get selectedProjectName =>
      selectedProject?['name']?.toString() ??
      selectedProject?['project_name']?.toString();
}

class ThemeSessionView {
  final AppThemeMode mode;

  const ThemeSessionView({required this.mode});
}

class NotificationSessionView {
  final List<NotificationItem> notifications;
  final bool loading;

  const NotificationSessionView({
    required this.notifications,
    required this.loading,
  });

  factory NotificationSessionView.fromState(NotificationState state) {
    return NotificationSessionView(
      notifications: List<NotificationItem>.unmodifiable(state.notifications),
      loading: state.loading,
    );
  }

  int get unreadCount => notifications.where((n) => !n.read).length;

  String get signature => stateSignature({
        'notifications': notifications
            .map(
              (n) => {
                'id': n.id,
                'title': n.title,
                'message': n.message,
                'time': n.time,
                'read': n.read,
              },
            )
            .toList(),
        'loading': loading,
      });
}

class AuthSessionNotifier extends StateNotifier<AuthSessionView> {
  AuthSessionNotifier() : super(AuthSessionView.fromUser(null));

  void sync(Map<String, dynamic>? user) {
    final next = AuthSessionView.fromUser(user);
    if (next.signature == state.signature) return;
    state = next;
  }

  void clear() {
    if (state.user == null && !state.isAuthenticated) return;
    state = AuthSessionView.fromUser(null);
  }
}

class ProjectSessionNotifier extends StateNotifier<ProjectSessionView> {
  ProjectSessionNotifier()
      : super(
          ProjectSessionView.fromState(
            projects: const [],
            selectedProject: null,
            isLoading: false,
          ),
        );

  void sync({
    required List<Map<String, dynamic>> projects,
    required Map<String, dynamic>? selectedProject,
    required bool isLoading,
  }) {
    final next = ProjectSessionView.fromState(
      projects: projects,
      selectedProject: selectedProject,
      isLoading: isLoading,
    );
    if (next.signature == state.signature) return;
    state = next;
  }

  void clear() {
    if (state.projects.isEmpty && state.selectedProject == null && !state.isLoading) {
      return;
    }
    state = ProjectSessionView.fromState(
      projects: const [],
      selectedProject: null,
      isLoading: false,
    );
  }
}

class ThemeSessionNotifier extends StateNotifier<ThemeSessionView> {
  ThemeSessionNotifier() : super(const ThemeSessionView(mode: AppThemeMode.light));

  void sync(AppThemeMode mode) {
    if (state.mode == mode) return;
    state = ThemeSessionView(mode: mode);
  }

  void clear() {
    if (state.mode == AppThemeMode.light) return;
    state = const ThemeSessionView(mode: AppThemeMode.light);
  }
}

class NotificationSessionNotifier
    extends StateNotifier<NotificationSessionView> {
  NotificationSessionNotifier()
      : super(
          NotificationSessionView.fromState(
            const NotificationState(),
          ),
        );

  void sync(NotificationState state) {
    final next = NotificationSessionView.fromState(state);
    if (next.signature == this.state.signature) return;
    this.state = next;
  }

  void setLoading(bool loading) {
    if (state.loading == loading) return;
    state = NotificationSessionView(
      notifications: state.notifications,
      loading: loading,
    );
  }

  void replaceAll(List<NotificationItem> notifications) {
    final next = NotificationSessionView(
      notifications: List<NotificationItem>.unmodifiable(notifications),
      loading: false,
    );
    if (next.signature == state.signature) return;
    state = next;
  }

  void clear() {
    if (state.notifications.isEmpty && !state.loading) return;
    state = const NotificationSessionView(notifications: [], loading: false);
  }

  void upsert(NotificationItem next) {
    final updated = [...state.notifications];
    final index = updated.indexWhere((item) => item.id == next.id);
    if (index == -1) {
      updated.insert(0, next);
    } else {
      updated[index] = next;
    }
    replaceAll(updated);
  }

  void markRead(String notificationId) {
    replaceAll(
      state.notifications.map((item) {
        if (item.id != notificationId) return item;
        return item.copyWith(read: true);
      }).toList(),
    );
  }

  void markAllRead() {
    replaceAll(
      state.notifications
          .map((item) => item.copyWith(read: true))
          .toList(),
    );
  }

  void remove(String notificationId) {
    replaceAll(
      state.notifications.where((item) => item.id != notificationId).toList(),
    );
  }
}

final authSessionProvider =
    StateNotifierProvider<AuthSessionNotifier, AuthSessionView>(
  (ref) => AuthSessionNotifier(),
);

final projectSessionProvider =
    StateNotifierProvider<ProjectSessionNotifier, ProjectSessionView>(
  (ref) => ProjectSessionNotifier(),
);

final themeSessionProvider =
    StateNotifierProvider<ThemeSessionNotifier, ThemeSessionView>(
  (ref) => ThemeSessionNotifier(),
);

final notificationSessionProvider = StateNotifierProvider<
    NotificationSessionNotifier,
    NotificationSessionView>(
  (ref) => NotificationSessionNotifier(),
);
