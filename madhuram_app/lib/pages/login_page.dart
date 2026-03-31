import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../store/auth_actions.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../services/access_control_store.dart';
import '../components/ui/mad_button.dart';
import '../components/ui/mad_input.dart';
import '../utils/responsive.dart';

/// Login page matching React's Login.jsx - Responsive version
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  static const List<(String label, String email, String password)>
  _demoAccounts = [
    ('Admin Demo', 'admin@madhuram.com', 'admin123'),
    ('PM Demo', 'pm@madhuram.com', 'pm123'),
    ('Devang Demo', 'devang@gmail.com', '123456'),
  ];

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _showPassword = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_emailController.text.trim().isEmpty ||
        _passwordController.text.isEmpty) {
      setState(() {
        _error = 'Please enter both email and password.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    final store = StoreProvider.of<AppState>(context);
    store.dispatch(LoginStart());

    try {
      final result = await ApiClient.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      if (!mounted) return;

      if (result['success'] == true) {
        final user = await AuthStorage.getUser();
        if (user == null || user.isEmpty) {
          final error = 'Login failed: missing user/token in response.';
          store.dispatch(LoginFailure(error));
          if (mounted) {
            setState(() => _error = error);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(error),
                backgroundColor: const Color(0xFFDC2626),
              ),
            );
          }
          return;
        }
        final userId = (user['user_id'] ?? user['id'] ?? '').toString();
        Map<String, dynamic> resolvedUser = user;
        if (userId.isNotEmpty) {
          final accessResult = await ApiClient.getAccessUser(userId);
          if (accessResult['success'] == true &&
              accessResult['data'] is Map<String, dynamic>) {
            resolvedUser = AccessControlStore.resolveUserAccessControl(
              user,
              accessControl:
                  Map<String, dynamic>.from(accessResult['data'] as Map),
            );
          } else {
            resolvedUser = AccessControlStore.resolveUserAccessControl(user);
          }
        } else {
          resolvedUser = AccessControlStore.resolveUserAccessControl(user);
        }
        await AuthStorage.setUser(resolvedUser);
        store.dispatch(LoginSuccess(resolvedUser));
        if (mounted) {
          Navigator.pushReplacementNamed(context, '/projects');
        }
      } else {
        final status = result['status']?.toString();
        final baseUrl = ApiClient.baseUrl;
        final error = (result['error']?.toString().isNotEmpty == true)
            ? result['error'].toString()
            : 'Login failed';
        store.dispatch(LoginFailure(error));
        if (mounted) {
          setState(() => _error = error);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                status == null
                    ? '$error\nAPI: $baseUrl'
                    : '$error (HTTP $status)\nAPI: $baseUrl',
              ),
              backgroundColor: const Color(0xFFDC2626),
              duration: const Duration(seconds: 5),
            ),
          );
        }
      }
    } catch (e) {
      final error = 'Unable to login right now. $e';
      store.dispatch(LoginFailure(error));
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _fillDemoCredentials(String email, String password) {
    _emailController.text = email;
    _passwordController.text = password;
    setState(() => _error = null);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isWide = !responsive.isMobile;

    return Scaffold(
      body: Row(
        children: [
          // Left side - Hero section (desktop only)
          if (isWide)
            Expanded(
              flex: 5,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF4988C4), Color(0xFF2D5A87)],
                  ),
                ),
                child: Stack(
                  children: [
                    // Abstract background shapes
                    Positioned(
                      top: -100,
                      left: -100,
                      child: Container(
                        width: 400,
                        height: 400,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(0.1),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: -150,
                      right: -150,
                      child: Container(
                        width: 500,
                        height: 500,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                    ),
                    // Content
                    Padding(
                      padding: const EdgeInsets.all(48),
                      child: SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Logo
                            Row(
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(
                                    LucideIcons.package2,
                                    color: Colors.white,
                                    size: 28,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                const Text(
                                  'Madhuram',
                                  style: TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 48),
                            Text(
                              'Streamline Your\nInventory Management',
                              style: TextStyle(
                                fontSize: responsive.value(
                                  mobile: 32,
                                  tablet: 40,
                                  desktop: 48,
                                ),
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                height: 1.2,
                                letterSpacing: -1,
                              ),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              'Manage projects, track inventory, process purchase orders,\nand generate reports - all in one place.',
                              style: TextStyle(
                                fontSize: responsive.value(
                                  mobile: 14,
                                  tablet: 16,
                                  desktop: 18,
                                ),
                                color: Colors.white.withOpacity(0.8),
                                height: 1.5,
                              ),
                            ),
                            const SizedBox(height: 48),
                            // Feature badges
                            Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: [
                                _buildFeatureBadge('Project Management'),
                                _buildFeatureBadge('BOQ Tracking'),
                                _buildFeatureBadge('Purchase Orders'),
                                _buildFeatureBadge('Inventory Control'),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Right side - Login form
          Expanded(
            flex: isWide ? 4 : 1,
            child: Container(
              color: isDark
                  ? AppTheme.darkBackground
                  : AppTheme.lightBackground,
              child: SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.all(
                      responsive.value(mobile: 20, tablet: 28, desktop: 32),
                    ),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: responsive.value(
                          mobile: 360,
                          tablet: 380,
                          desktop: 400,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Mobile logo
                          if (!isWide) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: AppTheme.primaryColor,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(
                                    LucideIcons.package2,
                                    color: Colors.white,
                                    size: 28,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  'Madhuram',
                                  style: TextStyle(
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                    color: isDark
                                        ? AppTheme.darkForeground
                                        : AppTheme.lightForeground,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 48),
                          ],

                          // Welcome text
                          Text(
                            'Welcome back',
                            style: TextStyle(
                              fontSize: responsive.value(
                                mobile: 24,
                                tablet: 26,
                                desktop: 28,
                              ),
                              fontWeight: FontWeight.bold,
                              color: isDark
                                  ? AppTheme.darkForeground
                                  : AppTheme.lightForeground,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Enter your credentials to access your account',
                            style: TextStyle(
                              fontSize: responsive.value(
                                mobile: 13,
                                tablet: 13,
                                desktop: 14,
                              ),
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                          SizedBox(
                            height: responsive.value(
                              mobile: 24,
                              tablet: 28,
                              desktop: 32,
                            ),
                          ),

                          // Error message
                          if (_error != null) ...[
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.red.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: Colors.red.withOpacity(0.3),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.error_outline,
                                    color: Colors.red,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _error!,
                                      style: const TextStyle(
                                        color: Colors.red,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 24),
                          ],

                          // Email field
                          MadInput(
                            controller: _emailController,
                            labelText: 'Email',
                            hintText: 'Enter your email',
                            keyboardType: TextInputType.emailAddress,
                            prefix: Icon(
                              LucideIcons.mail,
                              size: 18,
                              color: isDark
                                  ? AppTheme.darkMutedForeground
                                  : AppTheme.lightMutedForeground,
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Password field
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Password',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: isDark
                                      ? AppTheme.darkForeground
                                      : AppTheme.lightForeground,
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _passwordController,
                                obscureText: !_showPassword,
                                decoration: InputDecoration(
                                  hintText: 'Enter your password',
                                  prefixIcon: Icon(
                                    LucideIcons.lock,
                                    size: 18,
                                    color: isDark
                                        ? AppTheme.darkMutedForeground
                                        : AppTheme.lightMutedForeground,
                                  ),
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      _showPassword
                                          ? LucideIcons.eyeOff
                                          : LucideIcons.eye,
                                      size: 18,
                                      color: isDark
                                          ? AppTheme.darkMutedForeground
                                          : AppTheme.lightMutedForeground,
                                    ),
                                    onPressed: () => setState(
                                      () => _showPassword = !_showPassword,
                                    ),
                                  ),
                                ),
                                onSubmitted: (_) => _login(),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),

                          // Login button
                          MadButton(
                            text: 'Sign in',
                            onPressed: _isLoading ? null : _login,
                            loading: _isLoading,
                          ),
                          const SizedBox(height: 16),

                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? Colors.white.withOpacity(0.04)
                                  : Colors.black.withOpacity(0.03),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isDark
                                    ? Colors.white.withOpacity(0.1)
                                    : Colors.black.withOpacity(0.08),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Demo Login Credentials',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: isDark
                                        ? AppTheme.darkForeground
                                        : AppTheme.lightForeground,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                ..._demoAccounts.map((account) {
                                  return _buildDemoCredentialTile(
                                    context,
                                    isDark: isDark,
                                    label: account.$1,
                                    email: account.$2,
                                    password: account.$3,
                                  );
                                }),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Terms and Privacy
                          Text(
                            'By continuing, you agree to our Terms of Service and Privacy Policy.',
                            textAlign: TextAlign.center,
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
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.2)),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildDemoCredentialTile(
    BuildContext context, {
    required bool isDark,
    required String label,
    required String email,
    required String password,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: _isLoading ? null : () => _fillDemoCredentials(email, password),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '$label: $email / $password',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark
                      ? AppTheme.darkMutedForeground
                      : AppTheme.lightMutedForeground,
                ),
              ),
            ),
            Text(
              'Use',
              style: TextStyle(
                fontSize: 12,
                color: AppTheme.primaryColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
