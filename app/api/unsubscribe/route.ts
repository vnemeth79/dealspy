import { NextRequest, NextResponse } from 'next/server';
import { getUserByToken, deleteUser } from '@/lib/db/users';

/**
 * POST /api/unsubscribe?token=xxx
 * Unsubscribe user from all notifications / delete account
 */
export async function POST(request: NextRequest) {
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
    // Delete user
    await deleteUser(token);

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
