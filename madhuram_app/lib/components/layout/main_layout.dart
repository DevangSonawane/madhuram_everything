import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/app_theme.dart';
import '../../utils/access_control.dart';
import '../../utils/app_navigation.dart';
import '../../utils/responsive.dart';
import '../../providers/legacy_session_providers.dart';
import '../../ui/menu_items.dart';
import 'sidebar.dart';
import 'app_header.dart';

/// Main layout matching React's MainLayout.jsx - Responsive version
class MainLayout extends ConsumerStatefulWidget {
  final String title;
  final Widget child;
  final String currentRoute;
  final IconData? headerLeadingIcon;
  final VoidCallback? onHeaderLeadingPressed;
  final bool showSidebar;
  final bool requireProject;

  const MainLayout({
    super.key,
    required this.title,
    required this.child,
    required this.currentRoute,
    this.headerLeadingIcon,
    this.onHeaderLeadingPressed,
    this.showSidebar = true,
    this.requireProject = true,
  });

  @override
  ConsumerState<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends ConsumerState<MainLayout> {
  bool _isSidebarCollapsed = false;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  bool _redirectInProgress = false;

  void _toggleSidebar() {
    setState(() {
      _isSidebarCollapsed = !_isSidebarCollapsed;
    });
  }

  void _navigate(String route, String title) {
    // Close drawer on mobile
    if (_scaffoldKey.currentState?.isDrawerOpen == true) {
      Navigator.pop(context);
    }
    context.appGo(route);
  }

  Widget _buildScaffold({
    required bool isDark,
    required Responsive responsive,
    required Widget content,
  }) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor:
          isDark ? AppTheme.darkBackground : AppTheme.lightBackground,
      drawer: widget.showSidebar && (responsive.isMobile || responsive.isTablet)
          ? Drawer(
              width: responsive.isMobile
                  ? responsive.screenWidth * 0.85
                  : 288,
              child: AppSidebar(
                isCollapsed: false,
                currentRoute: widget.currentRoute,
                onNavigate: _navigate,
              ),
            )
          : null,
      body: Row(
        children: [
          // Desktop sidebar only
          if (widget.showSidebar && responsive.isDesktop)
            Stack(
              children: [
                AppSidebar(
                  isCollapsed: _isSidebarCollapsed,
                  currentRoute: widget.currentRoute,
                  onNavigate: _navigate,
                ),
                SidebarToggleButton(
                  isCollapsed: _isSidebarCollapsed,
                  onToggle: _toggleSidebar,
                ),
              ],
            ),

          // Main content – matches React's flex-1 + overflow-y-auto layout.
          // Each page handles its own scrolling; we just provide bounded
          // height so Expanded widgets inside pages work correctly.
          Expanded(
            child: Column(
              children: [
                AppHeader(
                  title: widget.title,
                  leadingIcon: widget.headerLeadingIcon,
                  onLeadingPressed: widget.onHeaderLeadingPressed,
                  showMenuButton: widget.showSidebar,
                  onMenuPressed: () {
                    _scaffoldKey.currentState?.openDrawer();
                  },
                ),
                Expanded(
                  child: Padding(
                    padding: responsive.padding,
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          maxWidth: 1400,
                          minWidth: 0,
                        ),
                        child: content,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final responsive = Responsive(context);

    final auth = ref.watch(authSessionProvider);
    final project = ref.watch(projectSessionProvider);
    final user = auth.user;
    final isAuthenticated = auth.isAuthenticated;
    final hasSelectedProject = project.selectedProject != null;

    if (!isAuthenticated) {
      if (!_redirectInProgress) {
        _redirectInProgress = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          context.appGo('/login');
        });
      }
      return Scaffold(
        backgroundColor: isDark ? AppTheme.darkBackground : AppTheme.lightBackground,
        body: const SizedBox.shrink(),
      );
    }

    if (widget.requireProject && !hasSelectedProject) {
      if (!_redirectInProgress) {
        _redirectInProgress = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          context.appGo('/projects');
        });
      }
      return Scaffold(
        backgroundColor: isDark ? AppTheme.darkBackground : AppTheme.lightBackground,
        body: const SizedBox.shrink(),
      );
    }

    _redirectInProgress = false;

    final normalizedRoute = normalizeRouteForAccess(widget.currentRoute);
    final hasAccess = hasRouteAccess(user, normalizedRoute);
    final visibleRoute = getFirstVisibleMenuRoute(user: user) ?? '/profile';

    if (!hasAccess && visibleRoute != normalizedRoute && !_redirectInProgress) {
      _redirectInProgress = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        context.appGo(visibleRoute);
      });
    }

    final content = hasAccess
        ? widget.child
        : const Center(child: CircularProgressIndicator());

    return _buildScaffold(
      isDark: isDark,
      responsive: responsive,
      content: content,
    );
  }
}

/// Protected route wrapper - wraps pages with MainLayout
class ProtectedRoute extends StatelessWidget {
  final String title;
  final String route;
  final Widget child;
  final IconData? headerLeadingIcon;
  final VoidCallback? onHeaderLeadingPressed;
  final bool showSidebar;
  final bool requireProject;

  const ProtectedRoute({
    super.key,
    required this.title,
    required this.route,
    required this.child,
    this.headerLeadingIcon,
    this.onHeaderLeadingPressed,
    this.showSidebar = true,
    this.requireProject = true,
  });

  @override
  Widget build(BuildContext context) {
    return MainLayout(
      title: title,
      currentRoute: route,
      child: child,
      headerLeadingIcon: headerLeadingIcon,
      onHeaderLeadingPressed: onHeaderLeadingPressed,
      showSidebar: showSidebar,
      requireProject: requireProject,
    );
  }
}
