import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'auth_storage.dart';

class ApiClient {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.festmate.in',
  );

  /// Global timeout for ALL HTTP requests.
  /// If the server is unreachable, calls fail fast instead of hanging forever.
  static const Duration _httpTimeout = Duration(seconds: 20);

  // ============================================================================
  // Helper Methods
  // ============================================================================
  static Map<String, String> _authHeaders(String? token) {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static http.Response _errorResponse(int status, String message) {
    return http.Response(
      jsonEncode({'error': message}),
      status,
      headers: {'content-type': 'application/json'},
    );
  }

  static Future<http.Response> _request(
    Future<http.Response> Function() requestFn,
  ) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        return await requestFn().timeout(_httpTimeout);
      } on TimeoutException {
        if (attempt == 0) {
          await Future<void>.delayed(const Duration(milliseconds: 600));
          continue;
        }
        return _errorResponse(
          408,
          'Request timeout while contacting $baseUrl. Check internet/API and retry.',
        );
      } on SocketException {
        if (attempt == 0) {
          await Future<void>.delayed(const Duration(milliseconds: 600));
          continue;
        }
        return _errorResponse(
          503,
          'Unable to reach server at $baseUrl. Verify API URL and network access in APK.',
        );
      } on HandshakeException {
        return _errorResponse(
          495,
          'Secure connection failed. Check SSL certificate and server domain.',
        );
      } on HttpException catch (e) {
        return _errorResponse(502, e.message);
      } catch (e) {
        return _errorResponse(500, 'Unexpected network error: $e');
      }
    }
    return _errorResponse(500, 'Unexpected request state');
  }

  /// Wrapper: GET with timeout
  static Future<http.Response> _get(Uri uri, {Map<String, String>? headers}) =>
      _request(() => http.get(uri, headers: headers));

  /// Wrapper: POST with timeout
  static Future<http.Response> _post(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) => _request(() => http.post(uri, headers: headers, body: body));

  /// Wrapper: PUT with timeout
  static Future<http.Response> _put(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) => _request(() => http.put(uri, headers: headers, body: body));

  /// Wrapper: DELETE with timeout
  static Future<http.Response> _delete(
    Uri uri, {
    Map<String, String>? headers,
  }) => _request(() => http.delete(uri, headers: headers));

  /// Wrapper: PATCH with timeout
  static Future<http.Response> _patch(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) => _request(() => http.patch(uri, headers: headers, body: body));

  /// Helper for multipart form-data requests (for file uploads)
  static Future<Map<String, dynamic>> _multipartRequest(
    String method,
    String endpoint,
    Map<String, String> fields, {
    Map<String, File>? files,
  }) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl$endpoint');
    final request = http.MultipartRequest(method, uri);

    // Add authorization header
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    // Add fields
    request.fields.addAll(fields);

    // Add files
    if (files != null) {
      for (final entry in files.entries) {
        request.files.add(
          await http.MultipartFile.fromPath(entry.key, entry.value.path),
        );
      }
    }

    try {
      final streamedResponse = await request.send().timeout(_httpTimeout);
      final response = await http.Response.fromStream(streamedResponse);
      return _handleResponse(response);
    } on TimeoutException {
      return {
        'success': false,
        'error':
            'Upload timeout. Please check your internet connection and retry.',
        'status': 408,
      };
    } on SocketException {
      return {
        'success': false,
        'error':
            'Unable to reach server. Verify API URL and network access in APK.',
        'status': 503,
      };
    } catch (e) {
      return {'success': false, 'error': 'Upload failed: $e', 'status': 500};
    }
  }

  static Future<Map<String, dynamic>> _multipartFilesRequest(
    String method,
    String endpoint,
    Map<String, String> fields, {
    required List<File> files,
    String fileField = 'files',
  }) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl$endpoint');
    final request = http.MultipartRequest(method, uri);

    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    request.fields.addAll(fields);

    for (final file in files) {
      request.files.add(
        await http.MultipartFile.fromPath(fileField, file.path),
      );
    }

    try {
      final streamedResponse = await request.send().timeout(_httpTimeout);
      final response = await http.Response.fromStream(streamedResponse);
      return _handleResponse(response);
    } on TimeoutException {
      return {
        'success': false,
        'error':
            'Upload timeout. Please check your internet connection and retry.',
        'status': 408,
      };
    } on SocketException {
      return {
        'success': false,
        'error':
            'Unable to reach server. Verify API URL and network access in APK.',
        'status': 503,
      };
    } catch (e) {
      return {
        'success': false,
        'error': 'Upload failed: $e',
        'status': 500,
      };
    }
  }

  static Future<Map<String, dynamic>> _handleResponse(
    http.Response response,
  ) async {
    final contentType = response.headers['content-type'] ?? '';
    dynamic data;
    try {
      if (contentType.contains('application/json')) {
        data = jsonDecode(response.body);
      } else {
        data = response.body;
      }
    } catch (_) {
      data = response.body;
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {'success': true, 'data': _unwrapData(data)};
    }
    final error = (data is Map && ((data['error'] ?? data['message']) != null))
        ? (data['error'] ?? data['message'])
        : response.reasonPhrase;
    return {'success': false, 'error': error, 'status': response.statusCode};
  }

  static Future<String?> _getToken() => AuthStorage.getToken();

  /// Some environments return payloads wrapped as { data: ... }.
  /// Unwrap recursively so callers get the actual entity/list.
  static dynamic _unwrapData(dynamic data) {
    dynamic current = data;
    while (current is Map && current.containsKey('data')) {
      current = current['data'];
    }
    return current;
  }

  // ============================================================================
  // Authentication
  // ============================================================================
  static Future<Map<String, dynamic>> login(
    String email,
    String password,
  ) async {
    final uri = Uri.parse('$baseUrl/api/auth/login');
    final res = await _post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    final result = await _handleResponse(res);
    if (result['success'] == true) {
      final data = result['data'];
      if (data is! Map<String, dynamic>) {
        return {
          'success': false,
          'error': 'Invalid login response from server.',
        };
      }
      final token =
          data['token'] ?? data['access_token'] ?? data['jwt'] ?? '';
      if (token == null || token.toString().isEmpty) {
        return {
          'success': false,
          'error': data['message']?.toString() ?? 'Login failed.',
        };
      }
      final rawUser = data['user'];
      final userMap = rawUser is Map<String, dynamic> ? rawUser : data;
      final user = {
        ...userMap,
        'token': token,
      };
      await AuthStorage.setUser(user);
    }
    return result;
  }

  static Future<Map<String, dynamic>> signup(
    Map<String, dynamic> userData,
  ) async {
    final uri = Uri.parse('$baseUrl/api/auth/signup');
    final payload = <String, dynamic>{
      'username': userData['username'],
      'name': userData['name'],
      'email': userData['email'],
      'phone_number': userData['phone_number'],
      'password': userData['password'],
      'role': userData['role'],
      'project_id': userData['project_id'],
      'project': userData['project'],
    };
    final res = await _post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createUser(
    Map<String, dynamic> userData,
  ) async {
    final uri = Uri.parse('$baseUrl/api/auth/signup');
    final payload = <String, dynamic>{
      'username': userData['username'],
      'name': userData['name'],
      'email': userData['email'],
      'phone_number': userData['phone_number'],
      'password': userData['password'],
      'role': userData['role'],
      'project_id': userData['project_id'],
      'project': userData['project'],
    };
    final res = await _post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> logout() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/auth/logout');
    final res = await _post(uri, headers: _authHeaders(token));
    await AuthStorage.clear();
    return _handleResponse(res);
  }

  // ============================================================================
  // Users
  // ============================================================================
  static Future<Map<String, dynamic>> getUsers() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/auth/users');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getUserById(String userId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/auth/users/$userId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateUser(
    String userId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/auth/users/$userId');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  // ============================================================================
  // Access Control
  // ============================================================================
  static Future<Map<String, dynamic>> getAccessCatalog() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/access/catalog');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getAccessUser(String userId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/access/user/$userId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getAccessAllUsers() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/access/all-users');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> revokeAccessUser(String userId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/access/user/$userId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateAccessUserPage(
    String userId,
    String pagePath,
    Map<String, dynamic> payload,
  ) async {
    final token = await _getToken();
    final encodedPagePath = Uri.encodeComponent(pagePath);
    final uri = Uri.parse(
      '$baseUrl/api/access/user/$userId/page/$encodedPagePath',
    );
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(payload),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateAccessUserFunction(
    String userId,
    String functionKey,
    Map<String, dynamic> payload,
  ) async {
    final token = await _getToken();
    final encodedFunctionKey = Uri.encodeComponent(functionKey);
    final uri = Uri.parse(
      '$baseUrl/api/access/user/$userId/function/$encodedFunctionKey',
    );
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(payload),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateAccessUserBulk(
    String userId,
    Map<String, dynamic> payload,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/access/user/$userId/bulk');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(payload),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateUserAccessControl(
    String userId,
    Map<String, dynamic> accessControl,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/auth/users/$userId/access-control');
    final res = await _patch(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode({'access_control': accessControl}),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteUser(String userId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/auth/users/$userId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Projects
  // ============================================================================
  static Future<Map<String, dynamic>> getProjects() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/projects');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getProject(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/projects/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createProject(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/projects');
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateProject(
    String projectId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/projects/$projectId');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteProject(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/projects/$projectId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Create project with file uploads (FormData)
  static Future<Map<String, dynamic>> createProjectWithFiles({
    required Map<String, dynamic> projectData,
    File? workOrderFile,
    File? masFile,
  }) async {
    final fields = <String, String>{
      'project_name': (projectData['project_name'] ?? '').toString(),
      'project_startdate': (projectData['project_startdate'] ?? '').toString(),
      'client_name': (projectData['client_name'] ?? '').toString(),
      'location': (projectData['location'] ?? '').toString(),
      'floor': (projectData['floor'] ?? '').toString(),
      'estimate_value': (projectData['estimate_value'] ?? '').toString(),
      'wo_number': (projectData['wo_number'] ?? '').toString(),
      'work_order_information': (projectData['work_order_information'] ?? '')
          .toString(),
    };

    // Add array fields with indexed keys
    final prPoTracking = projectData['pr_po_tracking'] as List? ?? [];
    for (var i = 0; i < prPoTracking.length; i++) {
      fields['pr_po_tracking[$i]'] = prPoTracking[i].toString();
    }

    final samples = projectData['samples'] as List? ?? [];
    for (var i = 0; i < samples.length; i++) {
      fields['samples[$i]'] = samples[i].toString();
    }

    final mlManagement = projectData['ml_management'] as List? ?? [];
    for (var i = 0; i < mlManagement.length; i++) {
      fields['ml_management[$i]'] = mlManagement[i].toString();
    }

    final files = <String, File>{};
    if (workOrderFile != null) files['work_order_file'] = workOrderFile;
    if (masFile != null) files['mas_file'] = masFile;

    return _multipartRequest('POST', '/api/projects', fields, files: files);
  }

  /// Update project with file uploads (FormData)
  static Future<Map<String, dynamic>> updateProjectWithFiles({
    required String projectId,
    required Map<String, dynamic> projectData,
    File? workOrderFile,
    File? masFile,
  }) async {
    final fields = <String, String>{
      'project_name': (projectData['project_name'] ?? '').toString(),
      'product_duration': (projectData['product_duration'] ?? '').toString(),
      'client_name': (projectData['client_name'] ?? '').toString(),
      'location': (projectData['location'] ?? '').toString(),
      'floor': (projectData['floor'] ?? '').toString(),
      'estimate_value': (projectData['estimate_value'] ?? '').toString(),
      'wo_number': (projectData['wo_number'] ?? '').toString(),
      'work_order_information': (projectData['work_order_information'] ?? '')
          .toString(),
    };

    // ML Management for update uses object format
    final mlManagement = projectData['ml_management'];
    if (mlManagement is Map) {
      fields['ml_management[ml_task]'] = (mlManagement['ml_task'] ?? '')
          .toString();
    }

    final prPoTracking = projectData['pr_po_tracking'] as List? ?? [];
    for (var i = 0; i < prPoTracking.length; i++) {
      fields['pr_po_tracking[$i]'] = prPoTracking[i].toString();
    }

    final samples = projectData['samples'] as List? ?? [];
    for (var i = 0; i < samples.length; i++) {
      fields['samples[$i]'] = samples[i].toString();
    }

    final files = <String, File>{};
    if (workOrderFile != null) files['work_order_file'] = workOrderFile;
    if (masFile != null) files['mas_file'] = masFile;

    return _multipartRequest(
      'PUT',
      '/api/projects/$projectId',
      fields,
      files: files,
    );
  }

  // ============================================================================
  // BOQ
  // ============================================================================
  static Future<Map<String, dynamic>> getBOQsByProject(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/boq/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createBOQ(
    Map<String, dynamic> data,
  ) async {
    final fields = <String, String>{
      // Match React contract: always send category key, default empty string.
      'category': (data['category'] ?? '').toString(),
      // Required in create flow.
      'project_id': (data['project_id'] ?? '').toString(),
    };

    if (data['item_code'] != null && data['item_code'].toString().isNotEmpty) {
      fields['item_code'] = data['item_code'].toString();
    }
    if (data['description'] != null &&
        data['description'].toString().isNotEmpty) {
      fields['description'] = data['description'].toString();
    }
    if (data['floor'] != null && data['floor'].toString().isNotEmpty) {
      fields['floor'] = data['floor'].toString();
    }
    if (data['unit'] != null && data['unit'].toString().isNotEmpty) {
      fields['unit'] = data['unit'].toString();
    }
    if (data['quantity'] != null && data['quantity'].toString().isNotEmpty) {
      fields['quantity'] = data['quantity'].toString();
    }
    if (data['rate'] != null && data['rate'].toString().isNotEmpty) {
      fields['rate'] = data['rate'].toString();
    }
    if (data['amount'] != null && data['amount'].toString().isNotEmpty) {
      fields['amount'] = data['amount'].toString();
    }

    final files = <String, File>{};
    final file = data['boq_file'];
    if (file is File) {
      files['boq_file'] = file;
    }

    return _multipartRequest(
      'POST',
      '/api/boq',
      fields,
      files: files.isEmpty ? null : files,
    );
  }

  static Future<Map<String, dynamic>> updateBOQ(
    String boqId,
    Map<String, dynamic> data,
  ) async {
    final fields = <String, String>{};
    const keys = [
      'category',
      'item_code',
      'description',
      'floor',
      'unit',
      'quantity',
      'rate',
      'amount',
      'project_id',
    ];
    for (final key in keys) {
      final value = data[key];
      if (value != null && value.toString().isNotEmpty) {
        fields[key] = value.toString();
      }
    }

    final files = <String, File>{};
    final file = data['boq_file'];
    if (file is File) {
      files['boq_file'] = file;
    }

    return _multipartRequest(
      'PUT',
      '/api/boq/$boqId',
      fields,
      files: files.isEmpty ? null : files,
    );
  }

  static Future<Map<String, dynamic>> deleteBOQ(String boqId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/boq/$boqId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Get individual BOQ by ID
  static Future<Map<String, dynamic>> getBOQ(String boqId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/boq/$boqId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Get all BOQs
  static Future<Map<String, dynamic>> getAllBOQs() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/boq');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Create BOQ with file upload (FormData)
  static Future<Map<String, dynamic>> createBOQWithFile({
    required Map<String, dynamic> data,
    File? boqFile,
  }) async {
    final fields = <String, String>{
      'category': (data['category'] ?? '').toString(),
      'project_id': (data['project_id'] ?? '').toString(),
      'floor': (data['floor'] ?? '').toString(),
      'unit': (data['unit'] ?? '').toString(),
      'quantity': (data['quantity'] ?? '').toString(),
      'rate': (data['rate'] ?? '').toString(),
      'amount': (data['amount'] ?? '').toString(),
    };

    // Only add optional fields if they have value
    if (data['item_code'] != null && data['item_code'].toString().isNotEmpty) {
      fields['item_code'] = data['item_code'].toString();
    }
    if (data['description'] != null &&
        data['description'].toString().isNotEmpty) {
      fields['description'] = data['description'].toString();
    }

    final files = <String, File>{};
    if (boqFile != null) files['boq_file'] = boqFile;

    return _multipartRequest('POST', '/api/boq', fields, files: files);
  }

  /// Update BOQ with file upload (FormData)
  static Future<Map<String, dynamic>> updateBOQWithFile({
    required String boqId,
    required Map<String, dynamic> data,
    File? boqFile,
  }) async {
    final fields = <String, String>{
      'category': (data['category'] ?? '').toString(),
      'project_id': (data['project_id'] ?? '').toString(),
      'floor': (data['floor'] ?? '').toString(),
      'unit': (data['unit'] ?? '').toString(),
      'quantity': (data['quantity'] ?? '').toString(),
      'rate': (data['rate'] ?? '').toString(),
      'amount': (data['amount'] ?? '').toString(),
    };

    if (data['item_code'] != null && data['item_code'].toString().isNotEmpty) {
      fields['item_code'] = data['item_code'].toString();
    }
    if (data['description'] != null &&
        data['description'].toString().isNotEmpty) {
      fields['description'] = data['description'].toString();
    }

    final files = <String, File>{};
    if (boqFile != null) files['boq_file'] = boqFile;

    return _multipartRequest('PUT', '/api/boq/$boqId', fields, files: files);
  }

  // ============================================================================
  // Samples
  // ============================================================================
  static const List<String> _sampleCreateCandidates = [
    '/api/sample',
    '/api/sample/create',
    '/api/sample/create-sample',
    '/api/samples',
    '/api/samples/create',
    '/api/samples/create-sample',
  ];

  static const List<String> _sampleUploadCandidates = [
    '/api/sample/upload',
    '/api/samples/upload',
  ];

  static const List<String> _sampleListCandidates = [
    '/api/sample',
    '/api/samples',
  ];

  static const List<String> _sampleProjectCandidates = [
    '/api/sample/project/{projectId}',
    '/api/samples/project/{projectId}',
  ];

  static const List<String> _sampleByIdCandidates = [
    '/api/sample/{id}',
    '/api/samples/{id}',
  ];

  static Future<Map<String, dynamic>> uploadSampleFiles(
    List<File> files,
  ) async {
    if (files.isEmpty) {
      return {'success': false, 'error': 'No files to upload'};
    }
    final token = await _getToken();
    Map<String, dynamic>? lastError;
    for (final path in _sampleUploadCandidates) {
      final uri = Uri.parse('$baseUrl$path');
      final request = http.MultipartRequest('POST', uri);
      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }
      for (final f in files) {
        request.files.add(await http.MultipartFile.fromPath('file', f.path));
      }
      final streamedResponse = await request.send().timeout(_httpTimeout);
      final response = await http.Response.fromStream(streamedResponse);
      final result = await _handleResponse(response);
      if (result['success'] == true) {
        return {...result, 'data': _unwrapData(result['data'])};
      }
      lastError = result;
      if (result['status'] != 404) return result;
    }
    return lastError ??
        {'success': false, 'error': 'Upload path not found', 'status': 404};
  }

  static Future<Map<String, dynamic>> getSamples() async {
    final token = await _getToken();
    Map<String, dynamic>? lastError;
    for (final path in _sampleListCandidates) {
      final uri = Uri.parse('$baseUrl$path');
      final res = await _get(uri, headers: _authHeaders(token));
      final result = await _handleResponse(res);
      if (result['success'] == true) {
        return {...result, 'data': _unwrapData(result['data'])};
      }
      lastError = result;
      if (result['status'] != 404) return result;
    }
    return lastError ??
        {'success': false, 'error': 'List path not found', 'status': 404};
  }

  static Future<Map<String, dynamic>> getSampleById(String id) async {
    final token = await _getToken();
    Map<String, dynamic>? lastError;
    for (final path in _sampleByIdCandidates) {
      final uri = Uri.parse('$baseUrl${path.replaceAll('{id}', id)}');
      final res = await _get(uri, headers: _authHeaders(token));
      final result = await _handleResponse(res);
      if (result['success'] == true) {
        return {...result, 'data': _unwrapData(result['data'])};
      }
      lastError = result;
      if (result['status'] != 404) return result;
    }
    return lastError ??
        {'success': false, 'error': 'Get by id path not found', 'status': 404};
  }

  static Future<Map<String, dynamic>> getSamplesByProject(
    String projectId,
  ) async {
    final token = await _getToken();
    Map<String, dynamic>? lastError;
    for (final path in _sampleProjectCandidates) {
      final resolved = path.replaceAll('{projectId}', projectId);
      final uri = Uri.parse('$baseUrl$resolved');
      final res = await _get(uri, headers: _authHeaders(token));
      final result = await _handleResponse(res);
      if (result['success'] == true) {
        return {...result, 'data': _unwrapData(result['data'])};
      }
      lastError = result;
      if (result['status'] != 404) return result;
    }
    return lastError ??
        {
          'success': false,
          'error': 'Get by project path not found',
          'status': 404,
        };
  }

  static Future<Map<String, dynamic>> createSample(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final payload = Map<String, dynamic>.from(data);
    for (final k in ['location', 'item_description', 'add_fields']) {
      if (payload[k] != null && payload[k] is! String) {
        payload[k] = jsonEncode(payload[k]);
      }
    }
    Map<String, dynamic>? lastError;
    for (final path in _sampleCreateCandidates) {
      final uri = Uri.parse('$baseUrl$path');
      final res = await _post(
        uri,
        headers: _authHeaders(token),
        body: jsonEncode(payload),
      );
      final result = await _handleResponse(res);
      if (result['success'] == true) {
        return {...result, 'data': _unwrapData(result['data'])};
      }
      lastError = result;
      if (result['status'] != 404) return result;
    }
    return lastError ??
        {'success': false, 'error': 'Create path not found', 'status': 404};
  }

  static Future<Map<String, dynamic>> updateSample(
    String id,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final payload = Map<String, dynamic>.from(data);
    for (final k in ['location', 'item_description', 'add_fields']) {
      if (payload[k] != null && payload[k] is! String) {
        payload[k] = jsonEncode(payload[k]);
      }
    }
    Map<String, dynamic>? lastError;
    for (final path in _sampleByIdCandidates) {
      final uri = Uri.parse('$baseUrl${path.replaceAll('{id}', id)}');
      final res = await _put(
        uri,
        headers: _authHeaders(token),
        body: jsonEncode(payload),
      );
      final result = await _handleResponse(res);
      if (result['success'] == true) {
        return {...result, 'data': _unwrapData(result['data'])};
      }
      lastError = result;
      if (result['status'] != 404) return result;
    }
    return lastError ??
        {'success': false, 'error': 'Update path not found', 'status': 404};
  }

  static Future<Map<String, dynamic>> deleteSample(String id) async {
    final token = await _getToken();
    Map<String, dynamic>? lastError;
    for (final path in _sampleByIdCandidates) {
      final uri = Uri.parse('$baseUrl${path.replaceAll('{id}', id)}');
      final res = await _delete(uri, headers: _authHeaders(token));
      final result = await _handleResponse(res);
      if (result['success'] == true) {
        return {...result, 'data': _unwrapData(result['data'])};
      }
      lastError = result;
      if (result['status'] != 404) return result;
    }
    return lastError ??
        {'success': false, 'error': 'Delete path not found', 'status': 404};
  }

  static Future<Map<String, dynamic>> uploadPRFile(File file) async {
    return _multipartRequest(
      'POST',
      '/api/pr/upload',
      {},
      files: {'file': file},
    );
  }

  static Future<Map<String, dynamic>> uploadPRSignature(File file) async {
    return _multipartRequest(
      'POST',
      '/api/pr/upload-signature',
      {},
      files: {'file': file},
    );
  }

  static Future<Map<String, dynamic>> createPR(Map<String, dynamic> data) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr');
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getPRs() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getPRById(String prId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr/$prId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getPRsByProject(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getPRsBySample(String sampleId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr/sample/$sampleId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updatePR(
    String prId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr/$prId');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deletePR(String prId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr/$prId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> uploadPrEmailAttachments(
    String prId,
    List<File> files,
  ) async {
    if (prId.isEmpty || files.isEmpty) {
      return {
        'success': false,
        'error': 'PR id and attachments are required',
      };
    }
    return _multipartFilesRequest(
      'POST',
      '/api/pr/$prId/upload-email-attachment',
      const {},
      files: files,
      fileField: 'files',
    );
  }

  static Future<Map<String, dynamic>> sendPrEmail({
    required String prId,
    required String to,
    List<String> cc = const [],
    String message = '',
    List<dynamic> attachments = const [],
    List<File> attachmentFiles = const [],
  }) async {
    if (prId.isEmpty) {
      return {
        'success': false,
        'error': 'PR id is required to send email.',
      };
    }

    final user = await AuthStorage.getUser();
    final userId = (user?['user_id'] ?? user?['id'] ?? user?['uid'])
        ?.toString()
        .trim();
    final userName = (user?['user_name'] ??
            user?['name'] ??
            user?['username'] ??
            user?['email'] ??
            '')
        .toString()
        .trim();

    List<dynamic> resolvedAttachments = List<dynamic>.from(attachments);
    if (attachmentFiles.isNotEmpty) {
      final uploadRes = await uploadPrEmailAttachments(prId, attachmentFiles);
      if (uploadRes['success'] != true) return uploadRes;
      final data = uploadRes['data'];
      resolvedAttachments = (data is Map ? data['attachments'] : null)
              as List? ??
          [];
    }

    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr/$prId/send-email');
    final res = await _post(
      uri,
      headers: {
        ..._authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'to': to.trim(),
        'cc': cc.where((e) => e.trim().isNotEmpty).toList(),
        'message': message.trim(),
        'attachments': resolvedAttachments,
        if (userId != null && userId.isNotEmpty) 'user_id': userId,
        if (userName.isNotEmpty) 'user_name': userName,
      }),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getPrEmailLogs(String prId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/pr/$prId/email-logs');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> uploadPoEmailAttachments(
    String poId,
    List<File> files,
  ) async {
    if (poId.isEmpty || files.isEmpty) {
      return {
        'success': false,
        'error': 'PO id and attachments are required',
      };
    }
    return _multipartFilesRequest(
      'POST',
      '/api/po/$poId/upload-email-attachment',
      const {},
      files: files,
      fileField: 'files',
    );
  }

  static Future<Map<String, dynamic>> sendPoEmail({
    required String poId,
    required String to,
    List<String> cc = const [],
    String message = '',
    List<dynamic> attachments = const [],
    List<File> attachmentFiles = const [],
  }) async {
    if (poId.isEmpty) {
      return {
        'success': false,
        'error': 'PO id is required to send email.',
      };
    }

    final user = await AuthStorage.getUser();
    final userId = (user?['user_id'] ?? user?['id'] ?? user?['uid'])
        ?.toString()
        .trim();
    final userName = (user?['user_name'] ??
            user?['name'] ??
            user?['username'] ??
            user?['email'] ??
            '')
        .toString()
        .trim();

    List<dynamic> resolvedAttachments = List<dynamic>.from(attachments);
    if (attachmentFiles.isNotEmpty) {
      final uploadRes = await uploadPoEmailAttachments(poId, attachmentFiles);
      if (uploadRes['success'] != true) return uploadRes;
      final data = uploadRes['data'];
      resolvedAttachments = (data is Map ? data['attachments'] : null)
              as List? ??
          [];
    }

    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/po/$poId/send-email');
    final res = await _post(
      uri,
      headers: {
        ..._authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'to': to.trim(),
        'cc': cc.where((e) => e.trim().isNotEmpty).toList(),
        'message': message.trim(),
        'attachments': resolvedAttachments,
        if (userId != null && userId.isNotEmpty) 'user_id': userId,
        if (userName.isNotEmpty) 'user_name': userName,
      }),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getPoEmailLogs(
    String poId, {
    String? userId,
  }) async {
    final token = await _getToken();
    final query = userId == null || userId.isEmpty
        ? ''
        : '?user_id=${Uri.encodeQueryComponent(userId)}';
    final uri = Uri.parse('$baseUrl/api/po/$poId/email-logs$query');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Purchase Orders
  // ============================================================================
  static Future<Map<String, dynamic>> getPOsByProject(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/po/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createPO(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/po');
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updatePO(
    String poId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/po/$poId');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deletePO(String poId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/po/$poId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Get individual PO by ID
  static Future<Map<String, dynamic>> getPO(String poId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/po/$poId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Upload PO file
  static Future<Map<String, dynamic>> uploadPOFile(File file) async {
    return _multipartRequest(
      'POST',
      '/api/po/upload',
      {},
      files: {'file': file},
    );
  }

  /// Parse PO file (extract structured data from uploaded PDF)
  static Future<Map<String, dynamic>> parsePOFile(File file) async {
    return _multipartRequest(
      'POST',
      '/api/po-parser/parse',
      {},
      files: {'file': file},
    );
  }

  // ============================================================================
  // MIR (Material Inspection Request)
  // ============================================================================
  static Future<Map<String, dynamic>> getMIRsByProject(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/mir/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createMIR(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/mir');
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateMIR(
    String mirId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/mir/$mirId');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteMIR(String mirId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/mir/$mirId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Get individual MIR by ID
  static Future<Map<String, dynamic>> getMIR(String mirId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/mir/$mirId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Get all MIRs
  static Future<Map<String, dynamic>> getAllMIRs() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/mir');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Upload MIR file
  static Future<Map<String, dynamic>> uploadMIRFile(File file) async {
    return _multipartRequest(
      'POST',
      '/api/mir/upload',
      {},
      files: {'file': file},
    );
  }

  // ============================================================================
  // ITR (Installation Test Report)
  // ============================================================================
  static Future<Map<String, dynamic>> getITRsByProject(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/itr/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createITR(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/itr');
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateITR(
    String itrId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/itr/$itrId');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteITR(String itrId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/itr/$itrId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Get individual ITR by ID
  static Future<Map<String, dynamic>> getITR(String itrId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/itr/$itrId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Get all ITRs
  static Future<Map<String, dynamic>> getAllITRs() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/itr');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Upload ITR reference file (PDF/XLS/XLSX/CSV)
  static Future<Map<String, dynamic>> uploadITRReference(
    File file, {
    String? userId,
    String? userName,
  }) {
    final fields = <String, String>{};
    if (userId != null && userId.trim().isNotEmpty) {
      fields['user_id'] = userId.trim();
    }
    if (userName != null && userName.trim().isNotEmpty) {
      fields['user_name'] = userName.trim();
    }
    return _multipartRequest(
      'POST',
      '/api/itr/upload',
      fields,
      files: {'file': file},
    );
  }

  // ============================================================================
  // Attendance
  // ============================================================================
  static Future<Map<String, dynamic>> uploadAttendanceImage(
    File file, {
    String? userId,
    String? userName,
  }) {
    final fields = <String, String>{};
    if (userId != null && userId.trim().isNotEmpty) {
      fields['user_id'] = userId.trim();
    }
    if (userName != null && userName.trim().isNotEmpty) {
      fields['user_name'] = userName.trim();
    }
    return _multipartRequest(
      'POST',
      '/api/attendance/upload',
      fields,
      files: {'file': file},
    );
  }

  static Future<Map<String, dynamic>> createAttendance(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/attendance');
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getAllAttendance() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/attendance');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getAttendanceByProject(
    String projectId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/attendance/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getAttendanceByUser(
    String userId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/attendance/user/$userId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getAttendanceById(String id) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/attendance/$id');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateAttendance(
    String id,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/attendance/$id');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> checkoutAttendance(
    String id,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/attendance/checkout/$id');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteAttendance(
    String id, {
    String? userId,
    String? userName,
  }) async {
    final token = await _getToken();
    final queryParams = <String, String>{};
    if (userId != null && userId.trim().isNotEmpty) {
      queryParams['user_id'] = userId.trim();
    }
    if (userName != null && userName.trim().isNotEmpty) {
      queryParams['user_name'] = userName.trim();
    }
    final uri = Uri.parse('$baseUrl/api/attendance/$id').replace(
      queryParameters: queryParams.isEmpty ? null : queryParams,
    );
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Update ITR approval/status workflow
  static Future<Map<String, dynamic>> updateITRStatus(
    String itrId, {
    required String status,
    String inspectionCode = '',
    String lodhaPmcComments = '',
    String? userId,
    String? userName,
  }) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/itr/$itrId/status');
    final res = await _patch(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode({
        'status': status,
        'inspection_code': inspectionCode,
        'lodha_pmc_comments': lodhaPmcComments,
        'user_id': userId,
        'user_name': userName,
      }),
    );
    return _handleResponse(res);
  }

  // ============================================================================
  // Vendors
  // ============================================================================
  static Future<Map<String, dynamic>> getVendors() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendors');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getVendorsByProject(
    String projectId,
  ) async {
    // Backend does not support project-specific vendor fetch (404).
    // Always return the full vendor list instead.
    return getVendors();
  }

  static Future<Map<String, dynamic>> getVendorById(String vendorId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendors/$vendorId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createVendor(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendors');
    final payload = <String, dynamic>{
      'vendor_name': data['vendor_name'],
      'vendor_company_name': data['vendor_company_name'],
      'vendor_email': data['vendor_email'],
      'mobile_number': data['mobile_number'],
      'location': data['location'],
      'status': data['status'],
    };
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(payload),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateVendor(
    String vendorId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendors/$vendorId');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateVendorStatus(
    String vendorId,
    String status,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendors/$vendorId/status');
    final res = await _patch(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode({'status': status}),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteVendor(String vendorId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendors/$vendorId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Vendor Price Lists
  // ============================================================================
  static Future<Map<String, dynamic>> uploadVendorPriceListFile(
    File file, {
    Map<String, dynamic>? fields,
  }) async {
    final payload = <String, String>{};
    fields?.forEach((key, value) {
      if (value == null) return;
      final text = value.toString();
      if (text.trim().isEmpty) return;
      payload[key] = text;
    });
    return _multipartRequest(
      'POST',
      '/api/vendor-price-list/upload',
      payload,
      files: {'file': file},
    );
  }

  static Future<Map<String, dynamic>> getVendorPriceLists(
    String vendorId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendor-price-list/vendor/$vendorId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getVendorPriceListById(
    String priceListId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendor-price-list/$priceListId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createVendorPriceList(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendor-price-list');
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateVendorPriceList(
    String priceListId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendor-price-list/$priceListId');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteVendorPriceList(
    String priceListId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendor-price-list/$priceListId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateVendorPriceListStatus(
    String priceListId,
    String status,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/vendor-price-list/$priceListId/status');
    final res = await _patch(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode({'status': status}),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> compareVendorPriceListItems(
    Map<String, dynamic> params,
  ) async {
    final token = await _getToken();
    const allowedParams = <String>{
      'q',
      'item_name',
      'product_name',
      'category',
      'vendor_id',
      'vendor_ids',
      'project_id',
      'status',
      'limit',
      'offset',
    };

    final query = <String, String>{};
    params.forEach((key, value) {
      if (!allowedParams.contains(key)) return;
      if (value == null) return;
      final asString = value.toString().trim();
      if (asString.isEmpty) return;
      query[key] = asString;
    });

    final uri = Uri.parse(
      '$baseUrl/api/vendor-price-list/compare',
    ).replace(queryParameters: query.isEmpty ? null : query);
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Materials (Product Master)
  // ============================================================================
  static Future<Map<String, dynamic>> getMaterials() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/materials');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Inventory (Project-linked)
  // ============================================================================
  static Future<Map<String, dynamic>> getInventories() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/inventory');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getInventoryById(
    String inventoryId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/inventory/$inventoryId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getInventoriesByProject(
    String projectId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/inventory/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createInventory(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/inventory');
    final payload = <String, dynamic>{};
    if (data['brand'] != null) payload['brand'] = data['brand'];
    if (data['name'] != null) payload['name'] = data['name'];
    if (data['quantity'] != null) payload['quantity'] = data['quantity'];
    if (data['price'] != null) payload['price'] = data['price'];
    if (data['units'] != null) payload['units'] = data['units'];
    if (data['width'] != null) payload['width'] = data['width'];
    if (data['height'] != null) payload['height'] = data['height'];
    if (data['stockin'] != null) payload['stockin'] = data['stockin'];
    if (data['billing'] != null) payload['billing'] = data['billing'];
    if (data['project_id'] != null) {
      payload['project_id'] = data['project_id'];
    }
    if (data['user_id'] != null) payload['user_id'] = data['user_id'];
    if (data['user_name'] != null) payload['user_name'] = data['user_name'];
    if (data['notes'] != null) payload['notes'] = data['notes'];
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(payload),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateInventory(
    String inventoryId,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/inventory/$inventoryId');
    final payload = <String, dynamic>{};
    if (data['brand'] != null) payload['brand'] = data['brand'];
    if (data['name'] != null) payload['name'] = data['name'];
    if (data['quantity'] != null) payload['quantity'] = data['quantity'];
    if (data['price'] != null) payload['price'] = data['price'];
    if (data['units'] != null) payload['units'] = data['units'];
    if (data['width'] != null) payload['width'] = data['width'];
    if (data['height'] != null) payload['height'] = data['height'];
    if (data['stockin'] != null) payload['stockin'] = data['stockin'];
    if (data['billing'] != null) payload['billing'] = data['billing'];
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(payload),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateInventoryStockIn(
    String inventoryId,
    bool stockin,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/inventory/$inventoryId/stockin');
    final res = await _patch(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode({'stockin': stockin}),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateInventoryBilling(
    String inventoryId,
    bool billing,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/inventory/$inventoryId/billing');
    final res = await _patch(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode({'billing': billing}),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteInventory(
    String inventoryId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/inventory/$inventoryId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Inventory History
  // ============================================================================
  static Future<Map<String, dynamic>> getInventoryHistory(
    Map<String, dynamic> filters,
  ) async {
    final token = await _getToken();
    const allowed = <String>{
      'inventory_id',
      'user_id',
      'change_type',
      'source_type',
      'project_id',
      'from',
      'to',
      'page',
      'limit',
      'sort',
    };
    final query = <String, String>{};
    filters.forEach((key, value) {
      if (!allowed.contains(key)) return;
      if (value == null) return;
      final asString = value.toString().trim();
      if (asString.isEmpty) return;
      query[key] = asString;
    });
    final uri = Uri.parse('$baseUrl/api/inventory-history')
        .replace(queryParameters: query.isEmpty ? null : query);
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getInventoryHistorySummary({
    String? from,
    String? to,
  }) async {
    final token = await _getToken();
    final query = <String, String>{};
    if (from != null && from.trim().isNotEmpty) query['from'] = from.trim();
    if (to != null && to.trim().isNotEmpty) query['to'] = to.trim();
    final uri = Uri.parse('$baseUrl/api/inventory-history/summary')
        .replace(queryParameters: query.isEmpty ? null : query);
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getInventoryHistoryByItem(
    String inventoryId, {
    Map<String, dynamic>? filters,
  }) async {
    final token = await _getToken();
    const allowed = <String>{
      'change_type',
      'from',
      'to',
      'page',
      'limit',
      'sort',
    };
    final query = <String, String>{};
    (filters ?? {}).forEach((key, value) {
      if (!allowed.contains(key)) return;
      if (value == null) return;
      final asString = value.toString().trim();
      if (asString.isEmpty) return;
      query[key] = asString;
    });
    final uri = Uri.parse(
      '$baseUrl/api/inventory-history/item/$inventoryId',
    ).replace(queryParameters: query.isEmpty ? null : query);
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> searchInventoryTrace({
    String? query,
    String? projectId,
    String? minQty,
  }) async {
    final token = await _getToken();
    final params = <String, String>{};
    if (query != null && query.trim().isNotEmpty) {
      params['q'] = query.trim();
    }
    if (projectId != null && projectId.trim().isNotEmpty) {
      params['project_id'] = projectId.trim();
    }
    if (minQty != null && minQty.trim().isNotEmpty) {
      params['min_qty'] = minQty.trim();
    }
    final uri = Uri.parse(
      '$baseUrl/api/inventory-trace/search',
    ).replace(queryParameters: params.isEmpty ? null : params);
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Stock Areas
  // ============================================================================
  static Future<Map<String, dynamic>> getStockAreas() async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/stock-areas');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Stock Transfers
  // ============================================================================
  static Future<Map<String, dynamic>> getStockTransfers(
    String projectId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/stock-transfers/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Consumption
  // ============================================================================
  static Future<Map<String, dynamic>> getConsumption(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/consumption/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Returns
  // ============================================================================
  static Future<Map<String, dynamic>> getReturns(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/returns/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Challans
  // ============================================================================
  static Future<Map<String, dynamic>> getChallansByProject(
    String projectId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/dc/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getChallansByPO(String poId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/dc/po/$poId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getChallanById(String id) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/dc/$id');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> createChallan(
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/dc');
    final res = await _post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> updateChallan(
    String id,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/dc/$id');
    final res = await _put(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(data),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteChallan(String id) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/dc/$id');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> uploadChallanFile(File file) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/dc/upload');
    final request = http.MultipartRequest('POST', uri);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    final streamedResponse = await request.send().timeout(_httpTimeout);
    final response = await http.Response.fromStream(streamedResponse);
    return _handleResponse(response);
  }

  // ============================================================================
  // Billing
  // ============================================================================
  static Future<Map<String, dynamic>> getBillingByProject(
    String projectId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/billing/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Reports
  // ============================================================================
  static Future<Map<String, dynamic>> getReports(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/reports/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Audit Logs
  // ============================================================================
  static Future<Map<String, dynamic>> getAuditLogs(String projectId) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/audit-logs/project/$projectId');
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Dashboard
  // ============================================================================
  static Future<Map<String, dynamic>> getDashboardStats({
    String? projectId,
    String? userId,
  }) async {
    final token = await _getToken();
    final query = <String, String>{};
    if (projectId != null && projectId.isNotEmpty) {
      query['project_id'] = projectId;
    }
    if (userId != null && userId.isNotEmpty) {
      query['user_id'] = userId;
    }
    final uri = Uri.parse(
      '$baseUrl/api/dashboard/stats',
    ).replace(queryParameters: query.isEmpty ? null : query);
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> getDashboardActivity({
    required String userId,
    String? projectId,
    String? entityType,
    String? action,
    int? limit,
    int? offset,
  }) async {
    final token = await _getToken();
    final query = <String, String>{'user_id': userId};
    if (projectId != null && projectId.isNotEmpty) {
      query['project_id'] = projectId;
    }
    if (entityType != null && entityType.isNotEmpty) {
      query['entity_type'] = entityType;
    }
    if (action != null && action.isNotEmpty) {
      query['action'] = action;
    }
    if (limit != null) {
      query['limit'] = '$limit';
    }
    if (offset != null) {
      query['offset'] = '$offset';
    }

    final uri = Uri.parse(
      '$baseUrl/api/dashboard/activity',
    ).replace(queryParameters: query);
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> deleteDashboardActivity(
    String activityId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/api/dashboard/activity/$activityId');
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // Authentication Extras
  // ============================================================================
  /// Forgot password request
  static Future<Map<String, dynamic>> forgotPassword(String email) async {
    final uri = Uri.parse('$baseUrl/api/auth/forgot-password');
    final res = await _post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    return _handleResponse(res);
  }

  // ============================================================================
  // File Operations
  // ============================================================================
  /// Compress a file
  static Future<Map<String, dynamic>> compressFile(File file) async {
    return _multipartRequest(
      'POST',
      '/api/compress',
      {},
      files: {'file': file},
    );
  }

  /// Get file URL for uploaded files
  static String getFileUrl(String filename) {
    return '$baseUrl/uploads/$filename';
  }

  /// Get full API file URL
  static String getApiFileUrl(String path) {
    if (path.startsWith('http')) return path;
    return '$baseUrl$path';
  }

  /// Auth headers for file requests that require a token.
  static Future<Map<String, String>> getAuthHeadersForFile() async {
    final token = await _getToken();
    return _authHeaders(token);
  }

  // ============================================================================
  // Notifications
  // ============================================================================
  static Future<String?> getCurrentUserId() async {
    final user = await AuthStorage.getUser();
    return (user?['user_id'] ?? user?['id'] ?? user?['uid'])?.toString();
  }

  static String? getDashboardSocketUrl({String? userId, String? token}) {
    const socketEnabled = bool.fromEnvironment(
      'ENABLE_DASHBOARD_SOCKET',
      defaultValue: false,
    );
    if (!socketEnabled) return null;
    if (baseUrl.isEmpty) return null;

    final apiUri = Uri.tryParse(baseUrl);
    if (apiUri == null || apiUri.host.isEmpty) return null;

    final scheme = apiUri.scheme.toLowerCase();
    String wsScheme;
    if (scheme == 'https') {
      wsScheme = 'wss';
    } else if (scheme == 'http') {
      wsScheme = 'ws';
    } else if (scheme == 'wss' || scheme == 'ws') {
      wsScheme = scheme;
    } else {
      return null;
    }

    if (apiUri.hasPort && apiUri.port == 0) return null;

    final rawPath = apiUri.path;
    final normalizedBasePath = rawPath.isEmpty
        ? ''
        : rawPath.endsWith('/')
        ? rawPath.substring(0, rawPath.length - 1)
        : rawPath;

    final uri = Uri(
      scheme: wsScheme,
      host: apiUri.host,
      port: apiUri.hasPort ? apiUri.port : null,
      path: '$normalizedBasePath/ws/activity',
    );
    final params = <String, String>{};
    if (userId != null && userId.isNotEmpty) {
      params['user_id'] = userId;
    }
    if (token != null && token.isNotEmpty) {
      params['token'] = token;
    }
    return uri
        .replace(queryParameters: params.isEmpty ? null : params)
        .toString();
  }

  /// Get notifications for the current user (Dashboard module API).
  static Future<Map<String, dynamic>> getNotifications({
    String? userId,
    bool? isRead,
    int? limit,
    int? offset,
  }) async {
    final token = await _getToken();
    final resolvedUserId = (userId != null && userId.isNotEmpty)
        ? userId
        : await getCurrentUserId();
    if (resolvedUserId == null || resolvedUserId.isEmpty) {
      return {
        'success': false,
        'error': 'User id is required to fetch notifications',
        'status': 400,
      };
    }
    final query = <String, String>{'user_id': resolvedUserId};
    if (isRead != null) query['is_read'] = '$isRead';
    if (limit != null) query['limit'] = '$limit';
    if (offset != null) query['offset'] = '$offset';
    final uri = Uri.parse(
      '$baseUrl/api/dashboard/notifications',
    ).replace(queryParameters: query);
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Get unread notification count for a user.
  static Future<Map<String, dynamic>> getUnreadNotificationCount({
    String? userId,
  }) async {
    final token = await _getToken();
    final resolvedUserId = (userId != null && userId.isNotEmpty)
        ? userId
        : await getCurrentUserId();
    if (resolvedUserId == null || resolvedUserId.isEmpty) {
      return {
        'success': false,
        'error': 'User id is required to fetch unread count',
        'status': 400,
      };
    }
    final uri = Uri.parse(
      '$baseUrl/api/dashboard/notifications/unread-count',
    ).replace(queryParameters: {'user_id': resolvedUserId});
    final res = await _get(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Mark one notification as read.
  static Future<Map<String, dynamic>> markNotificationRead(
    String notificationId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse(
      '$baseUrl/api/dashboard/notifications/$notificationId/read',
    );
    final res = await _put(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Delete one notification.
  static Future<Map<String, dynamic>> deleteNotification(
    String notificationId,
  ) async {
    final token = await _getToken();
    final uri = Uri.parse(
      '$baseUrl/api/dashboard/notifications/$notificationId',
    );
    final res = await _delete(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  /// Mark all notifications as read for a user.
  static Future<Map<String, dynamic>> markAllNotificationsRead({
    String? userId,
  }) async {
    final token = await _getToken();
    final resolvedUserId = (userId != null && userId.isNotEmpty)
        ? userId
        : await getCurrentUserId();
    if (resolvedUserId == null || resolvedUserId.isEmpty) {
      return {
        'success': false,
        'error': 'User id is required to mark all notifications as read',
        'status': 400,
      };
    }
    final uri = Uri.parse(
      '$baseUrl/api/dashboard/notifications/read-all',
    ).replace(queryParameters: {'user_id': resolvedUserId});
    final res = await _put(uri, headers: _authHeaders(token));
    return _handleResponse(res);
  }

  // ============================================================================
  // React API name compatibility aliases
  // ============================================================================
  static Future<Map<String, dynamic>> getProjectById(String id) =>
      getProject(id);

  static Future<Map<String, dynamic>> getBOQById(String id) => getBOQ(id);

  static Future<Map<String, dynamic>> getBOQs() => getAllBOQs();

  static Future<Map<String, dynamic>> getPosByProject(String projectId) =>
      getPOsByProject(projectId);

  static Future<Map<String, dynamic>> getPoById(String id) => getPO(id);

  static Future<Map<String, dynamic>> createPo(Map<String, dynamic> data) =>
      createPO(data);

  static Future<Map<String, dynamic>> updatePo(
    String id,
    Map<String, dynamic> data,
  ) => updatePO(id, data);

  static Future<Map<String, dynamic>> deletePo(String id) => deletePO(id);

  static Future<Map<String, dynamic>> uploadPoFile(File file) =>
      uploadPOFile(file);

  static Future<Map<String, dynamic>> parsePoFile(File file) =>
      parsePOFile(file);

  static Future<Map<String, dynamic>> getMirsByProject(String projectId) =>
      getMIRsByProject(projectId);

  static Future<Map<String, dynamic>> getMirs() => getAllMIRs();

  static Future<Map<String, dynamic>> getMirById(String id) => getMIR(id);

  static Future<Map<String, dynamic>> createMir(Map<String, dynamic> data) =>
      createMIR(data);

  static Future<Map<String, dynamic>> updateMir(
    String id,
    Map<String, dynamic> data,
  ) => updateMIR(id, data);

  static Future<Map<String, dynamic>> deleteMir(String id) => deleteMIR(id);

  static Future<Map<String, dynamic>> uploadMirReference(File file) =>
      uploadMIRFile(file);

  static Future<Map<String, dynamic>> getItrsByProject(String projectId) =>
      getITRsByProject(projectId);

  static Future<Map<String, dynamic>> getItrs() => getAllITRs();

  static Future<Map<String, dynamic>> getItrById(String id) => getITR(id);

  static Future<Map<String, dynamic>> createItr(Map<String, dynamic> data) =>
      createITR(data);

  static Future<Map<String, dynamic>> updateItr(
    String id,
    Map<String, dynamic> data,
  ) => updateITR(id, data);

  static Future<Map<String, dynamic>> deleteItr(String id) => deleteITR(id);

  static Future<Map<String, dynamic>> getDcsByProject(String projectId) =>
      getChallansByProject(projectId);

  static Future<Map<String, dynamic>> getDcsByPo(String poId) =>
      getChallansByPO(poId);

  static Future<Map<String, dynamic>> getDcById(String id) =>
      getChallanById(id);

  static Future<Map<String, dynamic>> createDc(Map<String, dynamic> data) =>
      createChallan(data);

  static Future<Map<String, dynamic>> updateDc(
    String id,
    Map<String, dynamic> data,
  ) => updateChallan(id, data);

  static Future<Map<String, dynamic>> deleteDc(String id) => deleteChallan(id);

  static Future<Map<String, dynamic>> uploadDcFile(File file) =>
      uploadChallanFile(file);

  static Future<Map<String, dynamic>> uploadPrFile(File file) =>
      uploadPRFile(file);

  static Future<Map<String, dynamic>> uploadPrSignature(File file) =>
      uploadPRSignature(file);

  static Future<Map<String, dynamic>> createPr(Map<String, dynamic> data) =>
      createPR(data);

  static Future<Map<String, dynamic>> getPrs() => getPRs();

  static Future<Map<String, dynamic>> getPrById(String id) => getPRById(id);

  static Future<Map<String, dynamic>> getPrsByProject(String projectId) =>
      getPRsByProject(projectId);

  static Future<Map<String, dynamic>> getPrsBySample(String sampleId) =>
      getPRsBySample(sampleId);

  static Future<Map<String, dynamic>> updatePr(
    String id,
    Map<String, dynamic> data,
  ) => updatePR(id, data);

  static Future<Map<String, dynamic>> deletePr(String id) => deletePR(id);
}
