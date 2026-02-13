import { NextRequest, NextResponse } from 'next/server';
import { getUserByToken, updateUser } from '@/lib/db/users';
import { validateUserSettings } from '@/lib/subscription';

/**
 * GET /api/settings?token=xxx
 * Get user settings
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }

  const user = await getUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: 'User not found or invalid token' },
      { status: 404 }
    );
  }

  // Return user settings (excluding sensitive data)
  return NextResponse.json({
    email: user.email,
    language: user.language,
    categories: user.categories,
    countries: user.countries,
    keywords: user.keywords,
    sources: user.sources,
    notify_push: user.notify_push,
    notify_email: user.notify_email,
    notify_telegram: user.notify_telegram,
    telegram_connected: !!user.telegram_chat_id,
    subscription_tier: user.subscription_tier,
    subscription_status: user.subscription_status,
    trial_ends_at: user.trial_ends_at,
    subscription_ends_at: user.subscription_ends_at,
    has_billing: !!user.stripe_customer_id,
  });
}

/**
 * PUT /api/settings?token=xxx
 * Update user settings
 */
export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }

  const user = await getUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: 'User not found or invalid token' },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();

    // Extract updatable fields
    const updates: Record<string, unknown> = {};

    if (body.language !== undefined) {
      if (!['hu', 'en', 'de'].includes(body.language)) {
        return NextResponse.json(
          { error: 'Invalid language' },
          { status: 400 }
        );
      }
      updates.language = body.language;
    }

    if (body.categories !== undefined) {
      updates.categories = body.categories;
    }

    if (body.countries !== undefined) {
      updates.countries = body.countries;
    }

    if (body.keywords !== undefined) {
      updates.keywords = body.keywords.filter((k: string) => k.trim() !== '');
    }

    if (body.sources !== undefined) {
      updates.sources = body.sources;
    }

    if (body.notify_push !== undefined) {
      updates.notify_push = body.notify_push;
    }

    if (body.notify_email !== undefined) {
      updates.notify_email = body.notify_email;
    }

    if (body.notify_telegram !== undefined) {
      updates.notify_telegram = body.notify_telegram;
    }

    if (body.onesignal_player_id !== undefined) {
      updates.onesignal_player_id = body.onesignal_player_id;
    }

    // Validate against subscription limits
    const validation = validateUserSettings(user, {
      countries: updates.countries as string[] | undefined,
      categories: updates.categories as string[] | undefined,
      keywords: updates.keywords as string[] | undefined,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Update user
    await updateUser(token, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
