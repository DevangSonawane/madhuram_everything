import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:http/http.dart' as http;
import '../theme/app_theme.dart';
import '../store/app_state.dart';
import '../store/project_actions.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../services/file_service.dart';
import '../services/work_order_extractor.dart';
import '../components/ui/components.dart';
import '../utils/responsive.dart';
import '../models/project.dart';

/// Project Selection page - Responsive version
class ProjectSelectionPage extends StatefulWidget {
  const ProjectSelectionPage({super.key});

  @override
  State<ProjectSelectionPage> createState() => _ProjectSelectionPageState();
}

class _ProjectSelectionPageState extends State<ProjectSelectionPage> {
  bool _isLoading = false;
  String? _error;
  String _searchQuery = '';
  List<Project> _projects = [];
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAuthAndLoadProjects();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _checkAuthAndLoadProjects() async {
    if (!mounted) return;

    final store = StoreProvider.of<AppState>(context);

    // Check if authenticated
    if (!store.state.auth.isAuthenticated) {
      Navigator.pushReplacementNamed(context, '/login');
      return;
    }

    await _loadProjects();
  }

  Future<void> _loadProjects() async {
    if (!mounted) return;

    final store = StoreProvider.of<AppState>(context);
    store.dispatch(FetchProjectsStart());
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ApiClient.getProjects();

      if (!mounted) return;

      if (result['success'] == true) {
        final data = result['data'];
        // Handle both List and other response formats
        final List<dynamic> projectList = data is List ? data : [];
        final projectMaps = projectList
            .map((e) => e as Map<String, dynamic>)
            .toList();
        final projects = projectMaps.map((e) => Project.fromJson(e)).toList();

        store.dispatch(FetchProjectsSuccess(projectMaps));
        setState(() {
          _projects = projects;
          _isLoading = false;
          _error = null;
        });
      } else {
        store.dispatch(FetchProjectsFailure('API failure'));
        setState(() {
          _projects = [];
          _isLoading = false;
          _error = result['error']?.toString() ?? 'Failed to load projects';
        });
      }
    } catch (e) {
      debugPrint('[ProjectSelection] API error: $e');
      if (!mounted) return;
      store.dispatch(FetchProjectsFailure('$e'));
      setState(() {
        _projects = [];
        _isLoading = false;
        _error = 'Failed to load projects';
      });
    }
  }

  void _selectProject(Project project) {
    if (project.id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Project ID is missing. Please try again.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final store = StoreProvider.of<AppState>(context);
    // Convert Project to Map for Redux state storage
    store.dispatch(SelectProject(project.toMap()));

    // Save selected project ID to storage for persistence (like React app)
    AuthStorage.setSelectedProjectId(project.id);

    // Navigate to dashboard
    Navigator.pushReplacementNamed(context, '/dashboard');
  }

  List<Project> get _filteredProjects {
    var list = _projects;
    final normalizedRole = (_currentUserRole ?? '').toLowerCase();
    final canViewAllProjects = normalizedRole == 'admin';
    final assignedProjectIds = _resolveAssignedProjectIds(
      _currentUserProjectList,
    );

    if (!canViewAllProjects) {
      if (assignedProjectIds.isEmpty) {
        list = <Project>[];
      } else {
        list = list.where((project) {
          final projectKeys = <String>{
            project.id.toString().trim().toLowerCase(),
            (project.rawData?['project_id'] ?? '')
                .toString()
                .trim()
                .toLowerCase(),
            project.name.toString().trim().toLowerCase(),
            (project.rawData?['project_name'] ?? '')
                .toString()
                .trim()
                .toLowerCase(),
          }..removeWhere((value) => value.isEmpty);
          return projectKeys.any(assignedProjectIds.contains);
        }).toList();
      }
    }
    if (_searchQuery.isEmpty) return list;
    final query = _searchQuery.toLowerCase();
    return list.where((p) {
      return p.name.toLowerCase().contains(query) ||
          (p.client?.toLowerCase().contains(query) ?? false) ||
          (p.location?.toLowerCase().contains(query) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return StoreConnector<AppState, _ProjectSelectionViewModel>(
      converter: (store) => _ProjectSelectionViewModel(
        isAuthenticated: store.state.auth.isAuthenticated,
        userName: store.state.auth.userName ?? 'User',
        isAdmin: store.state.auth.isAdmin,
        userRole: store.state.auth.userRole,
        user: store.state.auth.user,
      ),
      builder: (context, vm) {
        // Check auth
        if (!vm.isAuthenticated) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            Navigator.pushReplacementNamed(context, '/login');
          });
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        return _buildPage(context, vm);
      },
    );
  }

  Widget _buildPage(BuildContext context, _ProjectSelectionViewModel vm) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final responsive = Responsive(context);
    _currentUserRole = vm.userRole;
    _currentUserProjectList = vm.user?['project_list'];

    return Scaffold(
      backgroundColor: isDark
          ? AppTheme.darkBackground
          : AppTheme.lightBackground,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: EdgeInsets.all(
                responsive.value(mobile: 16, tablet: 20, desktop: 24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: responsive.value(
                          mobile: 36,
                          tablet: 38,
                          desktop: 40,
                        ),
                        height: responsive.value(
                          mobile: 36,
                          tablet: 38,
                          desktop: 40,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          LucideIcons.package2,
                          color: Colors.white,
                          size: responsive.value(
                            mobile: 20,
                            tablet: 22,
                            desktop: 24,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Madhuram',
                        style: TextStyle(
                          fontSize: responsive.value(
                            mobile: 20,
                            tablet: 22,
                            desktop: 24,
                          ),
                          fontWeight: FontWeight.bold,
                          color: isDark
                              ? AppTheme.darkForeground
                              : AppTheme.lightForeground,
                        ),
                      ),
                      const Spacer(),
                      Row(
                        children: [
                          MadButton(
                            icon: LucideIcons.boxes,
                            text: responsive.isMobile ? null : 'Add Inventory',
                            onPressed: () =>
                                Navigator.pushNamed(context, '/inventory/add'),
                            variant: ButtonVariant.outline,
                            size: responsive.isMobile
                                ? ButtonSize.icon
                                : ButtonSize.md,
                          ),
                          const SizedBox(width: 8),
                          MadButton(
                            icon: LucideIcons.plus,
                            text: responsive.isMobile ? null : 'New Project',
                            onPressed: () => _showCreateProjectDialog(),
                            size: responsive.isMobile
                                ? ButtonSize.icon
                                : ButtonSize.md,
                          ),
                        ],
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
                  Text(
                    'Welcome, ${vm.userName}',
                    style: TextStyle(
                      fontSize: responsive.value(
                        mobile: 24,
                        tablet: 28,
                        desktop: 32,
                      ),
                      fontWeight: FontWeight.bold,
                      color: isDark
                          ? AppTheme.darkForeground
                          : AppTheme.lightForeground,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Select a project to continue to the dashboard.',
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
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Upload a work order PDF to auto-fill project details.',
                    style: TextStyle(
                      fontSize: responsive.value(
                        mobile: 12,
                        tablet: 13,
                        desktop: 13,
                      ),
                      color: isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  SizedBox(
                    height: responsive.value(
                      mobile: 16,
                      tablet: 20,
                      desktop: 24,
                    ),
                  ),
                  // Search
                  MadSearchInput(
                    controller: _searchController,
                    hintText: 'Search projects...',
                    width: double.infinity,
                    onChanged: (value) => setState(() => _searchQuery = value),
                    onClear: () => setState(() {
                      _searchQuery = '';
                      _searchController.clear();
                    }),
                  ),
                ],
              ),
            ),

            // Projects grid or loading/error state
            Expanded(child: _buildContent(isDark, responsive, vm.isAdmin)),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(bool isDark, Responsive responsive, bool isAdmin) {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading projects...'),
          ],
        ),
      );
    }

    if (_error != null) {
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
              const SizedBox(height: 16),
              Text(
                'Failed to load projects',
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
                _error!,
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
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              MadButton(
                icon: LucideIcons.refreshCw,
                text: 'Retry',
                onPressed: _loadProjects,
              ),
            ],
          ),
        ),
      );
    }

    if (_filteredProjects.isEmpty) {
      return _buildEmptyState(isDark, responsive, isAdmin);
    }

    final crossAxisCount = responsive.value(
      mobile: 1,
      tablet: 2,
      desktop: responsive.screenWidth > 1200 ? 3 : 2,
    );
    final spacing = responsive.value(mobile: 16.0, tablet: 20.0, desktop: 24.0);
    // Slightly taller mobile cards to avoid vertical overflow with long metadata + action row.
    final aspectRatio = responsive.value(
      mobile: 1.28,
      tablet: 1.35,
      desktop: 1.3,
    );

    return RefreshIndicator(
      onRefresh: _loadProjects,
      child: GridView.builder(
        padding: EdgeInsets.all(
          responsive.value(mobile: 16, tablet: 20, desktop: 24),
        ),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: spacing,
          mainAxisSpacing: spacing,
          childAspectRatio: aspectRatio,
        ),
        itemCount: _filteredProjects.length,
        itemBuilder: (context, index) {
          return _buildProjectCard(
            _filteredProjects[index],
            isDark,
            responsive,
            isAdmin,
          );
        },
      ),
    );
  }

  Widget _buildProjectCard(
    Project project,
    bool isDark,
    Responsive responsive,
    bool isAdmin,
  ) {
    final workOrderFile =
        project.rawData?['work_order_file'] ??
        project.rawData?['work_order_file_url'] ??
        project.rawData?['workOrderFile'];
    return MadCard(
      hoverable: true,
      onTap: () => _selectProject(project),
      child: Padding(
        padding: EdgeInsets.all(
          responsive.value(mobile: 14, tablet: 20, desktop: 24),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    project.name,
                    style: TextStyle(
                      fontSize: responsive.value(
                        mobile: 16,
                        tablet: 18,
                        desktop: 20,
                      ),
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isAdmin)
                      IconButton(
                        icon: Icon(
                          LucideIcons.trash2,
                          size: 18,
                          color: isDark
                              ? AppTheme.darkMutedForeground
                              : AppTheme.lightMutedForeground,
                        ),
                        onPressed: () => _showDeleteProjectConfirm(project),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(
                          minWidth: 32,
                          minHeight: 32,
                        ),
                      ),
                    const SizedBox(width: 4),
                    StatusBadge(status: project.status ?? 'Planning'),
                  ],
                ),
              ],
            ),
            SizedBox(
              height: responsive.value(mobile: 4, tablet: 6, desktop: 8),
            ),
            Text(
              project.client ?? '',
              style: TextStyle(
                fontSize: responsive.value(mobile: 12, tablet: 13, desktop: 14),
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(
              height: responsive.value(mobile: 8, tablet: 10, desktop: 12),
            ),
            const Spacer(),
            // Project info
            _buildInfoRow(
              icon: LucideIcons.mapPin,
              value: project.location ?? 'No location specified',
              isDark: isDark,
              responsive: responsive,
            ),
            SizedBox(
              height: responsive.value(mobile: 6, tablet: 7, desktop: 8),
            ),
            _buildInfoRow(
              icon: LucideIcons.calendar,
              value: 'Started: ${project.startDate ?? 'N/A'}',
              isDark: isDark,
              responsive: responsive,
            ),
            if ((workOrderFile ?? '').toString().isNotEmpty) ...[
              SizedBox(
                height: responsive.value(mobile: 6, tablet: 7, desktop: 8),
              ),
              _buildInfoRow(
                icon: LucideIcons.fileText,
                value: 'Work order attached',
                isDark: isDark,
                responsive: responsive,
              ),
            ],
            if (project.estimateValue != null) ...[
              SizedBox(
                height: responsive.value(mobile: 8, tablet: 10, desktop: 12),
              ),
              Text(
                project.estimateValue!,
                style: TextStyle(
                  fontSize: responsive.value(
                    mobile: 15,
                    tablet: 16,
                    desktop: 18,
                  ),
                  fontWeight: FontWeight.bold,
                  color: isDark
                      ? AppTheme.darkForeground
                      : AppTheme.lightForeground,
                ),
              ),
            ],
            const Spacer(),
            // Action button
            SizedBox(
              width: double.infinity,
              child: MadButton(
                text: 'Select Project',
                size: responsive.isMobile ? ButtonSize.sm : ButtonSize.md,
                onPressed: () => _selectProject(project),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String value,
    required bool isDark,
    required Responsive responsive,
  }) {
    return Row(
      children: [
        Icon(
          icon,
          size: responsive.value(mobile: 14, tablet: 15, desktop: 16),
          color: isDark
              ? AppTheme.darkMutedForeground
              : AppTheme.lightMutedForeground,
        ),
        SizedBox(width: responsive.value(mobile: 6, tablet: 7, desktop: 8)),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: responsive.value(mobile: 12, tablet: 13, desktop: 14),
              color: isDark
                  ? AppTheme.darkMutedForeground
                  : AppTheme.lightMutedForeground,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(bool isDark, Responsive responsive, bool isAdmin) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              LucideIcons.folderOpen,
              size: responsive.value(mobile: 48, tablet: 56, desktop: 64),
              color:
                  (isDark
                          ? AppTheme.darkMutedForeground
                          : AppTheme.lightMutedForeground)
                      .withOpacity(0.3),
            ),
            SizedBox(
              height: responsive.value(mobile: 16, tablet: 20, desktop: 24),
            ),
            Text(
              _searchQuery.isEmpty ? 'No projects yet' : 'No projects found',
              style: TextStyle(
                fontSize: responsive.value(mobile: 16, tablet: 17, desktop: 18),
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTheme.darkForeground
                    : AppTheme.lightForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchQuery.isEmpty
                  ? (isAdmin
                        ? 'Create one to get started.'
                        : 'Please contact an administrator.')
                  : 'Try a different search term',
              style: TextStyle(
                fontSize: responsive.value(mobile: 13, tablet: 13, desktop: 14),
                color: isDark
                    ? AppTheme.darkMutedForeground
                    : AppTheme.lightMutedForeground,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteProjectConfirm(Project project) {
    MadDialog.confirm(
      context: context,
      title: 'Delete Project',
      description:
          'Are you sure you want to delete "${project.name}"? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    ).then((confirmed) async {
      if (!confirmed || project.id.isEmpty || !mounted) return;
      final result = await ApiClient.deleteProject(project.id);
      if (!mounted) return;
      if (result['success'] == true) {
        _loadProjects();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text((result['error'] ?? 'Delete failed').toString()),
            backgroundColor: Colors.red,
          ),
        );
      }
    });
  }

  void _showCreateProjectDialog() {
    final nameController = TextEditingController();
    final clientController = TextEditingController();
    final locationController = TextEditingController();
    final startDateController = TextEditingController();
    final estimateValueController = TextEditingController();
    final woNumberController = TextEditingController();

    File? workOrderFile;
    File? masFile;
    String? workOrderFileName;
    String? masFileName;
    bool extracting = false;
    bool compressing = false;
    String? extractError;
    WorkOrderExtractionResult? extracted;

    void Function(void Function())? dialogSetState;
    MadFormDialog.show(
      context: context,
      title: 'Create New Project',
      maxWidth: 520,
      content: StatefulBuilder(
        builder: (context, setDialogState) {
          dialogSetState = setDialogState;
          return SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                MadInput(
                  controller: nameController,
                  labelText: 'Project Name',
                  hintText: 'Enter project name',
                ),
                const SizedBox(height: 16),
                MadInput(
                  controller: clientController,
                  labelText: 'Client Name',
                  hintText: 'Enter client name',
                ),
                const SizedBox(height: 16),
                MadInput(
                  controller: locationController,
                  labelText: 'Location',
                  hintText: 'Enter location',
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: MadInput(
                        controller: startDateController,
                        labelText: 'Start Date',
                        hintText: 'YYYY-MM-DD',
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: MadInput(
                        controller: estimateValueController,
                        labelText: 'Estimate Value',
                        hintText: '₹',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                MadInput(
                  controller: woNumberController,
                  labelText: 'WO Number',
                  hintText: 'Work order number',
                ),
                const SizedBox(height: 20),
                const Text(
                  'Work Order File (PDF)',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    MadButton(
                      icon: LucideIcons.upload,
                      text: workOrderFileName ?? 'Choose PDF',
                      variant: ButtonVariant.outline,
                      size: ButtonSize.sm,
                      onPressed: () async {
                        final file = await FileService.pickFileWithSource(
                          context: context,
                          allowedExtensions: ['pdf', 'csv', 'xlsx', 'xls'],
                        );
                        if (file != null) {
                          workOrderFile = file;
                          workOrderFileName = file.path
                              .split(RegExp(r'[/\\]'))
                              .last;
                          extractError = null;
                          if (workOrderFileName!.toLowerCase().endsWith(
                            '.pdf',
                          )) {
                            extracting = true;
                            setDialogState(() {});
                            final res =
                                await WorkOrderExtractor.extractFromFile(
                                  workOrderFile!,
                                );
                            extracting = false;
                            if (res.success) {
                              extracted = res;
                              if (nameController.text.trim().isEmpty &&
                                  res.projectName.isNotEmpty) {
                                nameController.text = res.projectName;
                              }
                              if (clientController.text.trim().isEmpty &&
                                  res.clientName.isNotEmpty) {
                                clientController.text = res.clientName;
                              }
                              if (locationController.text.trim().isEmpty &&
                                  res.location.isNotEmpty) {
                                locationController.text = res.location;
                              }
                              if (startDateController.text.trim().isEmpty &&
                                  res.startDate.isNotEmpty) {
                                startDateController.text = res.startDate;
                              }
                              if (estimateValueController.text.trim().isEmpty &&
                                  res.estimateValue.isNotEmpty) {
                                estimateValueController.text =
                                    res.estimateValue;
                              }
                              if (woNumberController.text.trim().isEmpty &&
                                  res.woNumber.isNotEmpty) {
                                woNumberController.text = res.woNumber;
                              }
                            } else {
                              extractError =
                                  res.error ?? 'Failed to extract work order';
                            }
                          }
                          setDialogState(() {});
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('No file selected')),
                          );
                        }
                      },
                    ),
                    if (workOrderFileName != null) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          workOrderFileName!,
                          style: TextStyle(
                            fontSize: 12,
                            color:
                                Theme.of(context).brightness == Brightness.dark
                                ? AppTheme.darkMutedForeground
                                : AppTheme.lightMutedForeground,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
                if (extracting) ...[
                  const SizedBox(height: 8),
                  const LinearProgressIndicator(),
                ],
                if (extractError != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    extractError!,
                    style: const TextStyle(fontSize: 12, color: Colors.red),
                  ),
                ],
                if (extracted != null) ...[
                  const SizedBox(height: 12),
                  MadButton(
                    text: 'Apply Extracted Values',
                    icon: LucideIcons.check,
                    variant: ButtonVariant.outline,
                    size: ButtonSize.sm,
                    onPressed: () {
                      final res = extracted!;
                      if (res.projectName.isNotEmpty)
                        nameController.text = res.projectName;
                      if (res.clientName.isNotEmpty)
                        clientController.text = res.clientName;
                      if (res.location.isNotEmpty)
                        locationController.text = res.location;
                      if (res.startDate.isNotEmpty)
                        startDateController.text = res.startDate;
                      if (res.estimateValue.isNotEmpty)
                        estimateValueController.text = res.estimateValue;
                      if (res.woNumber.isNotEmpty)
                        woNumberController.text = res.woNumber;
                      setDialogState(() {});
                    },
                  ),
                ],
                const SizedBox(height: 16),
                const Text(
                  'MAS File',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    MadButton(
                      icon: LucideIcons.upload,
                      text: masFileName ?? 'Choose File',
                      variant: ButtonVariant.outline,
                      size: ButtonSize.sm,
                      onPressed: () async {
                        final file = await FileService.pickFileWithSource(
                          context: context,
                        );
                        if (file != null) {
                          masFile = file;
                          masFileName = file.path.split(RegExp(r'[/\\]')).last;
                          setDialogState(() {});
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('No file selected')),
                          );
                        }
                      },
                    ),
                    if (masFileName != null) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          masFileName!,
                          style: TextStyle(
                            fontSize: 12,
                            color:
                                Theme.of(context).brightness == Brightness.dark
                                ? AppTheme.darkMutedForeground
                                : AppTheme.lightMutedForeground,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
                if (compressing) ...[
                  const SizedBox(height: 8),
                  const LinearProgressIndicator(),
                ],
              ],
            ),
          );
        },
      ),
      actions: [
        MadButton(
          text: 'Cancel',
          variant: ButtonVariant.outline,
          onPressed: () => Navigator.of(context).pop(),
        ),
        MadButton(
          text: 'Create',
          onPressed: () async {
            final projectName = nameController.text.trim();
            final clientName = clientController.text.trim();
            final location = locationController.text.trim();
            final startDate = startDateController.text.trim();
            final estimateValue = estimateValueController.text.trim();
            final woNumber = woNumberController.text.trim();
            if (projectName.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please enter project name')),
              );
              return;
            }
            dialogSetState?.call(() => compressing = true);
            final projectData = {
              'project_name': projectName,
              'client_name': clientName,
              'location': location,
              'project_startdate': startDate,
              'floor': '',
              'estimate_value': estimateValue,
              'wo_number': woNumber,
              'work_order_information': '',
            };

            if (workOrderFile != null) {
              try {
                final size = await workOrderFile!.length();
                if (size > 10 * 1024 * 1024) {
                  final result = await ApiClient.compressFile(workOrderFile!);
                  if (result['success'] == true && result['data'] is Map) {
                    final data = result['data'] as Map;
                    final url = data['url']?.toString();
                    if (url != null && url.isNotEmpty) {
                      final file = await _downloadCompressedFile(
                        url,
                        workOrderFile!.path.split('/').last,
                      );
                      if (file != null) workOrderFile = file;
                    }
                  }
                }
              } catch (_) {}
            }

            Map<String, dynamic> result;
            if (workOrderFile != null || masFile != null) {
              result = await ApiClient.createProjectWithFiles(
                projectData: projectData,
                workOrderFile: workOrderFile,
                masFile: masFile,
              );
            } else {
              result = await ApiClient.createProject({
                'project_name': projectName,
                'client_name': clientName,
                'location': location,
                'project_startdate': startDate,
                'estimate_value': estimateValue,
                'wo_number': woNumber,
              });
            }

            if (!mounted) return;
            dialogSetState?.call(() => compressing = false);
            if (result['success'] == true) {
              Navigator.of(context).pop();
              await _loadProjects();
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    (result['error'] ?? 'Failed to create project').toString(),
                  ),
                  backgroundColor: Colors.red,
                ),
              );
            }
          },
        ),
      ],
    );
  }

  String? _currentUserRole;
  dynamic _currentUserProjectList;

  Set<String> _resolveAssignedProjectIds(dynamic rawProjectList) {
    List<dynamic> values = const [];
    if (rawProjectList is List) {
      values = rawProjectList;
    } else if (rawProjectList is String && rawProjectList.trim().isNotEmpty) {
      try {
        final parsed = jsonDecode(rawProjectList);
        if (parsed is List) values = parsed;
      } catch (_) {
        values = const [];
      }
    }

    final normalized = <String>{};
    for (final entry in values) {
      if (entry == null) continue;
      if (entry is Map) {
        final candidates = [
          entry['id'],
          entry['project_id'],
          entry['name'],
          entry['project_name'],
        ];
        for (final candidate in candidates) {
          final key = (candidate ?? '').toString().trim().toLowerCase();
          if (key.isNotEmpty) normalized.add(key);
        }
      } else {
        final key = entry.toString().trim().toLowerCase();
        if (key.isNotEmpty) normalized.add(key);
      }
    }
    return normalized;
  }

  Future<File?> _downloadCompressedFile(String url, String filename) async {
    try {
      final token = await AuthStorage.getToken();
      final headers = <String, String>{};
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
      final uri = Uri.parse(
        url.startsWith('http') ? url : ApiClient.getApiFileUrl(url),
      );
      final response = await http.get(uri, headers: headers);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final dir = await FileService.getTempDirectory();
        final file = File('${dir.path}/$filename');
        await file.writeAsBytes(response.bodyBytes);
        return file;
      }
    } catch (_) {}
    return null;
  }
}

class _ProjectSelectionViewModel {
  final bool isAuthenticated;
  final String userName;
  final bool isAdmin;
  final String? userRole;
  final Map<String, dynamic>? user;

  _ProjectSelectionViewModel({
    required this.isAuthenticated,
    required this.userName,
    required this.isAdmin,
    required this.userRole,
    required this.user,
  });
}
