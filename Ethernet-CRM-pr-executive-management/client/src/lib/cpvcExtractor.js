/**
 * Extract CPVC-specific data from PDF text.
 * Handles item names, quantities, dimensions, specifications, and floor-wise breakdowns.
 */

/** @typedef {{ name: string, quantity: string, unit: string, dimensions: string, specifications: string, floor: string }} CPVCItem */

/**
 * Extract CPVC items from raw PDF text.
 * @param {string} rawText - Full text from extractTextFromPdf
 * @returns {{ items: CPVCItem[], diagrams: Array<{ pageNumber: number, type: string, description: string }>, metadata: { projectName: string, totalFloors: string, date: string } }}
 */
export function extractCPVCData(rawText) {
  const items = /** @type {CPVCItem[]} */ ([]);
  const diagrams = [];
  const metadata = {
    projectName: '',
    totalFloors: '',
    date: '',
  };

  if (!rawText || typeof rawText !== 'string') {
    return { items, diagrams, metadata };
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const text = rawText.replace(/\s+/g, ' ').trim();

  // Extract project name
  const projectMatch = text.match(/(?:CPVC|Project|Building)\s+([A-Za-z0-9\s-]+?)(?:\s+(?:Floor|FLR|1-5|Page|\d+)|$)/i);
  if (projectMatch) {
    metadata.projectName = projectMatch[1].trim().slice(0, 100);
  }

  // Extract floor information
  const floorMatch = text.match(/(?:Floor|FLR)\s*[:\s]*([1-5]|1\s*[-–]\s*5|\d+)/i) || 
                     text.match(/(\d+)\s*(?:Floor|FLR)/i);
  if (floorMatch) {
    metadata.totalFloors = floorMatch[1].replace(/[-–]/g, '-').trim();
  }

  // Extract date
  const dateMatch = text.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/);
  if (dateMatch) {
    metadata.date = dateMatch[1];
  }

  // Common CPVC item patterns
  const cpvcItemPatterns = [
    // Pattern: "CPVC Pipe 2 inch" or "CPVC Pipe 1/2 inch"
    /(?:CPVC\s+)?(?:Pipe|Piping)\s+(\d+(?:\/\d+)?)\s*(?:inch|"|mm|DN\d+)/i,
    // Pattern: "CPVC Fitting" or "CPVC Valve"
    /(?:CPVC\s+)?(Fitting|Valve|Elbow|Tee|Reducer|Coupling|Adapter|Bend|Socket|Union|Cap|Plug|Nipple)/i,
    // Pattern: "CPVC 2 inch" or "2 inch CPVC"
    /(\d+(?:\/\d+)?)\s*(?:inch|"|mm)\s*(?:CPVC|Pipe|Fitting)/i,
  ];

  // Unit patterns
  const unitPattern = /\b(Nos|Mtr|Meter|Meters|RM|Cum|Sft|Sqm|Kg|kg|Pcs|Piece|Pieces|Set|Sets|Lot|Lots)\b/i;

  // Quantity patterns
  const quantityPattern = /(\d+(?:[,.]\d+)?)\s*(?:Nos|Mtr|Meter|RM|Cum|Sft|Sqm|Kg|Pcs|Set|Lot)/i;

  // Dimension patterns
  const dimensionPatterns = [
    /(\d+(?:\/\d+)?)\s*(?:inch|"|Inch)/i,
    /DN\s*(\d+)/i,
    /(\d+)\s*mm/i,
    /(\d+(?:\.\d+)?)\s*(?:mm|MM)/i,
  ];

  // Specification patterns (IS standards, pressure ratings, etc.)
  const specPatterns = [
    /IS\s*[:\s]*(\d+)/i,
    /(?:Pressure|Rating)\s*[:\s]*(\d+(?:\s*kg\/cm²|\s*bar|\s*psi)?)/i,
    /(?:Standard|Spec)\s*[:\s]*([A-Z0-9\s-]+)/i,
  ];

  // Floor pattern
  const floorPattern = /(?:Floor|FLR)\s*[:\s]*([1-5]|1\s*[-–]\s*5|\d+)/i;

  // More flexible extraction - look for table-like structures
  // Try to find rows with: item description, quantity, unit
  
  // Pattern for table rows: description followed by numbers (quantity) and unit
  const tableRowPattern = /^(.+?)\s+(\d+(?:[,.]\d+)?)\s*(Nos|Mtr|Meter|Meters|RM|Cum|Sft|Sqm|Kg|Pcs|Set|Lot|Piece|Pieces|Sets|Lots)/i;
  
  // Pattern for multi-line items: description on one line, quantity+unit on next
  const multiLinePattern = /^(.+?)$/;
  
  let currentItem = null;
  let pendingDescription = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || skipLine(line)) continue;

    // Try table row pattern first (most common)
    const tableMatch = line.match(tableRowPattern);
    if (tableMatch) {
      // Flush previous item
      if (currentItem && (currentItem.name || currentItem.quantity)) {
        items.push(currentItem);
      }
      
      const [, desc, qty, unit] = tableMatch;
      const dimensions = desc.match(/(\d+(?:\/\d+)?)\s*(?:inch|"|mm|DN\d+)/i);
      
      currentItem = {
        name: desc.trim().slice(0, 200),
        quantity: qty.replace(/,/g, ''),
        unit: unit.trim(),
        dimensions: dimensions ? dimensions[1] : '',
        specifications: '',
        floor: '',
      };
      pendingDescription = '';
      continue;
    }

    // Check if line has quantity pattern
    const qtyMatch = line.match(quantityPattern);
    if (qtyMatch && pendingDescription) {
      // This is likely quantity+unit following a description
      if (currentItem && (currentItem.name || currentItem.quantity)) {
        items.push(currentItem);
      }
      
      const [, qty] = qtyMatch;
      const unitMatch = line.match(unitPattern);
      
      currentItem = {
        name: pendingDescription.slice(0, 200),
        quantity: qty.replace(/,/g, ''),
        unit: unitMatch ? unitMatch[1] : 'Nos',
        dimensions: '',
        specifications: '',
        floor: '',
      };
      pendingDescription = '';
      continue;
    }

    // Check for CPVC keywords - might be a description
    if (/CPVC|Pipe|Fitting|Valve|Elbow|Tee|Reducer|Coupling|Adapter|Bend|Socket|Union|Cap|Plug|Nipple|Fixture/i.test(line)) {
      // Extract dimensions if present
      const dimMatch = line.match(/(\d+(?:\/\d+)?)\s*(?:inch|"|mm|DN\d+)/i);
      const dimensions = dimMatch ? dimMatch[1] : '';
      
      // Check if this line also has quantity
      const hasQty = quantityPattern.test(line);
      
      if (hasQty) {
        const qtyMatch = line.match(quantityPattern);
        const unitMatch = line.match(unitPattern);
        
        if (currentItem && (currentItem.name || currentItem.quantity)) {
          items.push(currentItem);
        }
        
        currentItem = {
          name: line.replace(quantityPattern, '').trim().slice(0, 200),
          quantity: qtyMatch[1].replace(/,/g, ''),
          unit: unitMatch ? unitMatch[1] : 'Nos',
          dimensions: dimensions,
          specifications: '',
          floor: '',
        };
        pendingDescription = '';
      } else {
        // Store as pending description, might be followed by quantity on next line
        pendingDescription = line.trim();
      }
      continue;
    }

    // If we have a current item, try to enhance it
    if (currentItem) {
      // Check for dimensions
      const dimMatch = line.match(/(\d+(?:\/\d+)?)\s*(?:inch|"|mm|DN\d+)/i);
      if (dimMatch && !currentItem.dimensions) {
        currentItem.dimensions = dimMatch[1];
      }
      
      // Check for specifications
      const specMatch = line.match(/IS\s*[:\s]*(\d+)|(?:Pressure|Rating)\s*[:\s]*(\d+)/i);
      if (specMatch && !currentItem.specifications) {
        currentItem.specifications = specMatch[1] || specMatch[2] || '';
      }
      
      // Check for floor
      const floorMatch = line.match(floorPattern);
      if (floorMatch && !currentItem.floor) {
        currentItem.floor = floorMatch[1].replace(/[-–]/g, '-').trim();
      }
    }
  }

  // Add last item if exists
  if (currentItem && (currentItem.name || currentItem.quantity)) {
    items.push(currentItem);
  }
  
  // If we still have items with quantity but no name, try to infer name from context
  items.forEach((item, idx) => {
    if (item.quantity && !item.name) {
      item.name = `CPVC Item ${idx + 1}`;
    }
  });

  // Identify diagram pages (pages with keywords like "Plan", "Layout", "Diagram", "Drawing")
  // This is a simple heuristic - in a real implementation, you might want to analyze page content
  const diagramKeywords = /(?:Plan|Layout|Diagram|Drawing|Section|Elevation|Detail|View)/i;
  // Note: We can't determine page numbers from text alone, so diagrams will be identified
  // when images are extracted and matched with text content

  return { items, diagrams, metadata };
}

/**
 * Skip lines that are headers, footers, or not relevant.
 */
function skipLine(line) {
  if (!line || line.length < 3) return true;
  const lower = line.toLowerCase();
  
  // Skip page numbers, headers, footers
  if (/^Page\s+\d+/i.test(line)) return true;
  if (/^\d+\s+of\s+\d+$/i.test(line)) return true;
  if (/^CPVC\s+1-5\s+FLR$/i.test(line)) return true;
  if (/^Schedule|^Item\s*$|^Description|^Unit|^Qty/i.test(line)) return true;
  
  return false;
}

/**
 * Map extracted CPVC items to sample table format.
 * @param {CPVCItem[]} extracted
 * @param {number} totalFloors
 * @returns {Array<{ id: number, item: string, unit: string, perFloorQty: number, totalFloors: number, totalQty: number, status: string, dimensions: string, specifications: string }>}
 */
export function mapCPVCItemsToSamples(extracted, totalFloors = 1) {
  return extracted
    .filter(item => item.name || item.quantity)
    .map((item, i) => {
      const qty = parseFloat(item.quantity) || 0;
      const perFloorQty = item.floor ? qty : Math.round(qty / totalFloors) || 0;
      
      return {
        id: i + 1,
        item: item.name || `Item ${i + 1}`,
        unit: item.unit || 'Nos',
        perFloorQty: perFloorQty,
        totalFloors: totalFloors,
        totalQty: perFloorQty * totalFloors,
        status: 'Draft',
        dimensions: item.dimensions || '',
        specifications: item.specifications || '',
      };
    });
}
