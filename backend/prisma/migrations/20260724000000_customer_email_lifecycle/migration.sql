ALTER TABLE "KitOrder"
  ADD COLUMN "shippedAt" TIMESTAMP(3),
  ADD COLUMN "trackingCode" TEXT,
  ADD COLUMN "trackingUrl" TEXT,
  ADD COLUMN "shippingEmailedAt" TIMESTAMP(3),
  ADD COLUMN "shippingEmailProviderId" TEXT,
  ADD COLUMN "shippingEmailError" TEXT;

ALTER TABLE "CommercialContract"
  ADD COLUMN "welcomeEmailedAt" TIMESTAMP(3),
  ADD COLUMN "welcomeEmailProviderId" TEXT,
  ADD COLUMN "welcomeEmailError" TEXT;

CREATE INDEX "KitOrder_fulfillmentStatus_updatedAt_idx"
  ON "KitOrder"("fulfillmentStatus", "updatedAt");
