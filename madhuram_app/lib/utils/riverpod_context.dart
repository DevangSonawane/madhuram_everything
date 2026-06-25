import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/legacy_session_providers.dart';

extension RiverpodContextX on BuildContext {
  ProviderContainer get riverpodContainer =>
      ProviderScope.containerOf(this, listen: false);

  AuthSessionView get appAuth => riverpodContainer.read(authSessionProvider);
  ProjectSessionView get appProject =>
      riverpodContainer.read(projectSessionProvider);
  ThemeSessionView get appTheme => riverpodContainer.read(themeSessionProvider);
  NotificationSessionView get appNotifications =>
      riverpodContainer.read(notificationSessionProvider);
}
