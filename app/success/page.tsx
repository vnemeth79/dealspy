'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getInitialLanguage, getTranslation, type Language } from '@/lib/i18n/config';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [language, setLanguage] = useState<Language>('hu');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLanguage(getInitialLanguage());
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError('missing_session');
      return;
    }

    fetch(`/api/billing/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data: { token: string }) => setToken(data.token))
      .catch(() => setError('failed'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{getTranslation('common.loading', language)}</p>
      </div>
    );
  }

  if (error || !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {getTranslation('successPage.invalidSession', language)}
          </h1>
          <p className="text-gray-600 mb-6">
            {getTranslation('successPage.invalidSessionDesc', language)}
          </p>
          <Link
            href="/"
            className="inline-block py-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            {getTranslation('common.home', language)}
          </Link>
        </div>
      </div>
    );
  }

  const settingsUrl = token ? `/settings?token=${encodeURIComponent(token)}` : '/';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {getTranslation('successPage.thankYou', language)}
        </h1>
        <p className="text-gray-600 mb-6">
          {getTranslation('successPage.thankYouDesc', language)}
        </p>
        <Link
          href={settingsUrl}
          className="inline-block py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700"
        >
          {getTranslation('common.settings', language)}
        </Link>
        <p className="mt-6 text-sm text-gray-500">
          <Link href="/" className="text-blue-600 hover:underline">
            ← {getTranslation('common.home', language)}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-500">...</div></div>}>
      <SuccessContent />
    </Suspense>
  );
}
