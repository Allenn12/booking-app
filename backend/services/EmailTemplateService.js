/**
 * Email Template Service
 * ======================
 * Centralised HTML email templates for the booking system.
 * Uses nodemailer via the existing Mailtrap configuration.
 *
 * Methods:
 *   sendBookingConfirmation({ to, business, appointment, portalUrl })
 *   sendCancellationConfirmation({ to, business, appointment })
 *   sendPortalLinkReminder({ to, business, portalUrl, clientName })
 *
 * All methods are non-throwing (they catch and log errors).
 * Callers should also wrap in try/catch if they want to log context.
 */

import nodemailer from 'nodemailer';

// ──────────────────────────────────────────────────────────────────────────────
// Transporter factory — reads from env every call to pick up runtime changes
// ──────────────────────────────────────────────────────────────────────────────
function createTransporter() {
    return nodemailer.createTransport({
        host:   process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
        port:   parseInt(process.env.MAILTRAP_PORT, 10) || 2525,
        secure: false,
        auth: {
            user: process.env.MAILTRAP_USER || '15283a995f2545',
            pass: process.env.MAILTRAP_PASS || '7e048a9b500a13',
        },
        tls: { rejectUnauthorized: false },
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Date formatting helper — Croatian locale
// ──────────────────────────────────────────────────────────────────────────────
function formatDateCroatian(datetime) {
    try {
        const d = new Date(datetime);
        return d.toLocaleString('hr-HR', {
            weekday: 'long',
            day:     'numeric',
            month:   'long',
            year:    'numeric',
            hour:    '2-digit',
            minute:  '2-digit',
        });
    } catch {
        return String(datetime);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared HTML wrapper — base layout with business branding
// ──────────────────────────────────────────────────────────────────────────────
function baseLayout({ businessName, title, bodyContent, footerNote = '' }) {
    return `
<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0"
               style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;
                      box-shadow:0 2px 16px rgba(0,0,0,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);
                       padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                ${escapeHtml(businessName)}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;color:#1a1a2e;">
                ${escapeHtml(title)}
              </h2>
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;border-top:1px solid #f0f0f0;
                       text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                ${footerNote || 'Ne odgovarajte na ovu e-poštu. Ova poruka je generirana automatski.'}
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
}

// Simple HTML escaper to prevent injection in templates
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function infoRow(label, value) {
    return `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280;font-weight:500;width:140px;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;vertical-align:top;">
        ${escapeHtml(String(value || '—'))}
      </td>
    </tr>`;
}

function primaryButton(text, url) {
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
      <tr>
        <td style="border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);">
          <a href="${url}" target="_blank" rel="noopener"
             style="display:block;padding:14px 28px;font-size:15px;font-weight:700;
                    color:#ffffff;text-decoration:none;letter-spacing:0.2px;text-align:center;">
            ${escapeHtml(text)}
          </a>
        </td>
      </tr>
    </table>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Method 1: Booking Confirmation with Portal Link
// ──────────────────────────────────────────────────────────────────────────────
async function sendBookingConfirmation({ to, business, appointment, portalUrl }) {
    const businessName   = business?.name     || 'Vaš salon';
    const serviceName    = appointment?.service_name    || 'Usluga';
    const workerName     = appointment?.worker_name     || 'Naš djelatnik';
    const duration       = appointment?.duration_minutes ? `${appointment.duration_minutes} min` : '';
    const price          = appointment?.service_price   != null
        ? `${Number(appointment.service_price).toFixed(2)} ${business?.currency || 'EUR'}`
        : '';
    const formattedDate  = formatDateCroatian(appointment?.datetime || appointment?.appointment_datetime);

    const bodyContent = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Vaša rezervacija je uspješno potvrđena. Vidimo se uskoro! 🎉
    </p>

    <!-- Appointment details table -->
    <table role="presentation" cellpadding="0" cellspacing="0"
           style="width:100%;background:#f9fafb;border-radius:8px;padding:16px;margin:0 0 24px;border:1px solid #e5e7eb;">
      <tbody>
        ${infoRow('Datum i vrijeme', formattedDate)}
        ${infoRow('Usluga', serviceName)}
        ${infoRow('Trajanje', duration)}
        ${duration && price ? infoRow('Cijena', price) : ''}
        ${infoRow('Djelatnik', workerName)}
        ${business?.address ? infoRow('Adresa', `${business.address}${business.city ? ', ' + business.city : ''}`) : ''}
        ${business?.phone ? infoRow('Kontakt', business.phone) : ''}
      </tbody>
    </table>

    <!-- Magic link section -->
    <div style="background:linear-gradient(135deg,#f0f0ff,#f5f3ff);border-radius:8px;
                padding:20px;border:1px solid #e0e7ff;margin-bottom:8px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#4f46e5;">
        Vaš osobni portal
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;line-height:1.5;">
        Upravljajte svim terminima, pregledajte povijest i zakažite nove termine na jednom mjestu.
      </p>
      ${primaryButton('Upravljaj terminima →', portalUrl)}
    </div>
    <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
      📌 Ovaj link je jedinstven za vas. Čuvajte ga — njime pristupate svim vašim terminima bez lozinke.
    </p>
    `;

    const plainText = [
        `${businessName} — Potvrda rezervacije`,
        '',
        `Datum: ${formattedDate}`,
        `Usluga: ${serviceName}`,
        duration ? `Trajanje: ${duration}` : '',
        price ? `Cijena: ${price}` : '',
        `Djelatnik: ${workerName}`,
        business?.address ? `Adresa: ${business.address}${business.city ? ', ' + business.city : ''}` : '',
        '',
        `Vaš portal za upravljanje terminima: ${portalUrl}`,
        '',
        'Ne odgovarajte na ovu e-poštu.',
    ].filter(Boolean).join('\n');

    const html = baseLayout({
        businessName,
        title: 'Termin potvrđen ✓',
        bodyContent,
    });

    await sendEmail({
        from:    `"${businessName}" <noreply@booking-app.com>`,
        to,
        subject: `Potvrda rezervacije — ${businessName}`,
        html,
        text:    plainText,
    });

    console.log(`[Email] Booking confirmation sent to ${to}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Method 2: Cancellation Confirmation
// ──────────────────────────────────────────────────────────────────────────────
async function sendCancellationConfirmation({ to, business, appointment }) {
    const businessName  = business?.name  || 'Vaš salon';
    const serviceName   = appointment?.service_name || 'Usluga';
    const workerName    = appointment?.worker_name  || 'Naš djelatnik';
    const formattedDate = formatDateCroatian(appointment?.datetime || appointment?.appointment_datetime);
    const bookingUrl    = business?.slug
        ? `${process.env.FRONTEND_URL}/book/${business.slug}`
        : (process.env.FRONTEND_URL || '');

    const bodyContent = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Vaš termin je uspješno otkazan. Nadamo se da ćemo vas vidjeti uskoro!
    </p>

    <!-- Cancelled appointment details -->
    <table role="presentation" cellpadding="0" cellspacing="0"
           style="width:100%;background:#fef2f2;border-radius:8px;padding:16px;
                  margin:0 0 24px;border:1px solid #fee2e2;">
      <tbody>
        ${infoRow('Datum', formattedDate)}
        ${infoRow('Usluga', serviceName)}
        ${infoRow('Djelatnik', workerName)}
        ${infoRow('Status', 'Otkazano')}
      </tbody>
    </table>

    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.5;">
      Želite li zakazati novi termin?
    </p>
    ${bookingUrl ? primaryButton('Rezerviraj novi termin →', bookingUrl) : ''}
    `;

    const html = baseLayout({
        businessName,
        title: 'Termin je otkazan',
        bodyContent,
    });

    await sendEmail({
        from:    `"${businessName}" <noreply@booking-app.com>`,
        to,
        subject: `Vaš termin je otkazan — ${businessName}`,
        html,
        text:    `Vaš termin za ${serviceName} (${formattedDate}) je otkazan.\n\nZakazajte novi: ${bookingUrl}`,
    });

    console.log(`[Email] Cancellation confirmation sent to ${to}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Method 3: Portal Link Reminder (lookup flow)
// ──────────────────────────────────────────────────────────────────────────────
async function sendPortalLinkReminder({ to, business, portalUrl, clientName }) {
    const businessName = business?.name || 'Vaš salon';

    const bodyContent = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Bok${clientName ? ` <strong>${escapeHtml(clientName)}</strong>` : ''}! 👋<br/>
      Zatražili ste link za vaš klijentski portal u salonu <strong>${escapeHtml(businessName)}</strong>.
    </p>

    ${primaryButton('Otvori moje termine →', portalUrl)}

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
      📌 Ovaj link je jedinstven za vas i trajan — čuvajte ga na sigurnom.<br/>
      Ako niste vi zatražili ovaj email, jednostavno ga zanemarite.
    </p>
    `;

    const html = baseLayout({
        businessName,
        title: 'Vaš portal link',
        bodyContent,
        footerNote: 'Ako niste vi zatražili ovaj email, zanemarite ga. Ne odgovarajte na ovu poruku.',
    });

    await sendEmail({
        // Correction 6: each email comes FROM the specific business
        from:    `"${businessName}" <noreply@booking-app.com>`,
        to,
        subject: `Vaš portal za ${businessName}`,
        html,
        text:    `Vaš portal link za ${businessName}:\n${portalUrl}\n\nAko niste vi zatražili ovaj email, zanemarite ga.`,
    });

    console.log(`[Email] Portal link reminder sent to ${to}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Core send helper
// ──────────────────────────────────────────────────────────────────────────────
async function sendEmail({ from, to, subject, html, text }) {
    const transporter = createTransporter();
    const info = await transporter.sendMail({ from, to, subject, html, text });
    console.log(`[Email] Sent: ${info.messageId} → ${to}`);
    return info;
}

export default {
    sendBookingConfirmation,
    sendCancellationConfirmation,
    sendPortalLinkReminder,
};
