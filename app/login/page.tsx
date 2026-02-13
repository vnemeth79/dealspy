'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getInitialLanguage, type Language } from '@/lib/i18n/config';

const copy: Record<Language, { title: string; intro: string; useLink: string; noEmail: string; register: string; back: string }> = {
  hu: {
    title: 'Bejelentkezés',
    intro: 'A DealSpy jelenleg link-alapú hozzáférést használ: az emailben kapott linkkel éred el a beállításokat.',
    useLink: 'Keresd az email fiókodban a „DealSpy” vagy „beállítások” tárgyú üzenetet, és kattints a linkre.',
    noEmail: 'Nem találod? Ellenőrizd a spam mappát, vagy regisztrálj újra – a regisztráció után küldünk egy új linket.',
    register: 'Új regisztráció',
    back: 'Vissza a főoldalra',
  },
  en: {
    title: 'Log in',
    intro: 'DealSpy uses link-based access: use the link from your email to open settings.',
    useLink: 'Look for an email from DealSpy with subject containing “settings” or “welcome” and click the link.',
    noEmail: "Can't find it? Check your spam folder, or register again – we'll send a new link after registration.",
    register: 'Sign up',
    back: 'Back to home',
  },
  de: {
    title: 'Anmelden',
    intro: 'DealSpy nutzt Link-Zugang: Mit dem Link aus Ihrer E-Mail gelangen Sie zu den Einstellungen.',
    useLink: 'Suchen Sie in Ihrem Posteingang nach einer E-Mail von DealSpy („Einstellungen“ oder „Willkommen“) und klicken Sie auf den Link.',
    noEmail: 'Nicht gefunden? Prüfen Sie den Spam-Ordner oder registrieren Sie sich erneut – wir senden einen neuen Link.',
    register: 'Registrieren',
    back: 'Zur Startseite',
  },
};

export default function LoginPage() {
  const [language, setLanguage] = useState<Language>('hu');

  useEffect(() => {
    setLanguage(getInitialLanguage());
  }, []);

  const c = copy[language];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
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

        <h1 className="text-2xl font-bold text-gray-900 mb-4">{c.title}</h1>
        <p className="text-gray-600 mb-4">{c.intro}</p>
        <p className="text-gray-700 mb-6">{c.useLink}</p>
        <p className="text-sm text-gray-500 mb-8">{c.noEmail}</p>

        <div className="space-y-3">
          <Link
            href="/register"
            className="block w-full py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 text-center transition-colors"
          >
            {c.register}
          </Link>
          <Link
            href="/"
            className="block w-full py-3 px-6 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 text-center transition-colors"
          >
            {c.back}
          </Link>
        </div>
      </div>
    </div>
  );
}
