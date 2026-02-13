import { supabaseAdmin, User, CreateUserInput, UpdateUserInput, Deal } from './supabase';
import { randomUUID } from 'crypto';
import { isSubscriptionActive } from '@/lib/subscription';

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
 * Re-register a revoked user: update email, password, token, preferences, billing.
 * access_revoked_at is left set until they complete payment (webhook clears it).
 */
export async function updateRevokedUserForReRegister(
  id: string,
  updates: UpdateUserInput & { email?: string }
): Promise<User> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user for re-register: ${error.message}`);
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
 * Delete user by ID (hard delete; CASCADE removes notifications, payments)
 */
/**
 * Revoke access for a user (trial expired without payment). Does not delete the user so we can
 * identify by email that they already had a trial and send them straight to payment on re-register.
 */
export async function revokeAccessForUser(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      access_revoked_at: new Date().toISOString(),
      token: null,
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to revoke access: ${error.message}`);
  }
}

/**
 * Check if user has had trial expired and access revoked (identify "already had trial" by email).
 */
export function isAccessRevoked(user: User): boolean {
  return !!user.access_revoked_at;
}

/** Normalize string for matching: trim, lowercase, empty string if null/undefined */
function norm(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return '';
  return s.trim().toLowerCase();
}

/** Adószám / EV azonosító: trim, space-ek eltávolítva, lowercase (EU ÁFA is lehet) */
function normTaxId(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return '';
  return s.replace(/\s/g, '').trim().toLowerCase();
}

/**
 * Registration payload for matching against revoked users.
 * Név = cégnév VAGY adószám (adószám / egyéni vállalkozó azonosító).
 * Három kombináció: Név+email, Cím+név, Cím+email. Cím = város + utca+házszám (line1 részleges).
 */
export interface RegistrationMatchData {
  email: string;
  billing_company_name?: string | null;
  billing_tax_id?: string | null;
  billing_address_line1?: string | null;
  billing_address_city?: string | null;
}

/** Cím egyezés: város egyezik ÉS utca+házszám (line1) részlegesen egyezik (egyik tartalmazza a másikat) */
function addressMatch(
  line1A: string | null | undefined,
  cityA: string | null | undefined,
  line1B: string | null | undefined,
  cityB: string | null | undefined
): boolean {
  const nCityA = norm(cityA);
  const nCityB = norm(cityB);
  if (!nCityA || !nCityB || nCityA !== nCityB) return false;
  const n1 = norm(line1A);
  const n2 = norm(line1B);
  if (!n1 || !n2) return false;
  return n1.includes(n2) || n2.includes(n1);
}

/** Név/azonosító egyezés: cégnév VAGY adószám (EV azonosító) egyezik */
function nameOrTaxMatch(data: RegistrationMatchData, u: User): boolean {
  const nCompany = norm(data.billing_company_name);
  const uCompany = norm(u.billing_company_name);
  if (nCompany && uCompany && nCompany === uCompany) return true;
  const nTax = normTaxId(data.billing_tax_id);
  const uTax = normTaxId(u.billing_tax_id);
  if (nTax && uTax && nTax === uTax) return true;
  return false;
}

/**
 * Find a revoked user that matches the registration data. Three combinations (OR):
 * 1) (Név VAGY adószám) ÉS email, 2) Cím ÉS (név VAGY adószám), 3) Cím ÉS email.
 */
export async function findRevokedUserMatchingRegistration(
  data: RegistrationMatchData
): Promise<User | null> {
  const email = data.email?.trim().toLowerCase();
  if (!email) return null;

  const byEmail = await getUserByEmail(email);
  if (byEmail && byEmail.access_revoked_at) return byEmail;

  const revoked = await getRevokedUsers();

  for (const u of revoked) {
    const uEmail = (u.email || '').trim().toLowerCase();
    const addrMatch = addressMatch(
      data.billing_address_line1,
      data.billing_address_city,
      u.billing_address_line1,
      u.billing_address_city
    );
    const nameMatch = nameOrTaxMatch(data, u);

    if (nameMatch && uEmail === email) return u;
    if (addrMatch && nameMatch) return u;
    if (addrMatch && uEmail === email) return u;
  }
  return null;
}

/**
 * Get all users with revoked access (for matching on re-registration).
 */
export async function getRevokedUsers(): Promise<User[]> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .not('access_revoked_at', 'is', null);

  if (error) {
    throw new Error(`Failed to get revoked users: ${error.message}`);
  }
  return (data || []) as User[];
}

/**
 * Get users whose trial has ended and who never paid (revoke access: email + set access_revoked_at).
 * - trial_ends_at in the past AND (no Stripe customer OR subscription cancelled/unpaid)
 */
export async function getTrialExpiredUnpaidUsers(): Promise<User[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .lt('trial_ends_at', now)
    .or('stripe_customer_id.is.null,subscription_status.eq.cancelled,subscription_status.eq.unpaid');

  if (error) {
    throw new Error(`Failed to get trial-expired users: ${error.message}`);
  }

  const users = (data || []) as User[];
  return users.filter((u) => !isSubscriptionActive(u) && !u.access_revoked_at);
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

  const users = (data || []) as User[];
  return users.filter((u) => isSubscriptionActive(u));
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
