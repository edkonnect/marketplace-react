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
  discountPercent?: number; // sibling discount % (still percentage-based)
  discountAmountUsd?: number; // fixed promo coupon discount in USD
  discountLabel?: string;
}) {
  const stripe = getStripe();

  // Apply sibling % discount first, then subtract fixed coupon amount
  const afterSibling = params.discountPercent
    ? params.priceAmount * (1 - params.discountPercent / 100)
    : params.priceAmount;
  const discountedAmount = Math.max(0, afterSibling - (params.discountAmountUsd ?? 0));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: params.courseName,
            description: (params.discountPercent || params.discountAmountUsd)
              ? `One-on-one tutoring course (${params.discountLabel ?? "discount applied"})`
              : `One-on-one tutoring course`,
          },
          unit_amount: Math.round(discountedAmount * 100),
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
      console.warn(`[Stripe] Customer ${params.existingStripeCustomerId} is deleted — creating new one`);
    } catch (err: any) {
      console.warn(`[Stripe] Could not retrieve customer ${params.existingStripeCustomerId}: ${err?.message} — creating new one`);
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

// Compute the trial_end Unix timestamp for an enrollment happening now.
// Always midnight UTC on the same calendar day + 1 month, so same-day enrollments
// always produce the exact same value regardless of server timezone.
export function computeTrialEndTs(): number {
  const now = new Date();
  // Use UTC date components to avoid local-timezone drift
  const trialEnd = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1, // +1 month
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  return Math.floor(trialEnd.getTime() / 1000);
}

// Get the parent's trialing Stripe subscription whose trial_end matches today's enrollment,
// so same-day enrollments share one subscription (combined invoice).
// Different enrollment days produce different trial_end timestamps → separate subscriptions.
export async function getParentStripeSubscriptionForToday(
  stripeCustomerId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();

  const expectedTrialEnd = computeTrialEndTs();

  // Only trialing subs are eligible — active subs have already been charged
  const trialingList = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "trialing",
    limit: 10,
  });

  const match = trialingList.data.find(sub => sub.trial_end === expectedTrialEnd);
  return match ?? null;
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
  return await stripe.subscriptions.create({
    customer: params.stripeCustomerId,
    items: [{ price: params.priceId, metadata: { local_subscription_id: params.localSubscriptionId.toString() } }],
    proration_behavior: "none",
    trial_end: computeTrialEndTs(),
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
