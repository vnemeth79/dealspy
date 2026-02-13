import sgMail from '@sendgrid/mail';
import { User, Deal } from '../db/supabase';
import {
  groupDealsByCategory,
  getCategoryName,
  getCountryFlag,
  formatPrice,
  formatDeadline,
} from './matcher';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'alerts@dealspy.eu';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dealspy.eu';

interface EmailResult {
  success: boolean;
  error?: string;
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
  if (!process.env.SENDGRID_API_KEY) {
    return { success: false, error: 'SendGrid not configured' };
  }

  if (deals.length === 0) {
    return { success: true }; // No deals to send
  }

  const subject = getDigestSubject(user.language, deals.length);
  const html = generateDigestHtml(user, deals);

  try {
    await sgMail.send({
      to: user.email,
      from: {
        email: FROM_EMAIL,
        name: 'DealSpy',
      },
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(user: User): Promise<EmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    return { success: false, error: 'SendGrid not configured' };
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

  try {
    await sgMail.send({
      to: user.email,
      from: {
        email: FROM_EMAIL,
        name: 'DealSpy',
      },
      subject: subjects[user.language],
      html,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/**
 * Send admin alert (e.g. scraper failure after retries)
 */
export async function sendAdminAlert(
  subject: string,
  body: string
): Promise<EmailResult> {
  if (!process.env.SENDGRID_API_KEY || !ADMIN_EMAIL) {
    console.error('[Email] Admin alert skipped: SENDGRID_API_KEY or ADMIN_EMAIL not set');
    return { success: false, error: 'Admin email not configured' };
  }

  try {
    await sgMail.send({
      to: ADMIN_EMAIL,
      from: { email: FROM_EMAIL, name: 'DealSpy Alert' },
      subject: `[DealSpy] ${subject}`,
      text: body,
      html: `<pre style="font-family:sans-serif;">${body.replace(/</g, '&lt;')}</pre>`,
    });
    return { success: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
  }
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
