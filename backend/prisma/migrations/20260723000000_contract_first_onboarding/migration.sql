ALTER TABLE "Restaurant"
  ALTER COLUMN "plan" SET DEFAULT 'UNASSIGNED',
  ALTER COLUMN "subscriptionStatus" SET DEFAULT 'PENDING',
  ALTER COLUMN "maxUsers" SET DEFAULT 1;

ALTER TABLE "KitOrder"
  ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
  ADD COLUMN "deliveredAt" TIMESTAMP(3);

UPDATE "KitOrder"
SET "fulfillmentStatus" = 'PREPARING'
WHERE "status" = 'APPROVED';

UPDATE "KitOrder" AS kit
SET
  "fulfillmentStatus" = 'DELIVERED',
  "deliveredAt" = COALESCE(kit."paidAt", CURRENT_TIMESTAMP)
FROM "Restaurant" AS restaurant
WHERE
  kit."restaurantId" = restaurant."id"
  AND kit."status" = 'APPROVED'
  AND restaurant."subscriptionStatus" = 'ACTIVE';
