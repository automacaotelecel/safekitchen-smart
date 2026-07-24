ALTER TABLE "KitOrder" RENAME TO "ImplementationOrder";

ALTER TABLE "ImplementationOrder"
  RENAME COLUMN "deliveryAddress" TO "businessAddress";

ALTER TABLE "ImplementationOrder"
  RENAME COLUMN "fulfillmentStatus" TO "implementationStatus";

ALTER TABLE "ImplementationOrder"
  RENAME COLUMN "shippedAt" TO "scheduledAt";

ALTER TABLE "ImplementationOrder"
  RENAME COLUMN "trackingUrl" TO "meetingUrl";

ALTER TABLE "ImplementationOrder"
  RENAME COLUMN "shippingEmailedAt" TO "scheduleEmailedAt";

ALTER TABLE "ImplementationOrder"
  RENAME COLUMN "shippingEmailProviderId" TO "scheduleEmailProviderId";

ALTER TABLE "ImplementationOrder"
  RENAME COLUMN "shippingEmailError" TO "scheduleEmailError";

ALTER TABLE "ImplementationOrder"
  RENAME COLUMN "deliveredAt" TO "completedAt";

ALTER TABLE "ImplementationOrder"
  DROP COLUMN "trackingCode",
  ADD COLUMN "scheduledFor" TIMESTAMP(3),
  ADD COLUMN "scheduleNotes" TEXT;

ALTER TABLE "CommercialContract"
  RENAME COLUMN "kitOrderId" TO "implementationOrderId";

UPDATE "ImplementationOrder"
SET "implementationStatus" = CASE
  WHEN "implementationStatus" = 'PREPARING' THEN 'AWAITING_SCHEDULING'
  WHEN "implementationStatus" = 'SHIPPED' THEN 'SCHEDULED'
  WHEN "implementationStatus" = 'DELIVERED' THEN 'COMPLETED'
  ELSE "implementationStatus"
END;

UPDATE "CommercialContract"
SET "status" = 'IMPLEMENTATION_PAID_PENDING_ACTIVATION'
WHERE "status" = 'KIT_PAID_PENDING_SUBSCRIPTION';

UPDATE "Restaurant"
SET "subscriptionStatus" = CASE
  WHEN "subscriptionStatus" = 'PENDING_KIT' THEN 'PENDING_IMPLEMENTATION'
  WHEN "subscriptionStatus" = 'AWAITING_DELIVERY' THEN 'AWAITING_IMPLEMENTATION'
  ELSE "subscriptionStatus"
END;

ALTER TABLE "ImplementationOrder"
  RENAME CONSTRAINT "KitOrder_pkey" TO "ImplementationOrder_pkey";
ALTER INDEX "KitOrder_providerPreferenceId_key" RENAME TO "ImplementationOrder_providerPreferenceId_key";
ALTER INDEX "KitOrder_providerPaymentId_key" RENAME TO "ImplementationOrder_providerPaymentId_key";
ALTER INDEX "KitOrder_restaurantId_status_createdAt_idx" RENAME TO "ImplementationOrder_restaurantId_status_createdAt_idx";
ALTER INDEX "KitOrder_providerPaymentId_idx" RENAME TO "ImplementationOrder_providerPaymentId_idx";
ALTER INDEX "KitOrder_fulfillmentStatus_updatedAt_idx" RENAME TO "ImplementationOrder_implementationStatus_updatedAt_idx";
ALTER INDEX "CommercialContract_kitOrderId_key" RENAME TO "CommercialContract_implementationOrderId_key";

ALTER TABLE "ImplementationOrder"
  RENAME CONSTRAINT "KitOrder_restaurantId_fkey" TO "ImplementationOrder_restaurantId_fkey";

ALTER TABLE "CommercialContract"
  RENAME CONSTRAINT "CommercialContract_kitOrderId_fkey" TO "CommercialContract_implementationOrderId_fkey";
