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
  convertPendingPlanToFull?: boolean;
  externalPromoCode?: string;
  externalPromoEmail?: string;
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
      convert_pending_plan_to_full: params.convertPendingPlanToFull ? "true" : "false",
      external_promo_code: params.externalPromoCode || "",
      external_promo_email: params.externalPromoEmail || "",
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

// Create a Stripe subscription for 3-installment Test Prep plans.
// Uses cancel_at so Stripe auto-cancels after the 3rd invoice fires.
export async function createInstallmentStripeSubscription(params: {
  stripeCustomerId: string;
  priceId: string;
  parentId: number;
  localSubscriptionId: number;
  numberOfInstallments: number;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const trialEndTs = computeTrialEndTs();
  // cancel_at = trial_end + (numberOfInstallments months) in seconds
  const cancelAt = trialEndTs + params.numberOfInstallments * 30 * 24 * 60 * 60;
  return await stripe.subscriptions.create({
    customer: params.stripeCustomerId,
    items: [{ price: params.priceId, metadata: { local_subscription_id: params.localSubscriptionId.toString() } }],
    proration_behavior: "none",
    trial_end: trialEndTs,
    cancel_at: cancelAt,
    metadata: {
      parent_id: params.parentId.toString(),
      payment_type: "installment_3",
      number_of_installments: params.numberOfInstallments.toString(),
    },
  });
}

// Create a standalone (non-subscription) Stripe invoice for one usage-based billing cycle.
// Charges the parent's default payment method immediately.
export async function createUsageInvoice(params: {
  stripeCustomerId: string;
  parentId: number;
  localSubscriptionId: number;
  billingCycleId: number;
  sessionCount: number;
  perSessionRateCents: number;
  courseTitle: string;
  studentName: string;
  cycleStart: Date;
  cycleEnd: Date;
}): Promise<Stripe.Invoice> {
  return createCombinedUsageInvoice({
    stripeCustomerId: params.stripeCustomerId,
    cycleEnd: params.cycleEnd,
    billingCycleIds: [params.billingCycleId],
    lines: [{
      subscriptionId: params.localSubscriptionId,
      billingCycleId: params.billingCycleId,
      sessionCount: params.sessionCount,
      perSessionRateCents: params.perSessionRateCents,
      courseTitle: params.courseTitle,
      studentName: params.studentName,
      cycleStart: params.cycleStart,
      cycleEnd: params.cycleEnd,
    }],
  });
}

export async function createCombinedUsageInvoice(params: {
  stripeCustomerId: string;
  cycleEnd: Date;
  billingCycleIds: number[];
  lines: Array<{
    subscriptionId: number;
    billingCycleId: number;
    sessionCount: number;
    perSessionRateCents: number;
    courseTitle: string;
    studentName: string;
    cycleStart: Date;
    cycleEnd: Date;
  }>;
}): Promise<Stripe.Invoice> {
  const stripe = getStripe();
  const { format } = await import("date-fns");

  const invoice = await stripe.invoices.create({
    customer: params.stripeCustomerId,
    auto_advance: false,
    metadata: {
      type: "usage_cycle",
      billing_cycle_ids: params.billingCycleIds.join(","),
    },
  });

  // Attach one line item per subscription
  for (const line of params.lines) {
    const cycleLabel = `${format(line.cycleStart, "MMM d")} – ${format(line.cycleEnd, "MMM d, yyyy")}`;
    const description = `${line.sessionCount} session${line.sessionCount !== 1 ? "s" : ""} — ${line.courseTitle}${line.studentName ? ` (${line.studentName})` : ""} · ${cycleLabel}`;
    await stripe.invoiceItems.create({
      customer: params.stripeCustomerId,
      invoice: invoice.id,
      amount: line.sessionCount * line.perSessionRateCents,
      currency: "usd",
      description,
      metadata: {
        local_subscription_id: line.subscriptionId.toString(),
        billing_cycle_id: line.billingCycleId.toString(),
        session_count: line.sessionCount.toString(),
        per_session_rate_cents: line.perSessionRateCents.toString(),
      },
    });
  }

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);


  if (finalized.status === "paid") {
    return finalized;
  }

  try {
    const paid = await stripe.invoices.pay(invoice.id);
    return paid;
  } catch (err: any) {
    if ((err as any)?.message?.includes("already paid")) {
      const retrieved = await stripe.invoices.retrieve(invoice.id);
      return retrieved;
    }
    console.error(`[Stripe] Combined usage invoice ${invoice.id} pay() failed:`, err?.message);
    throw err;
  }
}

export async function createUsageEnrollmentCheckout(params: {
  stripeCustomerId: string;
  amountCents: number;
  courseName: string;
  courseId: number;
  userId: number;
  subscriptionId: number;
  origin: string;
}) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: params.stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `${params.courseName} — First Month` },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: { setup_future_usage: "off_session" },
    success_url: `${params.origin}/parent/dashboard?enrolled=success`,
    cancel_url: `${params.origin}/course/${params.courseId}?enrolled=cancelled`,
    metadata: {
      type: "usage_enrollment",
      subscription_id: params.subscriptionId.toString(),
      user_id: params.userId.toString(),
      course_id: params.courseId.toString(),
    },
  });
  return session;
}
