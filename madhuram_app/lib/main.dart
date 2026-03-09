import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:redux/redux.dart';
import 'dart:io';

// Store
import 'store/app_state.dart';
import 'store/auth_reducer.dart';
import 'store/auth_actions.dart';
import 'store/project_actions.dart';

// Models
import 'models/project.dart';

// Services
import 'services/auth_storage.dart';
import 'services/http_overrides.dart';
import 'services/api_client.dart';
import 'services/notification_service.dart';
import 'services/access_control_store.dart';

// Theme
import 'theme/app_theme.dart';

// Animations
import 'utils/animations.dart';

// Pages
import 'pages/login_page.dart';
import 'pages/project_selection_page.dart';
import 'pages/dashboard_page.dart';
import 'pages/boq_page.dart';
import 'pages/profile_page.dart';
// Inventory Module
import 'pages/materials_page.dart';
import 'pages/add_inventory_page.dart';
import 'pages/stock_areas_page.dart';
import 'pages/stock_transfers_page.dart';
import 'pages/consumption_page.dart';
import 'pages/returns_page.dart';

// Procurement Module
import 'pages/purchase_requests_page.dart';
import 'pages/vendor_comparison_page.dart';
import 'pages/purchase_orders_page_full.dart';
import 'pages/vendors_page_full.dart';
import 'pages/vendor_create_page.dart';
import 'pages/samples_page.dart';
import 'pages/sample_create_page.dart';
import 'pages/sample_preview_page.dart';
import 'pages/sample_edit_page.dart';

// Delivery & Inspection Module
import 'pages/challans_page.dart';
import 'pages/new_challan_page.dart';
import 'pages/challan_detail_page.dart';
import 'pages/mer_page.dart';
import 'pages/mir_page_full.dart';
import 'pages/itr_page_full.dart';

// Project Management Module
import 'pages/mas_page.dart';
import 'pages/billing_page.dart';

// Reporting & Admin Module
import 'pages/documents_page.dart';
import 'pages/reports_page.dart';
import 'pages/audit_logs_page.dart';

// Create store globally
late Store<AppState> store;

/// Named routes with fade transition (used by onGenerateRoute and routes)
final Map<String, Widget Function(BuildContext)> _appRoutes = {
  '/login': (context) => const LoginPage(),
  '/projects': (context) => const ProjectSelectionPage(),
  '/dashboard': (context) => const DashboardPage(),
  '/boq': (context) => const BOQPage(),
  '/mas': (context) => const MASPageFull(),
  '/samples': (context) => const SamplesPageFull(),
  '/purchase-requests': (context) => const PurchaseRequestsPageFull(),
  '/vendor-comparison': (context) => const VendorComparisonPageFull(),
  '/purchase-orders': (context) => const PurchaseOrdersPageFull(),
  '/vendors': (context) => const VendorsPageFull(),
  '/vendors/new': (context) => const VendorCreatePage(),
  '/challans': (context) => const ChallansPageFull(),
  '/challans/new': (context) => const NewChallanPage(),
  '/mer': (context) => const MERPageFull(),
  '/mir': (context) => const MIRPageFull(),
  '/itr': (context) => const ITRPageFull(),
  '/billing': (context) => const BillingPageFull(),
  '/stock-areas': (context) => const StockAreasPage(),
  '/materials': (context) => const MaterialsPage(),
  '/inventory/add': (context) => const AddInventoryPage(),
  '/projects/inventory/add': (context) => const AddInventoryPage(),
  '/stock-transfers': (context) => const StockTransfersPage(),
  '/consumption': (context) => const ConsumptionPage(),
  '/returns': (context) => const ReturnsPage(),
  '/documents': (context) => const DocumentsPageFull(),
  '/reports': (context) => const ReportsPageFull(),
  '/audit-logs': (context) => const AuditLogsPageFull(),
  '/profile': (context) => const ProfilePage(),
};

void main() async {
  // Ensure Flutter binding is initialized
  WidgetsFlutterBinding.ensureInitialized();

  // Allow self-signed certs in dev mode
  assert(() {
    HttpOverrides.global = DevHttpOverrides();
    return true;
  }());

  // Create the Redux store ONCE at app startup
  store = Store<AppState>(appReducer, initialState: AppState.initial());

  // Restore auth state from storage before running app
  await _restoreAuthState();
  await NotificationService.instance.initialize(store);

  runApp(MyApp(store: store));
}

/// Restore authentication state from storage.
/// Auth is restored synchronously (from local storage).
/// Project restoration is done in the background – never blocks app startup.
Future<void> _restoreAuthState() async {
  try {
    final hasUser = await AuthStorage.hasUser();
    if (hasUser) {
      final user = await AuthStorage.getUser();
      if (user != null) {
        final resolvedUser = await AccessControlStore.resolveUserAccessControl(
          user,
        );
        store.dispatch(LoginSuccess(resolvedUser));

        // Restore selected project from local storage WITHOUT calling API.
        // This ensures instant startup. The API fetch is done later when
        // ProjectSelectionPage loads.
        final savedProjectId = await AuthStorage.getSelectedProjectId();
        if (savedProjectId != null && savedProjectId.isNotEmpty) {
          // Create a minimal project map so MainLayout sees a selected project
          // and doesn't redirect to /projects.  The full project data will be
          // loaded when the user visits any page that needs it.
          store.dispatch(
            SelectProject({
              'project_id': savedProjectId,
              'project_name': 'Loading…',
            }),
          );

          // Fire-and-forget: try to fetch full project list in background
          _restoreProjectsInBackground(savedProjectId);
        }
      }
    }
  } catch (e) {
    debugPrint('Error restoring auth state: $e');
  }
}

/// Fetch projects in background and update the selected project with full data.
/// Never blocks – runs after the UI is already visible.
void _restoreProjectsInBackground(String savedProjectId) {
  ApiClient.getProjects()
      .then((result) {
        if (result['success'] == true) {
          final data = result['data'];
          final List<dynamic> projectList = data is List ? data : [];
          final projectMaps = projectList
              .map((e) => e as Map<String, dynamic>)
              .toList();
          store.dispatch(FetchProjectsSuccess(projectMaps));

          final projects = projectMaps.map((m) => Project.fromJson(m)).toList();
          final savedProject = projects.firstWhere(
            (p) => p.id == savedProjectId,
            orElse: () => Project(id: '', name: ''),
          );
          if (savedProject.id.isNotEmpty) {
            store.dispatch(SelectProject(savedProject.toMap()));
          }
        }
      })
      .catchError((e) {
        debugPrint('[Main] Background project restore failed: $e');
      });
}

class MyApp extends StatelessWidget {
  final Store<AppState> store;

  const MyApp({super.key, required this.store});

  @override
  Widget build(BuildContext context) {
    return StoreProvider<AppState>(
      store: store,
      child: StoreConnector<AppState, ThemeState>(
        converter: (store) => store.state.theme,
        builder: (context, themeState) {
          // Determine actual theme mode
          final platformBrightness =
              WidgetsBinding.instance.platformDispatcher.platformBrightness;
          final effectiveTheme = themeState.mode == AppThemeMode.system
              ? (platformBrightness == Brightness.dark
                    ? AppThemeMode.dark
                    : AppThemeMode.light)
              : themeState.mode;

          return MaterialApp(
            title: 'Madhuram',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme(),
            darkTheme: AppTheme.darkTheme(),
            themeMode: effectiveTheme == AppThemeMode.dark
                ? ThemeMode.dark
                : ThemeMode.light,
            builder: (context, child) {
              final mq = MediaQuery.of(context);
              final double current = mq.textScaler.scale(1.0);
              final double clamped = current.clamp(0.85, 1.15);
              return MediaQuery(
                data: mq.copyWith(textScaler: TextScaler.linear(clamped)),
                child: child ?? const SizedBox.shrink(),
              );
            },
            home: const AppRouter(),
            onGenerateRoute: (settings) {
              if (settings.name == '/challans/detail') {
                final id = settings.arguments?.toString() ?? '';
                return PageRouteBuilder<void>(
                  settings: settings,
                  pageBuilder: (context, animation, secondaryAnimation) =>
                      ChallanDetailPage(challanId: id),
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
                      },
                  transitionDuration: AppAnimations.normal,
                );
              }
              if (settings.name == '/samples/preview') {
                final id = settings.arguments?.toString() ?? '';
                return PageRouteBuilder<void>(
                  settings: settings,
                  pageBuilder: (context, animation, secondaryAnimation) =>
                      SamplePreviewPage(sampleId: id),
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
                      },
                  transitionDuration: AppAnimations.normal,
                );
              }
              if (settings.name == '/samples/edit') {
                final id = settings.arguments?.toString() ?? '';
                return PageRouteBuilder<void>(
                  settings: settings,
                  pageBuilder: (context, animation, secondaryAnimation) =>
                      SampleEditPage(sampleId: id),
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
                      },
                  transitionDuration: AppAnimations.normal,
                );
              }
              if (settings.name == '/samples/create') {
                final projectId = settings.arguments?.toString() ?? '';
                return PageRouteBuilder<void>(
                  settings: settings,
                  pageBuilder: (context, animation, secondaryAnimation) =>
                      SampleCreatePage(initialProjectId: projectId),
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
                      },
                  transitionDuration: AppAnimations.normal,
                );
              }
              final builder = _appRoutes[settings.name];
              if (builder != null) {
                return PageRouteBuilder<void>(
                  settings: settings,
                  pageBuilder: (context, animation, secondaryAnimation) =>
                      builder(context),
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
                      },
                  transitionDuration: AppAnimations.normal,
                );
              }
              return null;
            },
            routes: _appRoutes,
          );
        },
      ),
    );
  }
}

/// App Router - handles initial routing based on auth state
class AppRouter extends StatelessWidget {
  const AppRouter({super.key});

  @override
  Widget build(BuildContext context) {
    return StoreConnector<AppState, _AppRouterViewModel>(
      converter: (store) => _AppRouterViewModel(
        isAuthenticated: store.state.auth.isAuthenticated,
        hasSelectedProject: store.state.project.selectedProject != null,
      ),
      builder: (context, vm) {
        if (!vm.isAuthenticated) {
          return const LoginPage();
        }

        if (!vm.hasSelectedProject) {
          return const ProjectSelectionPage();
        }

        return const DashboardPage();
      },
    );
  }
}

class _AppRouterViewModel {
  final bool isAuthenticated;
  final bool hasSelectedProject;

  _AppRouterViewModel({
    required this.isAuthenticated,
    required this.hasSelectedProject,
  });
}
