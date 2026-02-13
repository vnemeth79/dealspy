/**
 * Szamlazz.hu Agent API – számla létrehozás és kiküldés
 * A Progile Tanácsadó Kft szamlazz.hu fiókján keresztül küldi a számlákat.
 *
 * Env: SZAMLazz_AGENT_KEY, SZAMLazz_* (eladó adatok), EUR_TO_HUF (opcionális árfolyam)
 */

const SZAMLazz_URL = 'https://www.szamlazz.hu/szamla/';
const REQUEST_FIELD = 'action-xmlagentxmlfile';

export interface SzamlazzSeller {
  name: string;
  taxNumber: string;
  address: {
    irsz: string;
    city: string;
  };
  bankName: string;
  bankAccount: string;
}

export interface SzamlazzBuyer {
  name: string;
  email: string;
  /** Irányítószám (kötelező) */
  irsz: string;
  /** Település (kötelező) */
  city: string;
  /** Cím (kötelező) */
  address: string;
  country?: string;
}

export interface SzamlazzItem {
  name: string;
  quantity: number;
  unit: string;
  /** Nettó egységár (HUF) */
  netUnitPrice: number;
  /** Áfa kulcs % (pl. 27) */
  vatRate: number;
}

export interface CreateInvoiceParams {
  buyer: SzamlazzBuyer;
  items: SzamlazzItem[];
  /** Külső azonosító (pl. Stripe invoice id) */
  externalId?: string;
  /** Fizetési határidő (napok) */
  paymentDeadlineDays?: number;
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build XML for Számla Agent (számla létrehozás)
 * Mező sorrendje kötött a dokumentáció szerint.
 */
function buildInvoiceXml(params: CreateInvoiceParams): string {
  const agentKey = process.env.SZAMLazz_AGENT_KEY;
  const sellerName = process.env.SZAMLazz_SELLER_NAME || 'Progile Tanácsadó Kft';
  const sellerTax = process.env.SZAMLazz_SELLER_TAX || '';
  const sellerIrsz = process.env.SZAMLazz_SELLER_IRSZ || '1134';
  const sellerCity = process.env.SZAMLazz_SELLER_CITY || 'Budapest';
  const sellerAddress = process.env.SZAMLazz_SELLER_ADDRESS || 'Váci út 45.';
  const sellerBank = process.env.SZAMLazz_SELLER_BANK || '';
  const sellerAccount = process.env.SZAMLazz_SELLER_ACCOUNT || '';

  const keltDatum = new Date().toISOString().slice(0, 10);
  const deadlineDays = params.paymentDeadlineDays ?? 8;
  const fizetesiHatarido = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const tetelek = params.items
    .map((item) => {
      const nettoErtek = round2(item.netUnitPrice * item.quantity);
      const afaErtek = round2(nettoErtek * (item.vatRate / 100));
      const bruttoErtek = round2(nettoErtek + afaErtek);
      return `    <tetel>
      <megnevezes>${escapeXml(item.name)}</megnevezes>
      <mennyiseg>${item.quantity}</mennyiseg>
      <mennyisegiEgyseg>${escapeXml(item.unit)}</mennyisegiEgyseg>
      <nettoEgysegar>${item.netUnitPrice}</nettoEgysegar>
      <afakulcs>${item.vatRate}</afakulcs>
      <nettoErtek>${nettoErtek}</nettoErtek>
      <afaErtek>${afaErtek}</afaErtek>
      <bruttoErtek>${bruttoErtek}</bruttoErtek>
    </tetel>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey || '')}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
    ${params.externalId ? `<szamlaKulsoAzon>${escapeXml(params.externalId)}</szamlaKulsoAzon>` : ''}
  </beallitasok>
  <fejlec>
    <keltDatum>${keltDatum}</keltDatum>
    <teljesitesDatum>${keltDatum}</teljesitesDatum>
    <fizetesiHatarido>${fizetesiHatarido}</fizetesiHatarido>
    <fizetesiMod>átutalás</fizetesiMod>
    <penznem>Ft</penznem>
    <szamlaNyelv>hu</szamlaNyelv>
  </fejlec>
  <elado>
    <bank>${escapeXml(sellerBank)}</bank>
    <bankszamlaszam>${escapeXml(sellerAccount)}</bankszamlaszam>
  </elado>
  <vevo>
    <nev>${escapeXml(params.buyer.name)}</nev>
    <orszag>${escapeXml(params.buyer.country || 'HU')}</orszag>
    <irsz>${escapeXml(params.buyer.irsz)}</irsz>
    <telepules>${escapeXml(params.buyer.city)}</telepules>
    <cim>${escapeXml(params.buyer.address)}</cim>
    <email>${escapeXml(params.buyer.email)}</email>
    <sendEmail>true</sendEmail>
    <adoalany>7</adoalany>
  </vevo>
  <tetelek>
${tetelek}
  </tetelek>
</xmlszamla>`;

  return xml;
}

export interface CreateInvoiceResult {
  success: boolean;
  invoiceNumber?: string;
  error?: string;
}

/**
 * Create invoice via Szamlazz.hu Agent and send by email to buyer.
 * Amounts must be in HUF (Progile Kft magyar számlát bocsát ki).
 */
export async function createAndSendInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
  const agentKey = process.env.SZAMLazz_AGENT_KEY;
  if (!agentKey) {
    return { success: false, error: 'SZAMLazz_AGENT_KEY not configured' };
  }

  const xml = buildInvoiceXml(params);
  const formData = new URLSearchParams();
  formData.append(REQUEST_FIELD, xml);

  try {
    const response = await fetch(SZAMLazz_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: formData.toString(),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('[Szamlazz] HTTP error:', response.status, text);
      return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }

    // Success response may be PDF binary or XML with result
    // Agent typically returns XML with documentNumber (szamlaszam) on success
    const docNumMatch = text.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i);
    const invoiceNumber = docNumMatch ? docNumMatch[1].trim() : undefined;

    if (text.includes('hibakod') || text.includes('hiba')) {
      const errMatch = text.match(/<hibauzenet>([^<]*)<\/hibauzenet>/i);
      const errMsg = errMatch ? errMatch[1].trim() : text.slice(0, 300);
      console.error('[Szamlazz] API error:', errMsg);
      return { success: false, error: errMsg, invoiceNumber };
    }

    console.log('[Szamlazz] Invoice created:', invoiceNumber || 'OK');
    return { success: true, invoiceNumber };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Szamlazz] Request failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Convert EUR amount to HUF and build a single invoice item for DealSpy subscription.
 */
export function buildDealSpySubscriptionItem(
  tier: string,
  billingCycle: string,
  amountEur: number,
  eurToHuf: number = Number(process.env.EUR_TO_HUF) || 400
): SzamlazzItem[] {
  const amountHuf = Math.round(amountEur * eurToHuf);
  const netto = Math.round(amountHuf / 1.27);
  const label = `DealSpy.eu előfizetés - ${tier} (${billingCycle === 'yearly' ? 'éves' : 'havi'})`;
  return [
    {
      name: label,
      quantity: 1,
      unit: 'db',
      netUnitPrice: netto,
      vatRate: 27,
    },
  ];
}
