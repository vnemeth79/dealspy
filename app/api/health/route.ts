import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';
import { isEmailConfigured } from '@/lib/notifications/email';

/**
 * GET /api/health
 * Health check endpoint
 */
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      anthropic: 'unknown',
      stripe: 'unknown',
      email: 'unknown',
      onesignal: 'unknown',
      telegram: 'unknown',
    },
  };

  // Check database
  try {
    const { error } = await supabaseAdmin.from('users').select('count').limit(1);
    health.services.database = error ? 'error' : 'ok';
  } catch {
    health.services.database = 'error';
  }

  // Check if API keys are configured
  health.services.anthropic = process.env.ANTHROPIC_API_KEY ? 'configured' : 'not configured';
  health.services.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured';
  health.services.email = isEmailConfigured() ? 'configured' : 'not configured';
  health.services.onesignal = process.env.ONESIGNAL_API_KEY ? 'configured' : 'not configured';
  health.services.telegram = process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured';

  // Set overall status
  if (health.services.database === 'error') {
    health.status = 'degraded';
  }

  return NextResponse.json(health);
}
