import sgMail from '@sendgrid/mail';
import { Resend } from 'resend';
import { User, Deal } from '../db/supabase';
import {
  groupDealsByCategory,
  getCategoryName,
  getCountryFlag,
  formatPrice,
  formatDeadline,
} from './matcher';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const RESEND = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'alerts@dealspy.eu';
const FROM_NAME = 'DealSpy';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dealspy.eu';

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
}

interface EmailResult {
  success: boolean;
  error?: string;
}

interface SendMailOptions {
  to: string | string[];
  fromName?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; type?: string }[];
}

async function sendMail(options: SendMailOptions): Promise<EmailResult> {
  const { to, fromName = FROM_NAME, subject, text, html, attachments } = options;
  const toList = Array.isArray(to) ? to : [to];

  if (RESEND) {
    try {
      const from = `${fromName} <${FROM_EMAIL}>`;
      const res = await RESEND.emails.send({
        from,
        to: toList,
        subject,
        html: html ?? text.replace(/\n/g, '<br>'),
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });
      if (res.error) {
        return { success: false, error: res.error.message };
      }
      return { success: true };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    }
  }

  if (process.env.SENDGRID_API_KEY) {
    try {
      await sgMail.send({
        to: toList,
        from: { email: FROM_EMAIL, name: fromName },
        subject,
        text,
        html: html ?? `<pre style="font-family:sans-serif;">${text.replace(/</g, '&lt;')}</pre>`,
        attachments: attachments?.map((a) => ({
          content: a.content.toString('base64'),
          filename: a.filename,
          type: a.type ?? 'application/octet-stream',
          disposition: 'attachment',
        })),
      });
      return { success: true };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    }
  }

  return { success: false, error: 'No email provider configured (set RESEND_API_KEY or SENDGRID_API_KEY)' };
}

/**
 * Get email subject based on language
 */
function getDigestSubject(lang: 'hu' | 'en' | 'de', count: number): string {
  const date = new Date().toLocaleDateString(
    lang === 'hu' ? 'hu-HU' : lang === 'de' ? 'de-DE' : 'en-GB',
    { month: 'short', day: 'numeric' }
  );

  const subjects = {
    hu: `🔍 DealSpy | ${count} új deal - ${date}`,
    en: `🔍 DealSpy | ${count} new deals - ${date}`,
    de: `🔍 DealSpy | ${count} neue Angebote - ${date}`,
  };

  return subjects[lang];
}

/**
 * Generate HTML email content
 */
function generateDigestHtml(user: User, deals: Deal[]): string {
  const lang = user.language;
  const grouped = groupDealsByCategory(deals);

  const greeting = {
    hu: 'Szia',
    en: 'Hello',
    de: 'Hallo',
  };

  const intro = {
    hu: `Ma ${deals.length} új releváns deal érkezett:`,
    en: `${deals.length} new relevant deals arrived today:`,
    de: `Heute sind ${deals.length} neue relevante Angebote eingetroffen:`,
  };

  const settingsText = {
    hu: 'Beállítások',
    en: 'Settings',
    de: 'Einstellungen',
  };

  const unsubscribeText = {
    hu: 'Leiratkozás',
    en: 'Unsubscribe',
    de: 'Abmelden',
  };

  let dealsHtml = '';

  for (const [category, categoryDeals] of Object.entries(grouped)) {
    const categoryName = getCategoryName(category, lang);

    dealsHtml += `
      <tr>
        <td style="padding: 20px 0 10px 0;">
          <h2 style="margin: 0; font-size: 18px; color: #1e3a5f; border-bottom: 2px solid #3b82f6; padding-bottom: 5px;">
            ${categoryName} (${categoryDeals.length})
          </h2>
        </td>
      </tr>
    `;

    for (const deal of categoryDeals.slice(0, 10)) {
      const title = lang === 'hu' && deal.title_hu
        ? deal.title_hu
        : lang === 'en' && deal.title_en
          ? deal.title_en
          : deal.title_original;

      const flag = getCountryFlag(deal.country);
      const price = formatPrice(deal.price, deal.currency);
      const deadline = formatDeadline(deal.deadline, lang);

      dealsHtml += `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <a href="${deal.url}" style="color: #1e3a5f; text-decoration: none; font-weight: 600;">
                    ${title}
                  </a>
                  <br>
                  <span style="color: #6b7280; font-size: 14px;">
                    ${deal.source} ${flag} | ${price} | ⏰ ${deadline}
                  </span>
                </td>
                <td width="80" align="right" valign="top">
                  <a href="${deal.url}" style="background: #3b82f6; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px;">
                    →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px;">
                🔍 DealSpy.eu
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                EU csődvagyon monitoring
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; color: #374151;">
                ${greeting[lang]}!<br><br>
                ${intro[lang]}
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                ${dealsHtml}
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #6b7280; font-size: 12px;">
                    <a href="${APP_URL}/settings?token=${user.token}" style="color: #3b82f6; text-decoration: none;">
                      ${settingsText[lang]}
                    </a>
                    &nbsp;|&nbsp;
                    <a href="${APP_URL}/unsubscribe?token=${user.token}" style="color: #6b7280; text-decoration: none;">
                      ${unsubscribeText[lang]}
                    </a>
                  </td>
                  <td align="right" style="color: #9ca3af; font-size: 12px;">
                    © ${new Date().getFullYear()} DealSpy.eu
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send daily digest email
 */
export async function sendDigestEmail(
  user: User,
  deals: Deal[]
): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email not configured (RESEND_API_KEY or SENDGRID_API_KEY)' };
  }

  if (deals.length === 0) {
    return { success: true };
  }

  const subject = getDigestSubject(user.language, deals.length);
  const html = generateDigestHtml(user, deals);
  return sendMail({ to: user.email, subject, text: subject, html });
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(user: User): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email not configured (RESEND_API_KEY or SENDGRID_API_KEY)' };
  }

  const subjects = {
    hu: '🔍 Üdvözlünk a DealSpy-nál!',
    en: '🔍 Welcome to DealSpy!',
    de: '🔍 Willkommen bei DealSpy!',
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px;">🔍 DealSpy.eu</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1e3a5f;">
                ${user.language === 'hu' ? 'Üdvözlünk!' : user.language === 'de' ? 'Willkommen!' : 'Welcome!'}
              </h2>
              <p style="color: #374151; line-height: 1.6;">
                ${user.language === 'hu'
                  ? 'Sikeresen regisztráltál a DealSpy-ra! Mostantól értesítünk, ha új releváns deal érkezik.'
                  : user.language === 'de'
                    ? 'Sie haben sich erfolgreich bei DealSpy registriert! Wir benachrichtigen Sie, wenn neue relevante Angebote eintreffen.'
                    : 'You have successfully registered for DealSpy! We will notify you when new relevant deals arrive.'
                }
              </p>
              <p style="margin-top: 30px;">
                <a href="${APP_URL}/settings?token=${user.token}" 
                   style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                  ${user.language === 'hu' ? 'Beállítások megtekintése' : user.language === 'de' ? 'Einstellungen anzeigen' : 'View Settings'}
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendMail({
    to: user.email,
    subject: subjects[user.language],
    text: '',
    html,
  });
}

/**
 * Send "trial expired, access ended, data deleted, you can re-register" email
 */
export async function sendTrialExpiredEmail(
  email: string,
  lang: 'hu' | 'en' | 'de'
): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email not configured' };
  }

  const subjects = {
    hu: 'DealSpy – A próbaidőszakod véget ért',
    en: 'DealSpy – Your trial has ended',
    de: 'DealSpy – Ihre Testphase ist beendet',
  };

  const bodies = {
    hu: `
      <p style="color: #374151; line-height: 1.6;">A 3 napos próbaidőszakod lejárt, és a próba alatt nem történt fizetés.</p>
      <p style="color: #374151; line-height: 1.6;"><strong>A hozzáférésedet töröltük.</strong> Bármikor újra regisztrálhatsz, és egyből a fizetéshez juthatsz (nincs második próbaidő).</p>
      <p style="margin-top: 24px;">
        <a href="${APP_URL}/register" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Újra regisztrálok</a>
      </p>
    `,
    en: `
      <p style="color: #374151; line-height: 1.6;">Your 3-day trial has ended and no payment was made during the trial.</p>
      <p style="color: #374151; line-height: 1.6;"><strong>Your access has been revoked.</strong> You can re-register anytime and go straight to payment (no second trial).</p>
      <p style="margin-top: 24px;">
        <a href="${APP_URL}/register" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Re-register</a>
      </p>
    `,
    de: `
      <p style="color: #374151; line-height: 1.6;">Ihre 3-Tage-Testphase ist beendet; während der Testphase wurde keine Zahlung durchgeführt.</p>
      <p style="color: #374151; line-height: 1.6;"><strong>Ihr Zugang wurde gesperrt.</strong> Sie können sich jederzeit erneut registrieren und gelangen direkt zur Zahlung (kein zweiter Probezeitraum).</p>
      <p style="margin-top: 24px;">
        <a href="${APP_URL}/register" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Erneut registrieren</a>
      </p>
    `,
  };

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px;">🔍 DealSpy.eu</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1e3a5f;">${subjects[lang]}</h2>
              ${bodies[lang]}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendMail({
    to: email,
    subject: subjects[lang],
    text: '',
    html,
  });
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/**
 * Send admin alert (e.g. scraper failure after retries)
 */
export async function sendAdminAlert(
  subject: string,
  body: string
): Promise<EmailResult> {
  if (!isEmailConfigured() || !ADMIN_EMAIL) {
    console.error('[Email] Admin alert skipped: no email provider or ADMIN_EMAIL not set');
    return { success: false, error: 'Admin email not configured' };
  }
  return sendMail({
    to: ADMIN_EMAIL,
    fromName: 'DealSpy Alert',
    subject: `[DealSpy] ${subject}`,
    text: body,
    html: `<pre style="font-family:sans-serif;">${body.replace(/</g, '&lt;')}</pre>`,
  });
}

/**
 * Notify admin when one or more scrapers fail after retries
 */
export async function sendScraperFailureAlert(
  errors: Array<{ source: string; error: string }>
): Promise<EmailResult> {
  const subject = `Scraper hibák (${errors.length} forrás)`;
  const body = `A következő források sikertelenek voltak (retry után is):\n\n${errors
    .map((e) => `- ${e.source}: ${e.error}`)
    .join('\n')}\n\nIdő: ${new Date().toISOString()}`;
  return sendAdminAlert(subject, body);
}

/**
 * Notify admin when one or more scrapers used AI fallback (regex found 0, AI extracted deals).
 * Indicates possible HTML structure change; consider updating the parser for that source.
 */
export async function sendScraperFallbackAlert(sources: string[]): Promise<EmailResult> {
  const subject = `Scraper: AI fallback használva (${sources.length} forrás) – lehetséges HTML változás`;
  const body = `A következő forrásoknál a szokásos regex 0 elemet talált, az AI fallback pedig dealeket adott. Valószínű, hogy a portál HTML-je megváltozott.\n\nForrások: ${sources.join(', ')}\n\nÉrdemes frissíteni a parsert (lib/scrapers/*.ts) a jobb teljesítmény érdekében.\n\nIdő: ${new Date().toISOString()}`;
  return sendAdminAlert(subject, body);
}

export interface AdminPaymentNotificationParams {
  customerEmail: string;
  amount: number;
  currency: string;
  tier: string;
  billingCycle: string;
  invoicePdfBuffer: Buffer;
  invoiceNumber: string;
}

/**
 * Send admin email when a payment succeeds: body with customer + amount, invoice PDF as attachment.
 */
export async function sendAdminPaymentNotification(
  params: AdminPaymentNotificationParams
): Promise<EmailResult> {
  if (!isEmailConfigured() || !ADMIN_EMAIL) {
    console.error('[Email] Payment notification skipped: no email provider or ADMIN_EMAIL not set');
    return { success: false, error: 'Admin email not configured' };
  }

  const { customerEmail, amount, currency, tier, billingCycle, invoicePdfBuffer, invoiceNumber } = params;
  const subject = `DealSpy: új fizetés – ${customerEmail}`;
  const body = `Új fizetés érkezett.\n\nVevő: ${customerEmail}\nÖsszeg: ${amount} ${currency}\nCsomag: ${tier} (${billingCycle})\nSzámla: ${invoiceNumber}\n\nA számla PDF csatolmányban mellékelve.\n\nIdő: ${new Date().toISOString()}`;
  const html = `
    <p>Új fizetés érkezett.</p>
    <ul>
      <li><strong>Vevő:</strong> ${customerEmail}</li>
      <li><strong>Összeg:</strong> ${amount} ${currency}</li>
      <li><strong>Csomag:</strong> ${tier} (${billingCycle})</li>
      <li><strong>Számla:</strong> ${invoiceNumber}</li>
    </ul>
    <p>A számla PDF csatolmányban mellékelve.</p>
    <p><small>Idő: ${new Date().toISOString()}</small></p>
  `;

  return sendMail({
    to: ADMIN_EMAIL,
    subject: `[DealSpy] ${subject}`,
    text: body,
    html: `<div style="font-family:sans-serif;">${html}</div>`,
    attachments: [
      {
        filename: `szamla-${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`,
        content: invoicePdfBuffer,
        type: 'application/pdf',
      },
    ],
  });
}
