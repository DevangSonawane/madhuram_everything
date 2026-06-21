import 'dart:io';
import 'package:excel/excel.dart';
import 'file_service.dart';

/// Excel file handling service
class ExcelService {
  /// Create a new Excel workbook
  static Excel createWorkbook() {
    return Excel.createExcel();
  }

  /// Read an Excel file
  static Future<Excel?> readExcelFile(File file) async {
    try {
      final bytes = await file.readAsBytes();
      return Excel.decodeBytes(bytes);
    } catch (e) {
      print('Error reading Excel file: $e');
    }
    return null;
  }

  /// Import Excel from file picker
  static Future<Excel?> importExcel() async {
    final file = await FileService.pickExcelFile();
    if (file != null) {
      return readExcelFile(file);
    }
    return null;
  }

  /// Save Excel workbook to file
  static Future<File?> saveExcel(Excel excel, String filename) async {
    try {
      final bytes = excel.encode();
      if (bytes != null) {
        return await FileService.saveFile(
          filename: filename.endsWith('.xlsx') ? filename : '$filename.xlsx',
          bytes: bytes,
          subfolder: 'exports',
        );
      }
    } catch (e) {
      print('Error saving Excel: $e');
    }
    return null;
  }

  /// Export Excel with save dialog
  static Future<String?> exportExcel(Excel excel, String filename) async {
    try {
      final bytes = excel.encode();
      if (bytes != null) {
        return await FileService.saveFileAs(
          filename: filename.endsWith('.xlsx') ? filename : '$filename.xlsx',
          bytes: bytes,
        );
      }
    } catch (e) {
      print('Error exporting Excel: $e');
    }
    return null;
  }

  /// Share Excel file
  static Future<void> shareExcel(Excel excel, String filename) async {
    try {
      final bytes = excel.encode();
      if (bytes != null) {
        final file = await FileService.saveFile(
          filename: filename.endsWith('.xlsx') ? filename : '$filename.xlsx',
          bytes: bytes,
          subfolder: 'temp',
        );
        if (file != null) {
          await FileService.shareFile(file, subject: filename);
        }
      }
    } catch (e) {
      print('Error sharing Excel: $e');
    }
  }

  /// Add header row with styling
  static void addHeaderRow(Sheet sheet, List<String> headers, {int rowIndex = 0}) {
    for (int i = 0; i < headers.length; i++) {
      final cell = sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: rowIndex));
      cell.value = TextCellValue(headers[i]);
      cell.cellStyle = CellStyle(
        bold: true,
        backgroundColorHex: ExcelColor.fromHexString('#E5E7EB'),
        horizontalAlign: HorizontalAlign.Center,
      );
    }
  }

  /// Add data row
  static void addDataRow(Sheet sheet, List<dynamic> values, int rowIndex) {
    for (int i = 0; i < values.length; i++) {
      final cell = sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: rowIndex));
      final value = values[i];
      if (value is num) {
        cell.value = DoubleCellValue(value.toDouble());
      } else if (value is DateTime) {
        cell.value = DateCellValue(year: value.year, month: value.month, day: value.day);
      } else {
        cell.value = TextCellValue(value?.toString() ?? '');
      }
    }
  }

  /// Set column widths
  static void setColumnWidths(Sheet sheet, List<double> widths) {
    for (int i = 0; i < widths.length; i++) {
      sheet.setColumnWidth(i, widths[i]);
    }
  }

  /// Export BOQ to Excel
  static Future<Excel> exportBOQToExcel({
    required String projectName,
    required List<Map<String, dynamic>> items,
  }) async {
    final excel = createWorkbook();
    final sheet = excel['BOQ'];

    // Title
    sheet.cell(CellIndex.indexByString('A1')).value = TextCellValue('Bill of Quantities - $projectName');
    sheet.merge(CellIndex.indexByString('A1'), CellIndex.indexByString('G1'));

    // Headers
    addHeaderRow(sheet, ['S.No', 'Item Code', 'Description', 'Unit', 'Quantity', 'Rate', 'Amount'], rowIndex: 2);
    setColumnWidths(sheet, [8, 15, 40, 10, 12, 15, 18]);

    // Data
    for (int i = 0; i < items.length; i++) {
      final item = items[i];
      addDataRow(sheet, [
        i + 1,
        item['item_code'] ?? '',
        item['description'] ?? '',
        item['unit'] ?? '',
        item['quantity'] ?? 0,
        item['rate'] ?? 0,
        item['amount'] ?? (item['quantity'] ?? 0) * (item['rate'] ?? 0),
      ], i + 3);
    }

    // Total row
    final totalRow = items.length + 3;
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: totalRow)).value = TextCellValue('Total:');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: totalRow)).cellStyle = CellStyle(bold: true);
    
    final totalAmount = items.fold<num>(0, (sum, item) => sum + (item['amount'] ?? (item['quantity'] ?? 0) * (item['rate'] ?? 0)));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: totalRow)).value = DoubleCellValue(totalAmount.toDouble());
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: totalRow)).cellStyle = CellStyle(bold: true);

    // Remove default Sheet1
    if (excel.sheets.containsKey('Sheet1')) {
      excel.delete('Sheet1');
    }

    return excel;
  }

  /// Export Materials to Excel
  static Future<Excel> exportMaterialsToExcel({
    required String projectName,
    required List<Map<String, dynamic>> materials,
  }) async {
    final excel = createWorkbook();
    final sheet = excel['Materials'];

    // Title
    sheet.cell(CellIndex.indexByString('A1')).value = TextCellValue('Materials List - $projectName');
    sheet.merge(CellIndex.indexByString('A1'), CellIndex.indexByString('F1'));

    // Headers
    addHeaderRow(sheet, ['S.No', 'Material Code', 'Name', 'Category', 'Unit', 'Stock'], rowIndex: 2);
    setColumnWidths(sheet, [8, 15, 35, 20, 10, 12]);

    // Data
    for (int i = 0; i < materials.length; i++) {
      final mat = materials[i];
      addDataRow(sheet, [
        i + 1,
        mat['material_code'] ?? '',
        mat['name'] ?? '',
        mat['category'] ?? '',
        mat['unit'] ?? '',
        mat['stock'] ?? 0,
      ], i + 3);
    }

    if (excel.sheets.containsKey('Sheet1')) {
      excel.delete('Sheet1');
    }

    return excel;
  }

  /// Export Purchase Orders to Excel
  static Future<Excel> exportPurchaseOrdersToExcel({
    required String projectName,
    required List<Map<String, dynamic>> orders,
  }) async {
    final excel = createWorkbook();
    final sheet = excel['Purchase Orders'];

    // Title
    sheet.cell(CellIndex.indexByString('A1')).value = TextCellValue('Purchase Orders - $projectName');
    sheet.merge(CellIndex.indexByString('A1'), CellIndex.indexByString('G1'));

    // Headers
    addHeaderRow(sheet, ['S.No', 'PO Number', 'Vendor', 'Date', 'Amount', 'Status', 'Items'], rowIndex: 2);
    setColumnWidths(sheet, [8, 15, 30, 15, 18, 12, 10]);

    // Data
    for (int i = 0; i < orders.length; i++) {
      final po = orders[i];
      addDataRow(sheet, [
        i + 1,
        po['po_number'] ?? '',
        po['vendor_name'] ?? '',
        po['date'] ?? '',
        po['total_amount'] ?? 0,
        po['status'] ?? '',
        po['items_count'] ?? 0,
      ], i + 3);
    }

    if (excel.sheets.containsKey('Sheet1')) {
      excel.delete('Sheet1');
    }

    return excel;
  }

  static String _stringValue(dynamic value, [String fallback = '']) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty || text.toLowerCase() == 'null' ? fallback : text;
  }

  static double _doubleValue(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    final normalized = value.toString().replaceAll(',', '').trim();
    return double.tryParse(normalized) ?? 0;
  }

  static List<Map<String, dynamic>> _normalizePoItems(dynamic rawItems) {
    if (rawItems is! List) return const [];
    return rawItems
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .map((item) {
          final qty = _doubleValue(item['qty'] ?? item['quantity']);
          final rate = _doubleValue(item['Rate'] ?? item['rate']);
          final amount = _doubleValue(item['Amount'] ?? item['amount']) != 0
              ? _doubleValue(item['Amount'] ?? item['amount'])
              : qty * rate;
          return <String, dynamic>{
            'srNo': _stringValue(item['srNo'] ?? item['srno']),
            'hsnCode': _stringValue(item['hsnCode'] ?? item['hsn']),
            'description': _stringValue(item['description']),
            'qty': qty,
            'uom': _stringValue(item['uom'] ?? item['UOM']),
            'rate': rate,
            'amount': amount,
            'remarks': _stringValue(item['remarks'] ?? item['remark']),
          };
        })
        .toList();
  }

  /// Export a single Purchase Order to Excel
  static Future<Excel> exportPurchaseOrderToExcel(
    Map<String, dynamic> poData,
  ) async {
    final excel = createWorkbook();
    final sheet = excel['Purchase Order'];
    final raw = Map<String, dynamic>.from(poData);
    final vendor = raw['vendor'] is Map
        ? Map<String, dynamic>.from(raw['vendor'] as Map)
        : <String, dynamic>{};
    final contacts = vendor['contacts'] is Map
        ? Map<String, dynamic>.from(vendor['contacts'] as Map)
        : <String, dynamic>{};
    final primary = contacts['primary'] is Map
        ? Map<String, dynamic>.from(contacts['primary'] as Map)
        : <String, dynamic>{};
    final secondary = contacts['secondary'] is Map
        ? Map<String, dynamic>.from(contacts['secondary'] as Map)
        : <String, dynamic>{};
    final discount = raw['discount'] is Map
        ? Map<String, dynamic>.from(raw['discount'] as Map)
        : <String, dynamic>{};
    final taxes = raw['taxes'] is Map
        ? Map<String, dynamic>.from(raw['taxes'] as Map)
        : <String, dynamic>{};
    final cgst = taxes['cgst'] is Map
        ? Map<String, dynamic>.from(taxes['cgst'] as Map)
        : <String, dynamic>{};
    final sgst = taxes['sgst'] is Map
        ? Map<String, dynamic>.from(taxes['sgst'] as Map)
        : <String, dynamic>{};
    final summary = raw['summary'] is Map
        ? Map<String, dynamic>.from(raw['summary'] as Map)
        : <String, dynamic>{};
    final notes = raw['notes'] is List
        ? (raw['notes'] as List).map((e) => e.toString()).where((e) => e.trim().isNotEmpty).toList()
        : <String>[];
    final terms = raw['termsAndConditions'] is List
        ? (raw['termsAndConditions'] as List).map((e) => e.toString()).where((e) => e.trim().isNotEmpty).toList()
        : <String>[];
    final items = _normalizePoItems(raw['items']);

    sheet.cell(CellIndex.indexByString('A1')).value = TextCellValue('Purchase Order');
    sheet.merge(CellIndex.indexByString('A1'), CellIndex.indexByString('H1'));
    sheet.cell(CellIndex.indexByString('A2')).value = TextCellValue('PO No: ${_stringValue(raw['order_no'] ?? raw['orderNo'])}');
    sheet.merge(CellIndex.indexByString('A2'), CellIndex.indexByString('H2'));
    sheet.cell(CellIndex.indexByString('A3')).value = TextCellValue('PO Date: ${_stringValue(raw['po_date'] ?? raw['poDate'])}');
    sheet.merge(CellIndex.indexByString('A3'), CellIndex.indexByString('H3'));
    sheet.cell(CellIndex.indexByString('A4')).value = TextCellValue('Vendor: ${_stringValue(vendor['name'] ?? raw['vendor_name'])}');
    sheet.merge(CellIndex.indexByString('A4'), CellIndex.indexByString('H4'));
    sheet.cell(CellIndex.indexByString('A5')).value = TextCellValue('Site: ${_stringValue(vendor['site'] ?? raw['site'])}');
    sheet.merge(CellIndex.indexByString('A5'), CellIndex.indexByString('H5'));
    sheet.cell(CellIndex.indexByString('A6')).value = TextCellValue('Contact Person: ${_stringValue(vendor['contactPerson'] ?? raw['contact_person'])}');
    sheet.merge(CellIndex.indexByString('A6'), CellIndex.indexByString('H6'));
    sheet.cell(CellIndex.indexByString('A7')).value = TextCellValue('Vendor Address: ${_stringValue(vendor['address'] ?? raw['vendor_address'])}');
    sheet.merge(CellIndex.indexByString('A7'), CellIndex.indexByString('H7'));
    sheet.cell(CellIndex.indexByString('A8')).value = TextCellValue('Primary Contact: ${_stringValue(primary['name'] ?? raw['primary_contact_name'])} / ${_stringValue(primary['phone'] ?? primary['number'] ?? raw['primary_contact_number'])}');
    sheet.merge(CellIndex.indexByString('A8'), CellIndex.indexByString('H8'));
    sheet.cell(CellIndex.indexByString('A9')).value = TextCellValue('Secondary Contact: ${_stringValue(secondary['name'] ?? raw['secondary_contact_name'])} / ${_stringValue(secondary['phone'] ?? secondary['number'] ?? raw['secondary_contact_number'])}');
    sheet.merge(CellIndex.indexByString('A9'), CellIndex.indexByString('H9'));

    addHeaderRow(
      sheet,
      ['Sr No', 'HSN', 'Description', 'Qty', 'UOM', 'Rate', 'Amount', 'Remarks'],
      rowIndex: 10,
    );
    setColumnWidths(sheet, [10, 15, 40, 12, 12, 15, 18, 28]);

    for (int i = 0; i < items.length; i++) {
      final item = items[i];
      addDataRow(sheet, [
        _stringValue(item['srNo'], (i + 1).toString()),
        item['hsnCode'] ?? '',
        item['description'] ?? '',
        item['qty'] ?? '',
        item['uom'] ?? '',
        item['rate'] ?? 0,
        item['amount'] ?? 0,
        item['remarks'] ?? '',
      ], i + 11);
    }

    final totalsRow = items.length + 13;
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: totalsRow)).value = TextCellValue('Subtotal');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: totalsRow)).value = DoubleCellValue(items.fold<double>(0, (sum, item) => sum + ((item['amount'] as double?) ?? 0)));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: totalsRow)).value = TextCellValue('Discount %');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: totalsRow)).value = TextCellValue(_stringValue(discount['percent']));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: totalsRow)).value = TextCellValue('Discount Amount');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: totalsRow)).value = DoubleCellValue(_doubleValue(discount['amount']));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: totalsRow)).value = TextCellValue('Total');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: totalsRow)).value = DoubleCellValue(_doubleValue(raw['total_amount'] ?? raw['totalAmount']));

    final infoRow = totalsRow + 2;
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: infoRow)).value = TextCellValue('After Discount');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: infoRow)).value = DoubleCellValue(_doubleValue(raw['afterDiscountAmount'] ?? raw['after_discount']));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: infoRow)).value = TextCellValue('CGST %');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: infoRow)).value = TextCellValue(_stringValue(cgst['percent'] ?? raw['cgst']));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: infoRow)).value = TextCellValue('CGST Amount');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: infoRow)).value = DoubleCellValue(_doubleValue(cgst['amount'] ?? raw['cgst_amount']));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: infoRow)).value = TextCellValue('SGST %');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: infoRow)).value = TextCellValue(_stringValue(sgst['percent'] ?? raw['sgst']));

    final infoRow2 = infoRow + 1;
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: infoRow2)).value = TextCellValue('SGST Amount');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: infoRow2)).value = DoubleCellValue(_doubleValue(sgst['amount'] ?? raw['sgst_amount']));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: infoRow2)).value = TextCellValue('Delivery');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: infoRow2)).value = TextCellValue(_stringValue(summary['delivery'] ?? raw['delivery']));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: infoRow2)).value = TextCellValue('Payment');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: infoRow2)).value = TextCellValue(_stringValue(summary['payment'] ?? raw['payment']));
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: infoRow2)).value = TextCellValue('Status');
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: infoRow2)).value = TextCellValue(_stringValue(raw['status'], 'created'));

    final noteRow = infoRow2 + 2;
    if (notes.isNotEmpty) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: noteRow)).value = TextCellValue('Notes');
      sheet.merge(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: noteRow), CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: noteRow));
      for (int i = 0; i < notes.length; i++) {
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: noteRow + i + 1)).value = TextCellValue(notes[i]);
        sheet.merge(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: noteRow + i + 1), CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: noteRow + i + 1));
      }
    }

    final termStartRow = noteRow + notes.length + 2;
    if (terms.isNotEmpty) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: termStartRow)).value = TextCellValue('Terms & Conditions');
      sheet.merge(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: termStartRow), CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: termStartRow));
      for (int i = 0; i < terms.length; i++) {
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: termStartRow + i + 1)).value = TextCellValue(terms[i]);
        sheet.merge(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: termStartRow + i + 1), CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: termStartRow + i + 1));
      }
    }

    if (excel.sheets.containsKey('Sheet1')) {
      excel.delete('Sheet1');
    }

    return excel;
  }

  /// Import BOQ from Excel
  static List<Map<String, dynamic>>? parseBOQFromExcel(Excel excel) {
    try {
      final sheet = excel.tables.values.first;
      if (sheet.rows.length < 2) return null;

      final items = <Map<String, dynamic>>[];
      
      // Find header row (look for 'Description' or 'Item')
      int headerRow = 0;
      for (int i = 0; i < sheet.rows.length && i < 5; i++) {
        final row = sheet.rows[i];
        for (final cell in row) {
          if (cell?.value?.toString().toLowerCase().contains('description') == true ||
              cell?.value?.toString().toLowerCase().contains('item') == true) {
            headerRow = i;
            break;
          }
        }
      }

      // Map column indices
      final headers = <int, String>{};
      final headerRowData = sheet.rows[headerRow];
      for (int i = 0; i < headerRowData.length; i++) {
        final value = headerRowData[i]?.value?.toString().toLowerCase() ?? '';
        if (value.contains('code')) headers[i] = 'item_code';
        else if (value.contains('desc')) headers[i] = 'description';
        else if (value.contains('unit')) headers[i] = 'unit';
        else if (value.contains('qty') || value.contains('quantity')) headers[i] = 'quantity';
        else if (value.contains('rate') || value.contains('price')) headers[i] = 'rate';
        else if (value.contains('amount') || value.contains('total')) headers[i] = 'amount';
      }

      // Parse data rows
      for (int i = headerRow + 1; i < sheet.rows.length; i++) {
        final row = sheet.rows[i];
        if (row.every((cell) => cell?.value == null)) continue;

        final item = <String, dynamic>{};
        for (final entry in headers.entries) {
          final cell = row.length > entry.key ? row[entry.key] : null;
          final value = cell?.value;
          if (entry.value == 'quantity' || entry.value == 'rate' || entry.value == 'amount') {
            item[entry.value] = value is num ? value : double.tryParse(value?.toString() ?? '') ?? 0;
          } else {
            item[entry.value] = value?.toString() ?? '';
          }
        }
        
        if (item.isNotEmpty && (item['description']?.toString().isNotEmpty == true)) {
          items.add(item);
        }
      }

      return items.isEmpty ? null : items;
    } catch (e) {
      print('Error parsing BOQ Excel: $e');
    }
    return null;
  }
}
