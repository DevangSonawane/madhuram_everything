class ITR {
  final String id;
  final String? projectId;
  final String itrRefNo;
  final String? projectName;
  final String? clientEmployer;
  final String? contractorPart;
  final String? lodhaPmc;
  final String? discipline;
  final Map<String, dynamic>? dynamicField;
  final String? status;
  final DateTime? createdAt;
  // Additional fields from React API
  final String? pmcEngineer;
  final String? contractor;
  final String? vendorCode;
  final String? materialCode;
  final String? wirItrSubmissionDateTime;
  final String? inspectionDateTime;
  final String? submittedTo;
  final String? submittedBy;
  final String? source;
  final String? sourceFileName;
  final Map<String, dynamic>? contractorPartData;
  final Map<String, dynamic>? lodhaPmcData;

  const ITR({
    required this.id,
    this.projectId,
    required this.itrRefNo,
    this.projectName,
    this.clientEmployer,
    this.contractorPart,
    this.lodhaPmc,
    this.discipline,
    this.dynamicField,
    this.status,
    this.createdAt,
    this.pmcEngineer,
    this.contractor,
    this.vendorCode,
    this.materialCode,
    this.wirItrSubmissionDateTime,
    this.inspectionDateTime,
    this.submittedTo,
    this.submittedBy,
    this.source,
    this.sourceFileName,
    this.contractorPartData,
    this.lodhaPmcData,
  });

  factory ITR.fromJson(Map<String, dynamic> json) {
    String readString(List<dynamic> candidates) {
      for (final value in candidates) {
        final text = value?.toString().trim() ?? '';
        if (text.isNotEmpty && text.toLowerCase() != 'null') return text;
      }
      return '';
    }

    final projectInfo = json['project_info'] is Map
        ? Map<String, dynamic>.from(json['project_info'] as Map)
        : <String, dynamic>{};
    final itrHeader = json['itr_header'] is Map
        ? Map<String, dynamic>.from(json['itr_header'] as Map)
        : <String, dynamic>{};
    final contractorPartData = json['contractor_part'] is Map
        ? Map<String, dynamic>.from(json['contractor_part'] as Map)
        : <String, dynamic>{};
    final lodhaPmcData = json['lodha_pmc'] is Map
        ? Map<String, dynamic>.from(json['lodha_pmc'] as Map)
        : <String, dynamic>{};

    final resolvedItrId = readString([
      json['itr_id'],
      json['id'],
    ]);
    final resolvedItrRefNo = readString([
      json['itr_ref_no'],
      json['itrRefNo'],
      json['itr_ref'],
      itrHeader['itr_ref_no'],
      itrHeader['itrRefNo'],
    ]);
    final resolvedProjectName = readString([
      json['project_name'],
      json['projectName'],
      projectInfo['project_name'],
      projectInfo['projectName'],
    ]);

    return ITR(
      id: resolvedItrId,
      projectId: readString([json['project_id'], json['projectId']]),
      itrRefNo: resolvedItrRefNo,
      projectName: resolvedProjectName,
      clientEmployer: readString([
        json['client_employer'],
        json['clientEmployer'],
        projectInfo['client_employer'],
        projectInfo['clientEmployer'],
      ]),
      contractorPart: json['contractor_part'] is String ? json['contractor_part'] : null,
      lodhaPmc: json['lodha_pmc'] is String ? json['lodha_pmc'] : null,
      discipline: readString([json['discipline'], contractorPartData['discipline']]),
      dynamicField: json['dynamic_field'] as Map<String, dynamic>?,
      status: json['status'],
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : null,
      pmcEngineer: readString([
        json['pmc_engineer'],
        json['pmcEngineer'],
        projectInfo['pmc_engineer'],
        projectInfo['pmcEngineer'],
      ]),
      contractor: readString([json['contractor'], projectInfo['contractor']]),
      vendorCode: readString([
        json['vendor_code'],
        json['vendorCode'],
        projectInfo['vendor_code'],
        projectInfo['vendorCode'],
      ]),
      materialCode: readString([
        json['material_code'],
        json['materialCode'],
        projectInfo['material_code'],
        projectInfo['materialCode'],
      ]),
      wirItrSubmissionDateTime: readString([
        json['wir_itr_submission_date_time'],
        json['wirItrSubmissionDateTime'],
        itrHeader['submission_datetime'],
        itrHeader['submissionDatetime'],
      ]),
      inspectionDateTime: readString([
        json['inspection_date_time'],
        json['inspectionDateTime'],
        itrHeader['inspection_datetime'],
        itrHeader['inspectionDatetime'],
      ]),
      submittedTo: readString([
        json['submitted_to'],
        json['submittedTo'],
        itrHeader['submitted_to'],
        itrHeader['submittedTo'],
      ]),
      submittedBy: readString([
        json['submitted_by'],
        json['submittedBy'],
        itrHeader['submitted_by'],
        itrHeader['submittedBy'],
      ]),
      source: readString([json['source']]),
      sourceFileName: readString([json['source_file_name'], json['sourceFileName']]),
      contractorPartData: contractorPartData.isEmpty ? null : contractorPartData,
      lodhaPmcData: lodhaPmcData.isEmpty ? null : lodhaPmcData,
    );
  }

  Map<String, dynamic> toJson() => {
    'itr_id': id,
    'project_id': projectId,
    'itr_ref_no': itrRefNo,
    'project_name': projectName,
    'client_employer': clientEmployer,
    'contractor_part': contractorPartData ?? contractorPart,
    'lodha_pmc': lodhaPmcData ?? lodhaPmc,
    'discipline': discipline,
    'dynamic_field': dynamicField,
    'status': status,
    'pmc_engineer': pmcEngineer,
    'contractor': contractor,
    'vendor_code': vendorCode,
    'material_code': materialCode,
    'wir_itr_submission_date_time': wirItrSubmissionDateTime,
    'inspection_date_time': inspectionDateTime,
    'submitted_to': submittedTo,
    'submitted_by': submittedBy,
    'source': source,
    'source_file_name': sourceFileName,
  };

  ITR copyWith({
    String? id,
    String? projectId,
    String? itrRefNo,
    String? projectName,
    String? clientEmployer,
    String? contractorPart,
    String? lodhaPmc,
    String? discipline,
    Map<String, dynamic>? dynamicField,
    String? status,
    String? pmcEngineer,
    String? contractor,
    String? vendorCode,
    String? materialCode,
    String? wirItrSubmissionDateTime,
    String? inspectionDateTime,
    String? submittedTo,
    String? submittedBy,
    String? source,
    String? sourceFileName,
    Map<String, dynamic>? contractorPartData,
    Map<String, dynamic>? lodhaPmcData,
  }) {
    return ITR(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      itrRefNo: itrRefNo ?? this.itrRefNo,
      projectName: projectName ?? this.projectName,
      clientEmployer: clientEmployer ?? this.clientEmployer,
      contractorPart: contractorPart ?? this.contractorPart,
      lodhaPmc: lodhaPmc ?? this.lodhaPmc,
      discipline: discipline ?? this.discipline,
      dynamicField: dynamicField ?? this.dynamicField,
      status: status ?? this.status,
      createdAt: createdAt,
      pmcEngineer: pmcEngineer ?? this.pmcEngineer,
      contractor: contractor ?? this.contractor,
      vendorCode: vendorCode ?? this.vendorCode,
      materialCode: materialCode ?? this.materialCode,
      wirItrSubmissionDateTime: wirItrSubmissionDateTime ?? this.wirItrSubmissionDateTime,
      inspectionDateTime: inspectionDateTime ?? this.inspectionDateTime,
      submittedTo: submittedTo ?? this.submittedTo,
      submittedBy: submittedBy ?? this.submittedBy,
      source: source ?? this.source,
      sourceFileName: sourceFileName ?? this.sourceFileName,
      contractorPartData: contractorPartData ?? this.contractorPartData,
      lodhaPmcData: lodhaPmcData ?? this.lodhaPmcData,
    );
  }
}

// ITR Discipline options matching React app
const itrDisciplines = [
  'Plumbing',
  'Fire Fighting',
  'HVAC',
  'Electrical',
  'Civil',
  'Structural',
];
