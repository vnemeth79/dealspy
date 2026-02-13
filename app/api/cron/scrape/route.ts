import { NextRequest, NextResponse } from 'next/server';
import { runAllScrapers } from '@/lib/scrapers';
import { createDeal, checkDealExists } from '@/lib/db/deals';
import { translateDeal } from '@/lib/ai/translate';
import { categorizeDeal } from '@/lib/ai/categorize';
import { sendScraperFailureAlert, sendScraperFallbackAlert } from '@/lib/notifications/email';
import type { Category } from '@/lib/db/supabase';

/**
 * POST /api/cron/scrape
 * Run all scrapers and save new deals
 * Called by Vercel Cron at 09:30 and 14:30 CET
 *
 * Query: dryRun=1 — only in development: run scrapers without DB/translate/emails (local testing).
 *        Ignored in production (NODE_ENV=production).
 */
export async function POST(request: NextRequest) {
  // Verify cron authentication
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const dryRun =
    process.env.NODE_ENV !== 'production' && request.nextUrl.searchParams.get('dryRun') === '1';

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Cron/Scrape] Starting scrape job...' + (dryRun ? ' (dry run)' : ''));

  try {
    // Run all scrapers
    const { deals: scrapedDeals, stats } = await runAllScrapers();

    console.log(`[Cron/Scrape] Scraped ${scrapedDeals.length} deals`);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        stats: {
          bySource: stats.bySource,
          errors: stats.errors,
          aiFallbackSources: stats.aiFallbackSources,
          totalDeals: stats.totalDeals,
          durationMs: stats.duration,
        },
        sources: Object.keys(stats.bySource),
      });
    }

    let newDeals = 0;
    let duplicates = 0;
    let errors = 0;

    // Process each deal
    for (const deal of scrapedDeals) {
      try {
        // Check if deal already exists
        const exists = await checkDealExists(deal.source, deal.source_id);
        if (exists) {
          duplicates++;
          continue;
        }

        // Translate deal
        let translations;
        try {
          translations = await translateDeal(deal);
        } catch (translateError) {
          console.error('[Cron/Scrape] Translation error:', translateError);
          translations = {
            title_hu: deal.title_original,
            title_en: deal.title_original,
          };
        }

        // Categorize deal
        let category: Category = 'other';
        try {
          category = await categorizeDeal(deal);
        } catch (categorizeError) {
          console.error('[Cron/Scrape] Categorization error:', categorizeError);
          category = 'other';
        }

        // Save to database
        await createDeal({
          source: deal.source as any,
          source_id: deal.source_id,
          title_original: deal.title_original,
          title_hu: translations.title_hu,
          title_en: translations.title_en,
          title_de: deal.country === 'de' || deal.country === 'at' 
            ? deal.title_original 
            : null,
          description_original: deal.description_original || null,
          description_hu: translations.description_hu || null,
          description_en: translations.description_en || null,
          category,
          country: deal.country,
          price: deal.price || null,
          currency: deal.currency || 'EUR',
          deadline: deal.deadline?.toISOString() || null,
          url: deal.url,
          image_url: deal.image_url || null,
          raw_data: deal.raw_data,
        });

        newDeals++;
      } catch (dealError) {
        console.error('[Cron/Scrape] Error processing deal:', dealError);
        errors++;
      }
    }

    // Admin alert if any scraper failed after retries (PRD)
    if (stats.errors.length > 0) {
      sendScraperFailureAlert(stats.errors).catch((err) =>
        console.error('[Cron/Scrape] Admin alert failed:', err)
      );
    }

    // Admin alert only when 0 results were due to page change (regex failed, AI fallback succeeded)
    if (stats.aiFallbackSources?.length > 0) {
      sendScraperFallbackAlert(stats.aiFallbackSources).catch((err) =>
        console.error('[Cron/Scrape] Fallback alert failed:', err)
      );
    }

    console.log(`[Cron/Scrape] Complete. New: ${newDeals}, Duplicates: ${duplicates}, Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      stats,
      newDeals,
      duplicates,
      errors,
    });
  } catch (error) {
    console.error('[Cron/Scrape] Job failed:', error);
    return NextResponse.json(
      { error: 'Scrape job failed', details: String(error) },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
