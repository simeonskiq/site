export function getPublicBaseUrl(): string {
  return (
    process.env['PUBLIC_SITE_URL'] ||
    (process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : '') ||
    ''
  );
}

export function normalizeImageUrl(input?: string | null, baseUrl?: string): string | null {
  if (!input) return null;
  let val = input;
  // Convert ../../images/... -> /images/...
  const idx = val.indexOf('/images/');
  if (idx >= 0) val = val.slice(idx);
  if (val.startsWith('../../images/')) val = val.replace('../../images/', '/images/');
  if (val.startsWith('../images/')) val = val.replace('../images/', '/images/');
  // If already absolute URL, keep it.
  if (/^https?:\/\//i.test(val)) return val;
  // If we have a base URL, make it absolute (best for email clients).
  if (baseUrl && val.startsWith('/')) return `${baseUrl}${val}`;
  return val;
}

export function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderBrandedEmail(options: {
  title: string;
  preheader?: string;
  bookingCode?: string | null;
  bodyHtml: string;
  footerText?: string;
  logoUrl?: string | null;
}): string {
  const {
    title,
    preheader,
    bookingCode,
    bodyHtml,
    footerText = 'Aurora Hotel',
    logoUrl
  } = options;

  const hiddenPreheader = (preheader || '').trim();
  const bookingLine = bookingCode
    ? `<div style="margin-top:10px;color:#6b7280;font-size:12px;">Booking ID: <span style="font-weight:800;color:#d97706;letter-spacing:1px;">${escapeHtml(bookingCode)}</span></div>`
    : '';

  return `
  <div style="margin:0;padding:0;background:#f6f7fb;">
    ${hiddenPreheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(hiddenPreheader)}</div>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:26px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td align="center" style="padding:26px 22px 18px 22px;border-bottom:1px solid #eef2f7;">
                ${logoUrl ? `<img src="${logoUrl}" alt="Aurora Hotel" height="78" style="display:block;border:0;outline:none;margin:0 auto;">` : `<div style="font-weight:900;font-size:22px;color:#111827;">Aurora Hotel</div>`}
                ${bookingLine}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 22px 6px 22px;">
                <div style="font-size:26px;line-height:32px;font-weight:900;color:#111827;margin:0;">${escapeHtml(title)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 22px 22px 22px;color:#111827;font-size:14px;line-height:20px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 22px;background:#0f172a;color:#cbd5e1;font-size:12px;">
                ${escapeHtml(footerText)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim();
}


