import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter_redux/flutter_redux.dart';
import '../../theme/app_theme.dart';
import '../../store/app_state.dart';
import '../../store/auth_actions.dart';
import '../../services/auth_storage.dart';
import '../../services/notification_service.dart';
import '../../utils/responsive.dart';

/// Header matching React's Header.jsx - Responsive version
class AppHeader extends StatelessWidget {
  final String title;
  final List<String>? breadcrumbs;
  final VoidCallback? onMenuPressed;
  final IconData? leadingIcon;
  final VoidCallback? onLeadingPressed;
  final VoidCallback? onNotificationPressed;
  final VoidCallback? onProfilePressed;
  final bool showMenuButton;

  const AppHeader({
    super.key,
    required this.title,
    this.breadcrumbs,
    this.onMenuPressed,
    this.leadingIcon,
    this.onLeadingPressed,
    this.onNotificationPressed,
    this.onProfilePressed,
    this.showMenuButton = true,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final responsive = Responsive(context);

    return SafeArea(
      top: true,
      bottom: false,
      child: Container(
        height: responsive.value(mobile: 64, tablet: 72, desktop: 80),
        padding: EdgeInsets.only(
          top: responsive.value(mobile: 4, tablet: 6, desktop: 8),
          left: responsive.value(mobile: 12, tablet: 20, desktop: 32),
          right: responsive.value(mobile: 12, tablet: 20, desktop: 32),
        ),
        decoration: BoxDecoration(
          color: (isDark ? AppTheme.darkBackground : AppTheme.lightBackground)
              .withOpacity(0.8),
        ),
        child: Row(
          children: [
            // Mobile/Tablet menu button
            if (!responsive.isDesktop && showMenuButton)
              IconButton(
                onPressed: onLeadingPressed ?? onMenuPressed,
                padding: EdgeInsets.zero,
                constraints: BoxConstraints(
                  minWidth: responsive.value(
                    mobile: 44,
                    tablet: 48,
                    desktop: 52,
                  ),
                  minHeight: responsive.value(
                    mobile: 44,
                    tablet: 48,
                    desktop: 52,
                  ),
                ),
                icon: Icon(
                  leadingIcon ?? LucideIcons.menu,
                  color: isDark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                  size: responsive.isMobile ? 20 : 24,
                ),
              ),

            // Breadcrumbs (desktop and tablet only)
            if (!responsive.isMobile)
              Expanded(child: _buildBreadcrumbs(context, isDark, responsive))
            else
              const Spacer(),

            // Notifications + profile (right aligned)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildNotificationButton(context, isDark, responsive),
                SizedBox(
                  width: responsive.value(mobile: 4, tablet: 6, desktop: 8),
                ),
                _buildUserAvatar(context, isDark, responsive),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBreadcrumbs(
    BuildContext context,
    bool isDark,
    Responsive responsive,
  ) {
    final items = breadcrumbs ?? [title];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: () => Navigator.pushReplacementNamed(context, '/dashboard'),
            child: Text(
              'Dashboard',
              style: TextStyle(
                fontSize: responsive.value(mobile: 12, tablet: 13, desktop: 14),
                fontWeight: FontWeight.w500,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
          ),
          for (int i = 0; i < items.length; i++) ...[
            Padding(
              padding: EdgeInsets.symmetric(
                horizontal: responsive.value(mobile: 4, tablet: 6, desktop: 8),
              ),
              child: Icon(
                Icons.chevron_right,
                size: responsive.value(mobile: 14, tablet: 15, desktop: 16),
                color:
                    (isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground)
                        .withOpacity(0.4),
              ),
            ),
            if (i == items.length - 1)
              Text(
                items[i],
                style: TextStyle(
                  fontSize: responsive.value(
                    mobile: 12,
                    tablet: 13,
                    desktop: 14,
                  ),
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTheme.darkForeground
                      : AppTheme.lightForeground,
                ),
              )
            else
              InkWell(
                onTap: () {
                  // Navigate to breadcrumb item
                },
                child: Text(
                  items[i],
                  style: TextStyle(
                    fontSize: responsive.value(
                      mobile: 12,
                      tablet: 13,
                      desktop: 14,
                    ),
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildNotificationButton(
    BuildContext context,
    bool isDark,
    Responsive responsive,
  ) {
    return StoreConnector<AppState, int>(
      distinct: true,
      converter: (store) => store.state.notification.unreadCount,
      builder: (context, unreadCount) {
        return IconButton(
          onPressed: onNotificationPressed ?? () => _showNotifications(context),
          padding: EdgeInsets.zero,
          constraints: BoxConstraints(
            minWidth: responsive.value(mobile: 36, tablet: 40, desktop: 44),
            minHeight: responsive.value(mobile: 36, tablet: 40, desktop: 44),
          ),
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(
                LucideIcons.bell,
                size: responsive.value(mobile: 18, tablet: 19, desktop: 20),
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
              if (unreadCount > 0)
                Positioned(
                  right: -2,
                  top: -2,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: isDark
                            ? AppTheme.darkBackground
                            : AppTheme.lightBackground,
                        width: 2,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildUserAvatar(
    BuildContext context,
    bool isDark,
    Responsive responsive,
  ) {
    return StoreConnector<AppState, _HeaderUserViewModel>(
      distinct: true,
      converter: (store) => _HeaderUserViewModel(
        userName: store.state.auth.userName ?? 'User',
        userEmail: store.state.auth.userEmail ?? '',
      ),
      builder: (context, vm) {
        final userName = vm.userName;
        final initials = userName
            .split(' ')
            .map((e) => e.isNotEmpty ? e[0] : '')
            .take(2)
            .join()
            .toUpperCase();

        final avatarSize = responsive.value(
          mobile: 28.0,
          tablet: 30.0,
          desktop: 32.0,
        );

        return PopupMenuButton<String>(
          offset: Offset(
            0,
            responsive.value(mobile: 40, tablet: 45, desktop: 50),
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          child: Container(
            width: avatarSize,
            height: avatarSize,
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(avatarSize / 2),
              border: Border.all(color: Colors.transparent, width: 2),
            ),
            child: Center(
              child: Text(
                initials,
                style: TextStyle(
                  fontSize: responsive.value(
                    mobile: 10,
                    tablet: 11,
                    desktop: 12,
                  ),
                  fontWeight: FontWeight.w600,
                  color: AppTheme.primaryColor,
                ),
              ),
            ),
          ),
          itemBuilder: (context) => [
            PopupMenuItem(
              enabled: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    userName,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  Text(
                    vm.userEmail,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                  ),
                ],
              ),
            ),
            const PopupMenuDivider(),
            PopupMenuItem(
              value: 'profile',
              child: Row(
                children: [
                  Icon(
                    LucideIcons.user,
                    size: 16,
                    color: isDark
                        ? AppTheme.darkForeground
                        : AppTheme.lightForeground,
                  ),
                  const SizedBox(width: 8),
                  const Text('Profile'),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'settings',
              child: Row(
                children: [
                  Icon(
                    LucideIcons.settings,
                    size: 16,
                    color: isDark
                        ? AppTheme.darkForeground
                        : AppTheme.lightForeground,
                  ),
                  const SizedBox(width: 8),
                  const Text('Settings'),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'support',
              child: Row(
                children: [
                  Icon(
                    LucideIcons.info,
                    size: 16,
                    color: isDark
                        ? AppTheme.darkForeground
                        : AppTheme.lightForeground,
                  ),
                  const SizedBox(width: 8),
                  const Text('Support'),
                ],
              ),
            ),
            const PopupMenuDivider(),
            PopupMenuItem(
              value: 'logout',
              child: Row(
                children: [
                  const Icon(LucideIcons.logOut, size: 16, color: Colors.red),
                  const SizedBox(width: 8),
                  const Text('Logout', style: TextStyle(color: Colors.red)),
                ],
              ),
            ),
          ],
          onSelected: (value) async {
            if (value == 'logout') {
              await AuthStorage.clear();
              if (!context.mounted) return;
              final store = StoreProvider.of<AppState>(context);
              store.dispatch(Logout());
              Navigator.of(context).pushReplacementNamed('/login');
            } else if (value == 'profile' || value == 'settings') {
              Navigator.of(context).pushNamed('/profile');
            }
          },
        );
      },
    );
  }

  void _showNotifications(BuildContext context) {
    final responsive = Responsive(context);
    NotificationService.instance.refreshNotifications();

    showModalBottomSheet(
      context: context,
      isScrollControlled: responsive.isMobile,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;

        return StoreConnector<AppState, NotificationState>(
          distinct: true,
          converter: (s) => s.state.notification,
          builder: (ctx, notifState) {
            final notifications = notifState.notifications;

            return Container(
              height: responsive.isMobile ? responsive.screenHeight * 0.7 : 420,
              padding: EdgeInsets.all(
                responsive.value(mobile: 16, tablet: 20, desktop: 24),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Notifications',
                        style: TextStyle(
                          fontSize: responsive.value(
                            mobile: 16,
                            tablet: 17,
                            desktop: 18,
                          ),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      TextButton(
                        onPressed: () async {
                          await NotificationService.instance.markAllAsRead();
                        },
                        child: const Text('Mark all read'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: notifications.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  LucideIcons.bell,
                                  size: responsive.value(
                                    mobile: 40,
                                    tablet: 44,
                                    desktop: 48,
                                  ),
                                  color:
                                      (isDark
                                              ? AppTheme.darkMutedForeground
                                              : AppTheme.lightMutedForeground)
                                          .withOpacity(0.2),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'No notifications',
                                  style: TextStyle(
                                    color: isDark
                                        ? AppTheme.darkMutedForeground
                                        : AppTheme.lightMutedForeground,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            itemCount: notifications.length,
                            separatorBuilder: (_, __) => Divider(
                              height: 1,
                              color:
                                  (isDark
                                          ? AppTheme.darkBorder
                                          : AppTheme.lightBorder)
                                      .withOpacity(0.5),
                            ),
                            itemBuilder: (ctx, index) {
                              final n = notifications[index];
                              return ListTile(
                                leading: Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: n.read
                                        ? Colors.transparent
                                        : AppTheme.primaryColor,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                title: Text(
                                  n.title,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: n.read
                                        ? FontWeight.normal
                                        : FontWeight.w600,
                                  ),
                                ),
                                subtitle: Text(
                                  n.message,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isDark
                                        ? AppTheme.darkMutedForeground
                                        : AppTheme.lightMutedForeground,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      n.time,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark
                                            ? AppTheme.darkMutedForeground
                                            : AppTheme.lightMutedForeground,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.close, size: 16),
                                      onPressed: () => NotificationService
                                          .instance
                                          .deleteNotification(n.id),
                                    ),
                                  ],
                                ),
                                onTap: () => NotificationService.instance
                                    .markAsRead(n.id),
                                onLongPress: () => NotificationService.instance
                                    .deleteNotification(n.id),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _HeaderUserViewModel {
  final String userName;
  final String userEmail;

  const _HeaderUserViewModel({required this.userName, required this.userEmail});

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is _HeaderUserViewModel &&
            userName == other.userName &&
            userEmail == other.userEmail;
  }

  @override
  int get hashCode => Object.hash(userName, userEmail);
}
