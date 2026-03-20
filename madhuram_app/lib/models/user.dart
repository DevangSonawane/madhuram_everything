import 'dart:convert';

class User {
  final String id;
  final String name;
  final String? username;
  final String email;
  final String? phoneNumber;
  final String role;
  final List<String>? projectList;
  final String? avatar;

  const User({
    required this.id,
    required this.name,
    this.username,
    required this.email,
    this.phoneNumber,
    required this.role,
    this.projectList,
    this.avatar,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    List<String>? normalizeProjectList(dynamic value) {
      if (value == null) return null;
      if (value is List) {
        return value
            .map((entry) {
              if (entry is Map) {
                return (entry['project_id'] ??
                        entry['id'] ??
                        entry['name'] ??
                        entry['project_name'] ??
                        '')
                    .toString();
              }
              return entry.toString();
            })
            .where((v) => v.trim().isNotEmpty)
            .toList();
      }
      if (value is String && value.trim().isNotEmpty) {
        try {
          final parsed = jsonDecode(value);
          return normalizeProjectList(parsed);
        } catch (_) {
          return <String>[];
        }
      }
      return null;
    }

    return User(
      id: (json['user_id'] ?? json['id'] ?? '').toString(),
      name: json['name'] ?? '',
      username: json['username'],
      email: json['email'] ?? '',
      phoneNumber: json['phone_number'],
      role: json['role'] ?? 'labour',
      projectList: normalizeProjectList(json['project_list']),
      avatar: json['avatar'],
    );
  }

  Map<String, dynamic> toJson() => {
    'user_id': id,
    'name': name,
    'username': username,
    'email': email,
    'phone_number': phoneNumber,
    'role': role,
    'project_list': projectList,
    'avatar': avatar,
  };

  bool get isAdmin => role == 'admin';
  bool get isProjectManager => role == 'project_manager';
  bool get isPoOfficer => role == 'po_officer';
  
  String get initials {
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, name.length >= 2 ? 2 : name.length).toUpperCase();
  }
}
