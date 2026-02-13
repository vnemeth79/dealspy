import { supabaseAdmin, Deal, CreateDealInput, Source } from './supabase';

/**
 * Create or update a deal (upsert based on source + source_id)
 */
export async function createDeal(dealData: CreateDealInput): Promise<Deal> {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .upsert(
      {
        ...dealData,
        currency: dealData.currency || 'EUR',
      },
      {
        onConflict: 'source,source_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create deal: ${error.message}`);
  }

  return data as Deal;
}

/**
 * Bulk create deals
 */
export async function createDeals(deals: CreateDealInput[]): Promise<{ created: number; duplicates: number }> {
  let created = 0;
  let duplicates = 0;

  for (const deal of deals) {
    const exists = await checkDealExists(deal.source, deal.source_id);
    if (exists) {
      duplicates++;
      continue;
    }

    try {
      await createDeal(deal);
      created++;
    } catch {
      // Likely a duplicate that was created between check and insert
      duplicates++;
    }
  }

  return { created, duplicates };
}

/**
 * Get deal by ID
 */
export async function getDealById(id: string): Promise<Deal | null> {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Deal;
}

/**
 * Get deals that haven't been notified yet
 */
export async function getUnnotifiedDeals(): Promise<Deal[]> {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('*')
    .is('notified_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get unnotified deals: ${error.message}`);
  }

  return (data || []) as Deal[];
}

/**
 * Mark deals as notified
 */
export async function markDealsAsNotified(dealIds: string[]): Promise<void> {
  if (dealIds.length === 0) return;

  const { error } = await supabaseAdmin
    .from('deals')
    .update({ notified_at: new Date().toISOString() })
    .in('id', dealIds);

  if (error) {
    throw new Error(`Failed to mark deals as notified: ${error.message}`);
  }
}

/**
 * Get recent deals
 */
export async function getRecentDeals(limit: number = 100): Promise<Deal[]> {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get recent deals: ${error.message}`);
  }

  return (data || []) as Deal[];
}

/**
 * Get deals by source
 */
export async function getDealsBySource(source: Source): Promise<Deal[]> {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('*')
    .eq('source', source)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get deals by source: ${error.message}`);
  }

  return (data || []) as Deal[];
}

/**
 * Check if a deal exists
 */
export async function checkDealExists(source: string, sourceId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('deals')
    .select('id')
    .eq('source', source)
    .eq('source_id', sourceId)
    .single();

  return !!data;
}

/**
 * Get deals created today
 */
export async function getTodaysDeals(): Promise<Deal[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('*')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get today's deals: ${error.message}`);
  }

  return (data || []) as Deal[];
}

/**
 * Get deals matching user preferences
 */
export async function getDealsForUser(
  categories: string[],
  countries: string[],
  sources: string[],
  keywords: string[],
  limit: number = 50
): Promise<Deal[]> {
  let query = supabaseAdmin
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Apply filters if not empty
  if (countries.length > 0) {
    query = query.in('country', countries);
  }

  if (categories.length > 0) {
    query = query.in('category', categories);
  }

  if (sources.length > 0) {
    query = query.in('source', sources);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get deals for user: ${error.message}`);
  }

  let deals = (data || []) as Deal[];

  // Filter by keywords if specified (done in memory due to complexity)
  if (keywords.length > 0) {
    deals = deals.filter((deal) => {
      const dealText = [
        deal.title_original,
        deal.title_hu,
        deal.title_en,
        deal.description_original,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return keywords.some((kw) => dealText.includes(kw.toLowerCase()));
    });
  }

  return deals;
}
