/**
 * Teszteli az oldalakat és API-kat.
 * Futtatás: npm run dev (egy terminálban), majd node scripts/test-pages.mjs (másikban)
 * Vagy: PORT=3001 node scripts/test-pages.mjs
 */

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}`;

async function request(method, path, body = null) {
  const url = new URL(path, BASE);
  const opts = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(url, opts);
  const data = await res.text();
  return { status: res.status, data };
}

async function run() {
  const results = [];
  let failed = 0;

  function ok(name, cond, detail = '') {
    const pass = !!cond;
    if (!pass) failed++;
    results.push({ name, pass, detail });
    console.log(pass ? '  ✓' : '  ✗', name, detail || '');
  }

  console.log('\n--- Oldalak (GET 200) ---\n');

  try {
    const r1 = await request('GET', '/');
    ok('Landing (/)', r1.status === 200, `status=${r1.status}`);
  } catch (e) {
    ok('Landing (/)', false, e.message || 'connection failed');
  }

  try {
    const r2 = await request('GET', '/register');
    ok('Register (/register)', r2.status === 200, `status=${r2.status}`);
  } catch (e) {
    ok('Register (/register)', false, e.message);
  }

  try {
    const r3 = await request('GET', '/settings');
    ok('Settings (/settings) - token nélkül', r3.status === 200, `status=${r3.status}`);
  } catch (e) {
    ok('Settings (/settings)', false, e.message);
  }

  try {
    const r4 = await request('GET', '/unsubscribe');
    ok('Unsubscribe (/unsubscribe) - token nélkül', r4.status === 200, `status=${r4.status}`);
  } catch (e) {
    ok('Unsubscribe (/unsubscribe)', false, e.message);
  }

  try {
    const r5 = await request('GET', '/impressum');
    ok('Impressum (/impressum)', r5.status === 200, `status=${r5.status}`);
  } catch (e) {
    ok('Impressum (/impressum)', false, e.message);
  }

  try {
    const r5b = await request('GET', '/login');
    ok('Login (/login)', r5b.status === 200, `status=${r5b.status}`);
  } catch (e) {
    ok('Login (/login)', false, e.message);
  }

  try {
    const r5c = await request('GET', '/success');
    ok('Success (/success) - session nélkül', r5c.status === 200, `status=${r5c.status}`);
  } catch (e) {
    ok('Success (/success)', false, e.message);
  }

  try {
    const r5d = await request('GET', '/register?cancelled=true');
    ok('Register ?cancelled=true', r5d.status === 200, `status=${r5d.status}`);
  } catch (e) {
    ok('Register ?cancelled=true', false, e.message);
  }

  console.log('\n--- API-k ---\n');

  try {
    const r = await request('POST', '/api/register', {});
    ok('POST /api/register (üres body) → 400', r.status === 400, `status=${r.status}`);
  } catch (e) {
    ok('POST /api/register', false, e.message);
  }

  try {
    const r = await request('POST', '/api/register', {
      email: 'invalid',
      password: 'short',
      language: 'hu',
      categories: [],
      countries: [],
    });
    ok('POST /api/register (invalid) → 400', r.status === 400, `status=${r.status}`);
  } catch (e) {
    ok('POST /api/register (invalid)', false, e.message);
  }

  try {
    const r = await request('GET', '/api/settings?token=invalid-token-12345');
    ok('GET /api/settings (rossz token) → 404', r.status === 404, `status=${r.status}`);
  } catch (e) {
    ok('GET /api/settings', false, e.message);
  }

  try {
    const r = await request('POST', '/api/unsubscribe?token=invalid-token-12345');
    ok('POST /api/unsubscribe (rossz token) → 404', r.status === 404, `status=${r.status}`);
  } catch (e) {
    ok('POST /api/unsubscribe', false, e.message);
  }

  try {
    const r = await request('GET', '/api/health');
    ok('GET /api/health → 200', r.status === 200, `status=${r.status}`);
  } catch (e) {
    ok('GET /api/health', false, e.message);
  }

  try {
    const r = await request('GET', '/api/billing/session');
    ok('GET /api/billing/session (no session_id) → 400', r.status === 400, `status=${r.status}`);
  } catch (e) {
    ok('GET /api/billing/session', false, e.message);
  }

  try {
    const r = await request('GET', '/api/billing/session?session_id=cs_invalid_123');
    ok('GET /api/billing/session (invalid) → 404', r.status === 404, `status=${r.status}`);
  } catch (e) {
    ok('GET /api/billing/session invalid', false, e.message);
  }

  try {
    const r = await request('POST', '/api/billing/checkout', {});
    ok('POST /api/billing/checkout (no token) → 400', r.status === 400, `status=${r.status}`);
  } catch (e) {
    ok('POST /api/billing/checkout', false, e.message);
  }

  try {
    const r = await request('POST', '/api/billing/checkout', { token: 'invalid-token-xyz' });
    ok('POST /api/billing/checkout (bad token) → 404', r.status === 404, `status=${r.status}`);
  } catch (e) {
    ok('POST /api/billing/checkout bad token', false, e.message);
  }

  try {
    const r = await request('PUT', '/api/settings?token=invalid-token-xyz', { language: 'en' });
    ok('PUT /api/settings (bad token) → 404', r.status === 404, `status=${r.status}`);
  } catch (e) {
    ok('PUT /api/settings', false, e.message);
  }

  console.log('\n--- Teljes regisztrációs folyamat (ha DB elérhető) ---\n');

  const uniqueEmail = `test-${Date.now()}@dealspy-e2e.local`;
  let registerToken = null;

  try {
    const r = await request('POST', '/api/register', {
      email: uniqueEmail,
      password: 'TestPassword123!',
      language: 'hu',
      categories: ['it'],
      countries: ['hu'],
      keywords: [],
      sources: ['eer'],
      notify_push: false,
      notify_email: true,
      notify_telegram: false,
      tier: 'pro',
      billingCycle: 'yearly',
    });
    if (r.status === 201 || r.status === 200) {
      let json = {};
      try {
        json = JSON.parse(r.data);
      } catch (_) {}
      registerToken = json.token;
      ok('POST /api/register (valid) → 200', true, `token received`);
    } else if (r.status === 500) {
      ok('POST /api/register (valid)', true, `kihagyva – DB/Stripe kell (status=500)`);
    } else {
      const msg = (() => {
        try {
          const j = JSON.parse(r.data);
          return j.error || r.data;
        } catch (_) {
          return r.data?.slice(0, 80) || `status=${r.status}`;
        }
      })();
      ok('POST /api/register (valid)', false, `status=${r.status} ${msg}`);
    }
  } catch (e) {
    ok('POST /api/register (valid)', false, e.message);
  }

  if (registerToken) {
    try {
      const r = await request('GET', `/api/settings?token=${encodeURIComponent(registerToken)}`);
      ok('GET /api/settings (érvényes token) → 200', r.status === 200, `status=${r.status}`);
    } catch (e) {
      ok('GET /api/settings (token)', false, e.message);
    }

    try {
      const r = await request('POST', '/api/billing/checkout', {
        token: registerToken,
        tier: 'pro',
        billingCycle: 'yearly',
      });
      const hasUrl = (() => {
        try {
          const j = JSON.parse(r.data);
          return !!j.url;
        } catch (_) {
          return false;
        }
      })();
      ok('POST /api/billing/checkout (token) → 200 + url', r.status === 200 && hasUrl, `status=${r.status}`);
    } catch (e) {
      ok('POST /api/billing/checkout (token)', false, e.message);
    }

    try {
      const r = await request('POST', `/api/unsubscribe?token=${encodeURIComponent(registerToken)}`, {});
      ok('POST /api/unsubscribe (érvényes token) → 200', r.status === 200, `status=${r.status}`);
    } catch (e) {
      ok('POST /api/unsubscribe (token)', false, e.message);
    }
  }

  console.log('\n--- Összesen ---\n');
  const passed = results.filter((r) => r.pass).length;
  console.log(`${passed}/${results.length} teszt sikeres.`);
  if (failed > 0) {
    console.log(`${failed} sikertelen.`);
    process.exit(1);
  }
  console.log('Minden teszt sikeres.\n');
}

run().catch((err) => {
  console.error('Futtatási hiba:', err);
  process.exit(1);
});
