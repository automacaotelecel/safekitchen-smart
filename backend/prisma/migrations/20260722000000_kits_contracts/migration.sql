-- Commercial kits, one-time setup payment and traceable electronic contracts.
UPDATE "Restaurant"
SET "plan" = CASE
  WHEN "plan" = 'ESSENTIAL' THEN 'START'
  WHEN "plan" IN ('PROFESSIONAL', 'PREMIUM') THEN 'PRO'
  ELSE "plan"
END;

UPDATE "Subscription"
SET "planCode" = CASE
  WHEN "planCode" = 'ESSENTIAL' THEN 'START'
  WHEN "planCode" IN ('PROFESSIONAL', 'PREMIUM') THEN 'PRO'
  ELSE "planCode"
END;

CREATE TABLE "KitOrder" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'MERCADO_PAGO',
    "providerPreferenceId" TEXT,
    "providerPaymentId" TEXT,
    "checkoutUrl" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "payerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerDocument" TEXT NOT NULL,
    "customerPhone" TEXT,
    "deliveryAddress" JSONB NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KitOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialContract" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "kitOrderId" TEXT NOT NULL,
    "acceptedById" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED_PENDING_PAYMENT',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerDocument" TEXT NOT NULL,
    "customerPhone" TEXT,
    "planCode" TEXT NOT NULL,
    "setupAmountCents" INTEGER NOT NULL,
    "monthlyAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "termsSnapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "acceptedIp" TEXT,
    "acceptedUserAgent" TEXT,
    "activatedAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "emailProviderId" TEXT,
    "emailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommercialContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitOrder_providerPreferenceId_key" ON "KitOrder"("providerPreferenceId");
CREATE UNIQUE INDEX "KitOrder_providerPaymentId_key" ON "KitOrder"("providerPaymentId");
CREATE INDEX "KitOrder_restaurantId_status_createdAt_idx" ON "KitOrder"("restaurantId", "status", "createdAt");
CREATE INDEX "KitOrder_providerPaymentId_idx" ON "KitOrder"("providerPaymentId");
CREATE UNIQUE INDEX "CommercialContract_kitOrderId_key" ON "CommercialContract"("kitOrderId");
CREATE UNIQUE INDEX "CommercialContract_contractNumber_key" ON "CommercialContract"("contractNumber");
CREATE INDEX "CommercialContract_restaurantId_status_createdAt_idx" ON "CommercialContract"("restaurantId", "status", "createdAt");
CREATE INDEX "CommercialContract_customerEmail_idx" ON "CommercialContract"("customerEmail");

ALTER TABLE "KitOrder" ADD CONSTRAINT "KitOrder_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialContract" ADD CONSTRAINT "CommercialContract_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialContract" ADD CONSTRAINT "CommercialContract_kitOrderId_fkey" FOREIGN KEY ("kitOrderId") REFERENCES "KitOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialContract" ADD CONSTRAINT "CommercialContract_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
