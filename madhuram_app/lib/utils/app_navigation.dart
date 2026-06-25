import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

extension AppNavigation on BuildContext {
  void appGo(String location, {Object? extra}) {
    go(location, extra: extra);
  }

  Future<T?> appPush<T extends Object?>(
    String location, {
    Object? extra,
  }) {
    return push<T>(location, extra: extra);
  }

  void appPop<T extends Object?>([T? result]) {
    pop<T>(result);
  }
}
