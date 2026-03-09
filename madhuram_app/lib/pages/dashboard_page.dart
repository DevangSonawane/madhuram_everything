import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../services/api_client.dart';
import '../components/ui/mad_card.dart';
import '../components/ui/mad_button.dart';
import '../components/ui/mad_badge.dart';
import '../components/ui/stat_card.dart';
import '../components/layout/main_layout.dart';
import '../utils/responsive.dart';

/// Dashboard page aligned with React dashboard endpoints and metrics
class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  static const bool _enableRealtimeSocket = bool.fromEnvironment(
    'ENABLE_DASHBOARD_SOCKET',
    defaultValue: false,
  );

  List<Map<String, dynamic>> _chartData = [];
  List<Map<String, dynamic>> _recentActivity = [];
  Map<String, dynamic> _stats = {};
  bool _isLoading = false;
  bool _isRefreshing = false;
  String? _error;

  String? _lastUserId;
  String? _lastProjectId;
  String? _lastSocketToken;

  WebSocketChannel? _activityChannel;
  StreamSubscription? _activitySocketSub;
  Timer? _activityHeartbeat;
  Timer? _activityReconnectTimer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final store = StoreProvider.of<AppState>(context);
    final user = store.state.auth.user;
    final selectedProject = store.state.project.selectedProject;

    final userId = _resolveUserId(user);
    final projectId = _resolveProjectId(selectedProject);
    final token = user?['token']?.toString();
    final scopeChanged = _lastUserId != userId || _lastProjectId != projectId;
    final socketScopeChanged =
        _lastUserId != userId ||
        _lastProjectId != projectId ||
        _lastSocketToken != token;

    if (scopeChanged) {
      _lastUserId = userId;
      _lastProjectId = projectId;
      if (userId != null && userId.isNotEmpty) {
        _loadDashboardData(userId: userId, projectId: projectId);
      }
    }

    if (socketScopeChanged) {
      _lastSocketToken = token;
      _configureActivitySocket(
        userId: userId,
        token: token,
        projectId: projectId,
      );
    }
  }

  @override
  void dispose() {
    _disconnectActivitySocket();
    super.dispose();
  }

  String? _resolveUserId(Map<String, dynamic>? user) {
    return user?['user_id']?.toString() ??
        user?['id']?.toString() ??
        user?['uid']?.toString();
  }

  String? _resolveProjectId(Map<String, dynamic>? selectedProject) {
    return selectedProject?['id']?.toString() ??
        selectedProject?['project_id']?.toString();
  }

  Future<void> _loadDashboardData({
    required String userId,
    String? projectId,
    bool silent = false,
  }) async {
    if (!mounted) return;

    setState(() {
      _error = null;
      if (silent) {
        _isRefreshing = true;
      } else {
        _isLoading = true;
      }
    });

    try {
      final statsResult = await ApiClient.getDashboardStats(
        projectId: projectId,
      );
      final activityResult = await ApiClient.getDashboardActivity(
        userId: userId,
        projectId: projectId,
        limit: 8,
        offset: 0,
      );

      if (!mounted) return;

      final resolvedStats = _extractStats(statsResult['data']);
      final activities = _extractActivities(activityResult['data']);
      final chartData = _buildChartData(resolvedStats);

      setState(() {
        _stats = resolvedStats;
        _recentActivity = activities;
        _chartData = chartData;

        if (statsResult['success'] != true ||
            activityResult['success'] != true) {
          _error = (statsResult['error'] ?? activityResult['error'])
              ?.toString();
        }

        _isLoading = false;
        _isRefreshing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _isRefreshing = false;
        _error = 'Failed to load dashboard data';
      });
    }
  }

  Map<String, dynamic> _extractStats(dynamic rawData) {
    if (rawData is Map<String, dynamic>) {
      final nested = rawData['stats'];
      if (nested is Map<String, dynamic>) return nested;
      return rawData;
    }
    return <String, dynamic>{};
  }

  List<Map<String, dynamic>> _extractActivities(dynamic rawData) {
    dynamic payload = rawData;
    if (payload is Map<String, dynamic>) {
      payload = payload['activities'] ?? payload['data'];
    }

    if (payload is! List) return [];

    return payload
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .map(_normalizeActivity)
        .toList();
  }

  Map<String, dynamic> _normalizeActivity(Map<String, dynamic> raw) {
    final performer =
        raw['performed_by_name']?.toString() ??
        raw['user_name']?.toString() ??
        raw['user']?.toString() ??
        'System';
    final action = raw['action']?.toString() ?? 'updated';
    final entityType = raw['entity_type']?.toString() ?? 'item';
    final entityName = raw['entity_name']?.toString() ?? '';

    return {
      'id': raw['id']?.toString() ?? '',
      'user': performer,
      'action':
          '${_humanizeAction(action)} ${entityType.toUpperCase()}${entityName.isNotEmpty ? ' ($entityName)' : ''}',
      'time': _formatRelativeTime(
        raw['created_at']?.toString() ?? raw['createdAt']?.toString(),
      ),
      'status': _statusFromAction(action),
      'initials': _activityInitials(performer),
    };
  }

  List<Map<String, dynamic>> _buildChartData(Map<String, dynamic> stats) {
    return [
      {'name': 'Vendors', 'total': _metricTotal(stats['vendors'])},
      {'name': 'POs', 'total': _metricTotal(stats['pos'])},
      {'name': 'Samples', 'total': _metricTotal(stats['samples'])},
      {'name': 'MIRs', 'total': _metricTotal(stats['mirs'])},
      {'name': 'ITRs', 'total': _metricTotal(stats['itrs'])},
      {'name': 'Users', 'total': _metricTotal(stats['users'])},
    ];
  }

  int _metricTotal(dynamic value) {
    if (value is num) return value.toInt();
    if (value is Map) {
      final total = value['total'];
      if (total is num) return total.toInt();
      if (total != null) return int.tryParse(total.toString()) ?? 0;
    }
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  double? _metricLast30(dynamic value) {
    if (value is Map && value['last_30_days'] != null) {
      final raw = value['last_30_days'];
      if (raw is num) return raw.toDouble();
      return double.tryParse(raw.toString());
    }
    return null;
  }

  String _statusFromAction(String action) {
    switch (action.toLowerCase()) {
      case 'created':
        return 'success';
      case 'deleted':
        return 'warning';
      default:
        return 'info';
    }
  }

  String _humanizeAction(String action) {
    switch (action.toLowerCase()) {
      case 'created':
        return 'Created';
      case 'updated':
        return 'Updated';
      case 'deleted':
        return 'Deleted';
      default:
        return action;
    }
  }

  String _activityInitials(String name) {
    final value = name.trim();
    if (value.isEmpty) return 'NA';
    final parts = value
        .split(RegExp(r'\s+'))
        .where((e) => e.isNotEmpty)
        .toList();
    if (parts.length == 1) {
      final word = parts[0];
      return word.substring(0, word.length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  String _formatRelativeTime(String? value) {
    if (value == null || value.isEmpty) return '';
    final date = DateTime.tryParse(value)?.toLocal();
    if (date == null) return '';

    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  void _configureActivitySocket({
    required String? userId,
    required String? token,
    required String? projectId,
  }) {
    if (!_enableRealtimeSocket) {
      _disconnectActivitySocket();
      return;
    }
    if (userId == null || userId.isEmpty || token == null || token.isEmpty) {
      _disconnectActivitySocket();
      return;
    }
    _connectActivitySocket(userId: userId, token: token, projectId: projectId);
  }

  void _connectActivitySocket({
    required String userId,
    required String token,
    required String? projectId,
  }) {
    _disconnectActivitySocket();

    final socketUrl = ApiClient.getDashboardSocketUrl(
      userId: userId,
      token: token,
    );
    if (socketUrl == null || socketUrl.isEmpty) return;
    final socketUri = Uri.tryParse(socketUrl);
    if (socketUri == null ||
        socketUri.host.isEmpty ||
        !(socketUri.scheme == 'ws' || socketUri.scheme == 'wss') ||
        (socketUri.hasPort && socketUri.port == 0)) {
      return;
    }

    try {
      _activityChannel = WebSocketChannel.connect(socketUri);
      _activitySocketSub = _activityChannel!.stream.listen(
        (raw) => _handleActivitySocketMessage(raw, projectId: projectId),
        onDone: () => _scheduleActivityReconnect(
          userId: userId,
          token: token,
          projectId: projectId,
        ),
        onError: (_) => _scheduleActivityReconnect(
          userId: userId,
          token: token,
          projectId: projectId,
        ),
      );

      _activityHeartbeat = Timer.periodic(const Duration(seconds: 30), (_) {
        _activityChannel?.sink.add(jsonEncode({'type': 'ping'}));
      });
    } catch (_) {
      _scheduleActivityReconnect(
        userId: userId,
        token: token,
        projectId: projectId,
      );
    }
  }

  void _disconnectActivitySocket() {
    _activityReconnectTimer?.cancel();
    _activityReconnectTimer = null;

    _activityHeartbeat?.cancel();
    _activityHeartbeat = null;

    _activitySocketSub?.cancel();
    _activitySocketSub = null;

    _activityChannel?.sink.close();
    _activityChannel = null;
  }

  void _scheduleActivityReconnect({
    required String userId,
    required String token,
    required String? projectId,
  }) {
    if (!_enableRealtimeSocket) return;
    _activityHeartbeat?.cancel();
    _activityHeartbeat = null;
    _activitySocketSub?.cancel();
    _activitySocketSub = null;
    _activityChannel = null;

    _activityReconnectTimer?.cancel();
    _activityReconnectTimer = Timer(const Duration(seconds: 3), () {
      if (!mounted) return;

      final store = StoreProvider.of<AppState>(context, listen: false);
      final latestUserId = _resolveUserId(store.state.auth.user);
      final latestToken = store.state.auth.user?['token']?.toString();
      final latestProjectId = _resolveProjectId(
        store.state.project.selectedProject,
      );

      if (latestUserId != userId ||
          latestToken != token ||
          latestProjectId != projectId) {
        return;
      }

      _connectActivitySocket(
        userId: latestUserId ?? '',
        token: latestToken ?? '',
        projectId: latestProjectId,
      );
    });
  }

  void _handleActivitySocketMessage(dynamic raw, {required String? projectId}) {
    if (!mounted || raw == null) return;

    Map<String, dynamic>? msg;
    try {
      if (raw is String) {
        msg = jsonDecode(raw) as Map<String, dynamic>;
      } else if (raw is Map<String, dynamic>) {
        msg = raw;
      }
    } catch (_) {
      return;
    }
    if (msg == null) return;

    final type = msg['type']?.toString();
    if (type == 'INITIAL_ACTIVITIES' && projectId == null) {
      final data = msg['data'];
      if (data is List) {
        final normalized = data
            .whereType<Map>()
            .map((entry) => Map<String, dynamic>.from(entry))
            .map(_normalizeActivity)
            .take(8)
            .toList();
        if (mounted) {
          setState(() {
            _recentActivity = normalized;
          });
        }
      }
    }

    if (type == 'NEW_ACTIVITY') {
      final data = msg['data'];
      if (data is! Map) return;
      final activity = Map<String, dynamic>.from(data);
      if (projectId != null &&
          projectId.isNotEmpty &&
          activity['project_id']?.toString() != projectId) {
        return;
      }

      final activityId = activity['id']?.toString();
      final normalized = _normalizeActivity(activity);

      if (mounted) {
        setState(() {
          final filtered = _recentActivity.where((item) {
            if (activityId == null || activityId.isEmpty) return true;
            return item['id']?.toString() != activityId;
          }).toList();
          _recentActivity = [normalized, ...filtered].take(8).toList();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return StoreConnector<AppState, _DashboardViewModel>(
      converter: (store) => _DashboardViewModel(
        isAuthenticated: store.state.auth.isAuthenticated,
        user: store.state.auth.user,
        selectedProject: store.state.project.selectedProject,
      ),
      builder: (context, vm) {
        return _buildDashboard(context, vm);
      },
    );
  }

  Widget _buildDashboard(BuildContext context, _DashboardViewModel vm) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);

    final stats = _stats;
    final cardData = [
      {
        'title': 'Vendors',
        'value': _metricTotal(stats['vendors']).toString(),
        'icon': LucideIcons.building2,
        'iconColor': Colors.blue,
        'delta': _metricLast30(stats['vendors']),
      },
      {
        'title': 'Purchase Orders',
        'value': _metricTotal(stats['pos']).toString(),
        'icon': LucideIcons.shoppingCart,
        'iconColor': AppTheme.primaryColor,
        'delta': _metricLast30(stats['pos']),
      },
      {
        'title': 'Samples',
        'value': _metricTotal(stats['samples']).toString(),
        'icon': LucideIcons.flaskConical,
        'iconColor': Colors.purple,
        'delta': _metricLast30(stats['samples']),
      },
      {
        'title': 'MIRs',
        'value': _metricTotal(stats['mirs']).toString(),
        'icon': LucideIcons.package,
        'iconColor': Colors.green,
        'delta': _metricLast30(stats['mirs']),
      },
      {
        'title': 'ITRs',
        'value': _metricTotal(stats['itrs']).toString(),
        'icon': LucideIcons.clipboardCheck,
        'iconColor': Colors.orange,
        'delta': _metricLast30(stats['itrs']),
      },
      {
        'title': 'Users',
        'value': _metricTotal(stats['users']).toString(),
        'icon': LucideIcons.users,
        'iconColor': Colors.teal,
        'delta': _metricLast30(stats['users']),
      },
    ];

    return ProtectedRoute(
      title: 'Dashboard',
      route: '/dashboard',
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(context, vm, isDark, responsive),
            SizedBox(
              height: responsive.value(mobile: 16, tablet: 20, desktop: 24),
            ),

            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: MadCard(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Color(0xFFEF4444)),
                    ),
                  ),
                ),
              ),

            _buildStatsGrid(cardData, responsive),
            SizedBox(
              height: responsive.value(mobile: 16, tablet: 20, desktop: 24),
            ),

            if (responsive.isMobile)
              Column(
                children: [
                  _buildConsumptionChart(isDark, _chartData, responsive),
                  SizedBox(
                    height: responsive.value(
                      mobile: 16,
                      tablet: 20,
                      desktop: 24,
                    ),
                  ),
                  _buildRecentActivity(isDark, _recentActivity, responsive),
                ],
              )
            else
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: responsive.isTablet ? 1 : 3,
                    child: _buildConsumptionChart(
                      isDark,
                      _chartData,
                      responsive,
                    ),
                  ),
                  SizedBox(width: responsive.spacing),
                  Expanded(
                    flex: responsive.isTablet ? 1 : 2,
                    child: _buildRecentActivity(
                      isDark,
                      _recentActivity,
                      responsive,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    _DashboardViewModel vm,
    bool isDark,
    Responsive responsive,
  ) {
    final userId = _resolveUserId(vm.user);
    final projectId = _resolveProjectId(vm.selectedProject);

    Future<void> refresh() async {
      if (userId == null || userId.isEmpty) return;
      await _loadDashboardData(
        userId: userId,
        projectId: projectId,
        silent: true,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dashboard',
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
                    projectId != null && projectId.isNotEmpty
                        ? 'Live project metrics for ${vm.projectName}.'
                        : 'Live overall operational metrics.',
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
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (responsive.isDesktop || responsive.isTablet)
              Row(
                children: [
                  MadButton(
                    text: 'Refresh',
                    icon: LucideIcons.refreshCw,
                    variant: ButtonVariant.outline,
                    loading: _isRefreshing,
                    disabled: _isLoading,
                    onPressed: refresh,
                  ),
                  const SizedBox(width: 12),
                  MadButton(
                    text: 'New Request',
                    icon: LucideIcons.plus,
                    onPressed: () =>
                        Navigator.pushNamed(context, '/purchase-requests'),
                  ),
                ],
              ),
          ],
        ),
        if (responsive.isMobile) ...[
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: MadButton(
                  text: 'Refresh',
                  icon: LucideIcons.refreshCw,
                  variant: ButtonVariant.outline,
                  size: ButtonSize.sm,
                  loading: _isRefreshing,
                  disabled: _isLoading,
                  onPressed: refresh,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: MadButton(
                  text: 'New Request',
                  icon: LucideIcons.plus,
                  size: ButtonSize.sm,
                  onPressed: () =>
                      Navigator.pushNamed(context, '/purchase-requests'),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildStatsGrid(
    List<Map<String, dynamic>> cards,
    Responsive responsive,
  ) {
    final isVeryNarrow = responsive.screenWidth < 360;
    final crossAxisCount = isVeryNarrow
        ? 1
        : responsive.value(mobile: 2, tablet: 2, desktop: 3);
    final aspectRatio = isVeryNarrow
        ? 2.2
        : responsive.value(mobile: 1.0, tablet: 1.15, desktop: 1.3);

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: crossAxisCount,
      crossAxisSpacing: responsive.value(mobile: 8, tablet: 12, desktop: 16),
      mainAxisSpacing: responsive.value(mobile: 8, tablet: 12, desktop: 16),
      childAspectRatio: aspectRatio,
      children: cards
          .map(
            (card) => StatCard(
              title: card['title'] as String,
              value: _isLoading ? '...' : card['value']?.toString() ?? '0',
              icon: card['icon'] as IconData?,
              iconColor: card['iconColor'] as Color?,
              iconBackgroundColor: (card['iconColor'] as Color?)?.withValues(
                alpha: 0.1,
              ),
              change: card['delta'] as double?,
              subtitle: card['delta'] == null
                  ? 'No monthly delta available'
                  : 'added in last 30 days',
            ),
          )
          .toList(),
    );
  }

  Widget _buildConsumptionChart(
    bool isDark,
    List<Map<String, dynamic>> chartData,
    Responsive responsive,
  ) {
    double maxY = 100;
    if (chartData.isNotEmpty) {
      final values = chartData
          .map((e) => (e['total'] as num?)?.toDouble() ?? 0.0)
          .toList();
      maxY = values.reduce((a, b) => a > b ? a : b) * 1.2;
      if (maxY <= 0) maxY = 100;
    }

    final chartHeight = responsive.value(
      mobile: 220.0,
      tablet: 260.0,
      desktop: 300.0,
    );
    final barWidth = responsive.value(
      mobile: 20.0,
      tablet: 26.0,
      desktop: 32.0,
    );

    return MadCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const MadCardHeader(
            title: MadCardTitle('Entity Overview'),
            subtitle: MadCardDescription(
              'Totals by module based on current dashboard scope.',
            ),
          ),
          MadCardContent(
            child: _isLoading
                ? SizedBox(
                    height: chartHeight,
                    child: const Center(child: CircularProgressIndicator()),
                  )
                : chartData.isEmpty
                ? SizedBox(
                    height: chartHeight,
                    child: const Center(child: Text('No chart data available')),
                  )
                : SizedBox(
                    height: chartHeight,
                    child: BarChart(
                      BarChartData(
                        alignment: BarChartAlignment.spaceAround,
                        maxY: maxY,
                        barTouchData: BarTouchData(
                          enabled: true,
                          touchTooltipData: BarTouchTooltipData(
                            getTooltipItem: (group, groupIndex, rod, rodIndex) {
                              if (groupIndex < chartData.length) {
                                return BarTooltipItem(
                                  '${chartData[groupIndex]['name']}\n${rod.toY.toInt()}',
                                  const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                  ),
                                );
                              }
                              return null;
                            },
                          ),
                        ),
                        titlesData: FlTitlesData(
                          show: true,
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (value, meta) {
                                if (value.toInt() < chartData.length) {
                                  return Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: Text(
                                      chartData[value.toInt()]['name']
                                              ?.toString() ??
                                          '',
                                      style: TextStyle(
                                        color: isDark
                                            ? AppTheme.darkMutedForeground
                                            : AppTheme.lightMutedForeground,
                                        fontSize: responsive.value(
                                          mobile: 10,
                                          tablet: 11,
                                          desktop: 12,
                                        ),
                                      ),
                                    ),
                                  );
                                }
                                return const Text('');
                              },
                            ),
                          ),
                          leftTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                        ),
                        gridData: const FlGridData(show: false),
                        borderData: FlBorderData(show: false),
                        barGroups: chartData.asMap().entries.map((entry) {
                          return BarChartGroupData(
                            x: entry.key,
                            barRods: [
                              BarChartRodData(
                                toY:
                                    (entry.value['total'] as num?)
                                        ?.toDouble() ??
                                    0.0,
                                color: AppTheme.primaryColor,
                                width: barWidth,
                                borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(6),
                                ),
                              ),
                            ],
                          );
                        }).toList(),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentActivity(
    bool isDark,
    List<Map<String, dynamic>> activityData,
    Responsive responsive,
  ) {
    final items = activityData.take(responsive.isMobile ? 3 : 5).toList();
    return MadCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          MadCardHeader(
            title: const MadCardTitle('Recent Activity'),
            subtitle: const MadCardDescription(
              'Latest actions across the system.',
            ),
            action: GestureDetector(
              onTap: () => Navigator.pushNamed(context, '/audit-logs'),
              child: Text(
                'View All',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.primaryColor,
                ),
              ),
            ),
          ),
          MadCardContent(
            child: _isLoading
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  )
                : activityData.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: Center(
                      child: Text(
                        'No recent activity',
                        style: TextStyle(
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ),
                  )
                : _buildTimeline(items, isDark, responsive),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeline(
    List<Map<String, dynamic>> items,
    bool isDark,
    Responsive responsive,
  ) {
    final avatarSize = responsive.value(
      mobile: 32.0,
      tablet: 36.0,
      desktop: 40.0,
    );
    final leftColumnWidth = avatarSize + 16;
    final lineLeft = leftColumnWidth / 2 - 1;

    return IntrinsicHeight(
      child: Stack(
        children: [
          Positioned(
            left: lineLeft,
            top: avatarSize / 2 + 8,
            bottom: 8,
            child: Container(
              width: 2,
              decoration: BoxDecoration(
                color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                    .withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: items
                .map(
                  (activity) =>
                      _buildActivityItem(activity, isDark, responsive),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildActivityItem(
    Map<String, dynamic> activity,
    bool isDark,
    Responsive responsive,
  ) {
    final status = activity['status'] as String? ?? 'info';
    Color avatarColor;
    BadgeVariant badgeVariant;
    switch (status) {
      case 'success':
        avatarColor = Colors.green;
        badgeVariant = BadgeVariant.success;
        break;
      case 'warning':
        avatarColor = Colors.amber;
        badgeVariant = BadgeVariant.warning;
        break;
      case 'info':
      default:
        avatarColor = Colors.blue;
        badgeVariant = BadgeVariant.primary;
        break;
    }

    final avatarSize = responsive.value(
      mobile: 32.0,
      tablet: 36.0,
      desktop: 40.0,
    );
    final initials = (activity['initials'] as String? ?? 'U').toUpperCase();

    final leftColumnWidth = avatarSize + 16;
    return Padding(
      padding: EdgeInsets.only(
        bottom: responsive.value(mobile: 12, tablet: 14, desktop: 16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: leftColumnWidth,
            child: Center(
              child: Container(
                width: avatarSize,
                height: avatarSize,
                decoration: BoxDecoration(
                  color: avatarColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(avatarSize / 2),
                  border: Border.all(color: avatarColor, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 4,
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    initials.length >= 2 ? initials.substring(0, 2) : initials,
                    style: TextStyle(
                      fontSize: responsive.value(
                        mobile: 10,
                        tablet: 11,
                        desktop: 12,
                      ),
                      fontWeight: FontWeight.bold,
                      color: avatarColor,
                    ),
                  ),
                ),
              ),
            ),
          ),
          SizedBox(width: responsive.value(mobile: 8, tablet: 10, desktop: 12)),
          Expanded(
            child: Container(
              padding: EdgeInsets.all(
                responsive.value(mobile: 10, tablet: 11, desktop: 12),
              ),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.darkCard : AppTheme.lightCard,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                      .withValues(alpha: 0.5),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          activity['user'] ?? 'Unknown',
                          style: TextStyle(
                            fontSize: responsive.value(
                              mobile: 13,
                              tablet: 13,
                              desktop: 14,
                            ),
                            fontWeight: FontWeight.bold,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      MadBadge(text: status, variant: badgeVariant),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    activity['action'] ?? '',
                    style: TextStyle(
                      fontSize: responsive.value(
                        mobile: 12,
                        tablet: 12,
                        desktop: 13,
                      ),
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    activity['time'] ?? '',
                    style: TextStyle(
                      fontSize: responsive.value(
                        mobile: 10,
                        tablet: 11,
                        desktop: 12,
                      ),
                      fontFamily: 'monospace',
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardViewModel {
  final bool isAuthenticated;
  final Map<String, dynamic>? user;
  final Map<String, dynamic>? selectedProject;

  _DashboardViewModel({
    required this.isAuthenticated,
    required this.user,
    required this.selectedProject,
  });

  String get projectName =>
      selectedProject?['name']?.toString() ??
      selectedProject?['project_name']?.toString() ??
      'selected project';
}
