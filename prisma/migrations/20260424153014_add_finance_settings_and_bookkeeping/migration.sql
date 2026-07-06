-- CreateTable
CREATE TABLE "business_finance_settings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "company_name" TEXT,
    "company_website" TEXT,
    "company_email" TEXT,
    "company_phone" TEXT,
    "company_logo_url" TEXT,
    "company_notes" TEXT,
    "show_website" BOOLEAN NOT NULL DEFAULT true,
    "show_email" BOOLEAN NOT NULL DEFAULT true,
    "show_phone" BOOLEAN NOT NULL DEFAULT true,
    "show_address" BOOLEAN NOT NULL DEFAULT true,
    "remind_before_3_days" BOOLEAN NOT NULL DEFAULT false,
    "remind_on_due_date" BOOLEAN NOT NULL DEFAULT true,
    "remind_after_3_days" BOOLEAN NOT NULL DEFAULT true,
    "remind_after_7_days" BOOLEAN NOT NULL DEFAULT true,
    "quote_followup_days_2" BOOLEAN NOT NULL DEFAULT true,
    "quote_followup_days_3" BOOLEAN NOT NULL DEFAULT false,
    "quote_followup_days_4" BOOLEAN NOT NULL DEFAULT false,
    "quote_followup_days_7" BOOLEAN NOT NULL DEFAULT true,
    "default_due_date" TEXT NOT NULL DEFAULT 'Upon Receipt',
    "stripe_account_id" TEXT,
    "stripe_connected_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_finance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookkeeping_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "is_income" BOOLEAN NOT NULL DEFAULT false,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "reference_id" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookkeeping_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_finance_settings_business_id_key" ON "business_finance_settings"("business_id");

-- CreateIndex
CREATE INDEX "bookkeeping_transactions_business_id_transaction_date_idx" ON "bookkeeping_transactions"("business_id", "transaction_date");

-- AddForeignKey
ALTER TABLE "business_finance_settings" ADD CONSTRAINT "business_finance_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookkeeping_transactions" ADD CONSTRAINT "bookkeeping_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
