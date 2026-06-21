class PurchaseOrderItem {
  final String srNo;
  final String? hsnCode;
  final String description;
  final String? width;
  final String? length;
  final String quantity;
  final String uom;
  final String rate;
  final String amount;
  final String? remarks;

  const PurchaseOrderItem({
    required this.srNo,
    this.hsnCode,
    required this.description,
    this.width,
    this.length,
    required this.quantity,
    required this.uom,
    required this.rate,
    required this.amount,
    this.remarks,
  });

  factory PurchaseOrderItem.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderItem(
      srNo: json['srNo']?.toString() ?? '',
      hsnCode: json['hsnCode']?.toString(),
      description: json['description'] ?? '',
      width: json['width']?.toString(),
      length: json['length']?.toString(),
      quantity: json['qty']?.toString() ?? json['quantity']?.toString() ?? '',
      uom: json['uom'] ?? '',
      rate: json['rate']?.toString() ?? '',
      amount: json['amount']?.toString() ?? '',
      remarks: json['remarks'],
    );
  }

  /// toJson with correct field names matching React API
  Map<String, dynamic> toJson() => {
    'srno': srNo,
    'hsn': hsnCode,
    'description': description,
    'width': width,
    'length': length,
    'qty': quantity,
    'UOM': uom,
    'Rate': rate,
    'Amount': amount,
    'remark': remarks,
  };
}

class PurchaseOrderVendor {
  final String name;
  final String? site;
  final String? address;
  final String? contactPerson;
  final Map<String, dynamic>? contacts;

  const PurchaseOrderVendor({
    required this.name,
    this.site,
    this.address,
    this.contactPerson,
    this.contacts,
  });

  factory PurchaseOrderVendor.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderVendor(
      name: json['name'] ?? '',
      site: json['site'],
      address: json['address'],
      contactPerson: json['contactPerson'],
      contacts: json['contacts'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'site': site,
    'address': address,
    'contactPerson': contactPerson,
    'contacts': contacts,
  };
}

class PurchaseOrder {
  final String id;
  final String? projectId;
  final String orderNo;
  final String? poDate;
  final String? indentNo;
  final String? indentDate;
  final String? companyName;
  final String? companySubtitle;
  final String? companyAddress;
  final String? companyEmail;
  final String? companyGstNo;
  final PurchaseOrderVendor? vendor;
  final List<PurchaseOrderItem> items;
  final String? discountPercent;
  final String? discountAmount;
  final String? afterDiscountAmount;
  final String? cgstPercent;
  final String? cgstAmount;
  final String? sgstPercent;
  final String? sgstAmount;
  final String? totalAmount;
  final String? delivery;
  final String? payment;
  final List<String>? notes;
  final List<String>? termsAndConditions;
  final String status;
  final String? source;
  final String? sourceFileName;
  final String? createdAt;

  const PurchaseOrder({
    required this.id,
    this.projectId,
    required this.orderNo,
    this.poDate,
    this.indentNo,
    this.indentDate,
    this.companyName,
    this.companySubtitle,
    this.companyAddress,
    this.companyEmail,
    this.companyGstNo,
    this.vendor,
    this.items = const [],
    this.discountPercent,
    this.discountAmount,
    this.afterDiscountAmount,
    this.cgstPercent,
    this.cgstAmount,
    this.sgstPercent,
    this.sgstAmount,
    this.totalAmount,
    this.delivery,
    this.payment,
    this.notes,
    this.termsAndConditions,
    this.status = 'created',
    this.source,
    this.sourceFileName,
    this.createdAt,
  });

  static String? _readCleanString(dynamic value) {
    if (value == null) return null;
    final v = value.toString().trim();
    if (v.isEmpty || v.toLowerCase() == 'null') return null;
    return v;
  }

  factory PurchaseOrder.fromJson(Map<String, dynamic> json) {
    final vendorRaw = json['vendor'];
    Map<String, dynamic>? vendorJson;
    if (vendorRaw is Map) {
      vendorJson = Map<String, dynamic>.from(vendorRaw);
    } else {
      final flatVendorName = json['vendor_name']?.toString();
      if (flatVendorName != null && flatVendorName.isNotEmpty) {
        vendorJson = {
          'name': flatVendorName,
          'site': json['site'],
          'address': json['vendor_address'],
          'contactPerson': json['contact_person'],
          'contacts': {
            'primary': {
              'name': json['primary_contact_name'],
              'number': json['primary_contact_number'],
            },
            'secondary': {
              'name': json['secondary_contact_name'],
              'number': json['secondary_contact_number'],
            },
          },
        };
      }
    }
    final itemsRaw = json['items'];
    final itemsJson = itemsRaw is List ? itemsRaw : const [];
    final discountRaw = json['discount'];
    final discountJson = discountRaw is Map
        ? Map<String, dynamic>.from(discountRaw)
        : null;
    final taxesRaw = json['taxes'];
    final taxesJson = taxesRaw is Map
        ? Map<String, dynamic>.from(taxesRaw)
        : null;
    final summaryRaw = json['summary'];
    final summaryJson = summaryRaw is Map
        ? Map<String, dynamic>.from(summaryRaw)
        : null;
    final notesRaw = json['notes'] ?? json['po_notes'];
    final termsRaw = json['termsAndConditions'] ?? json['terms_and_conditions'];

    return PurchaseOrder(
      id: (json['po_id'] ?? json['id'] ?? '').toString(),
      projectId: json['project_id']?.toString(),
      orderNo: (json['order_no'] ?? json['orderNo'] ?? '').toString(),
      poDate: _readCleanString(
        json['po_date'] ??
            json['poDate'] ??
            json['order_date'] ??
            json['orderDate'] ??
            json['date'] ??
            json['created_at'] ??
            json['createdAt'],
      ),
      indentNo: (json['indent_no'] ?? json['indentNo'])?.toString(),
      indentDate: _readCleanString(json['indent_date'] ?? json['indentDate']),
      companyName: (json['company_name'] ?? json['companyName'])?.toString(),
      companySubtitle: (json['company_subtitle'] ?? json['companySubtitle'])
          ?.toString(),
      companyAddress: (json['company_address'] ?? json['companyAddress'])
          ?.toString(),
      companyEmail: (json['company_email'] ?? json['companyEmail'])?.toString(),
      companyGstNo: (json['company_gst'] ?? json['companyGstNo'])?.toString(),
      vendor: vendorJson != null
          ? PurchaseOrderVendor.fromJson(vendorJson)
          : null,
      items: itemsJson
          .whereType<Map>()
          .map((e) => PurchaseOrderItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      discountPercent: (json['discount'] ?? discountJson?['percent'])
          ?.toString(),
      discountAmount: (json['discount_amount'] ?? discountJson?['amount'])
          ?.toString(),
      afterDiscountAmount:
          (json['after_discount'] ?? json['afterDiscountAmount'])?.toString(),
      cgstPercent: (json['cgst'] ?? taxesJson?['cgst']?['percent'])?.toString(),
      cgstAmount: (json['cgst_amount'] ?? taxesJson?['cgst']?['amount'])
          ?.toString(),
      sgstPercent: (json['sgst'] ?? taxesJson?['sgst']?['percent'])?.toString(),
      sgstAmount: (json['sgst_amount'] ?? taxesJson?['sgst']?['amount'])
          ?.toString(),
      totalAmount:
          json['total_amount']?.toString() ?? json['totalAmount']?.toString(),
      delivery: (json['delivery'] ?? summaryJson?['delivery'])?.toString(),
      payment: (json['payment'] ?? summaryJson?['payment'])?.toString(),
      notes: notesRaw is List
          ? notesRaw.map((e) => e.toString()).toList()
          : (notesRaw is String && notesRaw.trim().isNotEmpty
                ? [notesRaw]
                : null),
      termsAndConditions: termsRaw is List
          ? termsRaw.map((e) => e.toString()).toList()
          : (termsRaw is String && termsRaw.trim().isNotEmpty
                ? [termsRaw]
                : null),
      status: (() {
        final status = json['status']?.toString().trim();
        return (status == null || status.isEmpty) ? 'created' : status;
      })(),
      source: json['source'],
      sourceFileName: json['sourceFileName'],
      createdAt: _readCleanString(json['created_at'] ?? json['createdAt']),
    );
  }

  /// Convenience getter for vendor name
  String? get vendorName => vendor?.name;

  /// Parse totalAmount as double for calculations
  double? get totalAmountValue => double.tryParse(totalAmount ?? '');

  Map<String, dynamic> toJson() => {
    'po_id': id,
    'project_id': projectId,
    'order_no': orderNo,
    'po_date': poDate,
    'indent_no': indentNo,
    'indent_date': indentDate,
    'companyName': companyName,
    'companySubtitle': companySubtitle,
    'companyAddress': companyAddress,
    'companyEmail': companyEmail,
    'companyGstNo': companyGstNo,
    'vendor': vendor?.toJson(),
    'items': items.map((e) => e.toJson()).toList(),
    'discount': {'percent': discountPercent, 'amount': discountAmount},
    'afterDiscountAmount': afterDiscountAmount,
    'taxes': {
      'cgst': {'percent': cgstPercent, 'amount': cgstAmount},
      'sgst': {'percent': sgstPercent, 'amount': sgstAmount},
    },
    'total_amount': totalAmount,
    'summary': {'delivery': delivery, 'payment': payment},
    'notes': notes,
    'termsAndConditions': termsAndConditions,
    'status': status,
    'source': source,
    'sourceFileName': sourceFileName,
    'created_at': createdAt,
  };
}
