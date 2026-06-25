import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'dart:io';

import 'firebase_options.dart';

// Services
import 'services/auth_storage.dart';
import 'services/http_overrides.dart';
import 'services/api_client.dart';
import 'services/attendance_reminder_service.dart';
import 'services/notification_service.dart';
import 'services/push_notification_service.dart';
import 'services/auth_refresh_service.dart';
import 'services/access_control_store.dart';
import 'providers/legacy_session_providers.dart';
import 'store/app_state.dart';
import 'utils/state_signature.dart';

// Theme
import 'theme/app_theme.dart';

// UI
import 'components/ui/components.dart';

// Pages
import 'pages/login_page.dart';
import 'pages/project_selection_page.dart';
import 'pages/dashboard_page.dart';
import 'pages/attendance_page.dart';
import 'pages/my_attendance_page.dart';
import 'pages/quotes_list_page.dart';
import 'pages/boq_page.dart';
import 'pages/profile_page.dart';
// Inventory Module
import 'pages/materials_page.dart';
import 'pages/add_inventory_page.dart';
import 'pages/inventory_history_page.dart';
import 'pages/inventory_item_history_page.dart';
import 'pages/stock_areas_page.dart';
import 'pages/stock_transfers_page.dart';
import 'pages/consumption_page.dart';
import 'pages/returns_page.dart';
import 'pages/quotes_search_page.dart';

// Procurement Module
import 'pages/purchase_requests_page.dart';
import 'pages/vendor_comparison_page.dart';
import 'pages/purchase_orders_page_full.dart';
import 'pages/vendors_page_full.dart';
import 'pages/vendor_create_page.dart';
import 'pages/vendor_price_lists_page.dart';
import 'pages/vendor_price_list_create_page.dart';
import 'pages/vendor_price_list_view_page.dart';
import 'pages/vendor_view_price_page.dart';
import 'pages/samples_page.dart';
import 'pages/sample_create_page.dart';
import 'pages/sample_preview_page.dart';
import 'pages/sample_edit_page.dart';

// Delivery & Inspection Module
import 'pages/challans_page.dart';
import 'pages/new_challan_page.dart';
import 'pages/challan_items_detail_page.dart';
import 'pages/challan_detail_page.dart';
import 'pages/mer_page.dart';
import 'pages/mir_page_full.dart';
import 'pages/mir_create_page.dart';
import 'pages/itr_page_full.dart';

// Project Management Module
// import 'pages/mas_page.dart';
import 'pages/billing_page.dart';

// Reporting & Admin Module
import 'pages/documents_page.dart';
import 'pages/reports_page.dart';
import 'pages/audit_logs_page.dart';

late final ProviderContainer appProviderContainer;
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

class _GoRouterRefreshNotifier extends ChangeNotifier {
  void refresh() => notifyListeners();
}

String? _projectSelectionRedirect({
  required String location,
  required AuthSessionView auth,
  required ProjectSessionView project,
}) {
  final isLoggedIn = auth.isAuthenticated;
  final hasProject = project.selectedProject != null;
  final isRoot = location == '/';
  final isLogin = location == '/login';
  final isProjects = location == '/projects';

  if (!isLoggedIn) {
    if (isLogin) return null;
    return '/login';
  }

  if (isRoot) {
    return hasProject ? '/dashboard' : '/projects';
  }

  if (isLogin) {
    return '/projects';
  }

  if (!hasProject) {
    return isProjects ? null : '/projects';
  }

  return null;
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = _GoRouterRefreshNotifier();
  ref.listen(authSessionProvider, (previous, next) => refreshNotifier.refresh());
  ref.listen(projectSessionProvider, (previous, next) => refreshNotifier.refresh());
  ref.onDispose(refreshNotifier.dispose);

  return GoRouter(
    navigatorKey: appNavigatorKey,
    initialLocation: '/',
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      final auth = ref.read(authSessionProvider);
      final project = ref.read(projectSessionProvider);
      final next = _projectSelectionRedirect(
        location: state.uri.path,
        auth: auth,
        project: project,
      );
      return next;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const SizedBox.shrink(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(path: '/projects', builder: (context, state) => const ProjectSelectionPage()),
      GoRoute(path: '/dashboard', builder: (context, state) => const DashboardPage()),
      GoRoute(path: '/attendance', builder: (context, state) => const AttendancePage()),
      GoRoute(path: '/attendance/my', builder: (context, state) => const MyAttendancePage()),
      GoRoute(path: '/boq', builder: (context, state) => const BOQPage()),
      GoRoute(path: '/samples', builder: (context, state) => const SamplesPageFull()),
      GoRoute(path: '/projects/quotes/add', builder: (context, state) => const QuotesListPage()),
      GoRoute(path: '/purchase-requests', builder: (context, state) => const PurchaseRequestsPageFull()),
      GoRoute(path: '/purchase-requests/create', builder: (context, state) => const PurchaseRequestCreatePage()),
      GoRoute(path: '/vendor-comparison', builder: (context, state) => const VendorComparisonPageFull()),
      GoRoute(path: '/purchase-orders', builder: (context, state) => const PurchaseOrdersPageFull()),
      GoRoute(path: '/vendors', builder: (context, state) => const VendorsPageFull()),
      GoRoute(path: '/vendors/new', builder: (context, state) => const VendorCreatePage()),
      GoRoute(path: '/challans', builder: (context, state) => const ChallansPageFull()),
      GoRoute(path: '/challans/new', builder: (context, state) => const NewChallanPage()),
      GoRoute(path: '/mer', builder: (context, state) => const MERPageFull()),
      GoRoute(path: '/mir', builder: (context, state) => const MIRPageFull()),
      GoRoute(path: '/mir/create', builder: (context, state) => const MIRCreatePage()),
      GoRoute(path: '/itr', builder: (context, state) => const ITRPageFull()),
      GoRoute(path: '/billing', builder: (context, state) => const BillingPageFull()),
      GoRoute(path: '/stock-areas', builder: (context, state) => const StockAreasPage()),
      GoRoute(path: '/materials', builder: (context, state) => const MaterialsPage()),
      GoRoute(path: '/inventory/add', builder: (context, state) => const AddInventoryPage()),
      GoRoute(path: '/inventory', builder: (context, state) => const AddInventoryPage()),
      GoRoute(path: '/projects/inventory/add', builder: (context, state) => const AddInventoryPage()),
      GoRoute(path: '/projects/inventory/full', builder: (context, state) => const AddInventoryPage(fullScreen: true)),
      GoRoute(path: '/projects/inventory/history', builder: (context, state) => const InventoryHistoryPage()),
      GoRoute(path: '/projects/quotes/search', builder: (context, state) => const QuotesSearchPage()),
      GoRoute(path: '/stock-transfers', builder: (context, state) => const StockTransfersPage()),
      GoRoute(path: '/consumption', builder: (context, state) => const ConsumptionPage()),
      GoRoute(path: '/returns', builder: (context, state) => const ReturnsPage()),
      GoRoute(path: '/documents', builder: (context, state) => const DocumentsPageFull()),
      GoRoute(path: '/reports', builder: (context, state) => const ReportsPageFull()),
      GoRoute(path: '/audit-logs', builder: (context, state) => const AuditLogsPageFull()),
      GoRoute(path: '/profile', builder: (context, state) => const ProfilePage()),
      GoRoute(path: '/users', builder: (context, state) => const ProfilePage()),
      GoRoute(path: '/settings', builder: (context, state) => const ProfilePage()),
      GoRoute(path: '/purchase-orders/preview', builder: (context, state) => const PurchaseOrdersPageFull()),
      GoRoute(path: '/mir/preview', builder: (context, state) => const MIRPageFull()),
      GoRoute(path: '/itr/preview', builder: (context, state) => const ITRPageFull()),
      GoRoute(
        path: '/challans/detail',
        builder: (context, state) => ChallanDetailPage(challanId: (state.extra as String?) ?? ''),
      ),
      GoRoute(
        path: '/challans/new/details',
        builder: (context, state) {
          final args = state.extra as Map<String, dynamic>? ?? {};
          final poRaw = args['poItems'];
          final deliveryRaw = args['deliveryItems'];

          List<Map<String, String>> mapItems(dynamic raw) {
            if (raw is! List) return const [];
            return raw
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .map(
                  (item) => {
                    'name': item['name']?.toString() ?? '',
                    'description': item['description']?.toString() ?? '',
                    'width': item['width']?.toString() ?? '',
                    'length': item['length']?.toString() ?? '',
                    'quantity': item['quantity']?.toString() ?? '',
                    'price': item['price']?.toString() ?? '',
                  },
                )
                .toList();
          }

          return ChallanItemsDetailPage(
            poItems: mapItems(poRaw),
            deliveryItems: mapItems(deliveryRaw),
          );
        },
      ),
      GoRoute(
        path: '/projects/inventory/item-history',
        builder: (context, state) => InventoryItemHistoryPage(
          inventoryId: (state.extra as String?) ?? '',
        ),
      ),
      GoRoute(
        path: '/samples/preview',
        builder: (context, state) => SamplePreviewPage(sampleId: (state.extra as String?) ?? ''),
      ),
      GoRoute(
        path: '/samples/edit',
        builder: (context, state) => SampleEditPage(sampleId: (state.extra as String?) ?? ''),
      ),
      GoRoute(
        path: '/samples/create',
        builder: (context, state) => SampleCreatePage(
          initialProjectId: (state.extra as String?) ?? '',
        ),
      ),
      GoRoute(
        path: '/vendors/price-lists',
        builder: (context, state) {
          final args = state.extra as Map<String, dynamic>? ?? {};
          return VendorPriceListsPage(
            vendorId: (args['vendorId'] ?? '').toString(),
            projectId: args['projectId']?.toString(),
            openLatestOnLoad: args['openLatest'] == true,
          );
        },
      ),
      GoRoute(
        path: '/vendors/price-lists/create',
        builder: (context, state) {
          final args = state.extra as Map<String, dynamic>? ?? {};
          return VendorPriceListCreatePage(
            vendorId: (args['vendorId'] ?? '').toString(),
            projectId: args['projectId']?.toString(),
          );
        },
      ),
      GoRoute(
        path: '/vendors/price-lists/view',
        builder: (context, state) {
          final args = state.extra as Map<String, dynamic>? ?? {};
          return VendorPriceListViewPage(
            vendorId: (args['vendorId'] ?? '').toString(),
            priceListId: (args['priceListId'] ?? '').toString(),
            projectId: args['projectId']?.toString(),
          );
        },
      ),
      GoRoute(
        path: '/vendors/view-price',
        builder: (context, state) {
          final args = state.extra as Map<String, dynamic>? ?? {};
          return VendorViewPricePage(
            vendorId: (args['vendorId'] ?? '').toString(),
            projectId: args['projectId']?.toString(),
          );
        },
      ),
    ],
  );
});

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  debugPrint(
    '[Main] Background message received: '
    '${message.notification?.title ?? message.data['title'] ?? 'Notification'}',
  );
}

void main() async {
  // Ensure Flutter binding is initialized
  WidgetsFlutterBinding.ensureInitialized();
  debugPrint('[Main] App bootstrap starting');

  // Allow self-signed certs in dev mode
  assert(() {
    HttpOverrides.global = DevHttpOverrides();
    return true;
  }());

  appProviderContainer = ProviderContainer();

  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  debugPrint('[Main] Firebase background handler registered');

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  debugPrint('[Main] Firebase initialized');

  runApp(
    UncontrolledProviderScope(
      container: appProviderContainer,
      child: const MyApp(),
    ),
  );

  unawaited(_bootstrapAfterRun());
}

Future<void> _bootstrapAfterRun() async {
  // Restore auth state and initialize background services after the first frame
  // so a slow network call cannot keep the splash/logo screen stuck.
  await _restoreAuthState();
  debugPrint('[Main] Auth state restore complete');
  await AuthRefreshService.instance.initialize(appProviderContainer);
  debugPrint('[Main] Auth refresh service initialized');
  await NotificationService.instance.initialize(appProviderContainer);
  debugPrint('[Main] Notification service initialized');
  PushNotificationService.instance.setNavigatorKey(appNavigatorKey);
  await PushNotificationService.instance.initialize(appProviderContainer);
  debugPrint('[Main] Push notification service initialized');
  await AttendanceReminderService.instance.initialize(appProviderContainer);
  debugPrint('[Main] Attendance reminder service initialized');
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
        var resolvedUser = AccessControlStore.resolveUserAccessControl(user);
        final authNotifier = appProviderContainer.read(authSessionProvider.notifier);
        if (!sameMapState(appProviderContainer.read(authSessionProvider).user, resolvedUser)) {
          authNotifier.sync(resolvedUser);
        }

        final userId =
            (resolvedUser['user_id'] ?? resolvedUser['id'] ?? '').toString();
        if (userId.isNotEmpty) {
          final accessResult = await ApiClient.getAccessUser(userId);
          resolvedUser = AccessControlStore.resolveUserAccessControl(
            resolvedUser,
            accessControl: (accessResult['success'] == true &&
                    accessResult['data'] is Map<String, dynamic>)
                ? Map<String, dynamic>.from(accessResult['data'] as Map)
                : null,
          );
          await AuthStorage.setUser(resolvedUser);
          authNotifier.sync(resolvedUser);
        }

        // Restore selected project from local storage WITHOUT calling API.
        // This ensures instant startup. The API fetch is done later when
        // ProjectSelectionPage loads.
        final savedProjectId = await AuthStorage.getSelectedProjectId();
        if (savedProjectId != null && savedProjectId.isNotEmpty) {
          final projectNotifier = appProviderContainer.read(projectSessionProvider.notifier);
          projectNotifier.sync(
            projects: appProviderContainer.read(projectSessionProvider).projects,
            selectedProject: {
              'project_id': savedProjectId,
              'project_name': 'Loading…',
            },
            isLoading: false,
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
          final projectNotifier = appProviderContainer.read(projectSessionProvider.notifier);
          final current = appProviderContainer.read(projectSessionProvider);
          if (stateSignature(current.projects) != stateSignature(projectMaps)) {
            projectNotifier.sync(
              projects: projectMaps,
              selectedProject: current.selectedProject,
              isLoading: current.isLoading,
            );
          }

          final savedProject = projectMaps.firstWhere(
            (project) =>
                project['id']?.toString() == savedProjectId ||
                project['project_id']?.toString() == savedProjectId,
            orElse: () => <String, dynamic>{},
          );
          if (savedProject.isNotEmpty &&
              !sameMapState(appProviderContainer.read(projectSessionProvider).selectedProject, savedProject)) {
            projectNotifier.sync(
              projects: projectMaps,
              selectedProject: savedProject,
              isLoading: false,
            );
          }
        }
      })
      .catchError((e) {
        debugPrint('[Main] Background project restore failed: $e');
      });
}

class MyApp extends ConsumerStatefulWidget {
  const MyApp({super.key});

  @override
  ConsumerState<MyApp> createState() => _MyAppState();
}

class _MyAppState extends ConsumerState<MyApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(PushNotificationService.instance.flushPendingNavigation());
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        final themeMode = ref.watch(themeSessionProvider).mode;
        final router = ref.watch(appRouterProvider);
        final platformBrightness =
            WidgetsBinding.instance.platformDispatcher.platformBrightness;
        final effectiveTheme = themeMode == AppThemeMode.system
            ? (platformBrightness == Brightness.dark
                  ? AppThemeMode.dark
                  : AppThemeMode.light)
            : themeMode;

        return MaterialApp.router(
          title: 'Madhuram',
          debugShowCheckedModeBanner: false,
          routerConfig: router,
          theme: AppTheme.lightTheme(),
          darkTheme: AppTheme.darkTheme(),
          themeMode: effectiveTheme == AppThemeMode.dark
              ? ThemeMode.dark
              : ThemeMode.light,
          builder: (context, child) {
            final mq = MediaQuery.of(context);
            final double current = mq.textScaler.scale(1.0);
            final double clamped = current.clamp(0.85, 1.15);
            return ToastContainer(
              child: MediaQuery(
                data: mq.copyWith(textScaler: TextScaler.linear(clamped)),
                child: child ?? const SizedBox.shrink(),
              ),
            );
          },
        );
      },
    );
  }
}

/// App Router - handles initial routing based on auth state
class AppRouter extends ConsumerWidget {
  const AppRouter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authSessionProvider);
    final project = ref.watch(projectSessionProvider);

    if (!auth.isAuthenticated) {
      return const LoginPage();
    }

    if (project.selectedProject == null) {
      return const ProjectSelectionPage();
    }

    return const DashboardPage();
  }
}
