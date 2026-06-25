import 'package:flutter/material.dart';
import '../utils/responsive.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import '../services/api_client.dart';
import '../components/ui/components.dart';
import '../components/layout/main_layout.dart';
import '../utils/riverpod_context.dart';

/// Audit log entry model (entity/action type tracking)
class AuditLog {
  final String id;
  final String user;
  final String action; // CREATE, UPDATE, DELETE
  final String? entity;
  final String time;
  final String? details;
  final String? ipAddress;

  const AuditLog({
    required this.id,
    required this.user,
    required this.action,
    required this.time,
    this.entity,
    this.details,
    this.ipAddress,
  });

  factory AuditLog.fromJson(Map<String, dynamic> json) {
    return AuditLog(
      id: (json['log_id'] ?? json['id'] ?? '').toString(),
      user: json['user'] ?? '',
      action: json['action'] ?? '',
      time: json['time'] ?? '',
      entity: json['entity'],
      details: json['details'],
      ipAddress: json['ip_address'] ?? json['ip'],
    );
  }

  Color get actionColor {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return const Color(0xFF3B82F6); // blue
      case 'UPDATE':
        return const Color(0xFFF59E0B); // amber
      case 'DELETE':
        return const Color(0xFFEF4444); // red
      default:
        return AppTheme.primaryColor;
    }
  }
}

/// Audit Logs page - entity/action type tracking
class AuditLogsPageFull extends StatefulWidget {
  const AuditLogsPageFull({super.key});
  @override
  State<AuditLogsPageFull> createState() => _AuditLogsPageFullState();
}

class _AuditLogsPageFullState extends State<AuditLogsPageFull> {
  bool _isLoading = false;
  String? _error;
  List<AuditLog> _logs = [];
  String _searchQuery = '';
  String? _actionFilter; // CREATE, UPDATE, DELETE
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadLogs());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadLogs() async {
    final projectId = context.appProject.selectedProjectId ?? '';
    if (projectId.isEmpty) {
      setState(() {
        _logs = [];
        _isLoading = false;
        _error = 'No project selected';
      });
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final result = await ApiClient.getAuditLogs(projectId);
      if (!mounted) return;
      if (result['success'] == true && result['data'] != null) {
        final data = result['data'] as List;
        final loaded = data.map((e) => AuditLog.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        setState(() {
          _logs = loaded;
          _isLoading = false;
        });
      } else {
        setState(() {
          _logs = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load audit logs';
        });
      }
    } catch (e) {
      debugPrint('[AuditLogs] API error: $e');
      if (!mounted) return;
      setState(() {
        _logs = [];
        _isLoading = false;
        _error = 'Failed to load audit logs';
      });
    }
  }

  List<AuditLog> get _filteredLogs {
    List<AuditLog> result = _logs;
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result.where((l) {
        return l.user.toLowerCase().contains(q) ||
            (l.entity?.toLowerCase().contains(q) ?? false) ||
            (l.details?.toLowerCase().contains(q) ?? false);
      }).toList();
    }
    if (_actionFilter != null) {
      result = result.where((l) => l.action.toUpperCase() == _actionFilter).toList();
    }
    return result;
  }

  void _onExportLogs() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Export Logs — placeholder')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final responsive = Responsive(context);
    final isMobile = responsive.isMobile;

    return ProtectedRoute(
      title: 'Audit Logs',
      route: '/audit-logs',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Audit Logs',
                      style: TextStyle(
                        fontSize: responsive.value(mobile: 22, tablet: 26, desktop: 28),
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Track all system activities and changes',
                      style: TextStyle(
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (!isMobile)
                MadButton(
                  text: 'Export Logs',
                  icon: LucideIcons.download,
                  variant: ButtonVariant.outline,
                  onPressed: _onExportLogs,
                ),
            ],
          ),
          const SizedBox(height: 24),
          if (!isMobile)
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Total Events',
                    value: '15,231',
                    icon: LucideIcons.activity,
                    iconColor: AppTheme.primaryColor,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Critical Actions',
                    value: '42',
                    icon: LucideIcons.triangleAlert,
                    iconColor: const Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatCard(
                    title: 'Active Users',
                    value: '18',
                    icon: LucideIcons.users,
                    iconColor: const Color(0xFF22C55E),
                  ),
                ),
              ],
            ),
          if (!isMobile) const SizedBox(height: 24),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              SizedBox(
                width: isMobile ? double.infinity : 320,
                child: MadSearchInput(
                  controller: _searchController,
                  hintText: 'Search by user, entity, details...',
                  onChanged: (v) => setState(() => _searchQuery = v),
                  onClear: () => setState(() => _searchQuery = ''),
                ),
              ),
              SizedBox(
                width: 160,
                child: MadSelect<String>(
                  value: _actionFilter,
                  placeholder: 'All Actions',
                  clearable: true,
                  options: const [
                    MadSelectOption(value: 'CREATE', label: 'CREATE'),
                    MadSelectOption(value: 'UPDATE', label: 'UPDATE'),
                    MadSelectOption(value: 'DELETE', label: 'DELETE'),
                  ],
                  onChanged: (v) => setState(() => _actionFilter = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? _buildErrorState(isDark, _error!)
                    : _filteredLogs.isEmpty
                        ? _buildEmptyState(isDark)
                        : MadCard(
                            child: Column(
                              children: [
                            // Table header
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                              decoration: BoxDecoration(
                                color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(0.3),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                              ),
                              child: Row(
                                children: [
                                  _buildHeaderCell('Timestamp', flex: 1, isDark: isDark),
                                  _buildHeaderCell('User', flex: 1, isDark: isDark),
                                  _buildHeaderCell('Action', flex: 1, isDark: isDark),
                                  if (!isMobile) ...[
                                    _buildHeaderCell('Entity', flex: 1, isDark: isDark),
                                    _buildHeaderCell('Details', flex: 2, isDark: isDark),
                                    _buildHeaderCell('IP Address', flex: 1, isDark: isDark),
                                  ],
                                ],
                              ),
                            ),
                            Expanded(
                              child: ListView.separated(
                                itemCount: _filteredLogs.length,
                                separatorBuilder: (_, __) => Divider(
                                  height: 1,
                                  color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder).withOpacity(0.5),
                                ),
                                itemBuilder: (context, index) =>
                                    _buildLogRow(_filteredLogs[index], isDark, isMobile),
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

  Widget _buildHeaderCell(String text, {required int flex, required bool isDark}) {
    return Expanded(
      flex: flex,
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
        ),
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  Widget _buildLogRow(AuditLog log, bool isDark, bool isMobile) {
    final color = log.actionColor;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 1,
            child: Text(
              log.time,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 1,
            child: Text(
              log.user,
              style: const TextStyle(fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 1,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                log.action,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            ),
          ),
          if (!isMobile) ...[
            Expanded(
              flex: 1,
              child: Text(log.entity ?? '—', overflow: TextOverflow.ellipsis),
            ),
            Expanded(
              flex: 2,
              child: Text(
                log.details ?? '—',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
                ),
              ),
            ),
            Expanded(
              flex: 1,
              child: Text(
                log.ipAddress ?? '—',
                style: TextStyle(
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              LucideIcons.scrollText,
              size: 64,
              color: (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground).withOpacity(0.3),
            ),
            const SizedBox(height: 24),
            Text(
              'No activities found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchQuery.isEmpty ? 'Activity logs will appear here' : 'Try a different search term',
              style: TextStyle(
                color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(bool isDark, String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red.withOpacity(0.5)),
            const SizedBox(height: 16),
            Text(
              'Failed to load audit logs',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: TextStyle(color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            MadButton(text: 'Retry', icon: LucideIcons.refreshCw, onPressed: _loadLogs),
          ],
        ),
      ),
    );
  }
}
