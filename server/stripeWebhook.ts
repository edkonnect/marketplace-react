import { Request, Response } from "express";
import Stripe from "stripe";
import { getStripe } from "./stripe";
import { ENV } from "./_core/env";
import * as db from "./db";
import { subscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendEnrollmentConfirmation, sendTutorEnrollmentNotification, formatEmailPrice } from "./email-helpers";

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("[Webhook] Missing stripe-signature header");
    return res.status(400).send("Missing signature");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      ENV.stripeWebhookSecret || ""
    );
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle test events
  if (event.id.startsWith('evt_test_')) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ 
      verified: true,
    });
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[Webhook] Checkout session completed:", session.id);

        const userId = parseInt(session.metadata?.userId || session.metadata?.parentId || "0");
        const courseId = parseInt(session.metadata?.courseId || "0");
        const tutorId = parseInt(session.metadata?.tutorId || "0");
        const studentFirstName = session.metadata?.studentFirstName || "";
        const studentLastName = session.metadata?.studentLastName || "";
        const studentGrade = session.metadata?.studentGrade || "";
        const subscriptionId = parseInt(session.metadata?.subscriptionId || "0");
        const paymentType = session.metadata?.paymentType || "full";
        const installmentNumber = session.metadata?.installmentNumber || "";

        // Handle installment payments
        if (paymentType === "installment" && subscriptionId) {
          console.log(`[Webhook] Processing installment payment ${installmentNumber} for subscription:`, subscriptionId);
          
          // Update subscription installment status
          const db_instance = await db.getDb();
          if (db_instance) {
            if (installmentNumber === "1") {
              await db_instance.update(subscriptions)
                .set({ 
                  firstInstallmentPaid: true,
                  paymentStatus: "pending" // Still pending until second installment
                })
                .where(eq(subscriptions.id, subscriptionId));
              console.log("[Webhook] First installment marked as paid");
            } else if (installmentNumber === "2") {
              await db_instance.update(subscriptions)
                .set({ 
                  secondInstallmentPaid: true,
                  paymentStatus: "paid" // Fully paid now
                })
                .where(eq(subscriptions.id, subscriptionId));
              console.log("[Webhook] Second installment marked as paid");
            }
          }

          // Create payment record for installment
          const course = await db.getCourseById(courseId);
          if (course && tutorId && subscriptionId) {
            await db.createPayment({
              parentId: userId,
              tutorId,
              subscriptionId,
              sessionId: null,
              amount: ((session.amount_total || 0) / 100).toString(),
              currency: session.currency || "usd",
              status: "completed",
              stripePaymentIntentId: session.payment_intent as string || null,
              paymentType: "subscription",
            });
            console.log(`[Webhook] Installment ${installmentNumber} payment record created`);
          }
        } else if (userId && courseId && tutorId) {
          // Original full payment flow - Create subscription with student information
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 3); // 3 month subscription

          const newSubscriptionId = await db.createSubscription({
            parentId: userId,
            courseId,
            startDate,
            endDate,
            studentFirstName,
            studentLastName,
            studentGrade: studentGrade || null,
          });

          console.log("[Webhook] Subscription created:", newSubscriptionId);

          // Get course details
          const course = await db.getCourseById(courseId);
          
          if (course) {
            // Get tutors for the course
            const tutors = await db.getTutorsForCourse(courseId);
            
            // Create payment record
            const paymentSubscriptionId = subscriptionId || newSubscriptionId;
            if (paymentSubscriptionId) {
              await db.createPayment({
                parentId: userId,
                tutorId,
                subscriptionId: paymentSubscriptionId,
                sessionId: null,
                amount: ((session.amount_total || 0) / 100).toString(),
                currency: session.currency || "usd",
                status: "completed",
                stripePaymentIntentId: session.payment_intent as string || null,
                paymentType: "subscription",
              });
            } else {
              console.warn("[Webhook] Skipped payment creation: missing subscriptionId", {
                userId,
                courseId,
                tutorId,
                metadataSubscriptionId: subscriptionId,
                newSubscriptionId,
              });
            }

            console.log("[Webhook] Payment record created for user:", userId);
            
            // Send enrollment confirmation email
            const user = await db.getUserById(userId);
            if (user && user.email && user.name) {
              const preferredTutor = tutorId ? tutors.find(t => t.tutorId === tutorId) : tutors[0];
              const tutorName = preferredTutor?.user.name || tutors[0]?.user.name || "Your tutor";
              const studentName = [studentFirstName, studentLastName].filter(Boolean).join(" ");
              const parentName = user.name;
              sendEnrollmentConfirmation({
                userEmail: user.email,
                userName: user.name,
                courseName: course.title,
                tutorName,
                studentName,
                coursePrice: formatEmailPrice(session.amount_total || 0),
                courseId: course.id,
              }).catch(err => console.error('[Email] Failed to send enrollment confirmation:', err));

              if (preferredTutor?.user.email) {
                sendTutorEnrollmentNotification({
                  tutorEmail: preferredTutor.user.email,
                  tutorName,
                  studentName,
                  parentName,
                  courseName: course.title,
                  coursePrice: formatEmailPrice(session.amount_total || 0),
                }).catch(err => console.error('[Email] Failed to send tutor enrollment notification:', err));
              }
            }
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("[Webhook] Payment intent succeeded:", paymentIntent.id);
        
        // Update payment status if needed
        // Most handling is done in checkout.session.completed
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("[Webhook] Payment intent failed:", paymentIntent.id);
        
        // Could update payment status to failed here if tracking
        break;
      }

      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;
        console.log("[Webhook] Customer created:", customer.id);
        // Store customer ID if needed
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
