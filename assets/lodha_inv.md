Lodha      <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tax Invoice - Hira (HGP Community)</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; background: #f4f4f4; color: #000; }
  .page { width: 210mm; margin: 10px auto; padding: 8mm; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.15); }
  .no-print { text-align:center; padding:10px; background:#333; color:#fff; font-size:13px; }
  .no-print button { padding:8px 24px; font-size:13px; cursor:pointer; background:#fff; border:none; border-radius:4px; font-weight:bold; }

  .header { display:flex; justify-content:space-between; align-items:flex-start; border:1.5px solid #000; padding:8px 10px; }
  .company-name { font-size:28px; font-weight:bold; letter-spacing:1px; }
  .company-sub { font-size:10px; margin-top:3px; line-height:1.6; }
  .company-sub a { color:#000; text-decoration:underline; }
  .logo-oval { width:68px; height:38px; background:#8a9a5b; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-style:italic; font-size:20px; font-weight:bold; font-family:Georgia,serif; }

  .row3 { display:grid; grid-template-columns:1fr 1fr 160px; border:1.5px solid #000; border-top:none; }
  .row3 > div { padding:4px 8px; }
  .row3 > div:not(:last-child) { border-right:1px solid #000; }

  .inv-title { text-align:center; font-size:17px; font-weight:bold; border:1.5px solid #000; border-top:none; padding:5px; }

  .meta2col { display:grid; grid-template-columns:1fr 1fr; border:1.5px solid #000; border-top:none; }
  .meta2col > div { padding:5px 8px; }
  .meta2col > div:first-child { border-right:1px solid #000; }
  .meta-row { display:flex; gap:4px; padding:1px 0; font-size:10.5px; }
  .ml { font-weight:bold; min-width:115px; }

  .parties { display:grid; grid-template-columns:1fr 1fr; border:1.5px solid #000; border-top:none; }
  .party { padding:5px 8px; }
  .party:first-child { border-right:1px solid #000; }
  .ph { font-weight:bold; text-align:center; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:4px; background:#f5f5f5; }

  .ref-bar { display:grid; grid-template-columns:110px 1fr 55px 110px 50px 1fr; border:1.5px solid #000; border-top:none; }
  .ref-bar > div { padding:3px 6px; }
  .ref-bar > div:not(:last-child) { border-right:1px solid #000; }
  .ref-hd { font-weight:bold; background:#f0f0f0; }

  .svc-bar { border:1.5px solid #000; border-top:none; padding:3px 8px; font-weight:bold; background:#fafafa; }

  table { width:100%; border-collapse:collapse; border:1.5px solid #000; border-top:none; font-size:10px; }
  th { background:#e8e8e8; font-weight:bold; text-align:center; padding:4px 5px; border:1px solid #000; }
  td { padding:3px 5px; border:1px solid #000; vertical-align:middle; }
  td.c { text-align:center; } td.r { text-align:right; }
  tr.foot-row td { font-weight:bold; background:#f0f0f0; font-size:11px; }

  .summary { display:grid; grid-template-columns:1fr 260px; border:1.5px solid #000; border-top:none; }
  .sum-left { padding:6px 8px; border-right:1px solid #000; }
  .sum-right { padding:5px 8px; }
  .arow { display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px dotted #bbb; font-size:10.5px; }
  .arow:last-child { border-bottom:none; }
  .arow.b { font-weight:bold; }
  .arow.big { font-weight:bold; font-size:12px; border-top:2px solid #000; padding-top:4px; margin-top:2px; }

  .footer { display:grid; grid-template-columns:1fr 1fr; border:1.5px solid #000; border-top:none; }
  .foot-l { padding:6px 8px; border-right:1px solid #000; font-size:9px; line-height:1.5; }
  .foot-r { padding:8px 10px; text-align:right; font-size:11px; }

  @media print { .no-print { display:none; } body { background:#fff; } .page { box-shadow:none; margin:0; } }
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">🖨️ Print / Save as PDF</button> &nbsp; Invoice: Hira — HGP Community Pvt. Ltd.</div>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">Madhuram Enterprises</div>
      <div class="company-sub">
        401, SUJATA BLDG, RAM NAGAR, OPP PARWANA BLDG, BORIVALI WEST. MUMBAI – 400092<br>
        Cell no. <a href="tel:+919819408257">+919819408257</a>, &nbsp;Email Id <a href="mailto:manish.plumbing@gmail.com">manish.plumbing@gmail.com</a><br>
        Website: <a href="#">www.madhuramrealtors.com</a>
      </div>
    </div>
    <div class="logo-oval">mε</div>
  </div>

  <!-- GSTIN / PAN / Copy -->
  <div class="row3">
    <div><strong>GSTIN: 27AESPN7117D1ZA</strong></div>
    <div><strong>PAN NO.: AESPN7117D</strong></div>
    <div style="text-align:right;"><strong>ORIGINAL FOR RECEIPENT</strong></div>
  </div>

  <!-- Title -->
  <div class="inv-title">TAX INVOICE</div>

  <!-- Meta -->
  <div class="meta2col">
    <div>
      <div class="meta-row"><span class="ml">Invoice No</span><span>: EHC/FF/1</span></div>
      <div class="meta-row"><span class="ml">Invoice date</span><span>: 17.4.2025</span></div>
      <div class="meta-row"><span class="ml">Reverse Charge (Y/N)</span><span>: N</span></div>
      <div class="meta-row"><span class="ml">State</span><span>: MAHARASHTRA &nbsp;&nbsp; Code: 27</span></div>
    </div>
    <div>
      <div class="meta-row"><span class="ml">PF NO</span><span>: KDMAL1528370000</span></div>
      <div class="meta-row"><span class="ml">ESIC NO</span><span>: 35000379650001009</span></div>
      <div class="meta-row"><span class="ml">PTR NO</span><span>: 27501078216P</span></div>
      <div class="meta-row"><span class="ml">MLWF NO</span><span>: MUMUMM000664</span></div>
    </div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div class="party">
      <div class="ph">Bill to Party</div>
      <div><strong>Co A/C Name:</strong> HGP COMMUNITY PVT. LTD.</div>
      <div style="margin-top:3px;"><strong>Address:</strong> Olympia, Central Avenue, Hiranandani Business Park, Powai, Mumbai 400 076</div>
      <div style="margin-top:3px;"><strong>GSTIN:</strong> 27AADCH8389P1ZL</div>
      <div><strong>State:</strong> Maharashtra &nbsp;&nbsp;<strong>Code:</strong> 27</div>
    </div>
    <div class="party">
      <div class="ph">Ship to Party / Site</div>
      <div><strong>Co A/C Name:</strong></div>
      <div style="margin-top:3px;"><strong>Address:</strong></div>
      <div style="margin-top:3px;"><strong>GSTIN:</strong></div>
      <div><strong>State:</strong> Maharashtra &nbsp;&nbsp;<strong>Code:</strong> 27</div>
    </div>
  </div>

  <!-- Reference bar -->
  <div class="ref-bar">
    <div class="ref-hd">BUILDING NAME</div>
    <div><strong>EMPRESS HILL C WING</strong></div>
    <div class="ref-hd">Reference</div>
    <div><strong>RA No. 1</strong> &nbsp; Work</div>
    <div class="ref-hd">WO NO</div>
    <div>4700157329 DT 27.3.2025 &nbsp;|&nbsp; FIRE FIGHTING WORKS</div>
  </div>

  <!-- Service dates -->
  <div class="svc-bar">SERVICE DATE FROM - 1.2.2025 TO 28.2.2025</div>

  <!-- Invoice Table -->
  <table>
    <thead>
      <tr>
        <th rowspan="2">S. No.</th>
        <th rowspan="2">Goods / Service Description</th>
        <th rowspan="2">SAC Code</th>
        <th rowspan="2">Value of Supply</th>
        <th rowspan="2">Discount</th>
        <th rowspan="2">Taxable Value</th>
        <th colspan="2">CGST</th>
        <th colspan="2">SGST</th>
        <th rowspan="2">Total</th>
      </tr>
      <tr>
        <th>Rate</th><th>Amount</th>
        <th>Rate</th><th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="c">1</td>
        <td>Works contracts service FIRE FIGHTING works</td>
        <td class="c">995461</td>
        <td class="r">3,25,823.19</td>
        <td class="c">0</td>
        <td class="r">3,25,823.19</td>
        <td class="c">9%</td>
        <td class="r">29,324.09</td>
        <td class="c">9%</td>
        <td class="r">29,324.09</td>
        <td class="r">3,84,471.36</td>
      </tr>
      <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody>
    <tfoot>
      <tr class="foot-row">
        <td colspan="2">Total</td>
        <td></td>
        <td class="r">3,25,823.19</td>
        <td class="c">-</td>
        <td class="r">3,25,823.19</td>
        <td></td>
        <td class="r">29,324.09</td>
        <td></td>
        <td class="r">29,324.09</td>
        <td class="r">3,84,471.36</td>
      </tr>
    </tfoot>
  </table>

  <!-- Summary -->
  <div class="summary">
    <div class="sum-left">
      <div style="font-weight:bold; margin-bottom:4px;">Total Invoice amount in words</div>
      <div>RUPEES THREE LAKH EIGHTY FOUR THOUSAND FOUR HUNDRED AND SEVENTY ONE ONLY</div>
      <div style="margin-top:10px; font-weight:bold;">Bank Details</div>
      <table style="border:none; margin-top:4px; font-size:10px;">
        <tr><td style="border:none; padding:1px 0; min-width:100px;"><strong>Bank Name:</strong></td><td style="border:none;"></td></tr>
        <tr><td style="border:none; padding:1px 0;"><strong>Account No:</strong></td><td style="border:none;"></td></tr>
        <tr><td style="border:none; padding:1px 0;"><strong>IFSC Code:</strong></td><td style="border:none;"></td></tr>
        <tr><td style="border:none; padding:1px 0;"><strong>Branch:</strong></td><td style="border:none;"></td></tr>
      </table>
    </div>
    <div class="sum-right">
      <div class="arow b"><span>Total Amount before Tax</span><span>3,25,823.19</span></div>
      <div class="arow"><span>Add: CGST</span><span>29,324.09</span></div>
      <div class="arow"><span>Add: SGST</span><span>29,324.09</span></div>
      <div class="arow"><span>ROUND OFF</span><span>-0.36</span></div>
      <div class="arow big"><span>Total Amount after Tax:</span><span>3,84,471.00</span></div>
      <div class="arow"><span>GST on Reverse Charge</span><span>0</span></div>
      <div class="arow"><span>E &amp; O.E</span><span></span></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="foot-l">
      <strong>Terms and Conditions:-</strong><br>
      1} This Invoice Should be Certified within 7 days of Invoice Date and Corrections should be intimated to us, In case not informed This Invoice Value will be considered as final and uploaded in GSTN Returns.<br>
      02} In the event full payment is not made against the above invoice within 30 days from the date of certification / Tax Invoice, whichever is earlier, interest @ 24% p.a. shall be payable on the outstanding amount.<br>
      03} This invoice is subject to Mumbai Jurisdiction Only.
    </div>
    <div class="foot-r">
      For,<br>
      <strong>M/S. MADHURAM ENTERPRISES</strong>
      <div style="margin-top:50px; font-weight:bold;">AUTHORISED SIGNATORY</div>
    </div>
  </div>

</div>
</body>
</html>