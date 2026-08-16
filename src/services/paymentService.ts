import type Stripe from "stripe";
import prisma from "../prisma";
import { getStripe } from "./stripe";

export type SupportTier = "support_1" | "support_5" | "support_10";

const supportPriceEnvByTier: Record<SupportTier, string> = {
  support_1: "STRIPE_SUPPORT_PRICE_1_ID",
  support_5: "STRIPE_SUPPORT_PRICE_5_ID",
  support_10: "STRIPE_SUPPORT_PRICE_10_ID",
};

function appUrl(path: string) {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
  return new URL(path, baseUrl).toString();
}

function stripeId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function getOrCreateUserByClerkId(clerkId: string) {
  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId },
  });
}

export async function createCheckoutSession(user: Awaited<ReturnType<typeof getOrCreateUserByClerkId>>, priceId?: string) {
  const selectedPriceId = priceId?.trim() || process.env.STRIPE_PRICE_ID;
  if (!selectedPriceId) {
    throw new Error("Missing priceId. Send one in the request body or set STRIPE_PRICE_ID.");
  }

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomerId(user);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: selectedPriceId, quantity: 1 }],
    success_url: appUrl("/billing/success?session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: appUrl("/billing/cancel"),
    client_reference_id: String(user.id),
    metadata: {
      userId: String(user.id),
    },
  });
}

export async function createSupportCheckoutSession(
  user: Awaited<ReturnType<typeof getOrCreateUserByClerkId>>,
  tier: SupportTier,
) {
  const priceId = getSupportPriceId(tier);
  const customerId = await getOrCreateStripeCustomerId(user);

  return getStripe().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl("/support/success?session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: appUrl("/support/cancel"),
    client_reference_id: String(user.id),
    metadata: {
      userId: String(user.id),
      tier,
      kind: "support",
    },
  });
}

export async function getPaymentStatus(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    subscription: {
      status: user.subscriptionStatus,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    },
    payments,
  };
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChanged(event.data.object);
      break;
    default:
      break;
  }
}

function getSupportPriceId(tier: SupportTier) {
  const envName = supportPriceEnvByTier[tier];
  const priceId = process.env[envName];

  if (!priceId) {
    throw new Error(`${envName} missing on server`);
  }

  return priceId;
}

async function getOrCreateStripeCustomerId(user: Awaited<ReturnType<typeof getOrCreateUserByClerkId>>) {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customerParams: Stripe.CustomerCreateParams = {
    metadata: {
      userId: String(user.id),
      clerkId: user.clerkId ?? "",
    },
  };

  if (user.email) {
    customerParams.email = user.email;
  }

  const customer = await getStripe().customers.create(customerParams);

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = Number(session.client_reference_id ?? session.metadata?.userId);
  if (!Number.isInteger(userId)) return;

  await prisma.payment.upsert({
    where: { stripeCheckoutSessionId: session.id },
    update: {
      stripeCustomerId: stripeId(session.customer),
      stripeSubscriptionId: stripeId(session.subscription),
      stripePaymentIntentId: stripeId(session.payment_intent),
      mode: session.mode ?? "subscription",
      status: session.payment_status ?? session.status ?? "completed",
      amountTotal: session.amount_total,
      currency: session.currency,
    },
    create: {
      userId,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: stripeId(session.customer),
      stripeSubscriptionId: stripeId(session.subscription),
      stripePaymentIntentId: stripeId(session.payment_intent),
      mode: session.mode ?? "subscription",
      status: session.payment_status ?? session.status ?? "completed",
      amountTotal: session.amount_total,
      currency: session.currency,
    },
  });

  const customerId = stripeId(session.customer);
  const userData = {
    subscriptionStatus: session.payment_status === "paid" ? "active" : "checkout_completed",
    ...(customerId ? { stripeCustomerId: customerId } : {}),
  };

  await prisma.user.update({
    where: { id: userId },
    data: userData,
  });
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  const customerId = stripeId(subscription.customer);
  if (!customerId) return;

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
    },
  });
}
