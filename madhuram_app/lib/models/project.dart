/// Project model - Matching React app project structure
class Project {
  final String id;
  final String name;
  final String? client;
  final String? location;
  final String? status;
  final String? startDate;
  final String? endDate;
  final String? estimateValue;
  final String? description;
  final Map<String, dynamic>? rawData;

  const Project({
    required this.id,
    required this.name,
    this.client,
    this.location,
    this.status,
    this.startDate,
    this.endDate,
    this.estimateValue,
    this.description,
    this.rawData,
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    String? _firstNonEmpty(List<dynamic> values) {
      for (final v in values) {
        final text = v?.toString();
        if (text != null && text.trim().isNotEmpty) return text;
      }
      return null;
    }

    return Project(
      id: _firstNonEmpty([json['id'], json['project_id'], json['projectId']]) ?? '',
      name: _firstNonEmpty([json['name'], json['project_name'], json['projectName']]) ?? 'Unnamed Project',
      client: _firstNonEmpty([json['client'], json['client_name'], json['clientName']]),
      location: _firstNonEmpty([json['location']]),
      status: _firstNonEmpty([json['status']]) ?? 'Planning',
      startDate: _firstNonEmpty([
        json['start_date'],
        json['startDate'],
        json['project_startdate'],
        json['product_duration'],
      ]),
      endDate: _firstNonEmpty([json['end_date'], json['endDate']]),
      estimateValue: _firstNonEmpty([json['estimate_value'], json['estimateValue'], json['value']]),
      description: _firstNonEmpty([json['description']]),
      rawData: json,
    );
  }

  Map<String, dynamic> toJson() {
    final locationData = rawData?['location_data'];
    return {
      'id': id,
      'project_id': id,
      'name': name,
      'project_name': name,
      'client': client,
      'client_name': client,
      'location': location,
      'status': status,
      'start_date': startDate,
      'project_startdate': startDate,
      'end_date': endDate,
      'estimate_value': estimateValue,
      'value': estimateValue,
      'description': description,
      if (locationData is Map) 'location_data': Map<String, dynamic>.from(locationData),
    };
  }

  /// Convert to Map for Redux state (maintains compatibility with existing Map<String, dynamic> storage)
  Map<String, dynamic> toMap() => toJson();

  /// Create from Redux state Map
  static Project fromMap(Map<String, dynamic> map) => Project.fromJson(map);

  @override
  String toString() => 'Project(id: $id, name: $name)';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Project && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
