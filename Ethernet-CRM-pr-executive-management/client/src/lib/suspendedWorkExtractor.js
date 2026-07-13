/**
 * Extract suspended work data from PDF text.
 * Handles suspended work items, quantities, dimensions, and floor-wise breakdowns.
 */

/** @typedef {{ name: string, quantity: string, unit: string, dimensions: string, specifications: string, floor: string, status: string }} SuspendedWorkItem */

/**
 * Extract suspended work items from raw PDF text.
 * @param {string} rawText - Full text from extractTextFromPdf
 * @returns {{ items: SuspendedWorkItem[], diagrams: Array<{ pageNumber: number, type: string, description: string }>, metadata: { projectName: string, totalFloors: string, date: string } }}
 */
export function extractSuspendedWorkData(rawText) {
  const items = /** @type {SuspendedWorkItem[]} */ ([]);
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
  const projectMatch = text.match(/(?:Suspended|Work|Project|Building|FLR|Floor)\s+([A-Za-z0-9\s-]+?)(?:\s+(?:Floor|FLR|1-4|Page|\d+)|$)/i);
  if (projectMatch) {
    metadata.projectName = projectMatch[1].trim().slice(0, 100);
  }

  // Extract floor information (1-4 FLR pattern)
  const floorMatch = text.match(/(?:Floor|FLR)\s*[:\s]*([1-4]|1\s*[-–]\s*4|\d+)/i) || 
                     text.match(/(\d+)\s*(?:Floor|FLR)/i) ||
                     text.match(/(1\s*[-–]\s*4)\s*(?:FLR|Floor)/i);
  if (floorMatch) {
    metadata.totalFloors = floorMatch[1].replace(/[-–]/g, '-').trim();
  }

  // Extract date
  const dateMatch = text.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/);
  if (dateMatch) {
    metadata.date = dateMatch[1];
  }

  // Suspended work item patterns
  const suspendedItemPatterns = [
    // Pattern: "Suspended Work" or "Suspended Item"
    /(?:Suspended\s+)?(?:Work|Item|Fixture|Fitting|Equipment)/i,
    // Pattern: "Ceiling" or "Overhead"
    /(?:Ceiling|Overhead|Suspended|Hanging)/i,
    // Pattern: "Light Fixture", "Fan", "AC Unit", etc.
    /(?:Light|Lamp|Fan|AC|Air\s+Conditioner|Ventilator|Exhaust|Duct|Pipe|Conduit)/i,
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
    /(\d+(?:\.\d+)?)\s*(?:W|Watts?|watt)/i, // For lights/fans
  ];

  // Specification patterns
  const specPatterns = [
    /IS\s*[:\s]*(\d+)/i,
    /(?:Rating|Power)\s*[:\s]*(\d+(?:\s*W|\s*watt)?)/i,
    /(?:Type|Model)\s*[:\s]*([A-Z0-9\s-]+)/i,
    /(?:Brand|Make)\s*[:\s]*([A-Za-z0-9\s-]+)/i,
  ];

  // Floor pattern
  const floorPattern = /(?:Floor|FLR)\s*[:\s]*([1-4]|1\s*[-–]\s*4|\d+)/i;

  // Status patterns (suspended, pending, etc.)
  const statusPattern = /(?:Status|State)\s*[:\s]*(Suspended|Pending|Completed|In\s+Progress|Hold)/i;

  // More flexible extraction - look for table-like structures
  const tableRowPattern = /^(.+?)\s+(\d+(?:[,.]\d+)?)\s*(Nos|Mtr|Meter|Meters|RM|Cum|Sft|Sqm|Kg|Pcs|Set|Lot|Piece|Pieces|Sets|Lots)/i;
  
  let currentItem = null;
  let pendingDescription = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || skipLine(line)) continue;

    // Try table row pattern first
    const tableMatch = line.match(tableRowPattern);
    if (tableMatch) {
      if (currentItem && (currentItem.name || currentItem.quantity)) {
        items.push(currentItem);
      }
      
      const [, desc, qty, unit] = tableMatch;
      const dimensions = desc.match(/(\d+(?:\/\d+)?)\s*(?:inch|"|mm|DN\d+|W|Watts?)/i);
      
      currentItem = {
        name: desc.trim().slice(0, 200),
        quantity: qty.replace(/,/g, ''),
        unit: unit.trim(),
        dimensions: dimensions ? dimensions[1] : '',
        specifications: '',
        floor: '',
        status: 'Suspended',
      };
      pendingDescription = '';
      continue;
    }

    // Check if line has quantity pattern
    const qtyMatch = line.match(quantityPattern);
    if (qtyMatch && pendingDescription) {
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
        status: 'Suspended',
      };
      pendingDescription = '';
      continue;
    }

    // Check for suspended work keywords
    if (/Suspended|Ceiling|Overhead|Hanging|Fixture|Light|Lamp|Fan|AC|Air\s+Conditioner|Ventilator|Exhaust|Duct|Conduit/i.test(line)) {
      const dimMatch = line.match(/(\d+(?:\/\d+)?)\s*(?:inch|"|mm|DN\d+|W|Watts?)/i);
      const dimensions = dimMatch ? dimMatch[1] : '';
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
          status: 'Suspended',
        };
        pendingDescription = '';
      } else {
        pendingDescription = line.trim();
      }
      continue;
    }

    // Enhance current item
    if (currentItem) {
      const dimMatch = line.match(/(\d+(?:\/\d+)?)\s*(?:inch|"|mm|DN\d+|W|Watts?)/i);
      if (dimMatch && !currentItem.dimensions) {
        currentItem.dimensions = dimMatch[1];
      }
      
      const specMatch = line.match(/IS\s*[:\s]*(\d+)|(?:Rating|Power)\s*[:\s]*(\d+)/i);
      if (specMatch && !currentItem.specifications) {
        currentItem.specifications = specMatch[1] || specMatch[2] || '';
      }
      
      const floorMatch = line.match(floorPattern);
      if (floorMatch && !currentItem.floor) {
        currentItem.floor = floorMatch[1].replace(/[-–]/g, '-').trim();
      }
      
      const statusMatch = line.match(statusPattern);
      if (statusMatch && currentItem.status === 'Suspended') {
        currentItem.status = statusMatch[1];
      }
    }
  }

  // Add last item
  if (currentItem && (currentItem.name || currentItem.quantity)) {
    items.push(currentItem);
  }
  
  // Ensure all items have names
  items.forEach((item, idx) => {
    if (item.quantity && !item.name) {
      item.name = `Suspended Item ${idx + 1}`;
    }
  });

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
  if (/^1-4\s+FLR$/i.test(line)) return true;
  if (/^Suspended\s+Work$/i.test(line) && line.length < 20) return true;
  if (/^Schedule|^Item\s*$|^Description|^Unit|^Qty/i.test(line)) return true;
  
  return false;
}

/**
 * Map extracted suspended work items to sample table format.
 * @param {SuspendedWorkItem[]} extracted
 * @param {number} totalFloors
 * @returns {Array<{ id: number, item: string, unit: string, perFloorQty: number, totalFloors: number, totalQty: number, status: string, dimensions: string, specifications: string, workType: string }>}
 */
export function mapSuspendedWorkItemsToSamples(extracted, totalFloors = 1) {
  return extracted
    .filter(item => item.name || item.quantity)
    .map((item, i) => {
      const qty = parseFloat(item.quantity) || 0;
      const perFloorQty = item.floor ? qty : Math.round(qty / totalFloors) || 0;
      
      return {
        id: i + 1,
        item: item.name || `Suspended Item ${i + 1}`,
        unit: item.unit || 'Nos',
        perFloorQty: perFloorQty,
        totalFloors: totalFloors,
        totalQty: perFloorQty * totalFloors,
        status: item.status || 'Suspended',
        dimensions: item.dimensions || '',
        specifications: item.specifications || '',
        workType: 'Suspended',
      };
    });
}
