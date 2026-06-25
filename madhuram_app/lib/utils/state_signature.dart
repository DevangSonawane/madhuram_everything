import 'dart:convert';

dynamic _normalize(dynamic value) {
  if (value is Map) {
    final entries = value.entries
        .map((entry) => MapEntry(entry.key.toString(), _normalize(entry.value)))
        .toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return Map<String, dynamic>.fromEntries(entries);
  }
  if (value is List) {
    return value.map(_normalize).toList();
  }
  return value;
}

String stateSignature(dynamic value) {
  return jsonEncode(_normalize(value));
}

bool sameMapState(Map<String, dynamic>? left, Map<String, dynamic>? right) {
  return stateSignature(left ?? const <String, dynamic>{}) ==
      stateSignature(right ?? const <String, dynamic>{});
}
