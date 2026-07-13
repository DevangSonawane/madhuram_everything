import nodemailer from 'nodemailer';

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).trim().toLowerCase() === 'true';
};

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-IN');
};

const formatPrNumber = (pr = {}) => {
  const sourceDate = pr.date || pr.created_at || new Date().toISOString();
  const parsed = new Date(sourceDate);
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const datePart = Number.isNaN(parsed.getTime()) ? '0000-00-00' : `${yyyy}-${mm}-${dd}`;
  const sequence = pr.pr_id || pr.id || '0';
  const project = pr.project_id || pr.projectId || '0';
  return `PR-${datePart}-${sequence}-${project}`;
};

const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = toBool(process.env.SMTP_SECURE, false);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const rejectUnauthorized = toBool(process.env.SMTP_REJECT_UNAUTHORIZED, true);

  if (!user || !pass) {
    return { error: 'SMTP_USER and SMTP_PASS are required to send email.' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  });

  return { transporter };
};

const normalizeVendors = (vendors) => {
  if (!Array.isArray(vendors)) return [];
  return vendors
    .map((vendor) => ({
      vendor_id: vendor.vendor_id ?? vendor.id ?? null,
      vendor_name: String(vendor.vendor_name || vendor.vendor_company_name || 'Vendor').trim(),
      vendor_email: String(vendor.vendor_email || '').trim(),
    }))
    .filter((vendor) => vendor.vendor_email);
};

const parseJsonField = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

export const sendPrEmail = async (req, res) => {
  try {
    const pr = parseJsonField(req.body?.pr, {});
    const vendors = normalizeVendors(parseJsonField(req.body?.vendors, []));
    const customRemarksRaw = parseJsonField(req.body?.custom_remarks, '');
    const customRemarks = String(customRemarksRaw || '').trim();

    if (!pr || typeof pr !== 'object' || Object.keys(pr).length === 0) {
      return res.status(400).json({ error: 'pr details are required' });
    }
    if (vendors.length === 0) {
      return res.status(400).json({ error: 'Select at least one vendor with a valid email' });
    }

    const { transporter, error } = createTransporter();
    if (error) {
      return res.status(500).json({ error });
    }

    const prNumber = formatPrNumber(pr);
    const items = Array.isArray(pr.items) ? pr.items : [];
    const itemLines = items.length
      ? items.map((item, index) => `${index + 1}. ${item.material_description || '-'} | Qty: ${item.req_qty ?? '-'} ${item.unit || ''}`.trim())
      : ['No item rows available.'];

    const subject = `Purchase Request ${prNumber}`;
    const text = [
      'Hello,',
      '',
      'Please find the Purchase Request details below:',
      `PR Number: ${prNumber}`,
      `Project: ${pr.project_name || '-'}`,
      `Work Order: ${pr.workorder_no || '-'}`,
      `Location: ${pr.location || '-'}`,
      `Date: ${formatDate(pr.date)}`,
      `Urgency: ${pr.urgency || '-'}`,
      `MIR Ref: ${pr.mirno || '-'}`,
      '',
      'Items:',
      ...itemLines,
      '',
      `Remarks: ${pr.remarks || '-'}`,
      `Additional Remarks: ${customRemarks || '-'}`,
      '',
      'Regards,',
      process.env.SMTP_FROM_NAME || 'Madhuram Enterprises',
    ].join('\n');

    const htmlItems = itemLines.map((line) => `<li>${line}</li>`).join('');
    const html = `
      <p>Hello,</p>
      <p>Please find the Purchase Request details below:</p>
      <p>
        <strong>PR Number:</strong> ${prNumber}<br/>
        <strong>Project:</strong> ${pr.project_name || '-'}<br/>
        <strong>Work Order:</strong> ${pr.workorder_no || '-'}<br/>
        <strong>Location:</strong> ${pr.location || '-'}<br/>
        <strong>Date:</strong> ${formatDate(pr.date)}<br/>
        <strong>Urgency:</strong> ${pr.urgency || '-'}<br/>
        <strong>MIR Ref:</strong> ${pr.mirno || '-'}
      </p>
      <p><strong>Items:</strong></p>
      <ol>${htmlItems}</ol>
      <p><strong>Remarks:</strong> ${pr.remarks || '-'}</p>
      <p><strong>Additional Remarks:</strong> ${customRemarks || '-'}</p>
      <p>Regards,<br/>${process.env.SMTP_FROM_NAME || 'Madhuram Enterprises'}</p>
    `;

    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || 'Madhuram Enterprises';
    const to = vendors.map((vendor) => `${vendor.vendor_name} <${vendor.vendor_email}>`).join(', ');
    const attachment = req.file
      ? [{
          filename: req.file.originalname || 'attachment',
          content: req.file.buffer,
          contentType: req.file.mimetype || undefined,
        }]
      : undefined;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html,
      attachments: attachment,
      cc: process.env.SMTP_CC_EMAIL || undefined,
      bcc: process.env.SMTP_BCC_EMAIL || undefined,
    });

    return res.status(200).json({
      success: true,
      message: `Email sent to ${vendors.length} vendor(s).`,
      data: {
        messageId: info.messageId,
        accepted: info.accepted || [],
        rejected: info.rejected || [],
        vendorCount: vendors.length,
      },
    });
  } catch (error) {
    console.error('Send PR email error:', error);
    return res.status(500).json({ error: 'Failed to send PR email' });
  }
};
