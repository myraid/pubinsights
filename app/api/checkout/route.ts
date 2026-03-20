import { NextResponse } from "next/server"
import Stripe from "stripe"
import { adminDb } from "@/app/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is not set")
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null

async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const userDoc = await adminDb.collection('users').doc(userId).get()
  const data = userDoc.data() ?? {}

  if (data.stripeCustomerId) {
    return data.stripeCustomerId as string
  }

  const customer = await stripe!.customers.create({
    email,
    metadata: { userId },
  })

  await adminDb.collection('users').doc(userId).update({
    stripeCustomerId: customer.id,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return customer.id
}

export async function POST(request: Request) {
  try {
    const { planId, userId, email } = await request.json()

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    if (planId === "free") {
      return NextResponse.json({ url: "/" })
    }

    if (planId !== "creator") {
      return NextResponse.json({ error: "Invalid planId" }, { status: 400 })
    }

    if (!userId || !email) {
      return NextResponse.json({ error: "userId and email are required" }, { status: 400 })
    }

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
    }

    const priceId = process.env.STRIPE_PRICE_CREATOR
    if (!priceId) {
      return NextResponse.json({ error: "STRIPE_PRICE_CREATOR is not configured" }, { status: 500 })
    }

    const stripeCustomerId = await getOrCreateStripeCustomer(userId, email)

    const successUrl = process.env.STRIPE_SUCCESS_URL || "http://localhost:3000/?checkout=success"
    const cancelUrl = process.env.STRIPE_CANCEL_URL || "http://localhost:3000/?checkout=cancel"

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
