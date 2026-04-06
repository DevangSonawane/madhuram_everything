import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import '../../theme/app_theme.dart';
import '../../store/app_state.dart';
import '../../utils/access_control.dart';
import '../../utils/responsive.dart';
import 'sidebar.dart';
import 'app_header.dart';

/// Main layout matching React's MainLayout.jsx - Responsive version
class MainLayout extends StatefulWidget {
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
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  bool _isSidebarCollapsed = false;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

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
    Navigator.pushReplacementNamed(context, route);
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

    return StoreConnector<AppState, _MainLayoutViewModel>(
      converter: (store) => _MainLayoutViewModel(
        isAuthenticated: store.state.auth.isAuthenticated,
        hasSelectedProject: store.state.project.selectedProject != null,
        projectName: store.state.project.selectedProjectName,
        user: store.state.auth.user,
      ),
      builder: (context, vm) {
        // Auth check - redirect if not authenticated
        if (!vm.isAuthenticated) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              Navigator.pushReplacementNamed(context, '/login');
            }
          });
          return Scaffold(
            backgroundColor: isDark
                ? AppTheme.darkBackground
                : AppTheme.lightBackground,
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        // Project check - redirect if no project selected
        if (widget.requireProject && !vm.hasSelectedProject) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              Navigator.pushReplacementNamed(context, '/projects');
            }
          });
          return Scaffold(
            backgroundColor: isDark
                ? AppTheme.darkBackground
                : AppTheme.lightBackground,
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        final normalizedRoute = normalizeRouteForAccess(widget.currentRoute);
        final hasAccess = hasRouteAccess(vm.user, normalizedRoute);
        final content = hasAccess
            ? widget.child
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.lock_outline, size: 56),
                      const SizedBox(height: 12),
                      const Text(
                        'You do not have permission to access this page.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () {
                          Navigator.pushReplacementNamed(context, '/profile');
                        },
                        child: const Text('Open Profile'),
                      ),
                    ],
                  ),
                ),
              );

        return _buildScaffold(
          isDark: isDark,
          responsive: responsive,
          content: content,
        );
      },
    );
  }
}

class _MainLayoutViewModel {
  final bool isAuthenticated;
  final bool hasSelectedProject;
  final String? projectName;
  final Map<String, dynamic>? user;

  _MainLayoutViewModel({
    required this.isAuthenticated,
    required this.hasSelectedProject,
    this.projectName,
    this.user,
  });
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
