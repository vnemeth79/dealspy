'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getTranslation, type Language } from '@/lib/i18n/config';

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

interface SettingsData {
  email: string;
  language: Language;
  categories: string[];
  countries: string[];
  keywords: string[];
  sources: string[];
  notify_push: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  telegram_connected: boolean;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  has_billing?: boolean;
}

function isSubscriptionActive(data: SettingsData): boolean {
  const status = data.subscription_status;
  if (status === 'cancelled' || status === 'unpaid') return false;
  if (status === 'trialing' && data.trial_ends_at) {
    if (new Date(data.trial_ends_at) < new Date()) return false;
  }
  if (status === 'active' && data.subscription_ends_at) {
    if (new Date(data.subscription_ends_at) < new Date()) return false;
  }
  return true;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [saved, setSaved] = useState(false);

  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<Language>('hu');
  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [keywordsText, setKeywordsText] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [hasBilling, setHasBilling] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
      setLoading(false);
      return;
    }

    fetch(`/api/settings?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) setInvalidToken(true);
          throw new Error('Failed to load');
        }
        return res.json();
      })
      .then((data: SettingsData) => {
        setEmail(data.email);
        setLanguage(data.language);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setCountries(Array.isArray(data.countries) ? data.countries : []);
        setKeywordsText(Array.isArray(data.keywords) ? data.keywords.join(', ') : '');
        setSources(Array.isArray(data.sources) ? data.sources : []);
        setNotifyPush(!!data.notify_push);
        setNotifyEmail(!!data.notify_email);
        setNotifyTelegram(!!data.notify_telegram);
        setSubscriptionTier(data.subscription_tier ?? null);
        setSubscriptionStatus(data.subscription_status ?? null);
        setTrialEndsAt(data.trial_ends_at ?? null);
        setSubscriptionEndsAt(data.subscription_ends_at ?? null);
        setHasBilling(!!data.has_billing);
      })
      .catch(() => {
        if (!invalidToken) setError(getTranslation('errors.loadSettingsFailed', language));
      })
      .finally(() => setLoading(false));
  }, [token]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/settings?token=${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          categories,
          countries,
          keywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
          sources,
          notify_push: notifyPush,
          notify_email: notifyEmail,
          notify_telegram: notifyTelegram,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || getTranslation('errors.saveFailed', language));
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(getTranslation('errors.generic', language));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">{getTranslation('common.loading', language)}</p>
      </div>
    );
  }

  if (invalidToken || !token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {t('settingsPage.invalidLink', language)}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('settingsPage.invalidLinkDesc', language)}
          </p>
          <Link
            href="/"
            className="inline-block py-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            {t('common.home', language)}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
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
                className={`px-2 py-1 rounded text-sm ${language === lang ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('common.settings', language)}
          </h1>
          <p className="text-gray-600 mb-6 text-sm">{email}</p>

          {(() => {
            const subData: SettingsData = {
              email,
              language,
              categories,
              countries,
              keywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
              sources,
              notify_push: notifyPush,
              notify_email: notifyEmail,
              notify_telegram: notifyTelegram,
              telegram_connected: false,
              subscription_tier: subscriptionTier,
              subscription_status: subscriptionStatus,
              trial_ends_at: trialEndsAt,
              subscription_ends_at: subscriptionEndsAt,
            };
            const active = isSubscriptionActive(subData);
            return (
              <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {t('settingsPage.subscription', language)}:
                  </span>
                  <span className="text-sm text-gray-600 capitalize">
                    {subscriptionTier || 'trial'} · {subscriptionStatus || '–'}
                  </span>
                </div>
                {!active && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    {t('settingsPage.noActiveSubscription', language)}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {!active && (
                    <button
                      type="button"
                      disabled={checkoutLoading}
                      onClick={async () => {
                        if (!token) return;
                        setCheckoutLoading(true);
                        try {
                          const res = await fetch('/api/billing/checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, tier: 'pro', billingCycle: 'yearly' }),
                          });
                          const data = await res.json();
                          if (res.ok && data.url) window.location.href = data.url;
                          else setError(data.error || t('common.error', language));
                        } catch {
                          setError(t('common.error', language));
                        } finally {
                          setCheckoutLoading(false);
                        }
                      }}
                      className="px-4 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {checkoutLoading
                        ? getTranslation('common.loading', language)
                        : t('settingsPage.enterPayment', language)}
                    </button>
                  )}
                  {active && hasBilling && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        try {
                          const res = await fetch('/api/billing/portal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token }),
                          });
                          const data = await res.json();
                          if (res.ok && data.url) window.location.href = data.url;
else setError(data.error || t('common.error', language));
                          } catch {
                            setError(t('common.error', language));
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {t('settingsPage.manageSubscription', language)}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.email', language)}
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.categories', language)}
              </label>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settingsPage.platformsEmpty', language)}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.channels', language)}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyPush}
                    onChange={(e) => setNotifyPush(e.target.checked)}
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyTelegram}
                    onChange={(e) => setNotifyTelegram(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t('channels.telegram', language)}</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {saved && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                {t('settingsPage.saved', language)}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? getTranslation('common.loading', language) : t('common.save', language)}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              href={`/unsubscribe?token=${encodeURIComponent(token)}`}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              {t('settingsPage.unsubscribeDelete', language)}
            </Link>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/" className="text-blue-600 hover:underline">
              ← {t('common.home', language)}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
