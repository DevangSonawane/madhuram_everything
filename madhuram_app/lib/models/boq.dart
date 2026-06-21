class BOQItem {
  final String id;
  final String? projectId;
  final String? code;
  final String? itemNo;
  final String? itemCode;
  final String? hsn;
  final String? sacCode;
  final String category;
  final String description;
  final String? floor;
  final String unit;
  final double quantity;
  final double? rate;
  final double? amount;
  final String? boqFile;
  final String? client;
  final DateTime? createdAt;

  const BOQItem({
    required this.id,
    this.projectId,
    this.code,
    this.itemNo,
    this.itemCode,
    this.hsn,
    this.sacCode,
    required this.category,
    required this.description,
    this.floor,
    required this.unit,
    required this.quantity,
    this.rate,
    this.amount,
    this.boqFile,
    this.client,
    this.createdAt,
  });

  factory BOQItem.fromJson(Map<String, dynamic> json) {
    return BOQItem(
      id: (json['boq_id'] ?? json['id'] ?? '').toString(),
      projectId: json['project_id']?.toString(),
      code: json['code']?.toString() ?? json['item_no']?.toString(),
      itemNo: json['item_no']?.toString(),
      itemCode: json['item_code']?.toString(),
      hsn: json['hsn']?.toString(),
      sacCode: json['sac_code']?.toString(),
      category: json['category'] ?? '',
      description: json['description'] ?? '',
      floor: json['floor'],
      unit: json['unit'] ?? '',
      quantity: _parseDouble(json['quantity']),
      rate: json['rate'] != null ? _parseDouble(json['rate']) : null,
      amount: json['amount'] != null ? _parseDouble(json['amount']) : null,
      boqFile: json['boq_file'],
      client: (json['client'] ?? json['boq_client'] ?? json['client_format'])?.toString().trim().toLowerCase(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'boq_id': id,
    'project_id': projectId,
    'code': code,
    'item_no': itemNo,
    'item_code': itemCode,
    'hsn': hsn,
    'sac_code': sacCode,
    'category': category,
    'description': description,
    'floor': floor,
    'unit': unit,
    'quantity': quantity,
    'rate': rate,
    'amount': amount,
    'boq_file': boqFile,
    'client': client,
  };

  static double _parseDouble(dynamic value) {
    if (value == null) return 0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  BOQItem copyWith({
    String? id,
    String? projectId,
    String? code,
    String? itemNo,
    String? itemCode,
    String? hsn,
    String? sacCode,
    String? category,
    String? description,
    String? floor,
    String? unit,
    double? quantity,
    double? rate,
    double? amount,
    String? boqFile,
    String? client,
  }) {
    return BOQItem(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      code: code ?? this.code,
      itemNo: itemNo ?? this.itemNo,
      itemCode: itemCode ?? this.itemCode,
      hsn: hsn ?? this.hsn,
      sacCode: sacCode ?? this.sacCode,
      category: category ?? this.category,
      description: description ?? this.description,
      floor: floor ?? this.floor,
      unit: unit ?? this.unit,
      quantity: quantity ?? this.quantity,
      rate: rate ?? this.rate,
      amount: amount ?? this.amount,
      boqFile: boqFile ?? this.boqFile,
      client: client ?? this.client,
      createdAt: createdAt,
    );
  }
}
