
const fs = require('fs');
const path = require('path');

const files = [
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/PurchaseRequests.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/BOQ.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/VendorComparison.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Samples.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Returns.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/MIR.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/MER.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/MAS.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/ITR.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Documents.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Consumption.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Challans.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Billing.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/AuditLogs.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Reports.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/ProjectSelection.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/StockTransfers.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/StockAreas.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Vendors.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/PurchaseOrders.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Materials.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Dashboard.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/pages/Projects.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/components/VendorComparison.jsx',
'/Users/devangsonawane/Ethernet-CRM-pr-executive-management/client/src/components/ui/data-table.jsx'
];

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('<Card') && !content.includes('import { Card') && !content.includes('import {Card') && !content.includes('import {  Card')) {
      console.log(`Missing Card import in: ${file}`);
    }
  } catch (err) {
    console.error(`Error reading ${file}: ${err.message}`);
  }
});
