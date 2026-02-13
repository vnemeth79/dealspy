'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getInitialLanguage, getTranslation, type Language } from '@/lib/i18n/config';

export default function ImpressumPage() {
  const [language, setLanguage] = useState<Language>('hu');

  useEffect(() => {
    setLanguage(getInitialLanguage());
  }, []);

  const content = {
    hu: {
      title: 'Impresszum',
      subtitle: 'Jogi információ és kapcsolat',
      operator: 'Szolgáltató / Üzemeltető',
      operatorName: 'DealSpy.eu',
      address: 'Cím',
      addressValue: 'Keress a kapcsolat űrlapon keresztül.',
      contact: 'Kapcsolat',
      contactValue: 'info@dealspy.eu',
      disclaimer: 'Felelősség kizárása',
      disclaimerText:
        'A DealSpy.eu kizárólag tájékoztató jellegű. Az oldalon megjelenő aukciók és csődvagyon adatait külső, nyilvános forrásokból gyűjtjük. Nem vállalunk felelősséget a források pontosságáért vagy naprakészségéért. A vásárlási döntést mindig a felhasználó önállóan hozza.',
      copyright: '© DealSpy.eu. Minden jog fenntartva.',
    },
    en: {
      title: 'Impressum',
      subtitle: 'Legal information and contact',
      operator: 'Operator',
      operatorName: 'DealSpy.eu',
      address: 'Address',
      addressValue: 'Please use the contact form.',
      contact: 'Contact',
      contactValue: 'info@dealspy.eu',
      disclaimer: 'Disclaimer',
      disclaimerText:
        'DealSpy.eu is for informational purposes only. Auction and insolvency data is collected from external, public sources. We do not guarantee the accuracy or timeliness of these sources. Purchase decisions are always made independently by the user.',
      copyright: '© DealSpy.eu. All rights reserved.',
    },
    de: {
      title: 'Impressum',
      subtitle: 'Rechtliche Informationen und Kontakt',
      operator: 'Anbieter / Betreiber',
      operatorName: 'DealSpy.eu',
      address: 'Adresse',
      addressValue: 'Bitte nutzen Sie das Kontaktformular.',
      contact: 'Kontakt',
      contactValue: 'info@dealspy.eu',
      disclaimer: 'Haftungsausschluss',
      disclaimerText:
        'DealSpy.eu dient nur zu Informationszwecken. Auktions- und Insolvenzdaten werden aus externen, öffentlichen Quellen gesammelt. Wir übernehmen keine Verantwortung für die Richtigkeit oder Aktualität dieser Quellen. Kaufentscheidungen trifft stets der Nutzer eigenverantwortlich.',
      copyright: '© DealSpy.eu. Alle Rechte vorbehalten.',
    },
  };

  const c = content[language] || content.en;

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
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

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{c.title}</h1>
          <p className="text-gray-600 mb-8">{c.subtitle}</p>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{c.operator}</h2>
            <p className="text-gray-700">{c.operatorName}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{c.address}</h2>
            <p className="text-gray-700">{c.addressValue}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{c.contact}</h2>
            <a href={`mailto:${c.contactValue}`} className="text-blue-600 hover:underline">
              {c.contactValue}
            </a>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{c.disclaimer}</h2>
            <p className="text-gray-700 text-sm leading-relaxed">{c.disclaimerText}</p>
          </section>

          <p className="text-sm text-gray-500 border-t border-gray-200 pt-6">{c.copyright}</p>

          <p className="mt-6">
            <Link href="/" className="text-blue-600 hover:underline">
              ← {getTranslation('common.home', language)}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
