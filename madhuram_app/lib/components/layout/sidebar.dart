import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../store/app_state.dart';
import '../../ui/menu_items.dart';
import '../../utils/responsive.dart';

/// Sidebar matching React's Sidebar.jsx - Responsive version
class AppSidebar extends StatelessWidget {
  final bool isCollapsed;
  final VoidCallback? onToggle;
  final String? currentRoute;
  final Function(String route, String title)? onNavigate;
  final String? projectId;

  const AppSidebar({
    super.key,
    this.isCollapsed = false,
    this.onToggle,
    this.currentRoute,
    this.onNavigate,
    this.projectId,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final responsive = Responsive(context);

    // In drawer mode (mobile/tablet), always show full sidebar
    final isInDrawer = !responsive.isDesktop;
    final effectiveCollapsed = isInDrawer ? false : isCollapsed;

    return StoreConnector<AppState, Map<String, dynamic>?>(
      converter: (store) => store.state.auth.user,
      builder: (context, user) {
        final categories = getMenuCategories(user: user);
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: effectiveCollapsed ? 80 : (isInDrawer ? double.infinity : 288),
          height: double.infinity,
          decoration: BoxDecoration(
            color: isDark
                ? AppTheme.sidebarDarkBackground
                : AppTheme.sidebarBackground,
            border: isInDrawer
                ? null
                : Border(
                    right: BorderSide(
                      color: (isDark ? Colors.white : Colors.black).withOpacity(
                        0.1,
                      ),
                    ),
                  ),
            boxShadow: isInDrawer
                ? null
                : [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 20,
                      offset: const Offset(0, 0),
                    ),
                  ],
          ),
          child: SafeArea(
            child: Column(
              children: [
                // Header with logo
                _buildHeader(context, isDark, effectiveCollapsed, responsive),

                // Menu items
                Expanded(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: responsive.value(
                        mobile: 8,
                        tablet: 10,
                        desktop: 12,
                      ),
                      vertical: responsive.value(
                        mobile: 12,
                        tablet: 14,
                        desktop: 16,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final category in categories) ...[
                          if (!effectiveCollapsed) ...[
                            Padding(
                              padding: EdgeInsets.fromLTRB(
                                responsive.value(
                                  mobile: 12,
                                  tablet: 14,
                                  desktop: 16,
                                ),
                                responsive.value(
                                  mobile: 12,
                                  tablet: 14,
                                  desktop: 16,
                                ),
                                responsive.value(
                                  mobile: 12,
                                  tablet: 14,
                                  desktop: 16,
                                ),
                                responsive.value(
                                  mobile: 6,
                                  tablet: 7,
                                  desktop: 8,
                                ),
                              ),
                              child: Text(
                                category.name.toUpperCase(),
                                style: TextStyle(
                                  fontSize: responsive.value(
                                    mobile: 9,
                                    tablet: 9,
                                    desktop: 10,
                                  ),
                                  fontWeight: FontWeight.bold,
                                  color:
                                      (isDark
                                              ? AppTheme.darkForeground
                                              : AppTheme.lightForeground)
                                          .withOpacity(0.4),
                                  letterSpacing: 1.5,
                                ),
                              ),
                            ),
                          ] else
                            SizedBox(
                              height: responsive.value(
                                mobile: 12,
                                tablet: 14,
                                desktop: 16,
                              ),
                            ),
                          for (final item in category.items)
                            _buildMenuItem(
                              context,
                              item,
                              isDark,
                              effectiveCollapsed,
                              responsive,
                            ),
                        ],
                      ],
                    ),
                  ),
                ),

                // Footer
                if (!effectiveCollapsed)
                  _buildFooter(context, isDark, responsive),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeader(
    BuildContext context,
    bool isDark,
    bool collapsed,
    Responsive responsive,
  ) {
    return Container(
      height: responsive.value(mobile: 64, tablet: 72, desktop: 80),
      padding: EdgeInsets.symmetric(
        horizontal: collapsed
            ? 8
            : responsive.value(mobile: 16, tablet: 20, desktop: 24),
      ),
      child: Row(
        mainAxisAlignment: collapsed
            ? MainAxisAlignment.center
            : MainAxisAlignment.start,
        children: [
          Container(
            width: responsive.value(mobile: 32, tablet: 34, desktop: 36),
            height: responsive.value(mobile: 32, tablet: 34, desktop: 36),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryColor.withOpacity(0.2),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(
              LucideIcons.package2,
              color: Colors.white,
              size: responsive.value(mobile: 18, tablet: 19, desktop: 20),
            ),
          ),
          if (!collapsed) ...[
            const SizedBox(width: 12),
            Text(
              'Madhuram',
              style: TextStyle(
                fontSize: responsive.value(mobile: 18, tablet: 19, desktop: 20),
                fontWeight: FontWeight.bold,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context,
    MenuItem item,
    bool isDark,
    bool collapsed,
    Responsive responsive,
  ) {
    final isActive = currentRoute == item.route;

    return Tooltip(
      message: collapsed ? item.title : '',
      waitDuration: const Duration(milliseconds: 500),
      child: Container(
        margin: EdgeInsets.only(
          bottom: responsive.value(mobile: 2, tablet: 3, desktop: 4),
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: () => onNavigate?.call(item.route, item.title),
            borderRadius: BorderRadius.circular(12),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: EdgeInsets.symmetric(
                horizontal: collapsed
                    ? 0
                    : responsive.value(mobile: 10, tablet: 11, desktop: 12),
                vertical: responsive.value(mobile: 10, tablet: 11, desktop: 12),
              ),
              decoration: BoxDecoration(
                color: isActive ? AppTheme.primaryColor : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
                boxShadow: isActive
                    ? [
                        BoxShadow(
                          color: AppTheme.primaryColor.withOpacity(0.25),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ]
                    : null,
              ),
              child: Row(
                mainAxisAlignment: collapsed
                    ? MainAxisAlignment.center
                    : MainAxisAlignment.start,
                children: [
                  Icon(
                    item.icon,
                    size: responsive.value(mobile: 18, tablet: 19, desktop: 20),
                    color: isActive
                        ? Colors.white
                        : (isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground)
                              .withOpacity(0.7),
                  ),
                  if (!collapsed) ...[
                    SizedBox(
                      width: responsive.value(
                        mobile: 10,
                        tablet: 11,
                        desktop: 12,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        item.title,
                        style: TextStyle(
                          fontSize: responsive.value(
                            mobile: 13,
                            tablet: 13,
                            desktop: 14,
                          ),
                          fontWeight: FontWeight.w500,
                          color: isActive
                              ? Colors.white
                              : (isDark
                                        ? AppTheme.darkForeground
                                        : AppTheme.lightForeground)
                                    .withOpacity(0.7),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFooter(
    BuildContext context,
    bool isDark,
    Responsive responsive,
  ) {
    return Container(
      margin: EdgeInsets.all(
        responsive.value(mobile: 12, tablet: 14, desktop: 16),
      ),
      padding: EdgeInsets.all(
        responsive.value(mobile: 12, tablet: 14, desktop: 16),
      ),
      decoration: BoxDecoration(
        color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(
          0.5,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (isDark ? Colors.white : Colors.black).withOpacity(0.05),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: responsive.value(mobile: 28, tablet: 30, desktop: 32),
            height: responsive.value(mobile: 28, tablet: 30, desktop: 32),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppTheme.primaryColor, Colors.purple],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                'V1',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: responsive.value(
                    mobile: 10,
                    tablet: 10,
                    desktop: 11,
                  ),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Inventory System',
                  style: TextStyle(
                    fontSize: responsive.value(
                      mobile: 12,
                      tablet: 13,
                      desktop: 14,
                    ),
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppTheme.darkForeground
                        : AppTheme.lightForeground,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  'v1.0.0',
                  style: TextStyle(
                    fontSize: responsive.value(
                      mobile: 10,
                      tablet: 11,
                      desktop: 12,
                    ),
                    color:
                        (isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground)
                            .withOpacity(0.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Toggle button for sidebar
class SidebarToggleButton extends StatelessWidget {
  final bool isCollapsed;
  final VoidCallback onToggle;

  const SidebarToggleButton({
    super.key,
    required this.isCollapsed,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Positioned(
      right: -14,
      top: 28,
      child: Material(
        color: isDark ? AppTheme.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        elevation: 2,
        child: InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: (isDark ? Colors.white : Colors.black).withOpacity(0.1),
              ),
            ),
            child: Icon(
              isCollapsed ? LucideIcons.chevronRight : LucideIcons.chevronLeft,
              size: 16,
              color: isDark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
        ),
      ),
    );
  }
}
