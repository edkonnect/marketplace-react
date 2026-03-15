import Stripe from "stripe";
import { ENV } from "./_core/env";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    });
  }
  return _stripe;
}

export async function createCheckoutSession(params: {
  priceAmount: number; // Amount in dollars
  courseName: string;
  courseId: number;
  userId: number;
  userEmail: string | null;
  userName: string | null;
  origin: string;
  subscriptionId?: number;
  tutorId?: number;
  discountPercent?: number; // e.g. 5 for 5%
}) {
  const stripe = getStripe();

  const discountedAmount = params.discountPercent
    ? params.priceAmount * (1 - params.discountPercent / 100)
    : params.priceAmount;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: params.courseName,
            description: params.discountPercent
              ? `One-on-one tutoring course (${params.discountPercent}% sibling discount applied)`
              : `One-on-one tutoring course`,
          },
          unit_amount: Math.round(discountedAmount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    customer_email: params.userEmail || undefined,
    client_reference_id: params.userId.toString(),
    metadata: {
      type: "course_enrollment",
      user_id: params.userId.toString(),
      course_id: params.courseId.toString(),
      subscription_id: params.subscriptionId?.toString() || "",
      tutor_id: params.tutorId?.toString() || "",
      customer_email: params.userEmail || "",
      customer_name: params.userName || "",
    },
    allow_promotion_codes: true,
    success_url: `${params.origin}/parent/dashboard?payment=success`,
    cancel_url: `${params.origin}/course/${params.courseId}?payment=cancelled`,
  });

  return session;
}

export async function createCustomer(params: {
  email: string;
  name?: string;
  userId: number;
}) {
  const stripe = getStripe();

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      user_id: params.userId.toString(),
    },
  });

  return customer;
}

export async function getOrCreateStripeCustomer(params: {
  userId: number;
  email: string;
  name?: string | null;
  existingStripeCustomerId?: string | null;
}): Promise<string> {
  const stripe = getStripe();

  if (params.existingStripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(params.existingStripeCustomerId);
      if (!existing.deleted) {
        return existing.id;
      }
    } catch {
      // Customer not found in Stripe — create a new one
    }
  }

  const customer = await createCustomer({
    email: params.email,
    name: params.name ?? undefined,
    userId: params.userId,
  });

  return customer.id;
}

// Create a Stripe Price for one course (used when adding a course item to a subscription)
export async function createStripePrice(params: {
  courseName: string;
  studentName: string;
  courseId: number;
  localSubscriptionId: number;
  monthlyAmountCents: number;
}): Promise<Stripe.Price> {
  const stripe = getStripe();
  const product = await stripe.products.create({
    name: params.courseName,
    description: params.studentName,
    metadata: {
      courseId: params.courseId.toString(),
      localSubscriptionId: params.localSubscriptionId.toString(),
    },
  });
  return await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: params.monthlyAmountCents,
    recurring: { interval: "month" },
  });
}

// Get the parent's Stripe subscription created on the same calendar day (UTC), if any.
// Only subscriptions created today are eligible for combining — different day = separate invoice.
export async function getParentStripeSubscriptionForToday(
  stripeCustomerId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();

  // Fetch both active and trialing (new subs start as trialing when trial_end is set)
  const [activeList, trialingList] = await Promise.all([
    stripe.subscriptions.list({ customer: stripeCustomerId, status: "active", limit: 10 }),
    stripe.subscriptions.list({ customer: stripeCustomerId, status: "trialing", limit: 10 }),
  ]);

  const allSubs = [...activeList.data, ...trialingList.data];

  // Today's date boundaries in UTC
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);

  const todaySub = allSubs.find(sub => {
    const createdAt = sub.created * 1000;
    return createdAt >= startOfToday.getTime() && createdAt < startOfTomorrow.getTime();
  });

  return todaySub ?? null;
}

// Add a new course item to the parent's existing Stripe subscription
export async function addCourseToStripeSubscription(params: {
  stripeSubscriptionId: string;
  priceId: string;
  localSubscriptionId: number;
}): Promise<Stripe.SubscriptionItem> {
  const stripe = getStripe();
  return await stripe.subscriptionItems.create({
    subscription: params.stripeSubscriptionId,
    price: params.priceId,
    proration_behavior: "none",
    metadata: {
      local_subscription_id: params.localSubscriptionId.toString(),
    },
  });
}

// Create a brand-new Stripe subscription for a parent (first course enrollment)
// trial_end defers the first charge by 1 month so billing starts next cycle
export async function createStripeSubscription(params: {
  stripeCustomerId: string;
  priceId: string;
  parentId: number;
  localSubscriptionId: number;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const trialEnd = new Date();
  trialEnd.setMonth(trialEnd.getMonth() + 1);
  trialEnd.setHours(0, 0, 0, 0);
  return await stripe.subscriptions.create({
    customer: params.stripeCustomerId,
    items: [{ price: params.priceId, metadata: { local_subscription_id: params.localSubscriptionId.toString() } }],
    proration_behavior: "none",
    trial_end: Math.floor(trialEnd.getTime() / 1000),
    metadata: {
      parent_id: params.parentId.toString(),
    },
  });
}

export async function createSetupCheckoutSession(params: {
  stripeCustomerId: string;
  origin: string;
  courseId: number;
  subscriptionId: number;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return await stripe.checkout.sessions.create({
    mode: "setup",
    customer: params.stripeCustomerId,
    currency: "usd",
    metadata: {
      type: "payment_method_setup",
      subscription_id: params.subscriptionId.toString(),
      course_id: params.courseId.toString(),
    },
    success_url: `${params.origin}/parent/dashboard?setup=success`,
    cancel_url: `${params.origin}/parent/dashboard?setup=cancelled`,
  });
}

export async function listStripeInvoicesForCustomer(
  stripeCustomerId: string,
  limit = 24
): Promise<Stripe.Invoice[]> {
  const stripe = getStripe();
  const response = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit,
    expand: ["data.lines"],
  });
  return response.data;
}

export async function getPaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function getCustomer(customerId: string) {
  const stripe = getStripe();
  return await stripe.customers.retrieve(customerId);
}
