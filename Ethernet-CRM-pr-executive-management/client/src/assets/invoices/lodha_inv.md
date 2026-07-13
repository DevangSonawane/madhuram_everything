<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tax Invoice - Lodha (Anjur Casa Eden C)</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial, sans-serif; font-size:11px; background:#f4f4f4; color:#000; }
  .page { width:210mm; margin:10px auto; padding:8mm; background:#fff; box-shadow:0 2px 10px rgba(0,0,0,0.15); }
  .no-print { text-align:center; padding:10px; background:#1a3a5c; color:#fff; font-size:13px; }
  .no-print button { padding:8px 24px; font-size:13px; cursor:pointer; background:#fff; border:none; border-radius:4px; font-weight:bold; color:#1a3a5c; }

  /* ── HEADER ── */
  .header {
    display:flex; justify-content:space-between; align-items:flex-start;
    border:1.5px solid #000; padding:8px 10px;
  }
  .company-name { font-size:26px; font-weight:bold; letter-spacing:1px; }
  .company-sub  { font-size:9.5px; margin-top:4px; line-height:1.7; }
  .company-sub a { color:#000; text-decoration:underline; }
  .logo-oval {
    width:66px; height:36px; background:#8a9a5b; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    color:#fff; font-style:italic; font-size:19px; font-weight:bold; font-family:Georgia,serif;
    flex-shrink:0;
  }

  /* ── TAX INVOICE TITLE ── */
  .inv-title {
    text-align:center; font-size:17px; font-weight:bold;
    border:1.5px solid #000; border-top:none; padding:5px; letter-spacing:3px;
  }

  /* ── META SECTION (2 col) ── */
  .meta-wrap {
    display:grid; grid-template-columns:1fr 1fr;
    border:1.5px solid #000; border-top:none;
  }
  .meta-left  { padding:5px 8px; border-right:1px solid #000; }
  .meta-right { padding:5px 8px; }
  .mrow { display:flex; padding:1.5px 0; font-size:10.5px; }
  .ml   { font-weight:bold; min-width:105px; flex-shrink:0; }
  .sec-hd { font-weight:bold; font-size:10.5px; margin:5px 0 2px; border-bottom:1px solid #ccc; padding-bottom:2px; }

  /* ── REF BARS (WO / Plant / Bill) ── */
  .ref-bar {
    display:grid; grid-template-columns:80px 1fr 90px 1fr;
    border:1.5px solid #000; border-top:none;
  }
  .ref-bar > div { padding:3px 7px; font-size:10.5px; }
  .ref-bar > div:not(:last-child) { border-right:1px solid #000; }
  .ref-hd { font-weight:bold; background:#f0f0f0; }

  /* ── INVOICE TABLE ── */
  table {
    width:100%;
    /* Use separate borders to avoid “double line” artifacts in html2canvas->PDF rendering */
    border-collapse:separate;
    border-spacing:0;
    border:1.5px solid #000; border-top:none; font-size:9.5px;
  }
  th {
    background:#e8e8e8; font-weight:bold; text-align:center;
    padding:3px 3px;
    border:0;
    border-right:1px solid #000;
    border-bottom:1px solid #000;
    font-size:9px; line-height:1.3;
  }
  td {
    padding:3px 4px;
    border:0;
    border-right:1px solid #000;
    border-bottom:1px solid #000;
    vertical-align:middle;
  }
  td.c { text-align:center; }
  td.r { text-align:right; }
  tr.foot-row td { font-weight:bold; background:#f0f0f0; font-size:10px; }
  /* Left edge borders */
  thead tr th:first-child, tbody tr td:first-child, tfoot tr td:first-child { border-left:1px solid #000; }

  /* ── SUMMARY SECTION ── */
  .summary {
    display:grid; grid-template-columns:1fr 220px;
    border:1.5px solid #000; border-top:none;
  }
  .sum-left  { padding:7px 9px; border-right:1px solid #000; }
  .sum-right { padding:6px 8px; }

  .arow {
    display:flex; justify-content:space-between;
    padding:2px 0; border-bottom:1px dotted #bbb; font-size:10.5px;
  }
  .arow:last-child { border-bottom:none; }
  .arow.b   { font-weight:bold; }
  .arow.big {
    font-weight:bold; font-size:12px;
    border-top:2px solid #000; padding-top:5px; margin-top:3px;
  }

  /* ── FOOTER ── */
  .footer {
    display:grid; grid-template-columns:1fr 1fr;
    border:1.5px solid #000; border-top:none; min-height:80px;
  }
  .foot-l { padding:8px 10px; border-right:1px solid #000; font-size:10px; }
  .foot-r { padding:8px 10px; text-align:right; font-size:10px; }

  /* ── RED DISCLAIMER ── */
  .disclaimer {
    border:1.5px solid #000; border-top:none;
    padding:5px 8px; font-size:9px; color:#cc0000; line-height:1.6;
  }

  @media print {
    .no-print { display:none; }
    body { background:#fff; }
    .page { box-shadow:none; margin:0; padding:6mm; }
  }
</style>
</head>
<body>

<div class="no-print">
  <button onclick="window.print()">🖨️ Print / Save as PDF</button>
  &nbsp; Invoice: Lodha — Cowtown Infotech / Anjur Casa Eden C
</div>

<div class="page">

  <!-- ══ HEADER ══ -->
  <div class="header">
    <div>
      <div class="company-name">Madhuram Enterprises</div>
      <div class="company-sub">
        SHOP NO – S/2, FLOOR NO 2, X TH CENTRAL MAL, MAHAVIR NAGAR, KANDIVALI WEST. MUMBAI – 400 067. MAHARASHTRA<br>
        &nbsp;&nbsp;&nbsp;&nbsp;Cell no. <a href="tel:+919819408257">+919819408257</a>,
        Email Id <a href="mailto:manish.plumbing@gmail.com">manish.plumbing@gmail.com</a><br>
        Website: <a href="#">www.madhuramrealtors.com</a>
      </div>
    </div>
    <div class="logo-oval">mε</div>
  </div>

  <!-- ══ TITLE ══ -->
  <div class="inv-title">TAX INVOICE</div>

  <!-- ══ META ══ -->
  <div class="meta-wrap">

    <!-- LEFT: Invoice details + Buyer's Details -->
    <div class="meta-left">
      <div class="mrow"><span class="ml">Invoice No</span><span>ME/EDENC-PL/3</span></div>
      <div class="mrow"><span class="ml">Invoice Date</span><span>6.3.2024</span></div>
      <div class="mrow"><span class="ml">GSTIN</span><span>27AESPN7117D1ZA</span></div>
      <div class="mrow" style="margin-top:2px;">
        <span class="ml">Address</span>
        <span>SHOP NO – S/2, FLOOR NO 2, X TH CENTRAL MAL,<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        MAHAVIR NAGAR, KANDIVALI WEST.<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        MUMBAI – 400 067. MAHARASHTRA</span>
      </div>

      <div class="sec-hd" style="margin-top:7px;">Buyer's Details</div>
      <div class="mrow"><span class="ml">Name</span><span>COWTOWN INFOTECH SERVICES PRIVATE LIMITED</span></div>
      <div class="mrow">
        <span class="ml">Address</span>
        <span>412, Floor-4, 17G Vardhaman Chamber,<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        Cawasji Patel Rd, Horniman Circle,<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        Fort, Mumbai – 400001</span>
      </div>
      <div class="mrow"><span class="ml">State Name</span><span>MAHARASHTRA</span></div>
      <div class="mrow"><span class="ml">State Code</span><span>27</span></div>
      <div class="mrow"><span class="ml">GSTIN</span><span>27AAACC4889L1Z4</span></div>
    </div>

    <!-- RIGHT: Receiver Details -->
    <div class="meta-right">
      <div class="sec-hd">Receiver Details :</div>
      <div class="mrow"><span class="ml">Name</span><span>COWTOWN INFOTECH SERVICES PRIVATE LIMITED</span></div>
      <div class="mrow"><span class="ml">Address</span><span>ANJUR CASA EDEN C</span></div>
      <div class="mrow"><span class="ml">Place of Supply</span><span>EDEN C WING, ANJUR UPPER THANE</span></div>
    </div>

  </div>

  <!-- ══ WO / PLANT NAME ══ -->
  <div class="ref-bar">
    <div class="ref-hd">WO No</div>
    <div>6100023272 DT 29.3.2023</div>
    <div class="ref-hd">PLANT NAME</div>
    <div>ANJUR CASA EDEN C</div>
  </div>

  <!-- ══ BILL NO ══ -->
  <div class="ref-bar" style="border-top:none;">
    <div class="ref-hd">BILL NO</div>
    <div>RA 3</div>
    <div class="ref-hd"></div>
    <div></div>
  </div>

  <!-- ══ INVOICE TABLE ══ -->
  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:28px;">SN</th>
        <th rowspan="2">Description of Service / Goods</th>
        <th rowspan="2">SAC / HSN Code</th>
        <th rowspan="2">UOM</th>
        <th rowspan="2">Qty</th>
        <th rowspan="2">Rate</th>
        <th rowspan="2">Total Value of Goods/ Services</th>
        <th rowspan="2">Discount if Any</th>
        <th rowspan="2">Taxable value</th>
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
        <td class="c"></td>
        <td class="c"></td>
        <td class="c"></td>
        <td class="r">6,88,019.26</td>
        <td class="c"></td>
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
      <tr><td style="height:18px;"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td style="height:18px;"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody>
    <tfoot>
      <tr class="foot-row">
        <td colspan="6" style="text-align:right; padding-right:8px;">Total</td>
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

  <!-- ══ SUMMARY ══ -->
  <div class="summary">

    <!-- LEFT: words + declaration -->
    <div class="sum-left">
      <div style="font-weight:bold; margin-bottom:3px; font-size:10.5px;">Total Invoice Value (In figure)</div>
      <div style="font-size:13px; font-weight:bold; margin-bottom:8px;">8,11,863</div>

      <div style="font-weight:bold; margin-bottom:3px; font-size:10.5px;">Total Invoice Value (In Words)</div>
      <div style="font-size:10.5px;">EIGHT LAKH ELEVEN THOUSAND EIGHT HUNDRED AND SIXTY THREE ONLY</div>

      <div style="margin-top:12px; font-size:9.5px; line-height:1.6;">
        <strong>Declaration:</strong> &nbsp; For &nbsp;<strong>MADHURAM ENTERPRISES</strong>
      </div>
      <div style="margin-top:4px; font-size:9.5px;">
        Electronic Reference Number: _________________
        &nbsp;&nbsp; Date: _________________
      </div>
    </div>

    <!-- RIGHT: amount breakdown -->
    <div class="sum-right">
      <div class="arow b"><span>Taxable Value</span><span>6,88,019.26</span></div>
      <div class="arow"><span>Add: CGST @ 9%</span><span>61,921.73</span></div>
      <div class="arow"><span>Add: SGST @ 9%</span><span>61,921.73</span></div>
      <div class="arow"><span>Add: IGST</span><span>—</span></div>
      <div class="arow"><span>Add: Cess</span><span>—</span></div>
      <div class="arow big"><span>Total Invoice Value</span><span>8,11,863</span></div>
    </div>

  </div>

  <!-- ══ FOOTER ══ -->
  <div class="footer">
    <div class="foot-l">
      <!-- left intentionally blank as per original -->
    </div>
    <div class="foot-r">
      <div>For &nbsp;<strong>MADHURAM ENTERPRISES</strong></div>
      <div style="margin-top:45px; font-weight:bold;">Authorised Signatory</div>
    </div>
  </div>

  <!-- ══ DISCLAIMER ══ -->
  <div class="disclaimer">
    (For Services – Two copies of invoices to be issued &nbsp;(i) ORIGINAL FOR RECIPIENT &amp; (ii) DUPLICATE FOR SUPPLIER<br>
    &amp; For Goods – Three copies of invoices to be issued &nbsp;(i) ORIGINAL FOR RECIPIENT, (ii) DUPLICATE FOR TRANSPORTER &amp; (iii) TRIPLICATE FOR SUPPLIER)
  </div>

</div>
</body>
</html>
