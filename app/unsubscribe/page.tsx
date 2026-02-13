'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getInitialLanguage, getTranslation, type Language } from '@/lib/i18n/config';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [language, setLanguage] = useState<Language>('hu');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'invalid'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setLanguage(getInitialLanguage());
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
    }
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: 'POST',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || getTranslation('unsubscribePage.failed', language));
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage(getTranslation('unsubscribePage.errorGeneric', language));
    }
  };

  const copy = {
    hu: {
      title: 'Leiratkozás',
      intro: 'Ha leiratkozik, minden értesítés megáll és a fiókod törlésre kerül. Ezt később nem tudod visszavonni.',
      confirm: 'Igen, leiratkozom',
      cancel: 'Mégse, vissza a beállításokhoz',
      successTitle: 'Sikeresen leiratkoztál',
      successText: 'További értesítéseket nem kapsz. Szeretnél újra feliratkozni?',
      backHome: 'Főoldal',
      invalidTitle: 'Érvénytelen link',
      invalidText: 'A leiratkozáshoz az emailben kapott linket használd.',
      signUpAgain: 'Újra feliratkozás',
      processing: 'Folyamatban...',
    },
    en: {
      title: 'Unsubscribe',
      intro: 'If you unsubscribe, all notifications will stop and your account will be deleted. This cannot be undone.',
      confirm: 'Yes, unsubscribe',
      cancel: 'Cancel, back to settings',
      successTitle: 'Successfully unsubscribed',
      successText: "You won't receive any more notifications. Want to sign up again?",
      backHome: 'Home',
      invalidTitle: 'Invalid link',
      invalidText: 'Use the link from your email to unsubscribe.',
      signUpAgain: 'Sign up again',
      processing: 'Processing...',
    },
    de: {
      title: 'Abmelden',
      intro: 'Wenn Sie sich abmelden, werden alle Benachrichtigungen eingestellt und Ihr Konto gelöscht. Dies kann nicht rückgängig gemacht werden.',
      confirm: 'Ja, abmelden',
      cancel: 'Abbrechen, zurück zu Einstellungen',
      successTitle: 'Erfolgreich abgemeldet',
      successText: 'Sie erhalten keine weiteren Benachrichtigungen. Möchten Sie sich wieder anmelden?',
      backHome: 'Startseite',
      invalidTitle: 'Ungültiger Link',
      invalidText: 'Verwenden Sie den Link aus Ihrer E-Mail zum Abmelden.',
      signUpAgain: 'Erneut anmelden',
      processing: 'Wird verarbeitet...',
    },
  };

  const c = copy[language] || copy.en;

  if (status === 'invalid' || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{c.invalidTitle}</h1>
          <p className="text-gray-600 mb-6">{c.invalidText}</p>
          <Link
            href="/"
            className="inline-block py-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            {c.backHome}
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{c.successTitle}</h1>
          <p className="text-gray-600 mb-6">{c.successText}</p>
          <Link
            href="/register"
            className="inline-block w-full py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 mb-3"
          >
            {c.signUpAgain}
          </Link>
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            {c.backHome}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">🔍</span>
          <span className="text-xl font-bold text-gray-900">DealSpy.eu</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{c.title}</h1>
        <p className="text-gray-600 mb-6">{c.intro}</p>

        {status === 'error' && errorMessage && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-6">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleUnsubscribe}
            disabled={status === 'loading'}
            className="w-full py-3 px-6 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'loading' ? c.processing : c.confirm}
          </button>
          <Link
            href={`/settings?token=${encodeURIComponent(token)}`}
            className="w-full py-3 px-6 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 text-center transition-colors"
          >
            {c.cancel}
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/" className="text-blue-600 hover:underline">
            ← {c.backHome}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-500">...</div></div>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
