Hira    <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tax Invoice - Lodha (Cowtown / Anjur Casa Eden C)</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial, sans-serif; font-size:11px; background:#f4f4f4; color:#000; }
  .page { width:210mm; margin:10px auto; padding:8mm; background:#fff; box-shadow:0 2px 10px rgba(0,0,0,0.15); }
  .no-print { text-align:center; padding:10px; background:#1a3a5c; color:#fff; font-size:13px; }
  .no-print button { padding:8px 24px; font-size:13px; cursor:pointer; background:#fff; border:none; border-radius:4px; font-weight:bold; color:#1a3a5c; }

  .header { display:flex; justify-content:space-between; align-items:flex-start; border:1.5px solid #000; padding:8px 10px; }
  .company-name { font-size:28px; font-weight:bold; letter-spacing:1px; }
  .company-sub { font-size:10px; margin-top:3px; line-height:1.6; }
  .company-sub a { color:#000; text-decoration:underline; }
  .logo-oval { width:68px; height:38px; background:#8a9a5b; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-style:italic; font-size:20px; font-weight:bold; font-family:Georgia,serif; }

  .inv-title { text-align:center; font-size:17px; font-weight:bold; border:1.5px solid #000; border-top:none; padding:5px; letter-spacing:2px; }

  /* Two-column meta grid */
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; border:1.5px solid #000; border-top:none; }
  .meta-col { padding:5px 8px; }
  .meta-col:first-child { border-right:1px solid #000; }
  .mrow { display:flex; gap:6px; padding:1.5px 0; font-size:10.5px; }
  .ml { font-weight:bold; min-width:110px; }

  /* Buyer/receiver section */
  .buyer-section { border:1.5px solid #000; border-top:none; }
  .buyer-header { display:grid; grid-template-columns:1fr 1fr; background:#f0f0f0; }
  .buyer-header > div { padding:3px 8px; font-weight:bold; }
  .buyer-header > div:first-child { border-right:1px solid #000; }
  .buyer-body { display:grid; grid-template-columns:1fr 1fr; }
  .buyer-body > div { padding:5px 8px; }
  .buyer-body > div:first-child { border-right:1px solid #000; }

  /* WO / Plant / Bill row */
  .ref-bar { display:grid; grid-template-columns:90px 1fr 90px 1fr; border:1.5px solid #000; border-top:none; }
  .ref-bar > div { padding:3px 7px; }
  .ref-bar > div:not(:last-child) { border-right:1px solid #000; }
  .ref-hd { font-weight:bold; background:#f0f0f0; }

  table {
    width:100%;
    /* Use separate borders to avoid “double line” artifacts in html2canvas->PDF rendering */
    border-collapse:separate;
    border-spacing:0;
    border:1.5px solid #000; border-top:none; font-size:10px;
  }
  th {
    background:#e8e8e8; font-weight:bold; text-align:center; padding:4px 5px;
    border:0; border-right:1px solid #000; border-bottom:1px solid #000;
  }
  td {
    padding:3px 5px; vertical-align:middle;
    border:0; border-right:1px solid #000; border-bottom:1px solid #000;
  }
  td.c { text-align:center; } td.r { text-align:right; }
  tr.foot-row td { font-weight:bold; background:#f0f0f0; font-size:11px; }
  /* Left edge borders */
  thead tr th:first-child, tbody tr td:first-child, tfoot tr td:first-child { border-left:1px solid #000; }

  .summary { display:grid; grid-template-columns:1fr 240px; border:1.5px solid #000; border-top:none; }
  .sum-left { padding:6px 8px; border-right:1px solid #000; }
  .sum-right { padding:5px 8px; }
  .arow { display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px dotted #bbb; font-size:10.5px; }
  .arow:last-child { border-bottom:none; }
  .arow.b { font-weight:bold; }
  .arow.big { font-weight:bold; font-size:13px; border-top:2px solid #000; padding-top:4px; margin-top:3px; }

  .footer { display:grid; grid-template-columns:1fr 1fr; border:1.5px solid #000; border-top:none; }
  .foot-l { padding:6px 8px; border-right:1px solid #000; font-size:9.5px; line-height:1.5; }
  .foot-r { padding:8px 10px; text-align:right; }

  .disclaimer { border:1.5px solid #000; border-top:none; padding:5px 8px; font-size:9px; color:#b00; line-height:1.5; }

  @media print { .no-print { display:none; } body { background:#fff; } .page { box-shadow:none; margin:0; } }
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">🖨️ Print / Save as PDF</button> &nbsp; Invoice: Lodha — Cowtown Infotech / Anjur Casa Eden C</div>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">Madhuram Enterprises</div>
      <div class="company-sub">
        SHOP NO – S/2, FLOOR NO 2, X TH CENTRAL MAL, MAHAVIR NAGAR, KANDIVALI WEST. MUMBAI – 400 067. MAHARASHTRA<br>
        Cell no. <a href="tel:+919819408257">+919819408257</a>, &nbsp;Email Id <a href="mailto:manish.plumbing@gmail.com">manish.plumbing@gmail.com</a><br>
        Website: <a href="#">www.madhuramrealtors.com</a>
      </div>
    </div>
    <div class="logo-oval">mε</div>
  </div>

  <!-- Title -->
  <div class="inv-title">TAX INVOICE</div>

  <!-- Meta grid -->
  <div class="meta-grid">
    <div class="meta-col">
      <div class="mrow"><span class="ml">Invoice No</span><span>: ME/EDENC-PL/3</span></div>
      <div class="mrow"><span class="ml">Invoice Date</span><span>: 6.3.2024</span></div>
      <div class="mrow"><span class="ml">GSTIN</span><span>: 27AESPN7117D1ZA</span></div>
      <div class="mrow"><span class="ml">Address</span><span>: SHOP NO – S/2, FLOOR NO 2, X TH CENTRAL MAL, MAHAVIR NAGAR, KANDIVALI WEST. MUMBAI – 400 067</span></div>
    </div>
    <div class="meta-col">
      <div class="mrow"><span class="ml">Place of Supply</span><span>: EDEN C WING, ANJUR UPPER THANE</span></div>
      <div style="margin-top:4px; font-weight:bold; font-size:10px;">Buyer's Details</div>
      <div class="mrow"><span class="ml">Name</span><span>: COWTOWN INFOTECH SERVICES PRIVATE LIMITED</span></div>
      <div class="mrow"><span class="ml">Address</span><span>: 412, Floor-4, 17G Vardhaman Chamber, Cawasji Patel Rd, Horniman Circle, Fort, Mumbai – 400001</span></div>
      <div class="mrow"><span class="ml">State Name</span><span>: MAHARASHTRA &nbsp; State Code: 27</span></div>
      <div class="mrow"><span class="ml">GSTIN</span><span>: 27AAACC4889L1Z4</span></div>
    </div>
  </div>

  <!-- WO / Plant / Bill row -->
  <div class="ref-bar">
    <div class="ref-hd">WO No</div>
    <div>6100023272 DT 29.3.2023</div>
    <div class="ref-hd">PLANT NAME</div>
    <div>ANJUR CASA EDEN C</div>
  </div>
  <div class="ref-bar" style="border-top:none;">
    <div class="ref-hd">BILL NO</div>
    <div>RA 3</div>
    <div class="ref-hd">Address</div>
    <div>ANJUR CASA EDEN C</div>
  </div>

  <!-- Invoice Table -->
  <table>
    <thead>
      <tr>
        <th rowspan="2">SN</th>
        <th rowspan="2">Description of Service / Goods</th>
        <th rowspan="2">SAC / HSN Code</th>
        <th rowspan="2">UOM</th>
        <th rowspan="2">Qty</th>
        <th rowspan="2">Rate</th>
        <th rowspan="2">Total Value of Goods/Services</th>
        <th rowspan="2">Discount if Any</th>
        <th rowspan="2">Taxable Value</th>
        <th colspan="2">CGST</th>
        <th colspan="2">SGST</th>
        <th colspan="2">IGST</th>
        <th colspan="2">Cess</th>
      </tr>
      <tr>
        <th>Rate</th><th>Amt.</th>
        <th>Rate</th><th>Amt.</th>
        <th>Rate</th><th>Amt.</th>
        <th>Rate</th><th>Amt.</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="c">1</td>
        <td>PLUMBING WORKS</td>
        <td class="c">998322</td>
        <td class="c">—</td>
        <td class="c">—</td>
        <td class="c">—</td>
        <td class="r">6,88,019.26</td>
        <td class="c">—</td>
        <td class="r">6,88,019.26</td>
        <td class="c">9%</td>
        <td class="r">61,921.73</td>
        <td class="c">9%</td>
        <td class="r">61,921.73</td>
        <td class="c">-</td>
        <td class="c">-</td>
        <td class="c">-</td>
        <td class="c">-</td>
      </tr>
      <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody>
    <tfoot>
      <tr class="foot-row">
        <td colspan="3">Total</td>
        <td></td><td></td><td></td>
        <td class="r">6,88,019.26</td>
        <td></td>
        <td class="r">6,88,019.26</td>
        <td></td>
        <td class="r">61,921.73</td>
        <td></td>
        <td class="r">61,921.73</td>
        <td></td><td></td><td></td><td></td>
      </tr>
    </tfoot>
  </table>

  <!-- Summary -->
  <div class="summary">
    <div class="sum-left">
      <div style="font-weight:bold; margin-bottom:3px;">Total Invoice Value (In Words)</div>
      <div>EIGHT LAKH ELEVEN THOUSAND EIGHT HUNDRED AND SIXTY THREE ONLY</div>
      <div style="margin-top:10px; font-weight:bold; margin-bottom:3px;">Total Invoice Value (In Figure)</div>
      <div style="font-size:14px; font-weight:bold;">₹ 8,11,863</div>
      <div style="margin-top:10px; font-size:9px;">
        <strong>Declaration:</strong><br>
        Electronic Reference Number: _________________ &nbsp;&nbsp; Date: _________________
      </div>
    </div>
    <div class="sum-right">
      <div class="arow b"><span>Taxable Value</span><span>6,88,019.26</span></div>
      <div class="arow"><span>Add: CGST @ 9%</span><span>61,921.73</span></div>
      <div class="arow"><span>Add: SGST @ 9%</span><span>61,921.73</span></div>
      <div class="arow"><span>Add: IGST</span><span>—</span></div>
      <div class="arow"><span>Add: Cess</span><span>—</span></div>
      <div class="arow big"><span>Total Invoice Value</span><span>8,11,863</span></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="foot-l">
      <strong>For MADHURAM ENTERPRISES</strong><br><br><br>
      <div style="margin-top:30px; font-weight:bold;">Authorised Signatory</div>
    </div>
    <div class="foot-r" style="font-size:10px; line-height:1.6;">
      <strong>For MADHURAM ENTERPRISES</strong><br><br><br>
      <div style="margin-top:30px; font-weight:bold;">Authorised Signatory</div>
    </div>
  </div>

  <!-- Disclaimer -->
  <div class="disclaimer">
    (For Services – Two copies of invoices to be issued (i) ORIGINAL FOR RECIPIENT &amp; (ii) DUPLICATE FOR SUPPLIER<br>
    &amp; For Goods – Three copies of invoices to be issued (i) ORIGINAL FOR RECIPIENT, (ii) DUPLICATE FOR TRANSPORTER &amp; (iii) TRIPLICATE FOR SUPPLIER)
  </div>

</div>
</body>
</html>
