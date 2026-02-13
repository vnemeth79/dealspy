import { supabaseAdmin, User, CreateUserInput, UpdateUserInput, Deal } from './supabase';
import { randomUUID } from 'crypto';

// Generate a unique token for settings link
function generateToken(): string {
  return randomUUID();
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Create a new user
 */
export async function createUser(userData: CreateUserInput): Promise<User> {
  if (!isValidEmail(userData.email)) {
    throw new Error('Invalid email format');
  }

  const token = userData.token || generateToken();

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      ...userData,
      token,
      subscription_tier: userData.subscription_tier || 'trial',
      subscription_status: userData.subscription_status || 'trialing',
      billing_cycle: userData.billing_cycle || 'monthly',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Email already registered');
    }
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return data as User;
}

/**
 * Get user by token (for settings page)
 */
export async function getUserByToken(token: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

/**
 * Get user by Stripe customer ID
 */
export async function getUserByStripeCustomerId(customerId: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

/**
 * Update user by token
 */
export async function updateUser(token: string, updates: UpdateUserInput): Promise<User> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('token', token)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return data as User;
}

/**
 * Update user by ID
 */
export async function updateUserById(id: string, updates: UpdateUserInput): Promise<User> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return data as User;
}

/**
 * Delete user by token (hard delete)
 */
export async function deleteUser(token: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('token', token);

  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }
}

/**
 * Get all active users (for notifications)
 */
export async function getAllActiveUsers(): Promise<User[]> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .in('subscription_status', ['trialing', 'active'])
    .neq('subscription_tier', 'cancelled');

  if (error) {
    throw new Error(`Failed to get active users: ${error.message}`);
  }

  return (data || []) as User[];
}

/**
 * Get users matching a deal (for notifications)
 */
export async function getUsersForNotification(deal: Deal): Promise<User[]> {
  const activeUsers = await getAllActiveUsers();

  return activeUsers.filter((user) => {
    // Country match (empty = all)
    if (user.countries.length > 0 && !user.countries.includes(deal.country)) {
      return false;
    }

    // Category match (empty = all)
    if (user.categories.length > 0 && !user.categories.includes(deal.category || 'other')) {
      return false;
    }

    // Source match (empty = all)
    if (user.sources.length > 0 && !user.sources.includes(deal.source)) {
      return false;
    }

    // Keyword match (empty = all, OR logic)
    if (user.keywords.length > 0) {
      const dealText = [
        deal.title_original,
        deal.title_hu,
        deal.title_en,
        deal.description_original,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const hasKeyword = user.keywords.some((kw) =>
        dealText.includes(kw.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Link Telegram chat ID to user
 */
export async function linkTelegramToUser(token: string, chatId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ telegram_chat_id: chatId })
    .eq('token', token);

  return !error;
}

/**
 * Unlink Telegram from user
 */
export async function unlinkTelegram(chatId: string): Promise<void> {
  await supabaseAdmin
    .from('users')
    .update({ telegram_chat_id: null, notify_telegram: false })
    .eq('telegram_chat_id', chatId);
}
