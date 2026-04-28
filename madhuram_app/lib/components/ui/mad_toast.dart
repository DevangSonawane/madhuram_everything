import 'package:flutter/material.dart';
import 'dart:math' as math;
import '../../theme/app_theme.dart';

/// Toast variant
enum ToastVariant { info, success, warning, error }

/// Toast data
class ToastData {
  final String id;
  final String message;
  final String? description;
  final ToastVariant variant;
  final Duration duration;
  final VoidCallback? action;
  final String? actionLabel;

  ToastData({
    String? id,
    required this.message,
    this.description,
    this.variant = ToastVariant.info,
    this.duration = const Duration(seconds: 4),
    this.action,
    this.actionLabel,
  }) : id = id ?? DateTime.now().millisecondsSinceEpoch.toString();
}

/// Toast notification widget
class MadToast extends StatefulWidget {
  final ToastData toast;
  final VoidCallback onDismiss;
  final Animation<double> animation;

  const MadToast({
    super.key,
    required this.toast,
    required this.onDismiss,
    required this.animation,
  });

  @override
  State<MadToast> createState() => _MadToastState();
}

class _MadToastState extends State<MadToast> {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    IconData icon;
    Color iconColor;
    Color backgroundColor;
    Color borderColor;

    switch (widget.toast.variant) {
      case ToastVariant.success:
        icon = Icons.check_circle_outline;
        iconColor = const Color(0xFF22C55E);
        backgroundColor = isDark ? const Color(0xFF052E16) : const Color(0xFFF0FDF4);
        borderColor = const Color(0xFF22C55E).withOpacity(0.3);
        break;
      case ToastVariant.warning:
        icon = Icons.warning_amber_rounded;
        iconColor = const Color(0xFFF59E0B);
        backgroundColor = isDark ? const Color(0xFF422006) : const Color(0xFFFFFBEB);
        borderColor = const Color(0xFFF59E0B).withOpacity(0.3);
        break;
      case ToastVariant.error:
        icon = Icons.error_outline;
        iconColor = const Color(0xFFEF4444);
        backgroundColor = isDark ? const Color(0xFF450A0A) : const Color(0xFFFEF2F2);
        borderColor = const Color(0xFFEF4444).withOpacity(0.3);
        break;
      case ToastVariant.info:
        icon = Icons.info_outline;
        iconColor = AppTheme.primaryColor;
        backgroundColor = isDark ? AppTheme.darkCard : Colors.white;
        borderColor = isDark ? AppTheme.darkBorder : AppTheme.lightBorder;
    }

    return SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(1, 0),
        end: Offset.zero,
      ).animate(CurvedAnimation(
        parent: widget.animation,
        curve: Curves.easeOutCubic,
      )),
      child: FadeTransition(
        opacity: widget.animation,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: math.min(400, MediaQuery.of(context).size.width - 32),
          ),
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: borderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: iconColor, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.toast.message,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                    ),
                    if (widget.toast.description != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        widget.toast.description!,
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ],
                    if (widget.toast.action != null && widget.toast.actionLabel != null) ...[
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: () {
                          widget.toast.action?.call();
                          widget.onDismiss();
                        },
                        child: Text(
                          widget.toast.actionLabel!,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: AppTheme.primaryColor,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: widget.onDismiss,
                child: Icon(
                  Icons.close,
                  size: 16,
                  color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Toast manager to show toasts from anywhere
class ToastManager {
  static final ToastManager _instance = ToastManager._internal();
  factory ToastManager() => _instance;
  ToastManager._internal();

  final List<ToastData> _toasts = [];
  final _listeners = <VoidCallback>[];

  List<ToastData> get toasts => List.unmodifiable(_toasts);

  void addListener(VoidCallback listener) {
    _listeners.add(listener);
  }

  void removeListener(VoidCallback listener) {
    _listeners.remove(listener);
  }

  void _notifyListeners() {
    for (final listener in _listeners) {
      listener();
    }
  }

  void show(ToastData toast) {
    _toasts.add(toast);
    _notifyListeners();

    Future.delayed(toast.duration, () {
      dismiss(toast.id);
    });
  }

  void dismiss(String id) {
    _toasts.removeWhere((t) => t.id == id);
    _notifyListeners();
  }

  void dismissAll() {
    _toasts.clear();
    _notifyListeners();
  }

  /// Convenience methods
  void success(String message, {String? description}) {
    show(ToastData(
      message: message,
      description: description,
      variant: ToastVariant.success,
    ));
  }

  void error(String message, {String? description}) {
    show(ToastData(
      message: message,
      description: description,
      variant: ToastVariant.error,
    ));
  }

  void warning(String message, {String? description}) {
    show(ToastData(
      message: message,
      description: description,
      variant: ToastVariant.warning,
    ));
  }

  void info(String message, {String? description}) {
    show(ToastData(
      message: message,
      description: description,
      variant: ToastVariant.info,
    ));
  }
}

/// Toast container to display toasts
class ToastContainer extends StatefulWidget {
  final Widget child;

  const ToastContainer({super.key, required this.child});

  @override
  State<ToastContainer> createState() => _ToastContainerState();
}

class _ToastContainerState extends State<ToastContainer> with TickerProviderStateMixin {
  final Map<String, AnimationController> _controllers = {};

  @override
  void initState() {
    super.initState();
    ToastManager().addListener(_onToastsChanged);
  }

  @override
  void dispose() {
    ToastManager().removeListener(_onToastsChanged);
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _onToastsChanged() {
    setState(() {
      // Create controllers for new toasts
      for (final toast in ToastManager().toasts) {
        if (!_controllers.containsKey(toast.id)) {
          final controller = AnimationController(
            vsync: this,
            duration: const Duration(milliseconds: 300),
          );
          _controllers[toast.id] = controller;
          controller.forward();
        }
      }

      // Remove controllers for dismissed toasts
      final currentIds = ToastManager().toasts.map((t) => t.id).toSet();
      final toRemove = _controllers.keys.where((id) => !currentIds.contains(id)).toList();
      for (final id in toRemove) {
        _controllers[id]?.dispose();
        _controllers.remove(id);
      }
    });
  }

  void _dismissToast(String id) {
    final controller = _controllers[id];
    if (controller != null) {
      controller.reverse().then((_) {
        ToastManager().dismiss(id);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isNarrow = width < 520;
    return Stack(
      children: [
        widget.child,
        SafeArea(
          child: Align(
            alignment: isNarrow ? Alignment.topCenter : Alignment.topRight,
            child: Padding(
              padding: const EdgeInsets.only(top: 16, left: 16, right: 16),
              child: Column(
                crossAxisAlignment: isNarrow ? CrossAxisAlignment.center : CrossAxisAlignment.end,
                children: ToastManager().toasts.map((toast) {
                  final controller = _controllers[toast.id];
                  if (controller == null) return const SizedBox.shrink();

                  return MadToast(
                    toast: toast,
                    animation: controller,
                    onDismiss: () => _dismissToast(toast.id),
                  );
                }).toList(),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Global toast helper
void showToast(
  BuildContext context,
  String message, {
  String? description,
  ToastVariant variant = ToastVariant.info,
  Duration duration = const Duration(seconds: 4),
  VoidCallback? action,
  String? actionLabel,
}) {
  ToastManager().show(ToastData(
    message: message,
    description: description,
    variant: variant,
    duration: duration,
    action: action,
    actionLabel: actionLabel,
  ));
}
