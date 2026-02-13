'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getTranslation, getInitialLanguage, type Language } from '@/lib/i18n/config';

const CATEGORIES = ['it', 'machines', 'vehicles', 'property'] as const;
const COUNTRIES = ['hu', 'at', 'de'] as const;
const SOURCES = [
  { id: 'eer', labelKey: 'EÉR' },
  { id: 'netbid', labelKey: 'NetBid' },
  { id: 'ediktsdatei', labelKey: 'Ediktsdatei' },
  { id: 'insolvenz', labelKey: 'Insolvenzbekanntmachungen' },
  { id: 'proventura', labelKey: 'Proventura' },
  { id: 'machineseeker', labelKey: 'Machineseeker' },
];

function t(key: string, lang: Language): string {
  return getTranslation(key, lang);
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const tierFromUrl = (searchParams.get('tier') as 'starter' | 'pro' | 'enterprise') || 'pro';
  const billingFromUrl = (searchParams.get('billing') as 'monthly' | 'yearly') || 'yearly';
  const cancelled = searchParams.get('cancelled') === 'true';

  const [language, setLanguage] = useState<Language>('hu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [keywordsText, setKeywordsText] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [payNow, setPayNow] = useState(false);
  const [billingCompany, setBillingCompany] = useState(false);
  const [billingCompanyName, setBillingCompanyName] = useState('');
  const [billingTaxId, setBillingTaxId] = useState('');
  const [billingAddressLine1, setBillingAddressLine1] = useState('');
  const [billingAddressLine2, setBillingAddressLine2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingPostalCode, setBillingPostalCode] = useState('');
  const [billingCountry, setBillingCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    token: string;
    checkoutUrl: string | null;
    telegramLink: string | null;
  } | null>(null);
  const [showTelegramBubble, setShowTelegramBubble] = useState(false);
  const telegramRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLanguage(getInitialLanguage());
  }, []);

  useEffect(() => {
    if (!showTelegramBubble) return;
    const close = () => setShowTelegramBubble(false);
    const t = setTimeout(close, 4000);
    const onDocClick = (e: MouseEvent) => {
      if (telegramRowRef.current && !telegramRowRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('click', onDocClick);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [showTelegramBubble]);

  const toggleCategory = (c: string) => {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const toggleCountry = (c: string) => {
    setCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const toggleSource = (s: string) => {
    setSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const requestPushPermission = () => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    Notification.requestPermission().then(() => {
      const win = window as unknown as { OneSignalDeferred?: Array<(os: unknown) => void | Promise<void>> };
      win.OneSignalDeferred?.push(async (OneSignal: unknown) => {
        const os = OneSignal as { User?: { PushSubscription?: { optIn?: () => Promise<void> } } };
        try {
          await os?.User?.PushSubscription?.optIn?.();
        } catch {
          // ignore
        }
      });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (categories.length === 0) {
      setError(t('errors.minCategories', language));
      return;
    }
    if (countries.length === 0) {
      setError(t('errors.minCountries', language));
      return;
    }

    setLoading(true);

    let onesignalPlayerId: string | null = null;
    if (notifyPush && typeof window !== 'undefined') {
      const win = window as unknown as { OneSignalDeferred?: Array<(os: unknown) => void | Promise<void>> };
      if (win.OneSignalDeferred) {
        try {
          const id = await new Promise<string | null>((resolve) => {
            win.OneSignalDeferred?.push(async (OneSignal: unknown) => {
              const os = OneSignal as {
                User?: {
                  PushSubscription?: {
                    id?: string | Promise<string | undefined>;
                    optIn?: () => Promise<void>;
                  };
                };
              };
              const sub = os?.User?.PushSubscription;
              if (sub?.optIn) await sub.optIn().catch(() => {});
              let subId = sub?.id;
              if (typeof subId === 'object' && subId !== null && 'then' in subId) subId = await subId;
              resolve(typeof subId === 'string' ? subId : null);
            });
            setTimeout(() => resolve(null), 4000);
          });
          onesignalPlayerId = id;
        } catch {
          // ignore
        }
      }
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          language,
          categories,
          countries,
          keywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
          sources,
          notify_push: notifyPush,
          notify_email: notifyEmail,
          notify_telegram: tierFromUrl === 'starter' ? false : notifyTelegram,
          onesignal_player_id: onesignalPlayerId || undefined,
          tier: tierFromUrl,
          billingCycle: billingFromUrl,
          payNow,
          ...(billingCompany && {
            billing_company_name: billingCompanyName.trim() || undefined,
            billing_tax_id: billingTaxId.trim() || undefined,
            billing_address_line1: billingAddressLine1.trim() || undefined,
            billing_address_line2: billingAddressLine2.trim() || undefined,
            billing_address_city: billingCity.trim() || undefined,
            billing_address_postal_code: billingPostalCode.trim() || undefined,
            billing_address_country: billingCountry || undefined,
          }),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || t('errors.registerFailed', language));
        return;
      }

      setSuccess({
        token: data.token,
        checkoutUrl: data.checkoutUrl || null,
        telegramLink: data.telegramLink || null,
      });
    } catch (err) {
      setError(t('errors.tryAgain', language));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('success.title', language)}
          </h1>
          <p className="text-gray-600 mb-2">
            {payNow ? t('success.subtitlePayNow', language) : t('success.subtitleTrial', language)}
          </p>
          <p className="text-sm text-gray-600 mb-6">
            {payNow
              ? t('success.afterPaymentNote', language)
              : t('success.nextStepTrial', language)}
          </p>

          {success.checkoutUrl && (
            <a
              href={success.checkoutUrl}
              className="block w-full py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors mb-4"
            >
              {payNow ? t('register.continuePaymentNow', language) : t('register.continuePayment', language)}
            </a>
          )}

          <Link
            href={`/settings?token=${success.token}`}
            className="block w-full py-3 px-6 rounded-lg font-semibold border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors mb-4"
          >
            {t('success.viewSettings', language)}
          </Link>

          {success.telegramLink && (
            <a
              href={success.telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-6 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('success.telegramConnect', language)} →
            </a>
          )}

          <p className="text-xs text-gray-600 mt-6">
            {t('register.checkEmail', language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>🔍</span> DealSpy.eu
          </Link>
          <div className="flex gap-1">
            {(['hu', 'en', 'de'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-2 py-1 rounded text-sm ${language === lang ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('common.register', language)}
          </h1>
          <p className="text-gray-600 mb-1">
            {t('register.trialSubtitle', language)}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {t('register.trialSubtitleDetail', language)}
          </p>

          {cancelled && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {t('register.cancelledMessage', language)}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.email', language)}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('form.emailPlaceholder', language)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.password', language)}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('form.passwordPlaceholder', language)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.categories', language)}
              </label>
              <p className="text-xs text-gray-600 mb-2">{t('form.categoriesHelp', language)}</p>
              <div className="flex flex-wrap gap-3">
                {CATEGORIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categories.includes(c)}
                      onChange={() => toggleCategory(c)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{t(`categories.${c}`, language)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.countries', language)}
              </label>
              <p className="text-xs text-gray-600 mb-2">{t('form.countriesHelp', language)}</p>
              <div className="flex flex-wrap gap-3">
                {COUNTRIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={countries.includes(c)}
                      onChange={() => toggleCountry(c)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{t(`countries.${c}`, language)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.keywords', language)}
              </label>
              <input
                type="text"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder={t('form.keywordsPlaceholder', language)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">{t('form.keywordsHelp', language)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('register.platformsEmpty', language)}
              </label>
              <div className="flex flex-wrap gap-3">
                {SOURCES.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sources.includes(s.id)}
                      onChange={() => toggleSource(s.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{s.labelKey}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={billingCompany}
                  onChange={(e) => setBillingCompany(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">{t('register.billingTitle', language)}</span>
              </label>
              <p className="text-xs text-gray-600 mb-4">{t('register.billingDesc', language)}</p>
              {billingCompany && (
                <div className="space-y-3 pl-0">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('form.billingCompanyName', language)}</label>
                    <input
                      type="text"
                      value={billingCompanyName}
                      onChange={(e) => setBillingCompanyName(e.target.value)}
                      placeholder="Progile Kft."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('form.billingTaxId', language)}</label>
                    <input
                      type="text"
                      value={billingTaxId}
                      onChange={(e) => setBillingTaxId(e.target.value)}
                      placeholder="HU12345678"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-600 mt-1">{t('form.billingTaxIdHelp', language)}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('form.billingAddressLine1', language)}</label>
                    <input
                      type="text"
                      value={billingAddressLine1}
                      onChange={(e) => setBillingAddressLine1(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('form.billingAddressLine2', language)}</label>
                    <input
                      type="text"
                      value={billingAddressLine2}
                      onChange={(e) => setBillingAddressLine2(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('form.billingCity', language)}</label>
                      <input
                        type="text"
                        value={billingCity}
                        onChange={(e) => setBillingCity(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('form.billingPostalCode', language)}</label>
                      <input
                        type="text"
                        value={billingPostalCode}
                        onChange={(e) => setBillingPostalCode(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('form.billingCountry', language)}</label>
                    <select
                      value={billingCountry}
                      onChange={(e) => setBillingCountry(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">—</option>
                      {['HU', 'AT', 'DE', 'RO', 'SK', 'SI', 'PL', 'CZ', 'IT', 'ES', 'FR', 'NL', 'BE', 'PT', 'GR', 'BG', 'HR', 'EE', 'LV', 'LT', 'IE', 'LU', 'MT', 'CY', 'FI', 'SE', 'DK'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.channels', language)}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyPush}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNotifyPush(checked);
                      if (checked) requestPushPermission();
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t('channels.push', language)}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t('channels.email', language)}</span>
                </label>
                <div ref={telegramRowRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTelegramBubble(true)}
                    className="flex items-center gap-2 cursor-pointer text-left w-full rounded px-1 py-0.5 -ml-1 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 bg-white" aria-hidden />
                    <span>{t('channels.telegram', language)}</span>
                  </button>
                  {showTelegramBubble && (
                    <div
                      className="absolute left-0 bottom-full mb-1.5 z-10 px-3 py-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg shadow-md max-w-xs"
                      role="tooltip"
                    >
                      {t('channels.telegramBubble', language)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('register.paymentTimingLabel', language)}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentTiming"
                    checked={payNow}
                    onChange={() => setPayNow(true)}
                    className="border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{t('register.payNowOption', language)}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentTiming"
                    checked={!payNow}
                    onChange={() => setPayNow(false)}
                    className="border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{t('register.trialOption', language)}</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('common.loading', language) : t('register.signUpButton', language)}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            <Link href="/" className="text-blue-600 hover:underline">
              ← {t('register.backHome', language)}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-500">...</div></div>}>
      <RegisterContent />
    </Suspense>
  );
}
