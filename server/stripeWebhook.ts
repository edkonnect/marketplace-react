import { Request, Response } from "express";
import Stripe from "stripe";
import { getStripe } from "./stripe";
import { ENV } from "./_core/env";
import * as db from "./db";

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;

  if (ENV.stripeWebhookSecret) {
    if (!sig) {
      console.error("[Webhook] Missing stripe-signature header");
      return res.status(400).send("Missing signature");
    }
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        ENV.stripeWebhookSecret
      );
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // No webhook secret configured — parse event directly (dev/testing only)
    console.warn("[Webhook] No STRIPE_WEBHOOK_SECRET set — skipping signature verification");
    try {
      event = JSON.parse(req.body.toString()) as Stripe.Event;
    } catch (err: any) {
      return res.status(400).send("Invalid JSON body");
    }
  }

  // Handle test events
  if (event.id.startsWith('evt_test_')) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // Trial lesson payments (one-time Stripe Checkout — unchanged)
      // -----------------------------------------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[Webhook] Checkout session completed:", session.id);

        const type = session.metadata?.type || "";

        console.log(`[Webhook] checkout.session.completed type="${type}" mode="${session.mode}" customer="${session.customer}"`);

        if (type === "payment_method_setup") {
          // Setup checkout completed — save card as default then create the Stripe Subscription
          const stripeCustomerId = session.customer as string | null;
          const setupIntentId = session.setup_intent as string | null;
          const subscriptionId = parseInt(session.metadata?.subscription_id || "0");
          const courseId = parseInt(session.metadata?.course_id || "0");
          console.log(`[Webhook] payment_method_setup: customerId=${stripeCustomerId} setupIntentId=${setupIntentId} subscriptionId=${subscriptionId} courseId=${courseId}`);

          if (stripeCustomerId && setupIntentId) {
            const stripe = getStripe();
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
            const paymentMethodId = setupIntent.payment_method as string | null;

            if (paymentMethodId) {
              // Set as default payment method on the customer
              await stripe.customers.update(stripeCustomerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
              });
              console.log(`[Webhook] Default payment method set for customer ${stripeCustomerId}`);
            }
          }

          // Now create/add to the parent's Stripe Subscription (one per parent)
          if (subscriptionId && stripeCustomerId) {
            const localSub = await db.getSubscriptionById(subscriptionId);
            const course = courseId ? await db.getCourseById(courseId) : null;

            // Persist stripeCustomerId on the parent user if not already saved
            if (localSub) {
              const parentUser = await db.getUserById(localSub.parentId);
              if (!parentUser?.stripeCustomerId) {
                await db.updateUserStripeCustomerId(localSub.parentId, stripeCustomerId);
                console.log(`[Webhook] Saved stripeCustomerId ${stripeCustomerId} for user ${localSub.parentId}`);
              }
            }

            if (!localSub) {
              console.error(`[Webhook] payment_method_setup: localSub not found for subscriptionId=${subscriptionId}`);
            }
            if (!course) {
              console.error(`[Webhook] payment_method_setup: course not found for courseId=${courseId}`);
            }

            if (localSub && course) {
              const { createStripePrice, getParentStripeSubscriptionForToday, createStripeSubscription, addCourseToStripeSubscription } = await import("./stripe");

              try {
                const totalSessions = course.totalSessions || 1;
                const sessionsPerWeek = course.sessionsPerWeek || 1;
                const sessionsPerMonth = sessionsPerWeek * 4;
                const numberOfMonths = Math.max(1, Math.ceil(totalSessions / sessionsPerMonth));
                const totalPriceCents = Math.round(parseFloat(course.price) * 100);
                const monthlyAmountCents = Math.round(totalPriceCents / numberOfMonths);
                const studentName = [localSub.studentFirstName, localSub.studentLastName].filter(Boolean).join(" ");

                console.log(`[Webhook] Monthly billing: ${totalSessions} sessions, ${sessionsPerWeek}/week → ${numberOfMonths} months @ ${monthlyAmountCents} cents/month`);

                // Create a recurring price for this course
                const price = await createStripePrice({
                  courseName: course.title,
                  studentName,
                  courseId: course.id,
                  localSubscriptionId: subscriptionId,
                  monthlyAmountCents,
                });
                console.log(`[Webhook] Created Stripe price: ${price.id}`);

                // Check if parent already has a Stripe subscription created TODAY
                // Same-day enrollments share one subscription (combined invoice)
                // Different-day enrollments get a separate subscription (separate invoice)
                const existingStripeSub = await getParentStripeSubscriptionForToday(stripeCustomerId);

                let stripeSubId: string;
                let stripeItemId: string;

                if (existingStripeSub) {
                  // Add this course as a new item to the existing subscription
                  console.log(`[Webhook] Parent already has Stripe sub ${existingStripeSub.id} — adding new item`);
                  const item = await addCourseToStripeSubscription({
                    stripeSubscriptionId: existingStripeSub.id,
                    priceId: price.id,
                    localSubscriptionId: subscriptionId,
                  });
                  stripeSubId = existingStripeSub.id;
                  stripeItemId = item.id;
                  console.log(`[Webhook] Added course item ${item.id} to subscription ${stripeSubId}`);
                } else {
                  // Create a brand-new subscription for this parent
                  const stripeSub = await createStripeSubscription({
                    stripeCustomerId,
                    priceId: price.id,
                    parentId: localSub.parentId,
                    localSubscriptionId: subscriptionId,
                  });
                  stripeSubId = stripeSub.id;
                  stripeItemId = stripeSub.items.data[0].id;
                  console.log(`[Webhook] Created new Stripe subscription ${stripeSubId} with item ${stripeItemId}`);
                }

                // Save IDs — first charge happens on next billing cycle via Stripe
                // Payment record will be created when invoice.payment_succeeded fires
                await db.updateSubscription(subscriptionId, {
                  stripeSubscriptionId: stripeSubId,
                  stripeItemId,
                  paymentStatus: "paid",
                });
                console.log(`[Webhook] Subscription ${subscriptionId} linked to Stripe sub ${stripeSubId}, item ${stripeItemId}`);
              } catch (err: any) {
                console.error("[Webhook] Failed to create/update subscription after card setup:", err?.message || err);
                if (err?.raw) console.error("[Webhook] Stripe error detail:", err.raw);
              }
            }
          }
        } else if (type === "course_enrollment") {
          console.log("[Webhook] Processing course enrollment payment");

          const userId = parseInt(session.metadata?.user_id || "0");
          const subscriptionId = parseInt(session.metadata?.subscription_id || "0");
          const tutorId = parseInt(session.metadata?.tutor_id || "0");

          if (subscriptionId) {
            // Mark subscription as paid
            await db.updateSubscription(subscriptionId, { paymentStatus: "paid" });

            // Create payment record
            if (tutorId) {
              await db.createPayment({
                parentId: userId,
                tutorId,
                subscriptionId,
                sessionId: null,
                amount: ((session.amount_total || 0) / 100).toString(),
                currency: session.currency || "usd",
                status: "completed",
                stripePaymentIntentId: (session as any).payment_intent as string || null,
                stripeInvoiceId: null,
                paymentType: "subscription",
              });
            }

            console.log("[Webhook] Course enrollment payment record created for subscription", subscriptionId);
          }
        } else if (type === "trial_lesson") {
          console.log("[Webhook] Processing trial lesson payment");

          const userId = parseInt(session.metadata?.userId || session.metadata?.parentId || "0");
          const courseId = parseInt(session.metadata?.courseId || "0");
          const tutorId = parseInt(session.metadata?.tutorId || "0");
          const studentFirstName = session.metadata?.studentFirstName || "";
          const studentLastName = session.metadata?.studentLastName || "";
          const studentGrade = session.metadata?.studentGrade || "";
          const scheduledAt = parseInt(session.metadata?.scheduledAt || "0");
          const duration = parseInt(session.metadata?.duration || "60");

          // Verify eligibility again
          const trialSessions = await db.getTrialSessionsByParentId(userId);
          if (trialSessions.length >= 2) {
            console.error("[Webhook] Trial lesson limit exceeded:", userId);
            return res.status(400).send("Trial lesson limit exceeded");
          }

          // Create trial session
          const sessionId = await db.createTrialSession({
            subscriptionId: null,
            tutorId,
            parentId: userId,
            scheduledAt,
            duration,
            isTrial: true,
            status: 'scheduled',
            notes: `Trial lesson for ${studentFirstName} ${studentLastName}${studentGrade ? ` (${studentGrade})` : ''}`,
          });

          if (sessionId) {
            console.log("[Webhook] Trial session created:", sessionId);

            // Create payment record
            await db.createPayment({
              parentId: userId,
              tutorId,
              subscriptionId: null,
              sessionId,
              amount: ((session.amount_total || 0) / 100).toString(),
              currency: session.currency || "usd",
              status: "completed",
              stripePaymentIntentId: session.payment_intent as string || null,
              paymentType: "session",
            });

            console.log("[Webhook] Trial lesson payment record created");

            // Send confirmation emails
            const course = await db.getCourseById(courseId);
            const user = await db.getUserById(userId);
            const tutor = await db.getUserById(tutorId);
            const trialSession = await db.getSessionById(sessionId);

            if (course && user && tutor && trialSession && user.email && user.name && tutor.email && tutor.name) {
              const { sendBookingConfirmation, formatEmailDate, formatEmailTime } = await import('./email-helpers');
              const sessionDate = new Date(trialSession.scheduledAt);
              const studentName = `${studentFirstName} ${studentLastName}`;

              sendBookingConfirmation({
                userEmail: user.email,
                userName: user.name,
                userRole: 'parent',
                courseName: course.title,
                tutorName: tutor.name,
                sessionDate: formatEmailDate(sessionDate, user.timezone || undefined),
                sessionTime: formatEmailTime(sessionDate, user.timezone || undefined),
                sessionDuration: `${trialSession.duration} minutes`,
                sessionPrice: '$1.00 - Trial Lesson',
              }).catch(err => console.error('[Email] Failed to send trial confirmation to parent:', err));

              sendBookingConfirmation({
                userEmail: tutor.email,
                userName: tutor.name,
                userRole: 'tutor',
                courseName: course.title,
                studentName,
                sessionDate: formatEmailDate(sessionDate, tutor.timezone || undefined),
                sessionTime: formatEmailTime(sessionDate, tutor.timezone || undefined),
                sessionDuration: `${trialSession.duration} minutes`,
                sessionPrice: '$1.00 - Trial Lesson',
              }).catch(err => console.error('[Email] Failed to send trial confirmation to tutor:', err));

              await db.createInAppNotification({
                userId: tutorId,
                title: 'New Trial Lesson Booking',
                message: `${user.name} booked a trial lesson for ${course.title} with ${studentName} on ${formatEmailDate(sessionDate)}`,
                type: 'new_booking',
                relatedId: sessionId,
              }).catch(err => console.error('[Webhook] Failed to create notification:', err));

              console.log("[Webhook] Trial lesson emails and notifications sent");
            }
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Stripe Subscription created — link stripeSubscriptionId to local row
      // -----------------------------------------------------------------------
      case "customer.subscription.created": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const subscriptionId = parseInt(stripeSub.metadata?.subscription_id || "0");

        if (subscriptionId) {
          // Only link stripeSubscriptionId — do NOT overwrite paymentStatus
          // (payment_method_setup handler already set it to "paid")
          await db.updateSubscription(subscriptionId, {
            stripeSubscriptionId: stripeSub.id,
          });
          console.log(`[Webhook] Linked stripeSubscriptionId ${stripeSub.id} to local #${subscriptionId}`);
        } else {
          console.warn("[Webhook] customer.subscription.created: no subscription_id in metadata", stripeSub.id);
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Invoice created (draft) — log only
      // -----------------------------------------------------------------------
      case "invoice.created": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Invoice created: ${invoice.id} for customer ${invoice.customer}, amount: ${invoice.amount_due}`);
        break;
      }

      // -----------------------------------------------------------------------
      // Invoice finalized — log only
      // -----------------------------------------------------------------------
      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Invoice finalized: ${invoice.id}, amount_due: ${invoice.amount_due}`);
        break;
      }

      // -----------------------------------------------------------------------
      // Invoice payment succeeded — create local payment records per line item
      // -----------------------------------------------------------------------
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Invoice payment succeeded: ${invoice.id}`);

        // Idempotency check — skip if any payment was already recorded for this invoice
        const existing = await db.getPaymentByStripeInvoiceId(invoice.id);
        if (existing) {
          console.log(`[Webhook] Payment already recorded for invoice ${invoice.id}, skipping`);
          break;
        }

        const stripeSubscriptionId = (
          typeof (invoice.parent as any)?.subscription_details?.subscription === "string"
            ? (invoice.parent as any).subscription_details.subscription
            : ((invoice.parent as any)?.subscription_details?.subscription as any)?.id ?? null
        ) as string | null;
        if (!stripeSubscriptionId) {
          console.warn("[Webhook] invoice.payment_succeeded: no subscription on invoice", invoice.id);
          break;
        }
        const stripePaymentIntentId = (invoice.payments?.data?.[0] as any)?.payment_details?.payment_intent
          ?? (invoice.payments?.data?.[0] as any)?.payment_intent ?? null;
        const stripePaymentIntentIdStr = typeof stripePaymentIntentId === "string"
          ? stripePaymentIntentId : (stripePaymentIntentId as any)?.id ?? null;

        // Fetch line items from the invoice (expand if not already present)
        let lineItems = invoice.lines?.data ?? [];
        if (lineItems.length === 0) {
          try {
            const stripe = getStripe();
            const expanded = await stripe.invoices.retrieve(invoice.id, { expand: ["lines"] });
            lineItems = expanded.lines?.data ?? [];
          } catch (err) {
            console.error("[Webhook] Failed to expand invoice lines:", err);
          }
        }

        console.log(`[Webhook] Invoice ${invoice.id} has ${lineItems.length} line item(s)`);

        // Process each line item — find the matching local subscription via stripeItemId
        let anyProcessed = false;
        for (const line of lineItems) {
          // Try new parent.subscription_item_details path first, fall back to legacy top-level field
          const stripeItemId = ((line.parent as any)?.subscription_item_details?.subscription_item
            ?? (line as any).subscription_item) as string | null;
          console.log(`[Webhook] Invoice line ${line.id}: stripeItemId=${stripeItemId}, parent type=${(line.parent as any)?.type}`);
          if (!stripeItemId) continue;

          // Try to look up local sub by stripeItemId first (most accurate)
          let localSub = await db.getSubscriptionByStripeItemId(stripeItemId);
          console.log(`[Webhook] stripeItemId=${stripeItemId} → localSub=${localSub?.id ?? "not found"}`);

          if (!localSub) {
            // Fallback: read local_subscription_id from subscription item metadata in Stripe
            try {
              const stripe = getStripe();
              const item = await stripe.subscriptionItems.retrieve(stripeItemId);
              const metaSubId = parseInt(item.metadata?.local_subscription_id || "0");
              console.log(`[Webhook] subscription item ${stripeItemId} metadata local_subscription_id=${metaSubId}`);
              if (metaSubId) {
                localSub = await db.getSubscriptionById(metaSubId);
                if (localSub) {
                  // Save stripeItemId so future lookups are fast
                  await db.updateSubscription(localSub.id, { stripeItemId });
                  console.log(`[Webhook] Recovered local sub ${localSub.id} via subscription item metadata`);
                }
              }
            } catch (err) {
              console.error("[Webhook] Failed to retrieve subscription item:", stripeItemId, err);
            }
          }

          if (!localSub) {
            console.warn(`[Webhook] Could not find local subscription for Stripe item ${stripeItemId}, skipping line`);
            continue;
          }

          // Mark this subscription as paid
          await db.updateSubscription(localSub.id, { paymentStatus: "paid" });

          // Get tutor for this subscription
          const tutors = await db.getTutorsForCourse(localSub.courseId);
          const preferredTutor = localSub.preferredTutorId
            ? tutors.find(t => t.tutorId === localSub.preferredTutorId)
            : null;
          const tutorId = preferredTutor?.tutorId || tutors.find(t => t.isPrimary)?.tutorId || tutors[0]?.tutorId;

          if (!tutorId) {
            console.warn(`[Webhook] No tutor found for subscription ${localSub.id}, skipping payment record`);
            continue;
          }

          await db.createPayment({
            parentId: localSub.parentId,
            tutorId,
            subscriptionId: localSub.id,
            sessionId: null,
            amount: (line.amount / 100).toString(),
            currency: line.currency,
            status: "completed",
            stripePaymentIntentId: stripePaymentIntentIdStr,
            stripeInvoiceId: invoice.id,
            paymentType: "subscription",
          });

          console.log(`[Webhook] Payment record created for invoice ${invoice.id}, line item ${stripeItemId}, local sub ${localSub.id}`);
          anyProcessed = true;
        }

        if (!anyProcessed) {
          // No line items matched — fall back to single-subscription lookup (legacy path)
          console.warn(`[Webhook] No line items matched for invoice ${invoice.id}, trying single-subscription fallback`);
          const localSub = await db.getSubscriptionByStripeId(stripeSubscriptionId);
          if (localSub) {
            await db.updateSubscription(localSub.id, { paymentStatus: "paid" });
            const tutors = await db.getTutorsForCourse(localSub.courseId);
            const tutorId = tutors.find(t => t.tutorId === localSub.preferredTutorId)?.tutorId
              || tutors.find(t => t.isPrimary)?.tutorId || tutors[0]?.tutorId;
            if (tutorId) {
              await db.createPayment({
                parentId: localSub.parentId,
                tutorId,
                subscriptionId: localSub.id,
                sessionId: null,
                amount: (invoice.amount_paid / 100).toString(),
                currency: invoice.currency,
                status: "completed",
                stripePaymentIntentId: stripePaymentIntentIdStr,
                stripeInvoiceId: invoice.id,
                paymentType: "subscription",
              });
              console.log(`[Webhook] Fallback payment record created for invoice ${invoice.id}, sub ${localSub.id}`);
            }
          } else {
            console.warn(`[Webhook] Could not find local subscription for Stripe sub: ${stripeSubscriptionId}`);
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Invoice payment failed — mark subscription as failed
      // -----------------------------------------------------------------------
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Invoice payment failed: ${invoice.id}`);

        const stripeSubscriptionId = (
          typeof (invoice.parent as any)?.subscription_details?.subscription === "string"
            ? (invoice.parent as any).subscription_details.subscription
            : ((invoice.parent as any)?.subscription_details?.subscription as any)?.id ?? null
        ) as string | null;
        if (stripeSubscriptionId) {
          const localSubs = await db.getSubscriptionsByStripeSubId(stripeSubscriptionId);
          for (const localSub of localSubs) {
            await db.updateSubscription(localSub.id, { paymentStatus: "failed" });
            console.log(`[Webhook] Marked subscription ${localSub.id} as payment failed`);
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("[Webhook] Payment intent succeeded:", paymentIntent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("[Webhook] Payment intent failed:", paymentIntent.id);
        break;
      }

      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;
        console.log("[Webhook] Customer created:", customer.id);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing event:", error);
    res.status(500).send("Webhook processing error");
  }
}
