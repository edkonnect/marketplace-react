import cron from "node-cron";
import * as db from "./db";
import { createCombinedUsageInvoice } from "./stripe";

export function startBillingCron() {
  // Run daily at 02:00 UTC — picks up any subscription whose billingCycleEnd < now
  cron.schedule("0 2 * * *", async () => {
    console.log("[Cron] Starting daily usage billing job...");
    await processUsageBilling();
  });
  console.log("[Cron] Daily billing cron scheduled (02:00 UTC every day)");
}

export async function processUsageBilling() {
  const dueSubs = await db.getUsageBasedSubscriptionsDue();
  console.log(`[Cron] Found ${dueSubs.length} usage-based subscription(s) due for billing`);

  // Group subscriptions by (parentId + billingCycleEnd) so same-parent same-cycle-end
  // subscriptions are combined into a single Stripe invoice
  const groups = new Map<string, typeof dueSubs>();
  for (const item of dueSubs) {
    const cycleEnd = (item.subscription.billingCycleEnd as Date).toISOString();
    const key = `${item.subscription.parentId}::${cycleEnd}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  console.log(`[Cron] Processing ${groups.size} billing group(s)`);

  for (const [groupKey, groupItems] of Array.from(groups)) {
    try {
      // Collect billing lines for all subscriptions in this group that have sessions
      type BillingLine = {
        subscriptionId: number;
        billingCycleId: number;
        sessionCount: number;
        perSessionRateCents: number;
        courseTitle: string;
        studentName: string;
        cycleStart: Date;
        cycleEnd: Date;
        nextStart: Date;
        nextEnd: Date;
      };
      const lines: BillingLine[] = [];
      const skipped: Array<{ subscription: any; nextStart: Date; nextEnd: Date }> = [];

      for (const { subscription, course } of groupItems) {
        const cycleStart = subscription.billingCycleStart as Date;
        const cycleEnd = subscription.billingCycleEnd as Date;
        const nextStart = new Date(cycleEnd);
        const nextEnd = new Date(Date.UTC(cycleEnd.getUTCFullYear(), cycleEnd.getUTCMonth() + 1, cycleEnd.getUTCDate()));

        const sessionCount = await db.countCompletedSessionsInWindow(subscription.id, cycleStart, cycleEnd);

        if (sessionCount === 0) {
          skipped.push({ subscription, nextStart, nextEnd });
          console.log(`[Cron] Sub ${subscription.id}: 0 sessions, will skip invoice`);
          continue;
        }

        const perSessionRateCents = subscription.perSessionRateCents ?? 0;
        const amountCents = sessionCount * perSessionRateCents;

        // Create billing cycle record
        let cycleId = await db.createBillingCycle({
          subscriptionId: subscription.id,
          cycleStart,
          cycleEnd,
          sessionsCount: sessionCount,
          amountCents,
          status: "pending",
        });

        if (!cycleId) {
          const existingCycle = await db.getOpenBillingCycleForSubscription(subscription.id);
          if (!existingCycle || existingCycle.status === "invoiced" || existingCycle.status === "paid") {
            await db.updateSubscription(subscription.id, { billingCycleStart: nextStart, billingCycleEnd: nextEnd });
            console.log(`[Cron] Sub ${subscription.id}: billing cycle already paid, advancing window`);
            continue;
          }
          cycleId = existingCycle.id;
          console.log(`[Cron] Sub ${subscription.id}: retrying ${existingCycle.status} billing cycle ${cycleId}`);
        }

        const studentName = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ");
        lines.push({
          subscriptionId: subscription.id,
          billingCycleId: cycleId,
          sessionCount,
          perSessionRateCents,
          courseTitle: course.title,
          studentName,
          cycleStart,
          cycleEnd,
          nextStart,
          nextEnd,
        });
      }

      // Advance window for skipped (0-session) subscriptions
      for (const { subscription, nextStart, nextEnd } of skipped) {
        await db.updateSubscription(subscription.id, { billingCycleStart: nextStart, billingCycleEnd: nextEnd });
      }

      if (lines.length === 0) {
        console.log(`[Cron] Group ${groupKey}: all subscriptions had 0 sessions, skipping invoice`);
        continue;
      }

      // Fetch parent's Stripe customer ID (same for all in group)
      const parentUser = await db.getUserById(lines[0].subscriptionId
        ? groupItems.find((i: { subscription: any; course: any }) => i.subscription.id === lines[0].subscriptionId)!.subscription.parentId
        : groupItems[0].subscription.parentId
      );
      const firstSub = groupItems[0].subscription;
      const parentUserRecord = await db.getUserById(firstSub.parentId);

      if (!parentUserRecord?.stripeCustomerId) {
        for (const line of lines) {
          await db.updateBillingCycle(line.billingCycleId, { status: "failed" });
          await db.updateSubscription(line.subscriptionId, { billingCycleStart: line.nextStart, billingCycleEnd: line.nextEnd });
        }
        console.error(`[Cron] Group ${groupKey}: no stripeCustomerId for parentId=${firstSub.parentId}`);
        continue;
      }

      try {
        const stripeInvoice = await createCombinedUsageInvoice({
          stripeCustomerId: parentUserRecord.stripeCustomerId,
          cycleEnd: lines[0].cycleEnd,
          billingCycleIds: lines.map(l => l.billingCycleId),
          lines,
        });

        const cycleStatus = stripeInvoice.status === "paid" ? "paid" : "invoiced";

        for (const line of lines) {
          await db.updateBillingCycle(line.billingCycleId, { status: cycleStatus, stripeInvoiceId: stripeInvoice.id });
          await db.updateSubscription(line.subscriptionId, { billingCycleStart: line.nextStart, billingCycleEnd: line.nextEnd });
        }

        const totalCents = lines.reduce((sum, l) => sum + l.sessionCount * l.perSessionRateCents, 0);
        console.log(`[Cron] Group ${groupKey}: ${cycleStatus} ${lines.length} subscription(s), total ${totalCents} cents (invoice ${stripeInvoice.id})`);
      } catch (stripeErr: any) {
        for (const line of lines) {
          await db.updateBillingCycle(line.billingCycleId, { status: "failed" });
          await db.updateSubscription(line.subscriptionId, { billingCycleStart: line.nextStart, billingCycleEnd: line.nextEnd });
        }
        console.error(`[Cron] Group ${groupKey}: Stripe invoice failed:`, stripeErr?.message);
      }
    } catch (err: any) {
      console.error(`[Cron] Failed to process billing group ${groupKey}:`, err?.message);
    }
  }

  console.log("[Cron] Monthly usage billing job complete");
}
