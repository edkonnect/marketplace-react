import { Request, Response } from "express";
import Stripe from "stripe";
import { getStripe } from "./stripe";
import { ENV } from "./_core/env";
import * as db from "./db";
import { sendCouponRewardEmail, sendEnrollmentConfirmation, sendTutorEnrollmentNotification } from "./email-helpers";

/**
 * Called after the referred user's first enrollment is confirmed.
 * Only rewards the REFERRER — referred user already got their coupon at email verification.
 */
async function processReferralReward(parentId: number): Promise<void> {
  try {
    const parentUser = await db.getUserById(parentId);
    if (!parentUser || !parentUser.referredBy) return;

    const referral = await db.getReferralByReferredUserId(parentId);
    if (!referral || referral.status === "rewarded") return;

    const referrerUser = await db.getUserByReferralCode(parentUser.referredBy);
    if (!referrerUser) return;

    // Only create coupon for the referrer (amounts are 0; resolved at enrollment based on course price)
    const referrerCoupon = await db.createCoupon({ userId: referrerUser.id, sourceReferralId: referral.id });

    await db.updateReferralRewarded(referral.id);

    if (referrerCoupon && referrerUser.email) {
      const parentName = `${parentUser.firstName} ${parentUser.lastName}`.trim();
      const referrerName = `${referrerUser.firstName} ${referrerUser.lastName}`.trim();
      await sendCouponRewardEmail({ userEmail: referrerUser.email, userName: referrerName, couponCode: referrerCoupon.code, reason: "referrer", friendName: parentName }).catch(() => {});
    }
  } catch (err) {
    console.error("[Webhook] processReferralReward failed:", err);
  }
}

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

  // Only log actionable events — suppress noise
  const silentEvents = ["setup_intent.created","setup_intent.succeeded","payment_method.attached","customer.updated","product.created","plan.created","price.created","invoice.paid","invoice_payment.paid","charge.succeeded","payment_intent.created","test_helpers.test_clock.advancing","test_helpers.test_clock.ready","invoice.updated","invoice.created","invoice.finalized","customer.subscription.created","payment_intent.succeeded","payment_intent.failed","customer.created"];
  if (silentEvents.includes(event.type)) return res.json({ received: true });

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // Trial lesson payments (one-time Stripe Checkout — unchanged)
      // -----------------------------------------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const type = session.metadata?.type || "";

        if (type === "payment_method_setup") {
          // Setup checkout completed — save card as default then create the Stripe Subscription
          const stripeCustomerId = session.customer as string | null;
          const setupIntentId = session.setup_intent as string | null;
          const subscriptionId = parseInt(session.metadata?.subscription_id || "0");
          const courseId = parseInt(session.metadata?.course_id || "0");

          if (stripeCustomerId && setupIntentId) {
            const stripe = getStripe();
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
            const paymentMethodId = setupIntent.payment_method as string | null;

            if (paymentMethodId) {
              // Set as default payment method on the customer
              await stripe.customers.update(stripeCustomerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
              });
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
              }
            }

            if (!localSub) {
              console.error(`[Webhook] payment_method_setup: localSub not found for subscriptionId=${subscriptionId}`);
            }
            if (!course) {
              console.error(`[Webhook] payment_method_setup: course not found for courseId=${courseId}`);
            }

            if (localSub && course) {
              const isUsageBased = localSub.paymentPlan === "monthly" && localSub.perSessionRateCents != null;

              if (isUsageBased) {
                // Usage-based (tutor/homework): don't create a Stripe subscription item.
                // Billing is handled entirely by the cron's standalone usage invoices.
                // Just mark the subscription as paid (card is saved on the Stripe customer).
                try {
                  await db.updateSubscription(subscriptionId, { paymentStatus: "paid" });
                  const localSubForReferral = await db.getSubscriptionById(subscriptionId);
                  if (localSubForReferral?.parentId) {
                    await processReferralReward(localSubForReferral.parentId);
                  }
                  // Send enrollment confirmation emails
                  try {
                    const parentUser = await db.getUserById(localSub.parentId);
                    const tutorUser = localSub.preferredTutorId ? await db.getUserById(localSub.preferredTutorId) : null;
                    const studentName = [localSub.studentFirstName, localSub.studentLastName].filter(Boolean).join(" ");
                    const coursePrice = course.price ? `$${parseFloat(course.price).toFixed(2)}` : "";
                    const tutorName = tutorUser ? [tutorUser.firstName, tutorUser.lastName].filter(Boolean).join(" ") : "Your tutor";
                    if (parentUser?.email) {
                      await sendEnrollmentConfirmation({
                        userEmail: parentUser.email,
                        userName: [parentUser.firstName, parentUser.lastName].filter(Boolean).join(" ") || parentUser.email,
                        courseName: course.title,
                        tutorName,
                        studentName,
                        coursePrice,
                        courseId: course.id,
                      });
                    }
                    if (tutorUser?.email) {
                      await sendTutorEnrollmentNotification({
                        tutorEmail: tutorUser.email,
                        tutorName,
                        courseName: course.title,
                        studentName,
                        parentName: [parentUser?.firstName, parentUser?.lastName].filter(Boolean).join(" "),
                        sessionsPerWeek: course.sessionsPerWeek ?? undefined,
                        totalSessions: course.totalSessions ?? null,
                      });
                    }
                  } catch (emailErr: any) {
                    console.error("[Webhook] Failed to send enrollment emails (usage-based card setup):", emailErr?.message);
                  }
                  console.log(`[Webhook] ✓ Usage-based enrollment card saved: sub=${subscriptionId}, customer=${stripeCustomerId}`);
                } catch (err: any) {
                  console.error("[Webhook] Failed to update usage-based subscription after card setup:", err?.message || err);
                }
              } else {
              const { createStripePrice, getParentStripeSubscriptionForToday, createStripeSubscription, addCourseToStripeSubscription } = await import("./stripe");

              try {
                const totalSessions = course.totalSessions || 1;
                const sessionsPerWeek = course.sessionsPerWeek || 1;
                const sessionsPerMonth = sessionsPerWeek * 4;
                const numberOfMonths = Math.max(1, Math.ceil(totalSessions / sessionsPerMonth));
                const rawPriceCents = Math.round(parseFloat(course.price) * 100);
                const siblingPct = localSub.siblingDiscountApplied ? 5 : 0;
                const promoAmountCents = Math.round(parseFloat(localSub.promoDiscountAmount ?? "0") * 100);
                const afterSiblingCents = siblingPct > 0
                  ? Math.round(rawPriceCents * (1 - siblingPct / 100))
                  : rawPriceCents;
                const totalPriceCents = Math.max(0, afterSiblingCents - promoAmountCents);
                const monthlyAmountCents = Math.round(totalPriceCents / numberOfMonths);
                  const studentName = [localSub.studentFirstName, localSub.studentLastName].filter(Boolean).join(" ");


                // Create a recurring price for this course
                const price = await createStripePrice({
                  courseName: course.title,
                  studentName,
                  courseId: course.id,
                  localSubscriptionId: subscriptionId,
                  monthlyAmountCents,
                });

                // Check if parent already has a Stripe subscription created TODAY
                // Same-day enrollments share one subscription (combined invoice)
                // Different-day enrollments get a separate subscription (separate invoice)
                const { computeTrialEndTs } = await import("./stripe");
                const existingStripeSub = await getParentStripeSubscriptionForToday(stripeCustomerId);

                let stripeSubId: string;
                let stripeItemId: string;

                if (existingStripeSub) {
                  // Add this course as a new item to the existing subscription
                  const item = await addCourseToStripeSubscription({
                    stripeSubscriptionId: existingStripeSub.id,
                    priceId: price.id,
                    localSubscriptionId: subscriptionId,
                  });
                  stripeSubId = existingStripeSub.id;
                  stripeItemId = item.id;
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
                }

                // Save IDs — first charge happens on next billing cycle via Stripe
                // Payment record will be created when invoice.payment_succeeded fires
                await db.updateSubscription(subscriptionId, {
                  stripeSubscriptionId: stripeSubId,
                  stripeItemId,
                  paymentStatus: "paid",
                });
                // Trigger referral reward on first enrollment
                const localSubForReferral = await db.getSubscriptionById(subscriptionId);
                if (localSubForReferral?.parentId) {
                  await processReferralReward(localSubForReferral.parentId);
                }
                // Send enrollment confirmation emails
                try {
                  const parentUser = await db.getUserById(localSub.parentId);
                  const tutorUser = localSub.preferredTutorId ? await db.getUserById(localSub.preferredTutorId) : null;
                  const studentName = [localSub.studentFirstName, localSub.studentLastName].filter(Boolean).join(" ");
                  const coursePrice = course.price ? `$${parseFloat(course.price).toFixed(2)}` : "";
                  const tutorName = tutorUser ? [tutorUser.firstName, tutorUser.lastName].filter(Boolean).join(" ") : "Your tutor";
                  if (parentUser?.email) {
                    await sendEnrollmentConfirmation({
                      userEmail: parentUser.email,
                      userName: [parentUser.firstName, parentUser.lastName].filter(Boolean).join(" ") || parentUser.email,
                      courseName: course.title,
                      tutorName,
                      studentName,
                      coursePrice,
                      courseId: course.id,
                    });
                  }
                  if (tutorUser?.email) {
                    await sendTutorEnrollmentNotification({
                      tutorEmail: tutorUser.email,
                      tutorName,
                      courseName: course.title,
                      studentName,
                      parentName: [parentUser?.firstName, parentUser?.lastName].filter(Boolean).join(" "),
                      sessionsPerWeek: course?.sessionsPerWeek ?? undefined,
                      totalSessions: course?.totalSessions ?? null,
                    });
                  }
                } catch (emailErr: any) {
                  console.error("[Webhook] Failed to send enrollment emails (payment_method_setup):", emailErr?.message);
                }
                console.log(`[Webhook] ✓ Enrollment setup: sub=${subscriptionId} → Stripe ${stripeSubId} (${existingStripeSub ? "combined" : "new"})`);
              } catch (err: any) {
                console.error("[Webhook] Failed to create/update subscription after card setup:", err?.message || err);
                if (err?.raw) console.error("[Webhook] Stripe error detail:", err.raw);
              }
              }
            }
          }
        } else if (type === "installment_setup") {
          // 3-installment Test Prep: same as payment_method_setup but uses
          // createInstallmentStripeSubscription so Stripe auto-cancels after N invoices.
          const stripeCustomerId = session.customer as string | null;
          const setupIntentId = session.setup_intent as string | null;
          const subscriptionId = parseInt(session.metadata?.subscription_id || "0");
          const courseId = parseInt(session.metadata?.course_id || "0");
          const installmentAmountCents = parseInt(session.metadata?.installment_amount_cents || "0");

          if (stripeCustomerId && setupIntentId) {
            const stripe = getStripe();
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
            const paymentMethodId = setupIntent.payment_method as string | null;
            if (paymentMethodId) {
              await stripe.customers.update(stripeCustomerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
              });
            }
          }

          if (subscriptionId && stripeCustomerId && installmentAmountCents > 0) {
            const localSub = await db.getSubscriptionById(subscriptionId);
            const course = courseId ? await db.getCourseById(courseId) : null;

            if (localSub) {
              const parentUser = await db.getUserById(localSub.parentId);
              if (!parentUser?.stripeCustomerId) {
                await db.updateUserStripeCustomerId(localSub.parentId, stripeCustomerId);
              }
            }

            if (localSub && course) {
              const { createStripePrice, createInstallmentStripeSubscription } = await import("./stripe");
              try {
                const studentName = [localSub.studentFirstName, localSub.studentLastName].filter(Boolean).join(" ");
                const numberOfInstallments = localSub.numberOfInstallments ?? 3;

                const price = await createStripePrice({
                  courseName: course.title,
                  studentName,
                  courseId: course.id,
                  localSubscriptionId: subscriptionId,
                  monthlyAmountCents: installmentAmountCents,
                });

                const stripeSub = await createInstallmentStripeSubscription({
                  stripeCustomerId,
                  priceId: price.id,
                  parentId: localSub.parentId,
                  localSubscriptionId: subscriptionId,
                  numberOfInstallments,
                });

                await db.updateSubscription(subscriptionId, {
                  stripeSubscriptionId: stripeSub.id,
                  stripeItemId: stripeSub.items.data[0].id,
                  paymentStatus: "paid",
                });
                await processReferralReward(localSub.parentId);
                // Send enrollment confirmation emails
                try {
                  const parentUser = await db.getUserById(localSub.parentId);
                  const tutorUser = localSub.preferredTutorId ? await db.getUserById(localSub.preferredTutorId) : null;
                  const coursePrice = course.price ? `$${parseFloat(course.price).toFixed(2)}` : "";
                  const tutorName = tutorUser ? [tutorUser.firstName, tutorUser.lastName].filter(Boolean).join(" ") : "Your tutor";
                  if (parentUser?.email) {
                    await sendEnrollmentConfirmation({
                      userEmail: parentUser.email,
                      userName: [parentUser.firstName, parentUser.lastName].filter(Boolean).join(" ") || parentUser.email,
                      courseName: course.title,
                      tutorName,
                      studentName,
                      coursePrice,
                      courseId: course.id,
                    });
                  }
                  if (tutorUser?.email) {
                    await sendTutorEnrollmentNotification({
                      tutorEmail: tutorUser.email,
                      tutorName,
                      courseName: course.title,
                      studentName,
                      parentName: [parentUser?.firstName, parentUser?.lastName].filter(Boolean).join(" "),
                      sessionsPerWeek: course?.sessionsPerWeek ?? undefined,
                      totalSessions: course?.totalSessions ?? null,
                    });
                  }
                } catch (emailErr: any) {
                  console.error("[Webhook] Failed to send enrollment emails (installment_setup):", emailErr?.message);
                }
                console.log(`[Webhook] ✓ Installment setup: sub=${subscriptionId} → Stripe ${stripeSub.id} (${numberOfInstallments} installments)`);
              } catch (err: any) {
                console.error("[Webhook] Failed to create installment subscription:", err?.message);
              }
            }
          }
        } else if (type === "usage_enrollment") {
          // Tutor/homework upfront first-month payment completed
          const subscriptionId = parseInt(session.metadata?.subscription_id || "0");
          const userId = parseInt(session.metadata?.user_id || "0");

          if (subscriptionId) {
            try {
              // Persist stripeCustomerId on parent user
              const stripeCustomerId = session.customer as string | null;
              if (stripeCustomerId && userId) {
                const parentUser = await db.getUserById(userId);
                if (!parentUser?.stripeCustomerId) {
                  await db.updateUserStripeCustomerId(userId, stripeCustomerId);
                }
              }

              // Activate subscription
              await db.updateSubscription(subscriptionId, { paymentStatus: "paid", status: "active" });

              // Record the upfront payment as the first billing cycle (pre-paid)
              const localSub = await db.getSubscriptionById(subscriptionId);
              if (localSub?.billingCycleStart && localSub?.billingCycleEnd) {
                await db.createBillingCycle({
                  subscriptionId,
                  cycleStart: localSub.billingCycleStart as Date,
                  cycleEnd: localSub.billingCycleEnd as Date,
                  sessionsCount: 0,
                  amountCents: session.amount_total ?? 0,
                  status: "paid",
                  stripeInvoiceId: session.payment_intent as string || null,
                });
              }

              // Create payment record so it shows in billing history
              const amountTotal = session.amount_total ?? 0;
              if (amountTotal > 0 && userId && localSub?.preferredTutorId) {
                await db.createPayment({
                  parentId: userId,
                  tutorId: localSub.preferredTutorId,
                  subscriptionId,
                  sessionId: null,
                  amount: (amountTotal / 100).toFixed(2),
                  currency: session.currency || "usd",
                  status: "completed",
                  stripePaymentIntentId: session.payment_intent as string || null,
                  stripeInvoiceId: null,
                  paymentType: "subscription",
                });
              }

              if (userId) await processReferralReward(userId);
              // Send enrollment confirmation emails
              try {
                const courseId = parseInt(session.metadata?.course_id || "0");
                const course = courseId ? await db.getCourseById(courseId) : null;
                const parentUser = userId ? await db.getUserById(userId) : null;
                const tutorUser = localSub?.preferredTutorId ? await db.getUserById(localSub.preferredTutorId) : null;
                if (course && parentUser?.email) {
                  const studentName = localSub ? [localSub.studentFirstName, localSub.studentLastName].filter(Boolean).join(" ") : "";
                  const coursePrice = course.price ? `$${parseFloat(course.price).toFixed(2)}` : "";
                  const tutorName = tutorUser ? [tutorUser.firstName, tutorUser.lastName].filter(Boolean).join(" ") : "Your tutor";
                  await sendEnrollmentConfirmation({
                    userEmail: parentUser.email,
                    userName: [parentUser.firstName, parentUser.lastName].filter(Boolean).join(" ") || parentUser.email,
                    courseName: course.title,
                    tutorName,
                    studentName,
                    coursePrice,
                    courseId: course.id,
                  });
                  if (tutorUser?.email) {
                    await sendTutorEnrollmentNotification({
                      tutorEmail: tutorUser.email,
                      tutorName,
                      courseName: course.title,
                      studentName,
                      parentName: [parentUser.firstName, parentUser.lastName].filter(Boolean).join(" "),
                      sessionsPerWeek: course?.sessionsPerWeek ?? undefined,
                      totalSessions: course?.totalSessions ?? null,
                    });
                  }
                }
              } catch (emailErr: any) {
                console.error("[Webhook] Failed to send enrollment emails (usage_enrollment):", emailErr?.message);
              }
              console.log(`[Webhook] ✓ Usage enrollment upfront paid: sub=${subscriptionId}, amount=${session.amount_total}`);
            } catch (err: any) {
              console.error("[Webhook] Failed to process usage_enrollment:", err?.message);
            }
          }
        } else if (type === "course_enrollment") {

          const userId = parseInt(session.metadata?.user_id || "0");
          const subscriptionId = parseInt(session.metadata?.subscription_id || "0");
          const tutorId = parseInt(session.metadata?.tutor_id || "0");

          if (subscriptionId) {
            // Mark subscription as paid
            await db.updateSubscription(subscriptionId, { paymentStatus: "paid" });
            // Trigger referral reward on first enrollment
            if (userId) await processReferralReward(userId);

            // Pay-in-full: Stripe Checkout mode=payment charges immediately.
            // No invoice.payment_succeeded fires for one-time payments, so we
            // must create the payment record here so it shows in billing history.
            const amountTotal = session.amount_total || 0;
            const localSubForCourse = await db.getSubscriptionById(subscriptionId);
            const resolvedTutorId = tutorId || localSubForCourse?.preferredTutorId || 0;
            if (amountTotal > 0 && userId && resolvedTutorId) {
              await db.createPayment({
                parentId: userId,
                tutorId: resolvedTutorId,
                subscriptionId,
                sessionId: null,
                amount: (amountTotal / 100).toFixed(2),
                currency: session.currency || "usd",
                status: "completed",
                stripePaymentIntentId: session.payment_intent as string || null,
                stripeInvoiceId: null,
                paymentType: "subscription",
              });
            }
            // Send enrollment confirmation emails
            try {
              const courseId = parseInt(session.metadata?.course_id || "0");
              const course = courseId ? await db.getCourseById(courseId) : null;
              const parentUser = userId ? await db.getUserById(userId) : null;
              const tutorUser = resolvedTutorId ? await db.getUserById(resolvedTutorId) : null;
              if (course && parentUser?.email && localSubForCourse) {
                const studentName = [localSubForCourse.studentFirstName, localSubForCourse.studentLastName].filter(Boolean).join(" ");
                const coursePrice = course.price ? `$${parseFloat(course.price).toFixed(2)}` : "";
                const tutorName = tutorUser ? [tutorUser.firstName, tutorUser.lastName].filter(Boolean).join(" ") : "Your tutor";
                await sendEnrollmentConfirmation({
                  userEmail: parentUser.email,
                  userName: [parentUser.firstName, parentUser.lastName].filter(Boolean).join(" ") || parentUser.email,
                  courseName: course.title,
                  tutorName,
                  studentName,
                  coursePrice,
                  courseId: course.id,
                });
                if (tutorUser?.email) {
                  await sendTutorEnrollmentNotification({
                    tutorEmail: tutorUser.email,
                    tutorName,
                    courseName: course.title,
                    studentName,
                    parentName: [parentUser.firstName, parentUser.lastName].filter(Boolean).join(" "),
                    sessionsPerWeek: course?.sessionsPerWeek ?? undefined,
                    totalSessions: course?.totalSessions ?? null,
                  });
                }
              }
            } catch (emailErr: any) {
              console.error("[Webhook] Failed to send enrollment emails (course_enrollment):", emailErr?.message);
            }
          }
        } else if (type === "trial_lesson") {

          const userId = parseInt(session.metadata?.userId || session.metadata?.parentId || "0");
          const courseId = parseInt(session.metadata?.courseId || "0");
          const tutorId = parseInt(session.metadata?.tutorId || "0");
          const studentFirstName = session.metadata?.studentFirstName || "";
          const studentLastName = session.metadata?.studentLastName || "";
          const studentGrade = session.metadata?.studentGrade || "";
          const scheduledAt = parseInt(session.metadata?.scheduledAt || "0");
          const duration = parseInt(session.metadata?.duration || "60");

          // BUG 2: Validate all critical metadata fields before proceeding
          // Prevents garbage sessions with parentId=0, scheduledAt=1970, etc.
          if (!userId || !tutorId || !courseId || !scheduledAt) {
            console.error("[Webhook] Invalid trial_lesson metadata — missing critical fields:", session.metadata);
            return res.status(400).send("Invalid trial lesson metadata");
          }

          // BUG 6: Reject if the scheduled time is too far in the past (>6 hours)
          // Stripe webhook can be delayed; anything more than 6h past is unrecoverable
          if (scheduledAt < Date.now() - 6 * 60 * 60 * 1000) {
            console.error("[Webhook] Trial session scheduled in the past:", new Date(scheduledAt).toISOString(), "parentId:", userId);
            return res.status(400).send("Trial session time has already passed");
          }

          // BUG 7: Validate duration is a sane number (15 min to 8 hours)
          if (duration < 15 || duration > 480) {
            console.error("[Webhook] Invalid trial session duration:", duration, "parentId:", userId);
            return res.status(400).send("Invalid session duration");
          }

          // Verify eligibility again
          const trialSessions = await db.getTrialSessionsByParentId(userId);
          if (trialSessions.length >= 2) {
            console.error("[Webhook] Trial lesson limit exceeded:", userId);
            return res.status(400).send("Trial lesson limit exceeded");
          }

          // BUG 4: Wrap session creation in try/catch for SESSION_CONFLICT
          // Without this, if two parents race for the same slot, the second parent
          // gets charged $1 but no session is created (money lost, no session).
          let sessionId: number | null = null;
          try {
            sessionId = await db.createTrialSession({
              subscriptionId: null,
              tutorId,
              parentId: userId,
              scheduledAt,
              duration,
              isTrial: true,
              status: 'scheduled',
              studentFirstName,
              studentLastName,
              studentGrade,
              courseId,
              notes: `Trial lesson for ${studentFirstName} ${studentLastName}${studentGrade ? ` (${studentGrade})` : ''}`,
            });
          } catch (err: any) {
            if (err?.message === 'SESSION_CONFLICT') {
              console.error("[Webhook] Trial slot conflict — slot already taken. parentId:", userId, "scheduledAt:", new Date(scheduledAt).toISOString());
              // The parent was charged $1 but the slot is taken. Log for manual refund review.
              // In production: trigger stripe.refunds.create({ payment_intent: session.payment_intent })
              return res.status(409).send("Session slot conflict — slot already booked");
            }
            throw err;
          }

          if (sessionId) {

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
        } else {
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Invoice created (draft) — log only
      // -----------------------------------------------------------------------
      case "invoice.created":
      case "invoice.finalized":
        break;

      // -----------------------------------------------------------------------
      // Invoice payment succeeded — create local payment records per line item
      // -----------------------------------------------------------------------
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        // Skip $0 invoices — these are trial period confirmations, not real charges
        if (invoice.amount_paid === 0) {
            break;
        }

        // Idempotency check — skip if any payment was already recorded for this invoice
        const existing = await db.getPaymentByStripeInvoiceId(invoice.id);
        if (existing) {
            break;
        }

        // Handle usage-based invoices (standalone, no Stripe subscription)
        if (invoice.metadata?.type === "usage_cycle") {
          const billingCycleId = parseInt(invoice.metadata?.billing_cycle_id || "0");
          const localSubId = parseInt(invoice.metadata?.local_subscription_id || "0");
          if (billingCycleId) {
            await db.updateBillingCycle(billingCycleId, {
              status: "paid",
              stripeInvoiceId: invoice.id,
              processedAt: new Date(),
            });
          }
          if (localSubId) {
            const localSub = await db.getSubscriptionById(localSubId);
            if (localSub) {
              const tutors = await db.getTutorsForCourse(localSub.courseId);
              const tutorId = localSub.preferredTutorId
                ? tutors.find((t: any) => t.tutorId === localSub.preferredTutorId)?.tutorId
                : undefined;
              const resolvedTutorId = tutorId || tutors.find((t: any) => t.isPrimary)?.tutorId || tutors[0]?.tutorId;
              if (resolvedTutorId) {
                const stripePaymentIntentId = (invoice.payments?.data?.[0] as any)?.payment_details?.payment_intent
                  ?? (invoice.payments?.data?.[0] as any)?.payment_intent ?? null;
                const piStr = typeof stripePaymentIntentId === "string"
                  ? stripePaymentIntentId : (stripePaymentIntentId as any)?.id ?? null;
                await db.createPayment({
                  parentId: localSub.parentId,
                  tutorId: resolvedTutorId,
                  subscriptionId: localSubId,
                  sessionId: null,
                  amount: (invoice.amount_paid / 100).toFixed(2),
                  currency: invoice.currency,
                  status: "completed",
                  stripePaymentIntentId: piStr,
                  stripeInvoiceId: invoice.id,
                  paymentType: "subscription",
                });
                console.log(`[Webhook] ✓ Usage cycle payment recorded: sub=${localSubId}, cycle=${billingCycleId}`);
              }
            }
          }
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


        // Process each line item — find the matching local subscription via stripeItemId
        let anyProcessed = false;
        let anySkippedAsCompleted = false;
        for (const line of lineItems) {
          // Try new parent.subscription_item_details path first, fall back to legacy top-level field
          const stripeItemId = ((line.parent as any)?.subscription_item_details?.subscription_item
            ?? (line as any).subscription_item) as string | null;
          if (!stripeItemId) continue;

          // Try to look up local sub by stripeItemId first (most accurate)
          let localSub = await db.getSubscriptionByStripeItemId(stripeItemId);

          if (!localSub) {
            // Fallback: read local_subscription_id from subscription item metadata in Stripe
            try {
              const stripe = getStripe();
              const item = await stripe.subscriptionItems.retrieve(stripeItemId);
              const metaSubId = parseInt(item.metadata?.local_subscription_id || "0");
              if (metaSubId) {
                localSub = await db.getSubscriptionById(metaSubId);
                if (localSub) {
                  // Save stripeItemId so future lookups are fast
                  await db.updateSubscription(localSub.id, { stripeItemId });
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

          // Skip if this subscription is already fully paid — prevents over-charging
          // if Stripe fires an invoice after we've already removed the item
          if (localSub.paymentStatus === "completed") {
              anySkippedAsCompleted = true;
            continue;
          }

          // Skip usage-based (tutor/homework monthly) subscriptions on subscription invoices.
          // Their billing is handled exclusively via standalone usage invoices from the cron job.
          if (localSub.paymentPlan === "monthly" && localSub.perSessionRateCents) {
            console.log(`[Webhook] Skipping usage-based sub ${localSub.id} on subscription invoice — billed via cron`);
            anySkippedAsCompleted = true;
            continue;
          }

          // Compute how many instalments this course requires.
          // For installment plans, use the explicit numberOfInstallments field.
          // For monthly plans, derive from session count (existing logic).
          const course = await db.getCourseById(localSub.courseId);
          const numberOfMonths = localSub.paymentPlan === "installment"
            ? (localSub.numberOfInstallments ?? 3)
            : course
              ? Math.max(1, Math.ceil((course.totalSessions || 1) / ((course.sessionsPerWeek || 1) * 4)))
              : null;

          // Count real payments already recorded for this subscription (BEFORE creating this one)
          const existingPayments = await db.getPaymentsBySubscriptionId(localSub.id);
          const paidCount = existingPayments.filter(
            (p: any) => p.status === "completed" && p.paymentType === "subscription" && parseFloat(p.amount) > 0
          ).length;

          // If already at the instalment limit, skip — handles race conditions where multiple
          // invoices arrive simultaneously (e.g. when test clock is advanced rapidly)
          if (numberOfMonths !== null && paidCount >= numberOfMonths) {
            console.log(`[Webhook] ⚠ Sub ${localSub.id} at limit (${paidCount}/${numberOfMonths}) — blocked extra charge`);
            anySkippedAsCompleted = true;
            // Still try to remove Stripe item in case previous attempt failed
            if (localSub.stripeItemId) {
              try {
                await getStripe().subscriptionItems.del(localSub.stripeItemId, { proration_behavior: "none" });
                await db.updateSubscription(localSub.id, { paymentStatus: "completed" });
              } catch (_) { /* already deleted */ }
            }
            continue;
          }

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

          const newPaidCount = paidCount + 1;
          console.log(`[Webhook] Payment ${newPaidCount}/${numberOfMonths ?? "?"} recorded for sub ${localSub.id}, invoice ${invoice.id}`);
          anyProcessed = true;

          // Mark as paid (or completed if this was the last instalment)
          if (numberOfMonths !== null && newPaidCount >= numberOfMonths) {
            // Mark completed in DB immediately — any concurrent webhook will see this and skip
            await db.updateSubscription(localSub.id, { paymentStatus: "completed" });
  
            // Stop future billing for this course item
            if (localSub.stripeItemId && localSub.stripeSubscriptionId) {
              const stripe = getStripe();
              try {
                // Try to delete the item immediately
                await stripe.subscriptionItems.del(localSub.stripeItemId, { proration_behavior: "none" });
                console.log(`[Webhook] Removed Stripe item ${localSub.stripeItemId}`);
              } catch (delErr: any) {
                console.warn(`[Webhook] Could not delete item (${delErr?.message}) — will cancel subscription at period end instead`);
                // Fallback: cancel the subscription at period end so no further invoices are generated
                // This is safe even during test clock advancement
                try {
                  // Check if all courses on this subscription are completed before cancelling
                  const allSubsOnStripe = await db.getSubscriptionsByStripeSubId(localSub.stripeSubscriptionId);
                  const allCompleted = allSubsOnStripe.every((s: any) => s.paymentStatus === "completed");
                  if (allCompleted) {
                    await stripe.subscriptions.cancel(localSub.stripeSubscriptionId);
                    console.log(`[Webhook] Cancelled Stripe subscription ${localSub.stripeSubscriptionId} immediately`);
                  } else {
                    // Other items still running — just update subscription to remove this item at next renewal
                    // Since we can't delete the item now, rely on the DB completed guard to block future payments
                  }
                } catch (cancelErr: any) {
                  console.error(`[Webhook] Failed to cancel subscription:`, cancelErr?.message);
                }
              }

              // If item was deleted successfully, check if subscription should be cancelled too
              try {
                const allSubsOnStripe = await db.getSubscriptionsByStripeSubId(localSub.stripeSubscriptionId);
                const allCompleted = allSubsOnStripe.every((s: any) => s.paymentStatus === "completed");
                if (allCompleted) {
                  await stripe.subscriptions.cancel(localSub.stripeSubscriptionId);
                  console.log(`[Webhook] Cancelled Stripe subscription ${localSub.stripeSubscriptionId} — all courses completed`);
                }
              } catch (_) { /* already cancelled or still has active items */ }
            }
          } else {
            await db.updateSubscription(localSub.id, { paymentStatus: "paid" });
          }
        }

        if (!anyProcessed && !anySkippedAsCompleted) {
          // No line items matched at all (not because they're completed) — legacy fallback path
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

              // Check completion for fallback path too
              try {
                const course = await db.getCourseById(localSub.courseId);
                if (course && localSub.stripeItemId) {
                  const totalSessions = course.totalSessions || 1;
                  const sessionsPerWeek = course.sessionsPerWeek || 1;
                  const numberOfMonths = Math.max(1, Math.ceil(totalSessions / (sessionsPerWeek * 4)));
                  const allPayments = await db.getPaymentsBySubscriptionId(localSub.id);
                  const completedPayments = allPayments.filter(
                    (p: any) => p.status === "completed" && p.paymentType === "subscription" && parseFloat(p.amount) > 0
                  ).length;
                  if (completedPayments >= numberOfMonths) {
                    const stripe = getStripe();
                    await stripe.subscriptionItems.del(localSub.stripeItemId, { proration_behavior: "none" });
                    await db.updateSubscription(localSub.id, { paymentStatus: "completed" });
                    const stripeSub = await stripe.subscriptions.retrieve(localSub.stripeSubscriptionId!);
                    if (stripeSub.items.data.length === 0) {
                      await stripe.subscriptions.cancel(localSub.stripeSubscriptionId!);
                    }
                  }
                }
              } catch (err: any) {
                console.error(`[Webhook] Fallback: Failed to check/cancel completed subscription ${localSub.id}:`, err?.message);
              }
            }
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Invoice payment failed — mark subscription as failed
      // -----------------------------------------------------------------------
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        // Handle usage-based invoice failure
        if (invoice.metadata?.type === "usage_cycle") {
          const billingCycleId = parseInt(invoice.metadata?.billing_cycle_id || "0");
          if (billingCycleId) {
            await db.updateBillingCycle(billingCycleId, { status: "failed" });
            console.log(`[Webhook] Usage cycle ${billingCycleId} payment failed`);
          }
          break;
        }

        const stripeSubscriptionId = (
          typeof (invoice.parent as any)?.subscription_details?.subscription === "string"
            ? (invoice.parent as any).subscription_details.subscription
            : ((invoice.parent as any)?.subscription_details?.subscription as any)?.id ?? null
        ) as string | null;
        if (stripeSubscriptionId) {
          const localSubs = await db.getSubscriptionsByStripeSubId(stripeSubscriptionId);
          for (const localSub of localSubs) {
            await db.updateSubscription(localSub.id, { paymentStatus: "failed" });
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        break;
      }

      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;
        break;
      }

      default:
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing event:", error);
    res.status(500).send("Webhook processing error");
  }
}
