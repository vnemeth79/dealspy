import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/db/supabase';
import { getUserByStripeCustomerId } from '@/lib/db/users';
import { sendAdminPaymentNotification } from '@/lib/notifications/email';

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

        if (userId && session.subscription) {
          const raw = await getStripe().subscriptions.retrieve(
            session.subscription as string
          );
          const sub = raw as Stripe.Subscription;
          const isTrialing = sub.status === 'trialing';
          const updatePayload: Record<string, unknown> = {
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_tier: tier || 'pro',
            subscription_status: isTrialing ? 'trialing' : 'active',
            billing_cycle: billingCycle || 'monthly',
            access_revoked_at: null,
          };
          const subAny = sub as Stripe.Subscription & { trial_end?: number; current_period_end?: number };
          if (isTrialing && subAny.trial_end) {
            updatePayload.trial_ends_at = new Date(subAny.trial_end * 1000).toISOString();
          } else {
            updatePayload.trial_ends_at = null;
          }
          if (subAny.current_period_end) {
            updatePayload.subscription_ends_at = new Date(subAny.current_period_end * 1000).toISOString();
          }

          await supabaseAdmin.from('users').update(updatePayload).eq('id', userId);

          console.log(`[Stripe Webhook] User ${userId} checkout completed (${isTrialing ? 'trialing' : 'active'})`);
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
        if (status === 'active' || status === 'trialing') {
          updateData.access_revoked_at = null;
        }
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

        // Update subscription status to active (trial ended); clear access_revoked if re-registered
        if (invoice.billing_reason === 'subscription_cycle') {
          await supabaseAdmin.from('users').update({
            subscription_status: 'active',
            access_revoked_at: null,
          }).eq('stripe_customer_id', customerId);
        }

        // Log payment (idempotency: stripe_invoice_id egyediség)
        const user = await getUserByStripeCustomerId(customerId);
        if (user) {
          const { data: existing } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('stripe_invoice_id', invoice.id)
            .maybeSingle();

          if (existing) {
            console.log('[Stripe Webhook] Payment already logged for invoice', invoice.id);
          } else {
            await supabaseAdmin.from('payments').insert({
              user_id: user.id,
              stripe_invoice_id: invoice.id,
              amount: invoice.amount_paid / 100,
              currency: invoice.currency.toUpperCase(),
              status: 'succeeded',
              tier: user.subscription_tier,
              billing_cycle: user.billing_cycle,
            });
            // Admin értesítés e-mailben, számla PDF csatolmányként
            try {
              const fullInvoice = await getStripe().invoices.retrieve(invoice.id);
              const pdfUrl = fullInvoice.invoice_pdf;
              if (pdfUrl && process.env.ADMIN_EMAIL && (process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY)) {
                const secret = process.env.STRIPE_SECRET_KEY;
                const pdfRes = await fetch(pdfUrl, {
                  headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
                });
                if (pdfRes.ok) {
                  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
                  await sendAdminPaymentNotification({
                    customerEmail: user.email,
                    amount: invoice.amount_paid / 100,
                    currency: (invoice.currency || 'eur').toUpperCase(),
                    tier: user.subscription_tier || 'pro',
                    billingCycle: user.billing_cycle || 'monthly',
                    invoicePdfBuffer: pdfBuffer,
                    invoiceNumber: fullInvoice.number || invoice.id,
                  });
                }
              }
            } catch (notifyErr) {
              console.error('[Stripe Webhook] Admin payment notification failed:', notifyErr);
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
