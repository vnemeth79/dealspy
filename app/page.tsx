'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTranslation, getInitialLanguage, type Language } from '@/lib/i18n/config';

type BillingCycle = 'monthly' | 'yearly';

const PRICING = {
  starter: { monthly: 19, yearly: 15 },
  pro: { monthly: 49, yearly: 39 },
  enterprise: { monthly: 149, yearly: 119 },
};

function t(key: string, lang: Language) {
  return getTranslation(key, lang);
}

export default function LandingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [language, setLanguage] = useState<Language>('hu');

  useEffect(() => {
    setLanguage(getInitialLanguage());
  }, []);

  const handleSelectTier = (tier: 'starter' | 'pro' | 'enterprise') => {
    if (tier === 'enterprise') {
      const subject = encodeURIComponent(t('pricing.enterpriseSubject', language));
      window.location.href = `mailto:info@dealspy.eu?subject=${subject}`;
    } else {
      window.location.href = `/register?tier=${tier}&billing=${billingCycle}`;
    }
  };

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <span className="text-xl font-bold text-gray-900">DealSpy.eu</span>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                {t('footer.features', language)}
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                {t('footer.pricing', language)}
              </a>
              <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors">
                {t('faq.title', language)}
              </a>
            </nav>

            <div className="flex items-center gap-4">
              <div className="flex gap-1 text-sm">
                {(['hu', 'en', 'de'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setLanguage(lang); if (typeof window !== 'undefined') window.localStorage.setItem('dealspy-lang', lang); }}
                    className={`px-2 py-1 rounded transition-colors ${
                      language === lang
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                {t('common.login', language)}
              </Link>
              <Link
                href="/register"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('common.register', language)}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-[1.4] md:leading-[1.35]">
            <span className="block">{t('hero.title', language)}</span>
            <span className="block mt-3 md:mt-4 text-blue-800">{t('hero.titleHighlight', language)}</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            {t('hero.subtitle', language)}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/register"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              🚀 {t('hero.cta', language)}
            </Link>
            <a
              href="#how-it-works"
              className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:border-gray-400 transition-colors inline-flex items-center justify-center gap-2"
            >
              ▶ {t('hero.ctaSecondary', language)}
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <span>✓ {t('badges.platforms', language)}</span>
            <span>✓ {t('badges.updates', language)}</span>
            <span>✓ {t('badges.translation', language)}</span>
            <span>✓ {t('badges.savings', language)}</span>
          </div>
        </div>
      </section>

      {/* PROBLEM/SOLUTION */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            {t('problem.title', language)}
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { icon: '😫', titleKey: 'problem.tooMany.title' as const, descKey: 'problem.tooMany.desc' as const },
              { icon: '🇩🇪', titleKey: 'problem.language.title' as const, descKey: 'problem.language.desc' as const },
              { icon: '⏰', titleKey: 'problem.timing.title' as const, descKey: 'problem.timing.desc' as const },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-sm text-center"
              >
                <div className="text-5xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {t(item.titleKey, language)}
                </h3>
                <p className="text-gray-600">{t(item.descKey, language)}</p>
              </div>
            ))}
          </div>
          <div className="bg-blue-600 text-white p-8 rounded-2xl text-center max-w-2xl mx-auto">
            <div className="text-4xl mb-4">💡</div>
            <h3 className="text-2xl font-bold mb-4">
              {t('problem.solution', language)}
            </h3>
            <p className="text-blue-100">
              {t('problem.solutionDesc', language)}
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            {t('howItWorks.title', language)}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '①', icon: '⚙️', titleKey: 'howItWorks.step1.title' as const, descKey: 'howItWorks.step1.desc' as const, timeKey: 'howItWorks.step1.badge' as const },
              { step: '②', icon: '🔍', titleKey: 'howItWorks.step2.title' as const, descKey: 'howItWorks.step2.desc' as const, timeKey: 'howItWorks.step2.badge' as const },
              { step: '③', icon: '🔔', titleKey: 'howItWorks.step3.title' as const, descKey: 'howItWorks.step3.desc' as const, timeKey: 'howItWorks.step3.badge' as const },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl text-gray-400 mb-4">{item.step}</div>
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {t(item.titleKey, language)}
                </h3>
                <p className="text-gray-600 mb-4">{t(item.descKey, language)}</p>
                <span className="text-sm text-blue-600">{t(item.timeKey, language)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOURCES */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            {t('sources.title', language)}
          </h2>
          <p className="text-gray-600 text-center mb-12">
            {t('sources.expanding', language)}
          </p>

          <div className="space-y-8">
            {[
              {
                flag: '🇭🇺',
                countryKey: 'sources.countryHu' as const,
                platforms: [
                  { name: 'EÉR', descKey: 'sources.descEer' as const },
                ],
              },
              {
                flag: '🇦🇹',
                countryKey: 'sources.countryAt' as const,
                platforms: [
                  { name: 'Ediktsdatei', descKey: 'sources.descEdiktsdatei' as const },
                  { name: 'KSV1870', descKey: 'sources.descKsv' as const },
                ],
              },
              {
                flag: '🇩🇪',
                countryKey: 'sources.countryDe' as const,
                platforms: [
                  { name: 'Insolvenzbekanntmachungen', descKey: 'sources.descInsolvenz' as const },
                  { name: 'NetBid', descKey: 'sources.descNetbid' as const },
                  { name: 'Proventura', descKey: 'sources.descProventura' as const },
                ],
              },
              {
                flag: '🇪🇺',
                countryKey: 'sources.countryEu' as const,
                platforms: [
                  { name: 'Machineseeker', descKey: 'sources.descMachineseeker' as const },
                  { name: 'Mascus', descKey: 'sources.descMascus' as const },
                  { name: 'TruckScout24', descKey: 'sources.descTruckScout' as const },
                ],
              },
            ].map((group, i) => (
              <div key={i}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {group.flag} {t(group.countryKey, language)}
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {group.platforms.map((platform, j) => (
                    <div
                      key={j}
                      className="bg-white/95 backdrop-blur-sm p-4 rounded-lg border border-gray-200"
                    >
                      <div className="font-medium text-gray-900">
                        {platform.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {t(platform.descKey, language)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            {t('features.title', language)}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: '🌍', key: 'translation' },
              { icon: '🎯', key: 'filtering' },
              { icon: '🤖', key: 'ai' },
              { icon: '🔔', key: 'notifications' },
              { icon: '📊', key: 'digest' },
              { icon: '⏰', key: 'deadline' },
              { icon: '💰', key: 'savings' },
            ].map((feature, i) => (
              <div key={i} className="bg-white/80 backdrop-blur-sm p-6 rounded-xl">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t(`features.${feature.key}.title`, language)}
                </h3>
                <p className="text-gray-600">{t(`features.${feature.key}.desc`, language)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            {t('pricing.title', language)}
          </h2>
          <p className="text-gray-600 text-center mb-8">
            {t('pricing.subtitle', language)}
          </p>

          {/* Billing Toggle */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <span
              className={`text-lg shrink-0 min-w-[6rem] text-center ${
                billingCycle === 'monthly'
                  ? 'text-gray-900 font-semibold'
                  : 'text-gray-500'
              }`}
            >
              {t('pricing.monthly', language)}
            </span>
            <button
              type="button"
              onClick={() =>
                setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')
              }
              className={`relative w-14 h-8 rounded-full shrink-0 transition-colors ${
                billingCycle === 'yearly' ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              aria-pressed={billingCycle === 'yearly'}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              className={`text-lg shrink-0 min-w-[6rem] text-center ${
                billingCycle === 'yearly'
                  ? 'text-gray-900 font-semibold'
                  : 'text-gray-500'
              }`}
            >
              {t('pricing.yearly', language)}
            </span>
            {billingCycle === 'yearly' && (
              <span className="bg-green-100 text-green-700 text-sm font-medium px-3 py-1 rounded-full shrink-0">
                {t('pricing.yearlySavings', language)}
              </span>
            )}
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Starter */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 border-2 border-gray-200">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">STARTER</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-gray-900">
                    €{PRICING.starter[billingCycle]}
                  </span>
                  <span className="text-gray-500">{t('pricing.perMonth', language)}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>1 {t('pricing.features.countries', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>3 {t('pricing.features.platforms', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>2 {t('pricing.features.categories', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>5 {t('pricing.features.keywords', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.emailDigest', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.emailSupport', language)}</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectTier('starter')}
                className="w-full py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {t('pricing.tryFree', language)}
              </button>
            </div>

            {/* Pro - Popular */}
            <div className="relative bg-gradient-to-b from-blue-600 to-blue-700 text-white rounded-2xl p-8 ring-4 ring-blue-300 scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-yellow-400 text-yellow-900 text-sm font-bold px-4 py-1 rounded-full">
                  ⭐ {t('pricing.popular', language).toUpperCase()}
                </span>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">PRO</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold">
                    €{PRICING.pro[billingCycle]}
                  </span>
                  <span className="text-blue-800">{t('pricing.perMonth', language)}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-blue-800">✓</span>
                  <span>3 {t('pricing.features.countries', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-800">✓</span>
                  <span>{t('pricing.features.allPlatforms', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-800">✓</span>
                  <span>{t('pricing.features.allCategories', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-800">✓</span>
                  <span>20 {t('pricing.features.keywords', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-800">✓</span>
                  <span>{t('pricing.features.instantPushEmail', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-800">✓</span>
                  <span>{t('pricing.features.telegram', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-800">✓</span>
                  <span>{t('pricing.features.prioritySupport', language)}</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectTier('pro')}
                className="w-full py-3 px-6 rounded-lg font-semibold bg-white text-blue-600 hover:bg-blue-50 transition-colors"
              >
                {t('pricing.tryFree', language)}
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 border-2 border-gray-200">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  ENTERPRISE
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-gray-900">
                    €{PRICING.enterprise[billingCycle]}
                  </span>
                  <span className="text-gray-500">{t('pricing.perMonth', language)}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.allCountries', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.allPlatforms', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.allCategories', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.unlimited', language)} {t('pricing.features.keywords', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.allChannels', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.api', language)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{t('pricing.features.dedicatedSupport', language)}</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectTier('enterprise')}
                className="w-full py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {t('pricing.contact', language)}
              </button>
            </div>
          </div>

          <div className="text-center mt-8 text-gray-500">
            💳 {t('pricing.trust.secure', language)} | 🔄 {t('pricing.trust.cancel', language)} |
            💰 {t('pricing.trust.refund', language)}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            {t('faq.title', language)}
          </h2>
          <div className="space-y-4">
            {(['trial', 'payment', 'cancel', 'frequency', 'api'] as const).map((key, i) => (
              <details
                key={key}
                className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 group"
              >
                <summary className="p-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 list-none flex items-center justify-between">
                  {t(`faq.${key}.q`, language)}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <p className="px-4 pb-4 text-gray-600">{t(`faq.${key}.a`, language)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {t('cta.title', language)}
          </h2>
          <p className="text-blue-100 mb-8">
            {t('cta.subtitle', language)}
          </p>
          <Link
            href="/register"
            className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            🚀 {t('cta.button', language)}
          </Link>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <span>🔒 256-bit SSL titkosítás</span>
            <span>🇪🇺 GDPR kompatibilis</span>
            <span>⭐ 4.8/5 értékelés</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🔍</span>
                <span className="text-xl font-bold text-white">DealSpy.eu</span>
              </div>
              <p className="text-sm">{t('footer.tagline', language)}</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.product', language)}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="hover:text-white">
                    {t('footer.features', language)}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white">
                    {t('footer.pricing', language)}
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white">
                    {t('faq.title', language)}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.company', language)}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/impressum" className="hover:text-white">
                    {t('footer.impressum', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white">
                    {t('footer.privacy', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white">
                    {t('footer.terms', language)}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.contact', language)}</h4>
              <ul className="space-y-2 text-sm">
                <li>info@dealspy.eu</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            © {new Date().getFullYear()} DealSpy.eu | {t('footer.copyright', language)}
          </div>
        </div>
      </footer>
    </div>
  );
}
