import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart' show kDebugMode, kIsWeb;
import 'package:flutter/material.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';
import 'api_client.dart';
import 'file_service.dart';

/// BOQ Item extracted from PDF
class ExtractedBOQItem {
  final String itemNo;
  final String description;
  final String unit;
  final String quantity;
  final String category;
  final String? hsn;
  final String? sacCode;
  final double? rate;
  final double? amount;
  final String? qtyText;
  final String? rateText;
  final String? amountText;

  const ExtractedBOQItem({
    required this.itemNo,
    required this.description,
    required this.unit,
    required this.quantity,
    required this.category,
    this.hsn,
    this.sacCode,
    this.rate,
    this.amount,
    this.qtyText,
    this.rateText,
    this.amountText,
  });

  Map<String, dynamic> toTableRow(int index) {
    final qty = double.tryParse(quantity.replaceAll(',', '')) ?? 0;
    return {
      'id': index + 1,
      'category': category.isNotEmpty ? category : 'General',
      'code': itemNo.isNotEmpty ? itemNo : 'BOQ-${index + 1}',
      'item_no': itemNo,
      'item_code': hsn ?? sacCode ?? '',
      'hsn': hsn ?? '',
      'sac_code': sacCode ?? '',
      'description': description,
      'unit': unit.isNotEmpty ? unit : 'Nos',
      'quantity': qty,
      'rate': rate ?? 0.0,
      'amount': amount ?? 0.0,
      'floor': 'All',
      'qty_text': qtyText ?? quantity,
      'rate_text': rateText,
      'amount_text': amountText,
    };
  }
}

/// Result of BOQ extraction
class BOQExtractionResult {
  final List<ExtractedBOQItem> items;
  final String projectName;
  final String? error;

  const BOQExtractionResult({
    this.items = const [],
    this.projectName = '',
    this.error,
  });

  bool get success => error == null && items.isNotEmpty;
  int get itemCount => items.length;
}

/// Service for extracting BOQ data from PDFs
class BOQExtractor {
  static void _log(String message) {
    if (kDebugMode) {
      debugPrint('[BOQExtractor] $message');
    }
  }

  // Skip patterns for header/footer lines
  static final List<RegExp> _skipPatterns = [
    RegExp(r'^OAKWOOD\s+BUILDING|^Item\s*$|^Nos\.\s*Description|^Page\s+No\.', caseSensitive: false),
    RegExp(r'^--\s+\d+\s+of\s+\d+|^SCHEDULE\s+OF\s+QUANTITIES', caseSensitive: false),
    RegExp(r'^Note:\s*$|^[ivxIVX]+\.\s|^[A-Z]\)\s'),
    RegExp('^TOTAL\\s*:\\s*["\']?[A-G]["\']?\\s*CARRIED\\s+TO\\s+SUMMARY', caseSensitive: false),
    RegExp(r'^Description\s+Unit\s+(Qty|Total|Tower)', caseSensitive: false),
  ];

  // Section header pattern (A., B., C., etc.)
  static final RegExp _sectionPattern = RegExp(r'^([A-G])\.\s+(.+)$');
  
  // Unit+Quantity only pattern
  static final RegExp _unitQtyPattern = RegExp(
    r'^(Nos|RM|Cum|Sft|Job|Mtr|Sqm|Kg|Ltr|Set|Pair|Each|Pcs)\.?\s*([\d,]+\.?\d*)\s*$',
    caseSensitive: false,
  );
  
  // Same line pattern: item_no description unit qty
  static final RegExp _sameLinePattern = RegExp(
    r'^(\d+(?:\.\d+)*)\s+(.+?)\s+(Nos|RM|Cum|Sft|Job|Mtr|Sqm|Kg|Ltr|Set|Pair|Each|Pcs)\.?\s*([\d,]+\.?\d*)\s*$',
    caseSensitive: false,
  );
  
  // Item start pattern
  static final RegExp _itemStartPattern = RegExp(r'^(\d+(?:\.\d+)*)\s+');
  
  // Project name patterns
  static final RegExp _projectNamePattern = RegExp(
    r'OAKWOOD\s+BUILDING|BUILDING\s+AT\s+KALYAN|PROJECT\s*[:\-]\s*(.+)',
    caseSensitive: false,
  );

  static String _normalizeSpaces(String value) =>
      value.replaceAll(RegExp(r'\s+'), ' ').trim();

  static String _toDecimalString(dynamic value) {
    if (value == null) return '';
    final cleaned = value.toString().trim();
    final match = RegExp(r'-?\d[\d,]*(?:\.\d+)?').firstMatch(cleaned);
    if (match == null) return '';
    return match.group(0)!.replaceAll(',', '');
  }

  static String _toFixedDecimalString(dynamic value, {int places = 2}) {
    final raw = _toDecimalString(value);
    if (raw.isEmpty) return '';
    final parsed = double.tryParse(raw);
    if (parsed == null) return '';
    return parsed.toStringAsFixed(places);
  }

  static double _toNumber(dynamic value) {
    final parsed = double.tryParse(_toDecimalString(value));
    return parsed ?? double.nan;
  }

  static List<String> _splitLines(String rawText) => rawText
      .split(RegExp(r'\r?\n'))
      .map(_normalizeSpaces)
      .where((line) => line.isNotEmpty)
      .toList();

  static bool _isLikelyFooterOrHeader(String line) {
    final upper = _normalizeSpaces(line).toUpperCase();
    if (upper.isEmpty) return true;
    if (upper.contains('SR.NO') && upper.contains('ITEM') && upper.contains('DESCRIPTION')) return true;
    if (upper.contains('HSN') && upper.contains('SAC') && upper.contains('UNIT')) return true;
    if (upper.contains('COMPANY') && upper.contains('CONTRACTOR')) return true;
    if (upper.contains('TOTAL OF AMOUNT')) return true;
    if (upper.contains('CONTRACT AMOUNT')) return true;
    if (upper == 'PAGE' || upper.startsWith('PAGE ')) return true;
    if (RegExp(r'\(SIGN\s*[&]\s*STAMP\)', caseSensitive: false).hasMatch(upper)) return true;
    if (RegExp(r'WORK ORDER\s*:\s*\d+', caseSensitive: false).hasMatch(upper)) return true;
    if (RegExp(r'VERSION NO\s*:\s*\d+', caseSensitive: false).hasMatch(upper)) return true;
    if (RegExp(r'^NO\.\s*CODE', caseSensitive: false).hasMatch(upper)) return true;
    return false;
  }

  static bool _looksLikeLodha(String rawText) {
    final text = rawText.toLowerCase();
    return text.contains('lodha') || RegExp(r'\bhsn\b').hasMatch(text) || RegExp(r'\d+\.\d+\.\d+').hasMatch(text);
  }

  static bool _looksLikeHiranandani(String rawText) {
    final text = rawText.toLowerCase();
    return text.contains('hiranandani') || text.contains('service description') || RegExp(r'\bsac\b').hasMatch(text);
  }

  static ExtractedBOQItem? _parseLodhaRow(String line, String currentSection) {
    final itemNoMatch = RegExp(r'^(\d+(?:\.\d+)*)\b').firstMatch(line);
    if (itemNoMatch == null) return null;
    final itemNo = itemNoMatch.group(1)!.trim();
    final hsnMatch = RegExp(r'\b(\d{6})\b').firstMatch(line);
    final tailMatch = RegExp(r'\b([A-Za-z]{1,10})\s+(-?\d[\d,]*\.?\d*)\s+(-?\d[\d,]*\.?\d*)\s+(-?\d[\d,]*\.?\d*)\s*$').firstMatch(line);
    if (hsnMatch == null || tailMatch == null) return null;
    final beforeTail = line.substring(0, tailMatch.start).trim();
    final hsnIndex = beforeTail.indexOf(hsnMatch.group(1)!);
    final description = _normalizeSpaces(
      hsnIndex >= 0 ? beforeTail.substring(0, hsnIndex) : beforeTail.replaceFirst(hsnMatch.group(0)!, ''),
    );
    if (description.isEmpty) return null;
    final unit = _normalizeSpaces(tailMatch.group(1)!);
    final qtyRaw = tailMatch.group(2)!;
    final rateRaw = tailMatch.group(3)!;
    final amountRaw = tailMatch.group(4)!;
    return ExtractedBOQItem(
      itemNo: itemNo,
      description: description,
      unit: unit,
      quantity: _toDecimalString(qtyRaw),
      category: currentSection.isNotEmpty ? currentSection : 'General',
      hsn: hsnMatch.group(1),
      rate: double.tryParse(_toDecimalString(rateRaw)),
      amount: double.tryParse(_toDecimalString(amountRaw)),
      qtyText: _toDecimalString(qtyRaw),
      rateText: _toFixedDecimalString(rateRaw),
      amountText: _toFixedDecimalString(amountRaw),
    );
  }

  static ExtractedBOQItem? _parseHiranandaniRow(String line, String currentSection) {
    final normalized = _normalizeSpaces(line);
    final itemNoMatch = RegExp(r'^(?:\(\s*\d+\s*\)|\d+\))|^\d+\b').firstMatch(normalized);
    if (itemNoMatch == null) return null;
    final itemNo = itemNoMatch.group(0)!.replaceAll(' ', '');
    final sacMatch = RegExp(r'\bSac(?:\s*Code)?\s*[:\-]?\s*(\d[\d\s]{5,10})\b', caseSensitive: false).firstMatch(normalized);
    final sacCode = sacMatch != null ? sacMatch.group(1)!.replaceAll(RegExp(r'\s+'), '') : '';
    final stripped = sacMatch != null
        ? normalized.substring(sacMatch.end).trim()
        : normalized.replaceFirst(RegExp(r'^\(\d+\)\s*'), '');
    final tokens = stripped.split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();
    if (tokens.length < 4) return null;
    for (var t = tokens.length - 1; t >= 3; t--) {
      final value = _toNumber(tokens[t]);
      final unitPrice = _toNumber(tokens[t - 1]);
      final qtyA = _toNumber(tokens[t - 2]);
      final qtyB = _toNumber(tokens[t - 3]);
      if (!value.isFinite || !unitPrice.isFinite) continue;
      if (qtyA.isFinite) {
        final desc = _normalizeSpaces(tokens.take(t - 2).join(' ')).trim();
        if (desc.isEmpty) continue;
        return ExtractedBOQItem(
          itemNo: itemNo,
          description: desc,
          unit: tokens[t - 2],
          quantity: _toDecimalString(tokens[t - 3]),
          category: currentSection.isNotEmpty ? currentSection : 'General',
          sacCode: sacCode.isNotEmpty ? sacCode : null,
          rate: unitPrice,
          amount: value,
          qtyText: _toDecimalString(tokens[t - 3]),
          rateText: _toFixedDecimalString(tokens[t - 1]),
          amountText: _toFixedDecimalString(tokens[t]),
        );
      }
      if (qtyB.isFinite) {
        final desc = _normalizeSpaces(tokens.take(t - 3).join(' ')).trim();
        if (desc.isEmpty) continue;
        return ExtractedBOQItem(
          itemNo: itemNo,
          description: desc,
          unit: tokens[t - 2],
          quantity: _toDecimalString(tokens[t - 3]),
          category: currentSection.isNotEmpty ? currentSection : 'General',
          sacCode: sacCode.isNotEmpty ? sacCode : null,
          rate: unitPrice,
          amount: value,
          qtyText: _toDecimalString(tokens[t - 3]),
          rateText: _toFixedDecimalString(tokens[t - 1]),
          amountText: _toFixedDecimalString(tokens[t]),
        );
      }
    }
    return null;
  }

  /// Pick and extract BOQ from a PDF file
  static Future<BOQExtractionResult> pickAndExtract(BuildContext context) async {
    try {
      _log('pickAndExtract started');
      final file = await FileService.pickFileWithSource(
        context: context,
        allowedExtensions: ['pdf'],
      );
      if (file == null) {
        _log('pickAndExtract: no file selected');
        return const BOQExtractionResult(error: 'No file selected');
      }

      _log('pickAndExtract: selected file path=${file.path}');

      Uint8List bytes;
      if (!kIsWeb) {
        bytes = await File(file.path).readAsBytes();
        _log('pickAndExtract: loaded ${bytes.length} bytes from disk');
      } else {
        _log('pickAndExtract: web path cannot read bytes here');
        return const BOQExtractionResult(error: 'Could not read file data');
      }

      return await extractFromBytes(bytes);
    } catch (e) {
      _log('pickAndExtract failed: $e');
      return BOQExtractionResult(error: 'Error picking file: $e');
    }
  }

  /// Extract BOQ from a local PDF file.
  static Future<BOQExtractionResult> extractFromFile(
    File file, {
    String? client,
    String? projectId,
  }) async {
    try {
      _log('extractFromFile started path=${file.path} client=${client ?? "(none)"} projectId=${projectId ?? "(none)"}');
      final bytes = await file.readAsBytes();
      _log('extractFromFile read ${bytes.length} bytes');
      final local = await extractFromBytes(bytes, client: client);
      _log('extractFromFile local result success=${local.success} items=${local.items.length} error=${local.error ?? "(none)"}');
      if (local.success) return local;

      final normalizedClient = (client ?? '').trim().toLowerCase();
      _log('extractFromFile falling back to remote parser for client=$normalizedClient');
      if (normalizedClient == 'lodha') {
        final remote = await ApiClient.parseBOQPdfLodha(
          boqFile: file,
          projectId: projectId,
          save: false,
        );
        _log('extractFromFile remote lodha response keys=${remote.keys.toList()}');
        final parsed = _resultFromRemoteResponse(remote, client: client);
        _log('extractFromFile remote lodha parsed success=${parsed?.success == true} items=${parsed?.items.length ?? 0}');
        if (parsed != null) return parsed;
      } else {
        final remote = await ApiClient.parseBOQPdf(
          boqFile: file,
          projectId: projectId,
          save: false,
          client: client,
        );
        _log('extractFromFile remote response keys=${remote.keys.toList()}');
        final parsed = _resultFromRemoteResponse(remote, client: client);
        _log('extractFromFile remote parsed success=${parsed?.success == true} items=${parsed?.items.length ?? 0}');
        if (parsed != null) return parsed;
      }

      _log('extractFromFile returning local fallback result');
      return local;
    } catch (e) {
      _log('extractFromFile failed: $e');
      return BOQExtractionResult(error: 'Error reading PDF file: $e');
    }
  }

  /// Extract BOQ from PDF bytes
  static Future<BOQExtractionResult> extractFromBytes(
    Uint8List bytes, {
    String? client,
  }) async {
    try {
      _log('extractFromBytes started bytes=${bytes.length} client=${client ?? "(none)"}');
      final PdfDocument document = PdfDocument(inputBytes: bytes);
      _log('extractFromBytes opened PDF pages=${document.pages.count}');
      final String rawText = _extractRawText(document);
      _log('extractFromBytes raw text length=${rawText.length}');
      document.dispose();

      if (rawText.trim().isNotEmpty) {
        _log('extractFromBytes using direct text extraction');
        return extractFromText(rawText, client: client);
      }

      _log('extractFromBytes raw text empty, starting OCR fallback');
      final ocrText = await _extractTextWithOcr(bytes);
      _log('extractFromBytes ocr text length=${ocrText.length}');
      if (ocrText.trim().isNotEmpty) {
        _log('extractFromBytes using OCR text');
        return extractFromText(ocrText, client: client);
      }

      _log('extractFromBytes no text found after raw extraction and OCR');
      return const BOQExtractionResult(error: 'No text found in PDF.');
    } catch (e) {
      _log('extractFromBytes failed: $e');
      return BOQExtractionResult(error: 'Error reading PDF: $e');
    }
  }

  static String _extractRawText(PdfDocument document) {
    final buffer = StringBuffer();
    final extractor = PdfTextExtractor(document);
    _log('extractRawText scanning ${document.pages.count} pages');
    for (var i = 0; i < document.pages.count; i++) {
      try {
        final lines = extractor.extractTextLines(startPageIndex: i, endPageIndex: i);
        _log('extractRawText page=$i textLines=${lines.length}');
        if (lines.isNotEmpty) {
          final ordered = [...lines]
            ..sort((a, b) {
              final topDelta = (a.bounds.top - b.bounds.top).abs();
              if (topDelta > 1) return b.bounds.top.compareTo(a.bounds.top);
              return a.bounds.left.compareTo(b.bounds.left);
            });
          for (final line in ordered) {
            final text = _normalizeSpaces(line.text);
            if (text.isNotEmpty) buffer.writeln(text);
          }
          _log('extractRawText page=$i accumulatedLength=${buffer.length}');
          continue;
        }
      } catch (_) {
        // Some PDFs contain malformed name/dictionary objects that break the
        // structured line extractor. Fall back to plain text extraction.
        _log('extractRawText page=$i extractTextLines failed, falling back to extractText');
      }

      try {
        final pageText = extractor.extractText(startPageIndex: i, endPageIndex: i);
        _log('extractRawText page=$i extractTextLength=${pageText.length}');
        if (pageText.trim().isNotEmpty) buffer.writeln(pageText);
      } catch (_) {
        // Skip pages we cannot decode cleanly.
        _log('extractRawText page=$i extractText failed');
      }
    }
    _log('extractRawText finished length=${buffer.length}');
    return buffer.toString();
  }

  static Future<String> _extractTextWithOcr(Uint8List bytes) async {
    try {
      _log('ocr fallback started bytes=${bytes.length}');
      final tempDir = await getTemporaryDirectory();
      _log('ocr tempDir=${tempDir.path}');
      final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final buffer = StringBuffer();
      var pageIndex = 0;

      await for (final raster in Printing.raster(bytes, dpi: 300.0)) {
        _log('ocr raster page=$pageIndex size=${raster.width}x${raster.height}');
        final pageFile = File('${tempDir.path}/boq_ocr_${DateTime.now().microsecondsSinceEpoch}_$pageIndex.png');
        await pageFile.writeAsBytes(await raster.toPng(), flush: true);
        try {
          final inputImage = InputImage.fromFilePath(pageFile.path);
          final recognizedText = await recognizer.processImage(inputImage);
          final text = _normalizeSpaces(recognizedText.text);
          _log('ocr page=$pageIndex recognizedLength=${text.length}');
          if (text.isNotEmpty) buffer.writeln(text);
        } catch (e) {
          // Skip pages we cannot OCR cleanly.
          _log('ocr page=$pageIndex recognition failed: $e');
        } finally {
          try {
            if (await pageFile.exists()) {
              await pageFile.delete();
            }
          } catch (_) {}
        }
        pageIndex += 1;
      }

      await recognizer.close();
      _log('ocr fallback finished length=${buffer.length}');
      return buffer.toString();
    } catch (e) {
      _log('ocr fallback failed: $e');
      return '';
    }
  }

  static BOQExtractionResult? _resultFromRemoteResponse(
    Map<String, dynamic> response, {
    String? client,
  }) {
    _log('remote response success=${response['success']} keys=${response.keys.toList()}');
    if (response['success'] != true) return null;
    final data = response['data'];
    _log('remote response dataType=${data.runtimeType}');
    final itemsData = data is Map
        ? (data['items'] is List
            ? data['items'] as List
            : data['boqs'] is List
                ? data['boqs'] as List
                : data['data'] is List
                    ? data['data'] as List
                    : const [])
        : const [];
    final items = itemsData
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .map((row) {
          final itemNo = (row['item_no'] ?? row['code'] ?? row['itemNo'] ?? '').toString();
          final description = (row['description'] ?? row['item_description'] ?? row['service_description'] ?? '').toString();
          final unit = (row['unit'] ?? row['uom'] ?? '').toString();
          final quantity = (row['qty'] ?? row['quantity'] ?? row['order_qty'] ?? '').toString();
          return ExtractedBOQItem(
            itemNo: itemNo,
            description: description,
            unit: unit,
            quantity: quantity,
            category: (row['section'] ?? row['category'] ?? 'General').toString(),
            hsn: (row['hsn'] ?? '').toString().trim().isNotEmpty ? row['hsn'].toString() : null,
            sacCode: (row['sac_code'] ?? '').toString().trim().isNotEmpty ? row['sac_code'].toString() : null,
            rate: double.tryParse(row['rate']?.toString() ?? row['unit_price']?.toString() ?? ''),
            amount: double.tryParse(row['amount']?.toString() ?? row['value']?.toString() ?? ''),
            qtyText: quantity,
            rateText: row['rate_text']?.toString() ?? row['unit_price_text']?.toString(),
            amountText: row['amount_text']?.toString() ?? row['value_text']?.toString(),
          );
        })
        .toList();
    _log('remote response parsed items=${items.length}');
    if (items.isEmpty) return null;
    final projectName = data is Map
        ? (data['projectName'] ?? data['project_name'] ?? '').toString()
        : '';
    return BOQExtractionResult(
      items: items,
      projectName: projectName,
      error: null,
    );
  }

  /// Extract BOQ items from raw text
  static BOQExtractionResult extractFromText(
    String rawText, {
    String? client,
  }) {
      final lineCount = rawText.split(RegExp(r'\r?\n')).where((l) => l.trim().isNotEmpty).length;
      _log('extractFromText started rawLength=${rawText.length} lineCount=$lineCount client=${client ?? "(none)"}');
      if (rawText.isNotEmpty) {
        final sample = rawText.replaceAll(RegExp(r'\s+'), ' ').trim();
        _log('extractFromText sample="${sample.length > 1000 ? '${sample.substring(0, 1000)}...' : sample}"');
      }
      final normalizedClient = (client ?? '').trim().toLowerCase();
    if (normalizedClient == 'lodha') {
      _log('extractFromText forcing lodha parser');
      final parsed = _extractLodhaFromText(rawText);
      _log('extractFromText lodha items=${parsed.items.length} error=${parsed.error ?? "(none)"}');
      if (parsed.items.isNotEmpty) return parsed;
    } else if (normalizedClient == 'hiranandani') {
      _log('extractFromText forcing hiranandani parser');
      final parsed = _extractHiranandaniFromText(rawText);
      _log('extractFromText hiranandani items=${parsed.items.length} error=${parsed.error ?? "(none)"}');
      if (parsed.items.isNotEmpty) return parsed;
    } else {
      if (_looksLikeLodha(rawText)) {
        _log('extractFromText detected lodha-like text');
        final lodha = _extractLodhaFromText(rawText);
        _log('extractFromText lodha detected items=${lodha.items.length} error=${lodha.error ?? "(none)"}');
        if (lodha.items.isNotEmpty) return lodha;
      }
      if (_looksLikeHiranandani(rawText)) {
        _log('extractFromText detected hiranandani-like text');
        final hiranandani = _extractHiranandaniFromText(rawText);
        _log('extractFromText hiranandani detected items=${hiranandani.items.length} error=${hiranandani.error ?? "(none)"}');
        if (hiranandani.items.isNotEmpty) return hiranandani;
      }
      final lodha = _extractLodhaFromText(rawText);
      _log('extractFromText fallback lodha items=${lodha.items.length} error=${lodha.error ?? "(none)"}');
      if (lodha.items.isNotEmpty) return lodha;
      final hiranandani = _extractHiranandaniFromText(rawText);
      _log('extractFromText fallback hiranandani items=${hiranandani.items.length} error=${hiranandani.error ?? "(none)"}');
      if (hiranandani.items.isNotEmpty) return hiranandani;
    }

    final List<ExtractedBOQItem> items = [];
    String projectName = '';
    String category = '';
    List<String> buffer = [];

    if (rawText.isEmpty) {
      _log('extractFromText raw text empty after format detection');
      return const BOQExtractionResult(error: 'No text to extract');
    }

    final lines = rawText
        .split(RegExp(r'\r?\n'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    void flush() {
      buffer = [];
    }

    bool shouldSkip(String line) {
      if (line.isEmpty) return true;
      return _skipPatterns.any((pattern) => pattern.hasMatch(line));
    }

    for (final line in lines) {
      if (items.length < 5) {
        _log('extractFromText scanning line="${line.length > 160 ? '${line.substring(0, 160)}...' : line}"');
      }
      // Try to find project name
      if (projectName.isEmpty) {
        final projectMatch = _projectNamePattern.firstMatch(line);
        if (projectMatch != null) {
          projectName = projectMatch.group(1) ?? line.substring(0, line.length > 120 ? 120 : line.length).trim();
        }
      }

      if (shouldSkip(line)) continue;

      // Check for section header
      final sectionMatch = _sectionPattern.firstMatch(line);
      if (sectionMatch != null) {
        flush();
        category = sectionMatch.group(2)!
            .replaceAll(RegExp(r'\s*\([^)]*\)\s*$'), '')
            .trim();
        if (category.length > 80) category = category.substring(0, 80);
        continue;
      }

      // Check for unit+qty only line
      final uqMatch = _unitQtyPattern.firstMatch(line);
      if (uqMatch != null) {
        if (buffer.isNotEmpty) {
          String desc = buffer.join(' ').trim();
          String itemNo = '';
          
          final firstMatch = _itemStartPattern.firstMatch(desc);
          if (firstMatch != null) {
            itemNo = firstMatch.group(1) ?? '';
            desc = desc.substring(firstMatch.group(0)!.length).trim();
          }
          
          if (desc.isNotEmpty && desc.length <= 1000) {
            items.add(ExtractedBOQItem(
              itemNo: itemNo,
              description: desc,
              unit: uqMatch.group(1)!,
              quantity: uqMatch.group(2)!.replaceAll(',', ''),
              category: category,
            ));
          }
          buffer = [];
        }
        continue;
      }

      // Check for same-line item
      final slMatch = _sameLinePattern.firstMatch(line);
      if (slMatch != null) {
        flush();
        items.add(ExtractedBOQItem(
          itemNo: slMatch.group(1)!.trim(),
          description: slMatch.group(2)!.trim(),
          unit: slMatch.group(3)!.trim(),
          quantity: slMatch.group(4)!.replaceAll(',', ''),
          category: category,
        ));
        continue;
      }

      // Check for item start
      if (_itemStartPattern.hasMatch(line)) {
        flush();
        buffer = [line];
        continue;
      }

      // Continue building buffer
      if (buffer.isNotEmpty) {
        buffer.add(line);
      }
    }

    flush();

    if (items.isEmpty) {
      _log('extractFromText final items empty');
      return const BOQExtractionResult(
        error: 'No BOQ items found in the PDF. The format may not be supported.',
      );
    }

    _log('extractFromText success items=${items.length} projectName=${projectName.isEmpty ? "(none)" : projectName}');
    return BOQExtractionResult(
      items: items,
      projectName: projectName,
    );
  }

  static BOQExtractionResult _extractLodhaFromText(String rawText) {
    final lines = _splitLines(rawText).where((line) => !_isLikelyFooterOrHeader(line)).toList();
    final items = <ExtractedBOQItem>[];
    final sections = <String>[];
    var projectName = '';
    var currentSection = '';
    final itemStartAt = <int>[];

    void pushSection(String name) {
      final normalized = _normalizeSpaces(name);
      if (normalized.isEmpty || (sections.isNotEmpty && sections.last == normalized)) return;
      sections.add(normalized);
    }

    final sectionRe = RegExp(r'^\d+\.\d+\s+[A-Z]');
    final itemNoRe = RegExp(r'^(?:\d+\.\d+\.\d+|\d+\.\d+|\d+)\b');
    final hsnRe = RegExp(r'\b(\d{6})\b');
    final tailRe = RegExp(r'\b([A-Za-z]{1,10})\s+(-?\d[\d,]*\.?\d*)\s+(-?\d[\d,]*\.?\d*)\s+(-?\d[\d,]*\.?\d*)\s*$');

    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      if (projectName.isEmpty) {
        final match = _projectNamePattern.firstMatch(line);
        if (match != null) {
          projectName = match.group(1) ?? line.substring(0, line.length > 120 ? 120 : line.length).trim();
        }
      }

      if (sectionRe.hasMatch(line)) {
        currentSection = _normalizeSpaces(line.replaceFirst(RegExp(r'^\d+\.\d+\s+'), ''));
        pushSection(currentSection);
        continue;
      }
      if (!itemNoRe.hasMatch(line)) continue;

      final itemNo = _normalizeSpaces(itemNoRe.firstMatch(line)!.group(0)!);
      final startLineIdx = i;
      var buffer = line.substring(itemNo.length).trim();
      final directParsed = _parseLodhaRow('$itemNo $buffer', currentSection);
      if (directParsed != null) {
        itemStartAt.add(startLineIdx);
        items.add(directParsed);
        continue;
      }
      var consumed = 0;
      var hsnMatch = hsnRe.firstMatch(buffer);
      var tailOk = tailRe.hasMatch(buffer);
      while ((!tailOk || hsnMatch == null) && i + 1 < lines.length && consumed < 40) {
        final next = lines[i + 1];
        if (sectionRe.hasMatch(next)) break;
        if (itemNoRe.hasMatch(next) && itemNoRe.firstMatch(next)!.group(0)! != itemNo) break;
        if (_isLikelyFooterOrHeader(next)) {
          i++;
          consumed++;
          continue;
        }
        buffer = '$buffer $next'.trim();
        i++;
        consumed++;
        hsnMatch = hsnRe.firstMatch(buffer);
        tailOk = tailRe.hasMatch(buffer);
      }

      if (hsnMatch == null) continue;
      final tailMatch = tailRe.firstMatch(buffer);
      if (tailMatch == null) continue;

      final beforeTail = buffer.substring(0, tailMatch.start).trim();
      final hsnIndex = beforeTail.indexOf(hsnMatch.group(1)!);
      final description = _normalizeSpaces(
        hsnIndex >= 0 ? beforeTail.substring(0, hsnIndex) : beforeTail.replaceFirst(hsnRe, ''),
      );
      if (description.isEmpty) continue;

      itemStartAt.add(startLineIdx);
      items.add(ExtractedBOQItem(
        itemNo: itemNo,
        description: description,
        unit: _normalizeSpaces(tailMatch.group(1)!),
        quantity: _toDecimalString(tailMatch.group(2)!),
        category: currentSection.isNotEmpty ? currentSection : 'General',
        hsn: hsnMatch.group(1),
        rate: double.tryParse(_toDecimalString(tailMatch.group(3)!)),
        amount: double.tryParse(_toDecimalString(tailMatch.group(4)!)),
        qtyText: _toDecimalString(tailMatch.group(2)!),
        rateText: _toFixedDecimalString(tailMatch.group(3)!),
        amountText: _toFixedDecimalString(tailMatch.group(4)!),
      ));
    }

    for (var li = 0; li < lines.length; li++) {
      final line = lines[li];
      if (line.isEmpty || _isLikelyFooterOrHeader(line)) continue;
      if (sectionRe.hasMatch(line)) continue;
      if (RegExp(r'^\d+\.\d+').hasMatch(line)) continue;
      if (hsnRe.hasMatch(line)) continue;
      if (tailRe.hasMatch(line)) continue;
      var nextK = -1;
      for (var k = 0; k < itemStartAt.length; k++) {
        if (itemStartAt[k] > li) {
          nextK = k;
          break;
        }
      }
      final target = nextK > 0
          ? nextK - 1
          : nextK == -1 && items.isNotEmpty
              ? items.length - 1
              : -1;
      if (target >= 0) {
        final current = items[target];
        items[target] = ExtractedBOQItem(
          itemNo: current.itemNo,
          description: _normalizeSpaces('${current.description} $line'),
          unit: current.unit,
          quantity: current.quantity,
          category: current.category,
          hsn: current.hsn,
          sacCode: current.sacCode,
          rate: current.rate,
          amount: current.amount,
          qtyText: current.qtyText,
          rateText: current.rateText,
          amountText: current.amountText,
        );
      }
    }

    return items.isEmpty
        ? const BOQExtractionResult(error: 'No BOQ items found in the PDF. The format may not be supported.')
        : BOQExtractionResult(items: items, projectName: projectName);
  }

  static BOQExtractionResult _extractHiranandaniFromText(String rawText) {
    final lines = _splitLines(rawText);
    final items = <ExtractedBOQItem>[];
    final sections = <String>[];
    var currentSection = '';

    void pushSection(String name) {
      final normalized = _normalizeSpaces(name);
      if (normalized.isEmpty || (sections.isNotEmpty && sections.last == normalized)) return;
      sections.add(normalized);
    }

    final sectionRe = RegExp(r'^\d+\s+[A-Za-z].+');
    final itemStartRe = RegExp(r'^(?:\(\s*\d+\s*\)|\d+\))');
    final lumpSumAuRe = RegExp(r'^\d+\s+AU\s+[\d,]+(\.\d+)?\b', caseSensitive: false);

    for (var i = 0; i < lines.length; i++) {
      var line = _normalizeSpaces(lines[i])
          .replaceAll(RegExp(r'\(\s*(\d+)\s*\)'), r'($1)')
          .replaceAll(RegExp(r'^(\d+)\)'), r'($1)');
      if (line.isEmpty) continue;
      if (RegExp(r'Sr\s*No\.?\s*Service\s*Description', caseSensitive: false).hasMatch(line)) continue;
      if (RegExp(r'^Building\s*:', caseSensitive: false).hasMatch(line)) continue;
      if (RegExp(r'Corporate\s*Addr', caseSensitive: false).hasMatch(line)) continue;
      if (RegExp(r'Page\s*No\.?\s*:', caseSensitive: false).hasMatch(line)) continue;

      if (sectionRe.hasMatch(line) && !itemStartRe.hasMatch(line) && !lumpSumAuRe.hasMatch(line)) {
        currentSection = line.replaceFirst(RegExp(r'^\d+\s+'), '').trim();
        pushSection(currentSection);
        continue;
      }

      if (lumpSumAuRe.hasMatch(line) ||
          (!itemStartRe.hasMatch(line) && !RegExp(r'\bSac\s*:\s*\d[\d\s]{5,10}\b', caseSensitive: false).hasMatch(line))) {
        continue;
      }

      var joined = line;
      var consumed = 0;
      while (i + 1 < lines.length && consumed < 30) {
        var next = _normalizeSpaces(lines[i + 1])
            .replaceAll(RegExp(r'\(\s*(\d+)\s*\)'), r'($1)')
            .replaceAll(RegExp(r'^(\d+)\)'), r'($1)');
        if (next.isEmpty) {
          i++;
          consumed++;
          continue;
        }
        if (sectionRe.hasMatch(next) &&
            !itemStartRe.hasMatch(next) &&
            !RegExp(r'^Building\s*:', caseSensitive: false).hasMatch(next) &&
            !RegExp(r'Sr\s*No\.?\s*Service', caseSensitive: false).hasMatch(next)) {
          break;
        }
        if (itemStartRe.hasMatch(next)) break;
        if (lumpSumAuRe.hasMatch(next) ||
            RegExp(r'\b(CGST|SGST|INR)\b', caseSensitive: false).hasMatch(next) ||
            RegExp(r'Sr\s*No\.?\s*Service\s*Description', caseSensitive: false).hasMatch(next) ||
            RegExp(r'^Building\s*:', caseSensitive: false).hasMatch(next) ||
            RegExp(r'Corporate\s*Addr', caseSensitive: false).hasMatch(next) ||
            RegExp(r'Page\s*No\.?\s*:', caseSensitive: false).hasMatch(next)) {
          i++;
          consumed++;
          continue;
        }
        joined = '$joined $next'.trim();
        i++;
        consumed++;
      }

      final parsed = _parseHiranandaniRow(joined, currentSection);
      if (parsed != null) items.add(parsed);
    }

    return items.isEmpty
        ? const BOQExtractionResult(error: 'No BOQ items found in the PDF. The format may not be supported.')
        : BOQExtractionResult(items: items, projectName: '');
  }

  /// Convert extracted items to table format
  static List<Map<String, dynamic>> mapToTableRows(List<ExtractedBOQItem> items, {int baseId = 0}) {
    return items.asMap().entries.map((entry) {
      return entry.value.toTableRow(baseId + entry.key);
    }).toList();
  }
}
