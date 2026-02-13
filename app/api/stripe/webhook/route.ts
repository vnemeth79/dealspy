import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/db/supabase';
import { getUserByStripeCustomerId } from '@/lib/db/users';
import {
  createAndSendInvoice,
  buildDealSpySubscriptionItem,
  type SzamlazzBuyer,
} from '@/lib/szamlazz';

// Lazy initialization
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, tier, billingCycle } = session.metadata || {};

        if (userId) {
          await supabaseAdmin.from('users').update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_tier: tier || 'pro',
            subscription_status: 'trialing',
            billing_cycle: billingCycle || 'monthly',
            trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          }).eq('id', userId);

          console.log(`[Stripe Webhook] User ${userId} checkout completed`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = (subscription as { customer: string }).customer;
        const subData = subscription as { status: string; current_period_end?: number };

        const status = subData.status === 'active' ? 'active' :
                       subData.status === 'trialing' ? 'trialing' :
                       subData.status === 'past_due' ? 'past_due' :
                       subData.status === 'canceled' ? 'cancelled' : 'unpaid';

        const updateData: Record<string, unknown> = {
          subscription_status: status,
        };

        if (subData.current_period_end) {
          updateData.subscription_ends_at = new Date(subData.current_period_end * 1000).toISOString();
        }

        await supabaseAdmin.from('users').update(updateData).eq('stripe_customer_id', customerId);

        console.log(`[Stripe Webhook] Subscription updated for customer ${customerId}: ${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = (subscription as { customer: string }).customer;

        await supabaseAdmin.from('users').update({
          subscription_status: 'cancelled',
          subscription_tier: 'cancelled',
        }).eq('stripe_customer_id', customerId);

        console.log(`[Stripe Webhook] Subscription cancelled for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as {
          customer: string;
          id: string;
          billing_reason?: string;
          amount_paid: number;
          currency: string;
        };
        const customerId = invoice.customer;

        // Update subscription status to active (trial ended)
        if (invoice.billing_reason === 'subscription_cycle') {
          await supabaseAdmin.from('users').update({
            subscription_status: 'active',
          }).eq('stripe_customer_id', customerId);
        }

        // Log payment (idempotency: stripe_invoice_id egyediség)
        const user = await getUserByStripeCustomerId(customerId);
        if (user) {
          const { data: existing } = await supabaseAdmin
            .from('payments')
            .select('id, szamlazz_invoice_number')
            .eq('stripe_invoice_id', invoice.id)
            .maybeSingle();

          if (existing) {
            console.log('[Stripe Webhook] Payment already logged for invoice', invoice.id);
          } else {
            const { data: paymentRow } = await supabaseAdmin
              .from('payments')
              .insert({
                user_id: user.id,
                stripe_invoice_id: invoice.id,
                amount: invoice.amount_paid / 100,
                currency: invoice.currency.toUpperCase(),
                status: 'succeeded',
                tier: user.subscription_tier,
                billing_cycle: user.billing_cycle,
              })
              .select('id')
              .single();

            // Progile Tanácsadó Kft – számla kiküldése szamlazz.hu-n keresztül (csak ha még nincs)
            if (process.env.SZAMLazz_AGENT_KEY && paymentRow?.id) {
              const amountEur = invoice.amount_paid / 100;
              const buyer: SzamlazzBuyer = {
                name: user.email,
                email: user.email,
                irsz: '0000',
                city: 'Nem megadva',
                address: 'Online vásárlás',
                country: 'HU',
              };
              const items = buildDealSpySubscriptionItem(
                user.subscription_tier,
                user.billing_cycle,
                amountEur
              );
              const invoiceResult = await createAndSendInvoice({
                buyer,
                items,
                externalId: invoice.id,
                paymentDeadlineDays: 8,
              });
              if (!invoiceResult.success) {
                console.error('[Stripe Webhook] Szamlazz invoice failed:', invoiceResult.error);
              } else {
                if (invoiceResult.invoiceNumber) {
                  await supabaseAdmin
                    .from('payments')
                    .update({ szamlazz_invoice_number: invoiceResult.invoiceNumber })
                    .eq('id', paymentRow.id);
                }
                console.log('[Stripe Webhook] Szamlazz invoice sent:', invoiceResult.invoiceNumber);
              }
            }
          }
        }

        console.log(`[Stripe Webhook] Payment succeeded for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as { customer: string };
        const customerId = invoice.customer;

        await supabaseAdmin.from('users').update({
          subscription_status: 'past_due',
        }).eq('stripe_customer_id', customerId);

        // TODO: Send email notification about failed payment

        console.log(`[Stripe Webhook] Payment failed for customer ${customerId}`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error handling event:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
