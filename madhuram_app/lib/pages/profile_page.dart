import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'dart:convert';
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../store/auth_actions.dart';
import '../store/theme_actions.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../services/access_control_store.dart';
import '../models/user.dart';
import '../components/ui/mad_card.dart';
import '../components/ui/mad_button.dart';
import '../components/ui/mad_switch.dart';
import '../components/ui/mad_badge.dart';
import '../components/ui/mad_input.dart';
import '../components/ui/mad_select.dart';
import '../components/layout/main_layout.dart';
import '../constants/access_control_catalog.dart';
import '../utils/access_control.dart';
import '../utils/responsive.dart';

/// Profile page - Responsive version
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  List<User> _users = [];
  List<MadSelectOption<String>> _projectOptions = [];
  bool _loadingProjects = false;
  bool _loadingUsers = false;
  String? _usersError;
  bool _attemptedUsersLoad = false;
  final TextEditingController _userSearchController = TextEditingController();
  String? _selectedAccessUserId;
  bool _savingAccessControl = false;
  Map<String, dynamic> _draftAccessControl = buildDefaultAccessControl();
  static const List<MadSelectOption<String>> _roleOptions = [
    MadSelectOption(value: 'admin', label: 'Administrator'),
    MadSelectOption(value: 'operational_manager', label: 'Operational Manager'),
    MadSelectOption(value: 'po_officer', label: 'PO Officer'),
    MadSelectOption(value: 'labour', label: 'Labour'),
  ];

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  @override
  void dispose() {
    _userSearchController.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() {
      _loadingUsers = true;
      _usersError = null;
    });
    try {
      final result = await ApiClient.getAccessAllUsers();
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'] as List;
        final loaded = data
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .map((e) => AccessControlStore.resolveUserAccessControl(e))
            .map((e) => User.fromJson(e))
            .toList()
          ..sort(
            (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
          );
        final firstNonAdmin = loaded.cast<User?>().firstWhere(
          (u) => u != null && u.role != 'admin',
          orElse: () => loaded.isNotEmpty ? loaded.first : null,
        );
        setState(() {
          _users = loaded;
          _loadingUsers = false;
          _selectedAccessUserId ??= firstNonAdmin?.id;
        });
        if (_selectedAccessUserId != null) {
          await _loadAccessControlForSelectedUser();
        }
      } else {
        setState(() {
          _users = [];
          _loadingUsers = false;
          _usersError = result['error']?.toString() ?? 'Failed to load users';
        });
      }
    } catch (e) {
      debugPrint('[Profile] Users API error: $e');
      if (!mounted) return;
      setState(() {
        _users = [];
        _loadingUsers = false;
        _usersError = 'Failed to load users';
      });
    }
  }

  Future<void> _loadProjects() async {
    setState(() => _loadingProjects = true);
    try {
      final result = await ApiClient.getProjects();
      if (!mounted) return;
      if (result['success'] == true) {
        final data = result['data'];
        final list = data is List ? data : const [];
        final options = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .map((project) {
              final id = (project['project_id'] ?? project['id'] ?? '')
                  .toString();
              final name =
                  (project['project_name'] ?? project['name'] ?? 'Project')
                      .toString();
              if (id.isEmpty) return null;
              return MadSelectOption<String>(
                value: id,
                label: '$id - $name',
              );
            })
            .whereType<MadSelectOption<String>>()
            .toList();
        options.sort((a, b) => a.label.compareTo(b.label));
        setState(() {
          _projectOptions = options;
          _loadingProjects = false;
        });
      } else {
        setState(() {
          _projectOptions = [];
          _loadingProjects = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _projectOptions = [];
        _loadingProjects = false;
      });
    }
  }

  List<User> get _filteredUsers {
    final q = _userSearchController.text.trim().toLowerCase();
    if (q.isEmpty) return _users;
    return _users.where((u) {
      return (u.name.toLowerCase().contains(q)) ||
          (u.email.toLowerCase().contains(q)) ||
          (u.username?.toLowerCase().contains(q) ?? false) ||
          (u.role.toLowerCase().contains(q)) ||
          (_getRoleName(u.role).toLowerCase().contains(q));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    return StoreConnector<AppState, _ProfilePermissionsViewModel>(
      distinct: true,
      converter: (store) {
        final user = store.state.auth.user;
        final role = (user?['role'] ?? '').toString();
        final canManageUsersByRole =
            role == 'admin' || role == 'operational_manager';
        final canViewUserManagementTab =
            canManageUsersByRole &&
            hasFunctionAccess(user, 'settings.user_management');
        final canViewAccessControlTab =
            canManageUsersByRole &&
            hasFunctionAccess(user, 'settings.access_control');
        return _ProfilePermissionsViewModel(
          isAdmin: role == 'admin',
          isOperationalManager: role == 'operational_manager',
          canViewUserManagementTab: canViewUserManagementTab,
          canViewAccessControlTab: canViewAccessControlTab,
        );
      },
      builder: (context, vm) {
        final shouldLoadUsers =
            vm.canViewUserManagementTab || vm.canViewAccessControlTab;
        if (shouldLoadUsers && !_attemptedUsersLoad) {
          _attemptedUsersLoad = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadUsers();
          });
        }

        final tabs = <Tab>[
          const Tab(text: 'Profile'),
          const Tab(text: 'Settings'),
        ];
        final tabViews = <Widget>[
          _buildProfileTab(isDark, responsive),
          _buildSettingsTab(isDark, responsive, vm.isOperationalManager),
        ];
        if (vm.canViewUserManagementTab) {
          tabs.add(const Tab(text: 'User Management'));
          tabViews.add(_buildUsersTab(isDark, responsive, vm.isAdmin));
        }
        if (vm.canViewAccessControlTab) {
          tabs.add(const Tab(text: 'Access Control'));
          tabViews.add(_buildAccessControlTab(isDark, responsive));
        }

        return ProtectedRoute(
          title: 'Profile',
          route: '/profile',
          child: DefaultTabController(
            length: tabs.length,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Profile & Settings',
                  style: TextStyle(
                    fontSize: responsive.value(
                      mobile: 22,
                      tablet: 26,
                      desktop: 28,
                    ),
                    fontWeight: FontWeight.bold,
                    color: isDark
                        ? AppTheme.darkForeground
                        : AppTheme.lightForeground,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Manage your account and preferences.',
                  style: TextStyle(
                    fontSize: responsive.value(
                      mobile: 13,
                      tablet: 14,
                      desktop: 14,
                    ),
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
                SizedBox(
                  height: responsive.value(mobile: 16, tablet: 20, desktop: 24),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.darkMuted : AppTheme.lightMuted,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: TabBar(
                    isScrollable: responsive.isMobile,
                    indicator: BoxDecoration(
                      color: isDark ? AppTheme.darkCard : Colors.white,
                      borderRadius: BorderRadius.circular(6),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    indicatorPadding: const EdgeInsets.all(4),
                    labelColor: isDark
                        ? AppTheme.darkForeground
                        : AppTheme.lightForeground,
                    unselectedLabelColor: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                    dividerColor: Colors.transparent,
                    labelStyle: TextStyle(
                      fontSize: responsive.value(
                        mobile: 13,
                        tablet: 14,
                        desktop: 14,
                      ),
                    ),
                    tabs: tabs,
                  ),
                ),
                SizedBox(
                  height: responsive.value(mobile: 16, tablet: 20, desktop: 24),
                ),
                Expanded(child: TabBarView(children: tabViews)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildProfileTab(bool isDark, Responsive responsive) {
    return StoreConnector<AppState, _ProfileAuthViewModel>(
      distinct: true,
      converter: (store) => _ProfileAuthViewModel(
        userName: store.state.auth.userName ?? '—',
        userEmail: store.state.auth.userEmail ?? '—',
        userPhone: store.state.auth.userPhone ?? '—',
        userRole: store.state.auth.userRole ?? '',
      ),
      builder: (context, auth) {
        final userName = auth.userName;
        final userEmail = auth.userEmail;
        final userPhone = auth.userPhone;
        final userRole = auth.userRole;

        return SingleChildScrollView(
          child: Column(
            children: [
              MadCard(
                child: Padding(
                  padding: EdgeInsets.all(
                    responsive.value(mobile: 16, tablet: 20, desktop: 24),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Profile header - stack on mobile
                      if (responsive.isMobile)
                        Column(
                          children: [
                            _buildAvatar(auth, responsive),
                            const SizedBox(height: 16),
                            _buildProfileInfo(
                              auth,
                              isDark,
                              responsive,
                              centered: true,
                            ),
                          ],
                        )
                      else
                        Row(
                          children: [
                            _buildAvatar(auth, responsive),
                            SizedBox(
                              width: responsive.value(
                                mobile: 16,
                                tablet: 20,
                                desktop: 24,
                              ),
                            ),
                            Expanded(
                              child: _buildProfileInfo(
                                auth,
                                isDark,
                                responsive,
                              ),
                            ),
                          ],
                        ),
                      SizedBox(
                        height: responsive.value(
                          mobile: 24,
                          tablet: 28,
                          desktop: 32,
                        ),
                      ),
                      const Divider(),
                      SizedBox(
                        height: responsive.value(
                          mobile: 16,
                          tablet: 20,
                          desktop: 24,
                        ),
                      ),
                      Text(
                        'Personal Information',
                        style: TextStyle(
                          fontSize: responsive.value(
                            mobile: 16,
                            tablet: 17,
                            desktop: 18,
                          ),
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? AppTheme.darkForeground
                              : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildInfoRow('Name', userName, isDark, responsive),
                      _buildInfoRow('Email', userEmail, isDark, responsive),
                      _buildInfoRow('Phone', userPhone, isDark, responsive),
                      _buildInfoRow(
                        'Role',
                        _getRoleName(userRole),
                        isDark,
                        responsive,
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(
                height: responsive.value(mobile: 16, tablet: 20, desktop: 24),
              ),
              // App Info section
              MadCard(
                child: Padding(
                  padding: EdgeInsets.all(
                    responsive.value(mobile: 16, tablet: 20, desktop: 24),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'App Information',
                        style: TextStyle(
                          fontSize: responsive.value(
                            mobile: 16,
                            tablet: 17,
                            desktop: 18,
                          ),
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? AppTheme.darkForeground
                              : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildInfoRow('Version', 'Unknown', isDark, responsive),
                      _buildInfoRow('Build', 'Unknown', isDark, responsive),
                      _buildInfoRow('Platform', 'Flutter', isDark, responsive),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAvatar(_ProfileAuthViewModel auth, Responsive responsive) {
    final size = responsive.value(mobile: 64.0, tablet: 72.0, desktop: 80.0);
    final initials = auth.userName
        .split(' ')
        .where((part) => part.trim().isNotEmpty)
        .map((e) => e.trim()[0])
        .take(2)
        .join()
        .toUpperCase();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.primaryColor, Colors.purple],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(size / 2),
      ),
      child: Center(
        child: Text(
          initials.isNotEmpty ? initials : 'U',
          style: TextStyle(
            fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  Widget _buildProfileInfo(
    _ProfileAuthViewModel auth,
    bool isDark,
    Responsive responsive, {
    bool centered = false,
  }) {
    return Column(
      crossAxisAlignment: centered
          ? CrossAxisAlignment.center
          : CrossAxisAlignment.start,
      children: [
        Text(
          auth.userName,
          style: TextStyle(
            fontSize: responsive.value(mobile: 20, tablet: 22, desktop: 24),
            fontWeight: FontWeight.bold,
          ),
          textAlign: centered ? TextAlign.center : TextAlign.start,
        ),
        const SizedBox(height: 4),
        Text(
          auth.userEmail,
          style: TextStyle(
            fontSize: responsive.value(mobile: 13, tablet: 14, desktop: 14),
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
          textAlign: centered ? TextAlign.center : TextAlign.start,
        ),
        const SizedBox(height: 8),
        MadBadge(
          text: _getRoleName(auth.userRole),
          variant: BadgeVariant.secondary,
        ),
      ],
    );
  }

  Widget _buildSettingsTab(
    bool isDark,
    Responsive responsive,
    bool isOperationalManager,
  ) {
    return StoreConnector<AppState, AppThemeMode>(
      distinct: true,
      converter: (store) => store.state.theme.mode,
      builder: (context, themeMode) {
        return SingleChildScrollView(
          child: Column(
            children: [
              MadCard(
                child: Padding(
                  padding: EdgeInsets.all(
                    responsive.value(mobile: 16, tablet: 20, desktop: 24),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Appearance',
                        style: TextStyle(
                          fontSize: responsive.value(
                            mobile: 16,
                            tablet: 17,
                            desktop: 18,
                          ),
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? AppTheme.darkForeground
                              : AppTheme.lightForeground,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Choose how the app looks. You can pick light, dark, or system.',
                        style: TextStyle(
                          fontSize: responsive.value(
                            mobile: 13,
                            tablet: 14,
                            desktop: 14,
                          ),
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                      SizedBox(
                        height: responsive.value(
                          mobile: 16,
                          tablet: 20,
                          desktop: 24,
                        ),
                      ),
                      if (responsive.isMobile)
                        Column(
                          children: [
                            _buildThemeOption(
                              icon: LucideIcons.sun,
                              label: 'Light',
                              isSelected: themeMode == AppThemeMode.light,
                              onTap: () => _setTheme(AppThemeMode.light),
                              isDark: isDark,
                              responsive: responsive,
                            ),
                            const SizedBox(height: 12),
                            _buildThemeOption(
                              icon: LucideIcons.moon,
                              label: 'Dark',
                              isSelected: themeMode == AppThemeMode.dark,
                              onTap: () => _setTheme(AppThemeMode.dark),
                              isDark: isDark,
                              responsive: responsive,
                            ),
                            const SizedBox(height: 12),
                            _buildThemeOption(
                              icon: LucideIcons.laptop,
                              label: 'System',
                              isSelected:
                                  themeMode == AppThemeMode.system,
                              onTap: () => _setTheme(AppThemeMode.system),
                              isDark: isDark,
                              responsive: responsive,
                            ),
                          ],
                        )
                      else
                        Row(
                          children: [
                            Expanded(
                              child: _buildThemeOption(
                                icon: LucideIcons.sun,
                                label: 'Light',
                                isSelected:
                                    themeMode == AppThemeMode.light,
                                onTap: () => _setTheme(AppThemeMode.light),
                                isDark: isDark,
                                responsive: responsive,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: _buildThemeOption(
                                icon: LucideIcons.moon,
                                label: 'Dark',
                                isSelected:
                                    themeMode == AppThemeMode.dark,
                                onTap: () => _setTheme(AppThemeMode.dark),
                                isDark: isDark,
                                responsive: responsive,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: _buildThemeOption(
                                icon: LucideIcons.laptop,
                                label: 'System',
                                isSelected:
                                    themeMode == AppThemeMode.system,
                                onTap: () => _setTheme(AppThemeMode.system),
                                isDark: isDark,
                                responsive: responsive,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
              if (isOperationalManager) ...[
                const SizedBox(height: 16),
                MadCard(
                  child: Padding(
                    padding: EdgeInsets.all(
                      responsive.value(mobile: 16, tablet: 20, desktop: 24),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Operational Manager',
                          style: TextStyle(
                            fontSize: responsive.value(
                              mobile: 16,
                              tablet: 17,
                              desktop: 18,
                            ),
                            fontWeight: FontWeight.w600,
                            color: isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'You are logged in as Operational Manager. Open the ITR module to manage ITR workflow.',
                          style: TextStyle(
                            fontSize: responsive.value(
                              mobile: 13,
                              tablet: 14,
                              desktop: 14,
                            ),
                            color: isDark
                                ? AppTheme.darkMutedForeground
                                : AppTheme.lightMutedForeground,
                          ),
                        ),
                        const SizedBox(height: 12),
                        MadButton(
                          text: 'Open ITR Module',
                          onPressed: () {
                            final projectId = StoreProvider.of<AppState>(
                              context,
                            ).state.project.selectedProjectId;
                            Navigator.pushNamed(
                              context,
                              projectId == null || projectId.isEmpty
                                  ? '/projects'
                                  : '/itr',
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildUsersTab(
    bool isDark,
    Responsive responsive,
    bool canDeleteUsers,
  ) {
    if (_loadingUsers) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_usersError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: responsive.value(mobile: 48, tablet: 56, desktop: 64),
                color: Colors.red.withOpacity(0.5),
              ),
              const SizedBox(height: 12),
              Text(
                _usersError!,
                style: TextStyle(
                  fontSize: responsive.value(
                    mobile: 14,
                    tablet: 15,
                    desktop: 16,
                  ),
                  color: isDark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              MadButton(
                text: 'Retry',
                size: ButtonSize.sm,
                onPressed: _loadUsers,
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'User Management',
              style: TextStyle(
                fontSize: responsive.value(mobile: 16, tablet: 17, desktop: 18),
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            MadButton(
              text: responsive.isMobile ? null : 'Add User',
              icon: LucideIcons.plus,
              size: ButtonSize.sm,
              onPressed: () => _showAddUserDialog(context, isDark, responsive),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MadSearchInput(
          controller: _userSearchController,
          hintText: 'Search by name, email, username or role...',
          onChanged: (_) => setState(() {}),
          onClear: () {
            _userSearchController.clear();
            setState(() {});
          },
          width: responsive.isMobile ? double.infinity : 320,
        ),
        const SizedBox(height: 16),
        Expanded(
          child: MadCard(
            child: _filteredUsers.isEmpty
                ? Center(
                    child: Text(
                      _userSearchController.text.trim().isNotEmpty
                          ? 'No users match your search'
                          : 'No users yet',
                      style: TextStyle(
                        fontSize: 14,
                        color: isDark
                            ? AppTheme.darkMutedForeground
                            : AppTheme.lightMutedForeground,
                      ),
                    ),
                  )
                : ListView.builder(
                    itemCount: _filteredUsers.length,
                    itemBuilder: (context, index) {
                      final user = _filteredUsers[index];
                      return _buildUserListTile(
                        user,
                        isDark,
                        responsive,
                        canDeleteUsers,
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }

  Future<void> _loadAccessControlForSelectedUser() async {
    final userId = _selectedAccessUserId;
    if (userId == null || userId.isEmpty) {
      if (mounted) {
        setState(() {
          _draftAccessControl = buildDefaultAccessControl();
        });
      }
      return;
    }

    final selectedUser = _findUserById(userId);
    if (selectedUser == null) return;

    final resolvedUser = AccessControlStore.resolveUserAccessControl(
      selectedUser.toJson(),
    );
    if (!mounted) return;
    setState(() {
      _draftAccessControl = normalizeAccessControl(
        resolvedUser['access_control'],
      );
    });
  }

  Map<String, dynamic> _cloneAccessControl(Map<String, dynamic> value) {
    return jsonDecode(jsonEncode(value)) as Map<String, dynamic>;
  }

  void _updatePageAccess(String pagePath, bool enabled) {
    setState(() {
      final next = _cloneAccessControl(_draftAccessControl);
      final pages = Map<String, dynamic>.from(next['pages'] as Map);
      final functions = Map<String, dynamic>.from(next['functions'] as Map);

      pages[pagePath] = enabled;
      if (!enabled) {
        for (final pageDef in accessControlCatalog) {
          if (pageDef.pagePath != pagePath) continue;
          for (final fn in pageDef.functions) {
            functions[fn.key] = false;
          }
          break;
        }
      }

      _draftAccessControl = {'pages': pages, 'functions': functions};
    });
  }

  void _updateFunctionAccess(
    String functionKey,
    bool enabled,
    String pagePath,
  ) {
    setState(() {
      final next = _cloneAccessControl(_draftAccessControl);
      final pages = Map<String, dynamic>.from(next['pages'] as Map);
      final functions = Map<String, dynamic>.from(next['functions'] as Map);

      functions[functionKey] = enabled;
      if (enabled) {
        pages[pagePath] = true;
      }

      _draftAccessControl = {'pages': pages, 'functions': functions};
    });
  }

  void _setAllAccess(bool enabled) {
    setState(() {
      final next = _cloneAccessControl(_draftAccessControl);
      final pages = Map<String, dynamic>.from(next['pages'] as Map);
      final functions = Map<String, dynamic>.from(next['functions'] as Map);

      for (final page in accessControlCatalog) {
        pages[page.pagePath] = enabled;
        for (final fn in page.functions) {
          functions[fn.key] = enabled;
        }
      }

      _draftAccessControl = {'pages': pages, 'functions': functions};
    });
  }

  Future<void> _saveAccessControl() async {
    final userId = _selectedAccessUserId;
    if (userId == null || userId.isEmpty) return;

    final selectedUser = _findUserById(userId);
    if (selectedUser == null) return;

    if (selectedUser.role == 'admin') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Admins always have full access. Select a non-admin user.',
          ),
        ),
      );
      return;
    }

    setState(() => _savingAccessControl = true);
    final normalized = normalizeAccessControl(_draftAccessControl);
    final store = StoreProvider.of<AppState>(context);
    final currentUser = store.state.auth.user;
    final grantedBy =
        (currentUser?['user_id'] ?? currentUser?['id'] ?? '').toString();
    final grantedByName =
        currentUser?['name']?.toString() ??
        currentUser?['email']?.toString();
    final payload = {
      'pages': normalized['pages'] ?? <String, dynamic>{},
      'functions': normalized['functions'] ?? <String, dynamic>{},
      if (grantedBy.isNotEmpty) 'granted_by': grantedBy,
      if (grantedByName != null && grantedByName.isNotEmpty)
        'granted_by_name': grantedByName,
    };
    final saveResult =
        await ApiClient.updateAccessUserBulk(selectedUser.id, payload);
    if (saveResult['success'] != true) {
      if (!mounted) return;
      setState(() => _savingAccessControl = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            saveResult['error']?.toString() ??
                'Failed to update access permissions.',
          ),
        ),
      );
      return;
    }

    if (!mounted) return;

    setState(() {
      _users = _users
          .map(
            (u) => u.id == selectedUser.id
                ? User(
                    id: u.id,
                    name: u.name,
                    username: u.username,
                    email: u.email,
                    phoneNumber: u.phoneNumber,
                    role: u.role,
                    projectList: u.projectList,
                    avatar: u.avatar,
                    accessControl: normalized,
                  )
                : u,
          )
          .toList();
    });

    final currentUserId = (currentUser?['user_id'] ?? currentUser?['id'] ?? '')
        .toString();
    if (currentUserId == selectedUser.id && currentUser != null) {
      final updatedCurrentUser = Map<String, dynamic>.from(currentUser);
      updatedCurrentUser['access_control'] = normalized;
      store.dispatch(LoginSuccess(updatedCurrentUser));
      await AuthStorage.setUser(updatedCurrentUser);
    }

    setState(() => _savingAccessControl = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Access settings saved for ${selectedUser.name}.'),
      ),
    );
  }

  Widget _buildAccessControlTab(bool isDark, Responsive responsive) {
    final selectedUser = _findUserById(_selectedAccessUserId);

    final pages = (_draftAccessControl['pages'] as Map?) ?? const {};
    final functions = (_draftAccessControl['functions'] as Map?) ?? const {};
    final enabledPages = pages.values.where((value) => value == true).length;
    final enabledFunctions = functions.values
        .where((value) => value == true)
        .length;
    final totalFunctions = accessControlCatalog.fold<int>(
      0,
      (sum, page) => sum + page.functions.length,
    );

    if (_loadingUsers) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_usersError != null) {
      return Center(
        child: Text(
          _usersError!,
          style: TextStyle(
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
      );
    }

    final widgets = <Widget>[
      Row(
        children: [
          Expanded(
            child: Text(
              'Access Control',
              style: TextStyle(
                fontSize: responsive.value(mobile: 16, tablet: 17, desktop: 18),
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
          ),
          MadButton(
            text: 'Allow all',
            size: ButtonSize.sm,
            variant: ButtonVariant.outline,
            onPressed: selectedUser == null || selectedUser.role == 'admin'
                ? null
                : () => _setAllAccess(true),
          ),
          const SizedBox(width: 8),
          MadButton(
            text: 'Deny all',
            size: ButtonSize.sm,
            variant: ButtonVariant.outline,
            onPressed: selectedUser == null || selectedUser.role == 'admin'
                ? null
                : () => _setAllAccess(false),
          ),
          const SizedBox(width: 8),
          MadButton(
            text: _savingAccessControl ? 'Saving...' : 'Save',
            size: ButtonSize.sm,
            onPressed:
                _savingAccessControl ||
                    selectedUser == null ||
                    selectedUser.role == 'admin'
                ? null
                : _saveAccessControl,
          ),
        ],
      ),
      const SizedBox(height: 12),
      MadCard(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              MadSelect<String>(
                labelText: 'Select User',
                value: _selectedAccessUserId,
                searchable: true,
                searchHint: 'Search users...',
                options: _users
                    .map(
                      (user) => MadSelectOption<String>(
                        value: user.id,
                        label: '${user.name} (${user.role})',
                      ),
                    )
                    .toList(),
                onChanged: (value) async {
                  if (value == null) return;
                  setState(() => _selectedAccessUserId = value);
                  await _loadAccessControlForSelectedUser();
                },
                placeholder: 'Select user',
              ),
              const SizedBox(height: 12),
              if (selectedUser != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                        .withOpacity(0.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        selectedUser.name,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        selectedUser.email,
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                      const SizedBox(height: 8),
                      MadBadge(
                        text: _getRoleName(selectedUser.role),
                        variant: selectedUser.role == 'admin'
                            ? BadgeVariant.default_
                            : BadgeVariant.secondary,
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildAccessStatCard(
                      title: 'Pages Enabled',
                      value: '$enabledPages / ${accessControlCatalog.length}',
                      isDark: isDark,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildAccessStatCard(
                      title: 'Functions Enabled',
                      value: '$enabledFunctions / $totalFunctions',
                      isDark: isDark,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 12),
    ];

    if (selectedUser == null) {
      widgets.add(
        Text(
          'Select a user from the dropdown to configure access.',
          style: TextStyle(
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
      );
    } else if (selectedUser.role == 'admin') {
      widgets.add(
        Text(
          'Admin users always have full access.',
          style: TextStyle(
            color: isDark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
      );
    } else {
      for (final page in accessControlCatalog) {
        final pageEnabled = pages[page.pagePath] == true;
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: MadCard(
              child: ExpansionTile(
                tilePadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 4,
                ),
                title: Text(page.pageTitle),
                subtitle: Text(
                  '${page.category} • ${page.description}',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark
                        ? AppTheme.darkMutedForeground
                        : AppTheme.lightMutedForeground,
                  ),
                ),
                childrenPadding: const EdgeInsets.only(
                  left: 16,
                  right: 16,
                  bottom: 12,
                ),
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
                          .withOpacity(0.4),
                    ),
                    child: MadSwitch(
                      value: pageEnabled,
                      onChanged: (value) =>
                          _updatePageAccess(page.pagePath, value),
                      label: 'Page Access',
                      description:
                          'Allow this page in sidebar and direct route.',
                    ),
                  ),
                  const SizedBox(height: 8),
                  for (final fn in page.functions) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color:
                              (isDark
                                      ? AppTheme.darkBorder
                                      : AppTheme.lightBorder)
                                  .withOpacity(0.5),
                        ),
                      ),
                      child: MadSwitch(
                        value: functions[fn.key] == true,
                        onChanged: (value) =>
                            _updateFunctionAccess(fn.key, value, page.pagePath),
                        label: fn.label,
                        description: fn.description,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      }
    }

    return ListView(children: widgets);
  }

  Widget _buildAccessStatCard({
    required String title,
    required String value,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
              .withOpacity(0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 12,
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  User? _findUserById(String? userId) {
    if (userId == null || userId.isEmpty) return null;
    for (final user in _users) {
      if (user.id == userId) return user;
    }
    return null;
  }

  Widget _buildUserListTile(
    User user,
    bool isDark,
    Responsive responsive,
    bool canDeleteUsers,
  ) {
    if (responsive.isMobile) {
      // Card-style on mobile
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                  .withOpacity(0.5),
            ),
          ),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
              child: Text(
                user.initials,
                style: TextStyle(
                  color: AppTheme.primaryColor,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.name,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                  Text(
                    user.email,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                  if (user.username != null && user.username!.isNotEmpty)
                    Text(
                      user.username!,
                      style: TextStyle(
                        fontSize: 11,
                        color:
                            (isDark
                                    ? AppTheme.darkMutedForeground
                                    : AppTheme.lightMutedForeground)
                                .withOpacity(0.8),
                      ),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  const SizedBox(height: 4),
                  MadBadge(
                    text: _getRoleName(user.role),
                    variant: BadgeVariant.secondary,
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 18),
              onSelected: (value) {
                if (value == 'edit')
                  _showEditUserDialog(context, user, isDark, responsive);
                else if (value == 'delete')
                  _showDeleteUserDialog(context, user);
              },
              itemBuilder: (context) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                if (canDeleteUsers)
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text('Delete', style: TextStyle(color: Colors.red)),
                  ),
              ],
            ),
          ],
        ),
      );
    }

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
        child: Text(
          user.initials,
          style: TextStyle(
            color: AppTheme.primaryColor,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      title: Text(user.name, overflow: TextOverflow.ellipsis, maxLines: 1),
      subtitle: Text(
        user.username != null && user.username!.isNotEmpty
            ? '${user.username} · ${user.email}'
            : user.email,
        overflow: TextOverflow.ellipsis,
        maxLines: 1,
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          MadBadge(
            text: _getRoleName(user.role),
            variant: BadgeVariant.secondary,
          ),
          const SizedBox(width: 8),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, size: 18),
            onSelected: (value) {
              if (value == 'edit')
                _showEditUserDialog(context, user, isDark, responsive);
              else if (value == 'delete')
                _showDeleteUserDialog(context, user);
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
              if (canDeleteUsers)
                const PopupMenuItem(
                  value: 'delete',
                  child: Text('Delete', style: TextStyle(color: Colors.red)),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(
    String label,
    String value,
    bool isDark,
    Responsive responsive,
  ) {
    if (responsive.isMobile) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThemeOption({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    required bool isDark,
    required Responsive responsive,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(
          responsive.value(mobile: 12, tablet: 14, desktop: 16),
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primaryColor.withOpacity(0.1)
              : (isDark ? AppTheme.darkMuted : AppTheme.lightMuted),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppTheme.primaryColor : Colors.transparent,
            width: 2,
          ),
        ),
        child: responsive.isMobile
            ? Row(
                children: [
                  Icon(
                    icon,
                    size: 24,
                    color: isSelected
                        ? AppTheme.primaryColor
                        : (isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    label,
                    style: TextStyle(
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.normal,
                      color: isSelected
                          ? AppTheme.primaryColor
                          : (isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground),
                    ),
                  ),
                  const Spacer(),
                  if (isSelected)
                    Icon(
                      Icons.check_circle,
                      color: AppTheme.primaryColor,
                      size: 20,
                    ),
                ],
              )
            : Column(
                children: [
                  Icon(
                    icon,
                    size: responsive.value(mobile: 24, tablet: 28, desktop: 32),
                    color: isSelected
                        ? AppTheme.primaryColor
                        : (isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    style: TextStyle(
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.normal,
                      color: isSelected
                          ? AppTheme.primaryColor
                          : (isDark
                                ? AppTheme.darkForeground
                                : AppTheme.lightForeground),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  void _setTheme(AppThemeMode mode) {
    final store = StoreProvider.of<AppState>(context);
    store.dispatch(SetTheme(mode));
  }

  String _getRoleName(String role) {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'operational_manager':
        return 'Operational Manager';
      case 'project_manager':
        return 'Project Manager';
      case 'po_officer':
        return 'PO Officer';
      case 'labour':
        return 'Labour';
      default:
        return role;
    }
  }

  void _showAddUserDialog(
    BuildContext context,
    bool isDark,
    Responsive responsive,
  ) {
    if (responsive.isMobile) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        builder: (ctx) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: SafeArea(
            child: _AddUserForm(
              roleOptions: _roleOptions,
              projectOptions: _projectOptions,
              loadingProjects: _loadingProjects,
              onCancel: () => Navigator.pop(ctx),
              onSuccess: () {
                Navigator.pop(ctx);
                _loadUsers();
              },
            ),
          ),
        ),
      );
    } else {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Add New User'),
          content: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: responsive.dialogWidth()),
            child: _AddUserForm(
              roleOptions: _roleOptions,
              projectOptions: _projectOptions,
              loadingProjects: _loadingProjects,
              onCancel: () => Navigator.pop(ctx),
              onSuccess: () {
                Navigator.pop(ctx);
                _loadUsers();
              },
            ),
          ),
        ),
      );
    }
  }

  void _showEditUserDialog(
    BuildContext context,
    User user,
    bool isDark,
    Responsive responsive,
  ) {
    if (responsive.isMobile) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        builder: (ctx) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: SafeArea(
            child: _EditUserForm(
              user: user,
              roleOptions: _roleOptions,
              projectOptions: _projectOptions,
              loadingProjects: _loadingProjects,
              onCancel: () => Navigator.pop(ctx),
              onSuccess: () {
                Navigator.pop(ctx);
                _loadUsers();
              },
            ),
          ),
        ),
      );
    } else {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Edit User'),
          content: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: responsive.dialogWidth()),
            child: _EditUserForm(
              user: user,
              roleOptions: _roleOptions,
              projectOptions: _projectOptions,
              loadingProjects: _loadingProjects,
              onCancel: () => Navigator.pop(ctx),
              onSuccess: () {
                Navigator.pop(ctx);
                _loadUsers();
              },
            ),
          ),
        ),
      );
    }
  }

  void _showDeleteUserDialog(BuildContext context, User user) {
    final messenger = ScaffoldMessenger.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete User'),
        content: Text(
          'Are you sure you want to delete "${user.name}" (${user.email})? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final result = await ApiClient.deleteUser(user.id);
              if (!mounted) return;
              if (result['success'] == true) {
                _loadUsers();
              } else {
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(
                      result['message']?.toString() ?? 'Failed to delete user',
                    ),
                  ),
                );
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}

class _ProfilePermissionsViewModel {
  final bool isAdmin;
  final bool isOperationalManager;
  final bool canViewUserManagementTab;
  final bool canViewAccessControlTab;

  _ProfilePermissionsViewModel({
    required this.isAdmin,
    required this.isOperationalManager,
    required this.canViewUserManagementTab,
    required this.canViewAccessControlTab,
  });

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is _ProfilePermissionsViewModel &&
            isAdmin == other.isAdmin &&
            isOperationalManager == other.isOperationalManager &&
            canViewUserManagementTab == other.canViewUserManagementTab &&
            canViewAccessControlTab == other.canViewAccessControlTab;
  }

  @override
  int get hashCode => Object.hash(
        isAdmin,
        isOperationalManager,
        canViewUserManagementTab,
        canViewAccessControlTab,
      );
}

class _ProfileAuthViewModel {
  final String userName;
  final String userEmail;
  final String userPhone;
  final String userRole;

  const _ProfileAuthViewModel({
    required this.userName,
    required this.userEmail,
    required this.userPhone,
    required this.userRole,
  });

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is _ProfileAuthViewModel &&
            userName == other.userName &&
            userEmail == other.userEmail &&
            userPhone == other.userPhone &&
            userRole == other.userRole;
  }

  @override
  int get hashCode => Object.hash(userName, userEmail, userPhone, userRole);
}

/// Form content for Add User dialog (stateful for controllers and role)
class _AddUserForm extends StatefulWidget {
  final List<MadSelectOption<String>> roleOptions;
  final List<MadSelectOption<String>> projectOptions;
  final bool loadingProjects;
  final VoidCallback onCancel;
  final VoidCallback onSuccess;

  const _AddUserForm({
    required this.roleOptions,
    required this.projectOptions,
    required this.loadingProjects,
    required this.onCancel,
    required this.onSuccess,
  });

  @override
  State<_AddUserForm> createState() => _AddUserFormState();
}

class _AddUserFormState extends State<_AddUserForm> {
  final _nameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _checkInController = TextEditingController();
  final _checkOutController = TextEditingController();
  String _selectedRole = 'labour';
  Set<String> _selectedProjectIds = {};
  String? _errorText;
  bool _loading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _checkInController.dispose();
    _checkOutController.dispose();
    super.dispose();
  }

  String _formatTime(TimeOfDay time) {
    final hh = time.hour.toString().padLeft(2, '0');
    final mm = time.minute.toString().padLeft(2, '0');
    return '$hh:$mm:00';
  }

  TimeOfDay? _parseTime(String value) {
    final parts = value.split(':');
    if (parts.length < 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return TimeOfDay(hour: h.clamp(0, 23), minute: m.clamp(0, 59));
  }

  Future<void> _pickTime({required bool isCheckIn}) async {
    final controller = isCheckIn ? _checkInController : _checkOutController;
    final initial = _parseTime(controller.text) ?? const TimeOfDay(hour: 9, minute: 0);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
    );
    if (picked == null) return;
    setState(() {
      controller.text = _formatTime(picked);
    });
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final username = _usernameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    final password = _passwordController.text;
    final checkInTime = _checkInController.text.trim();
    final checkOutTime = _checkOutController.text.trim();

    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      setState(() => _errorText = 'Name, email, and password are required');
      return;
    }
    if (_selectedRole == 'labour' &&
        (checkInTime.isEmpty || checkOutTime.isEmpty)) {
      setState(
        () => _errorText = 'Check-in and check-out times are required for labour',
      );
      return;
    }
    setState(() {
      _errorText = null;
      _loading = true;
    });
    final selectedProjects = _selectedProjectIds.toList();

    final payload = <String, dynamic>{
      'name': name,
      'username': username.isEmpty ? name : username,
      'email': email,
      'phone_number': phone.isEmpty ? null : phone,
      'password': password,
      'role': _selectedRole,
      'project': selectedProjects,
      'project_list': selectedProjects,
    };
    if (_selectedRole == 'labour') {
      payload['check_in_time'] = checkInTime;
      payload['check_out_time'] = checkOutTime;
    }

    final result = await ApiClient.createUser(payload);
    if (!mounted) return;
    setState(() => _loading = false);
    if (result['success'] == true) {
      widget.onSuccess();
    } else {
      setState(
        () =>
            _errorText = result['message']?.toString() ?? 'Failed to add user',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MadInput(
            controller: _nameController,
            labelText: 'Name',
            hintText: 'Enter full name',
          ),
          const SizedBox(height: 16),
          MadInput(
            controller: _usernameController,
            labelText: 'Username',
            hintText: 'Enter username',
          ),
          const SizedBox(height: 16),
          MadInput(
            controller: _emailController,
            labelText: 'Email',
            hintText: 'Enter email',
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 16),
          MadInput(
            controller: _phoneController,
            labelText: 'Phone',
            hintText: 'Enter phone number',
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 16),
          MadSelect<String>(
            labelText: 'Role',
            value: _selectedRole,
            options: widget.roleOptions,
            onChanged: (v) {
              setState(() {
                _selectedRole = v ?? 'labour';
                if (_selectedRole != 'labour') {
                  _checkInController.clear();
                  _checkOutController.clear();
                }
              });
            },
            placeholder: 'Select role',
          ),
          if (_selectedRole == 'labour') ...[
            const SizedBox(height: 16),
            DefaultTabController(
              length: 2,
              child: Container(
                decoration: BoxDecoration(
                  color: (Theme.of(context).brightness == Brightness.dark
                          ? AppTheme.darkMuted
                          : AppTheme.lightMuted)
                      .withOpacity(0.4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppTheme.darkBorder
                        : AppTheme.lightBorder,
                  ),
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TabBar(
                      labelColor: Theme.of(context).brightness == Brightness.dark
                          ? AppTheme.darkForeground
                          : AppTheme.lightForeground,
                      unselectedLabelColor:
                          Theme.of(context).brightness == Brightness.dark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                      indicatorColor: AppTheme.primaryColor,
                      tabs: const [
                        Tab(text: 'Check In'),
                        Tab(text: 'Check Out'),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 110,
                      child: TabBarView(
                        children: [
                          MadInput(
                            controller: _checkInController,
                            labelText: 'Check In Time',
                            hintText: 'HH:MM:SS',
                            suffix: IconButton(
                              icon: const Icon(Icons.access_time, size: 18),
                              onPressed: () => _pickTime(isCheckIn: true),
                            ),
                          ),
                          MadInput(
                            controller: _checkOutController,
                            labelText: 'Check Out Time',
                            hintText: 'HH:MM:SS',
                            suffix: IconButton(
                              icon: const Icon(Icons.access_time, size: 18),
                              onPressed: () => _pickTime(isCheckIn: false),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          MadInput(
            controller: _passwordController,
            labelText: 'Password',
            hintText: 'Enter password',
            obscureText: true,
          ),
          const SizedBox(height: 16),
          Text(
            'Projects',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
          const SizedBox(height: 8),
          if (widget.loadingProjects)
            Text(
              'Loading projects...',
              style: TextStyle(
                fontSize: 13,
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            )
          else
            Column(
              children: widget.projectOptions.map((option) {
                final isSelected = _selectedProjectIds.contains(option.value);
                return CheckboxListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: isSelected,
                  title: Text(option.label),
                  onChanged: (checked) {
                    if (checked == null) return;
                    setState(() {
                      if (checked) {
                        _selectedProjectIds.add(option.value);
                      } else {
                        _selectedProjectIds.remove(option.value);
                      }
                    });
                  },
                );
              }).toList(),
            ),
          if (_errorText != null) ...[
            const SizedBox(height: 12),
            Text(
              _errorText!,
              style: const TextStyle(color: Colors.red, fontSize: 13),
            ),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: MadButton(
                  text: 'Cancel',
                  variant: ButtonVariant.outline,
                  onPressed: _loading ? null : widget.onCancel,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: MadButton(
                  text: 'Add User',
                  onPressed: _loading ? null : _submit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Form content for Edit User dialog
class _EditUserForm extends StatefulWidget {
  final User user;
  final List<MadSelectOption<String>> roleOptions;
  final List<MadSelectOption<String>> projectOptions;
  final bool loadingProjects;
  final VoidCallback onCancel;
  final VoidCallback onSuccess;

  const _EditUserForm({
    required this.user,
    required this.roleOptions,
    required this.projectOptions,
    required this.loadingProjects,
    required this.onCancel,
    required this.onSuccess,
  });

  @override
  State<_EditUserForm> createState() => _EditUserFormState();
}

class _EditUserFormState extends State<_EditUserForm> {
  late final TextEditingController _usernameController;
  late final TextEditingController _emailController;
  late final TextEditingController _phoneController;
  late String _selectedRole;
  late Set<String> _selectedProjectIds;
  String? _errorText;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _usernameController = TextEditingController(
      text: widget.user.username ?? widget.user.name,
    );
    _emailController = TextEditingController(text: widget.user.email);
    _phoneController = TextEditingController(
      text: widget.user.phoneNumber ?? '',
    );
    _selectedRole = widget.user.role;
    final assigned = widget.user.projectList ?? const <String>[];
    _selectedProjectIds = Set<String>.from(assigned);
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _usernameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();

    if (username.isEmpty || email.isEmpty) {
      setState(() => _errorText = 'Username and email are required');
      return;
    }
    setState(() {
      _errorText = null;
      _loading = true;
    });
    final selectedProjects = _selectedProjectIds.toList();

    final result = await ApiClient.updateUser(widget.user.id, {
      'username': username,
      'email': email,
      'phone_number': phone.isEmpty ? null : phone,
      'role': _selectedRole,
      'project_list': selectedProjects,
    });
    if (!mounted) return;
    setState(() => _loading = false);
    if (result['success'] == true) {
      widget.onSuccess();
    } else {
      setState(
        () => _errorText =
            result['message']?.toString() ?? 'Failed to update user',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MadInput(
            controller: _usernameController,
            labelText: 'Username',
            hintText: 'Enter username',
          ),
          const SizedBox(height: 16),
          MadInput(
            controller: _emailController,
            labelText: 'Email',
            hintText: 'Enter email',
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 16),
          MadInput(
            controller: _phoneController,
            labelText: 'Phone',
            hintText: 'Enter phone number',
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 16),
          MadSelect<String>(
            labelText: 'Role',
            value: _selectedRole,
            options: widget.roleOptions,
            onChanged: (v) => setState(() => _selectedRole = v ?? 'labour'),
            placeholder: 'Select role',
          ),
          const SizedBox(height: 16),
          Text(
            'Projects',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
          const SizedBox(height: 8),
          if (widget.loadingProjects)
            Text(
              'Loading projects...',
              style: TextStyle(
                fontSize: 13,
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
            )
          else
            Column(
              children: widget.projectOptions.map((option) {
                final isSelected = _selectedProjectIds.contains(option.value);
                return CheckboxListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: isSelected,
                  title: Text(option.label),
                  onChanged: (checked) {
                    if (checked == null) return;
                    setState(() {
                      if (checked) {
                        _selectedProjectIds.add(option.value);
                      } else {
                        _selectedProjectIds.remove(option.value);
                      }
                    });
                  },
                );
              }).toList(),
            ),
          if (_errorText != null) ...[
            const SizedBox(height: 12),
            Text(
              _errorText!,
              style: const TextStyle(color: Colors.red, fontSize: 13),
            ),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: MadButton(
                  text: 'Cancel',
                  variant: ButtonVariant.outline,
                  onPressed: _loading ? null : widget.onCancel,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: MadButton(
                  text: 'Save',
                  onPressed: _loading ? null : _submit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
