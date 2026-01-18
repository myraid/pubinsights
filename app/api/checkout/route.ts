import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set")
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" }) : null

const planToPriceId = (planId: string) => {
  switch (planId) {
    case "creator":
      return process.env.STRIPE_PRICE_CREATOR
    case "pro":
      return process.env.STRIPE_PRICE_PRO
    default:
      return null
  }
}

export async function POST(request: Request) {
  try {
    const { planId } = await request.json()

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    if (planId === "freemium") {
      return NextResponse.json({ url: "/" })
    }

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
    }

    const priceId = planToPriceId(planId)
    if (!priceId) {
      return NextResponse.json({ error: "Invalid planId or missing price ID" }, { status: 400 })
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL || "http://localhost:3000/?checkout=success"
    const cancelUrl = process.env.STRIPE_CANCEL_URL || "http://localhost:3000/?checkout=cancel"

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl
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
