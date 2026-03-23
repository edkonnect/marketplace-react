-- Add courseType to courses
ALTER TABLE courses
  ADD COLUMN courseType ENUM('test_prep', 'tutor', 'homework') NOT NULL DEFAULT 'tutor';

-- Extend subscriptions for 3-installment + usage-based billing
ALTER TABLE subscriptions
  ADD COLUMN thirdInstallmentPaid    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN thirdInstallmentAmount  DECIMAL(10,2),
  ADD COLUMN numberOfInstallments    INT NOT NULL DEFAULT 1,
  ADD COLUMN billingCycleStart       TIMESTAMP NULL,
  ADD COLUMN billingCycleEnd         TIMESTAMP NULL,
  ADD COLUMN perSessionRateCents     INT NULL,
  ADD COLUMN loyaltyDiscountApplied  BOOLEAN NOT NULL DEFAULT FALSE;

-- New billingCycles table for usage-based tracking
CREATE TABLE billing_cycles (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  subscriptionId  INT NOT NULL,
  cycleStart      TIMESTAMP NOT NULL,
  cycleEnd        TIMESTAMP NOT NULL,
  sessionsCount   INT NOT NULL DEFAULT 0,
  amountCents     INT NOT NULL DEFAULT 0,
  status          ENUM('pending','invoiced','paid','failed') NOT NULL DEFAULT 'pending',
  stripeInvoiceId VARCHAR(255),
  processedAt     TIMESTAMP NULL,
  createdAt       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id) ON DELETE CASCADE,
  UNIQUE KEY billing_cycles_sub_start_unique (subscriptionId, cycleStart),
  INDEX billing_cycles_status_idx (status),
  INDEX billing_cycles_cycleEnd_idx (cycleEnd)
);
