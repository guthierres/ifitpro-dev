import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Stripe settings
    const { data: stripeSettings } = await supabase
      .from('stripe_settings')
      .select('webhook_secret, enabled')
      .single()

    if (!stripeSettings?.enabled) {
      return new Response(
        JSON.stringify({ error: 'Stripe integration not enabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.text()
    
    // Here you would verify the webhook signature with Stripe
    // For now, we'll parse the event directly
    const event = JSON.parse(body)

    console.log('Received Stripe webhook:', event.type)

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(supabase, event.data.object)
        break
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(supabase, event.data.object)
        break
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(supabase, event.data.object)
        break
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object)
        break
        
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleSubscriptionUpdate(supabase: any, subscription: any) {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id)

    if (error) {
      console.error('Error updating subscription:', error)
    } else {
      console.log('Subscription updated successfully')
    }
  } catch (error) {
    console.error('Error in handleSubscriptionUpdate:', error)
  }
}

async function handleSubscriptionCanceled(supabase: any, subscription: any) {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id)

    if (error) {
      console.error('Error canceling subscription:', error)
    } else {
      console.log('Subscription canceled successfully')
    }
  } catch (error) {
    console.error('Error in handleSubscriptionCanceled:', error)
  }
}

async function handlePaymentSucceeded(supabase: any, invoice: any) {
  try {
    // Find subscription by stripe subscription id
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', invoice.subscription)
      .single()

    if (subscription) {
      const { error } = await supabase
        .from('payment_history')
        .insert({
          subscription_id: subscription.id,
          stripe_payment_intent_id: invoice.payment_intent,
          amount_cents: invoice.amount_paid,
          currency: invoice.currency,
          status: 'succeeded',
          payment_method: 'stripe',
          paid_at: new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        })

      if (error) {
        console.error('Error recording payment:', error)
      } else {
        console.log('Payment recorded successfully')
      }
    }
  } catch (error) {
    console.error('Error in handlePaymentSucceeded:', error)
  }
}

async function handlePaymentFailed(supabase: any, invoice: any) {
  try {
    // Find subscription by stripe subscription id
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', invoice.subscription)
      .single()

    if (subscription) {
      const { error } = await supabase
        .from('payment_history')
        .insert({
          subscription_id: subscription.id,
          stripe_payment_intent_id: invoice.payment_intent,
          amount_cents: invoice.amount_due,
          currency: invoice.currency,
          status: 'failed',
          payment_method: 'stripe'
        })

      if (error) {
        console.error('Error recording failed payment:', error)
      } else {
        console.log('Failed payment recorded successfully')
      }
    }
  } catch (error) {
    console.error('Error in handlePaymentFailed:', error)
  }
}