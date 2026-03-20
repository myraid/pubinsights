import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

async function getUserIdByStripeCustomer(customerId: string): Promise<string | null> {
  const snap = await adminDb
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get()
  return snap.empty ? null : snap.docs[0].id
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.userId
        if (!userId) {
          console.error('checkout.session.completed: missing userId in metadata')
          break
        }

        await adminDb.collection('users').doc(userId).update({
          subscriptionTier: 'creator',
          subscriptionStatus: 'active',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          updatedAt: FieldValue.serverTimestamp(),
        })
        console.log(`User ${userId} upgraded to creator via checkout`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getUserIdByStripeCustomer(sub.customer as string)
        if (!userId) break

        if (sub.status === 'active' || sub.status === 'trialing') {
          await adminDb.collection('users').doc(userId).update({
            subscriptionTier: 'creator',
            subscriptionStatus: sub.status,
            updatedAt: FieldValue.serverTimestamp(),
          })
        } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
          await adminDb.collection('users').doc(userId).update({
            subscriptionStatus: sub.status,
            updatedAt: FieldValue.serverTimestamp(),
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getUserIdByStripeCustomer(sub.customer as string)
        if (!userId) break

        await adminDb.collection('users').doc(userId).update({
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        console.log(`User ${userId} downgraded to free (subscription deleted)`)
        break
      }

      default:
        // Ignore unhandled event types
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
