CREATE TABLE "office" (
  "id" UUID NOT NULL,
  "location" TEXT NOT NULL,
  "capacity" INTEGER,
  CONSTRAINT "office_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "address" JSONB NOT NULL,
  "settings" JSONB,
  "headquarters_id" UUID,
  CONSTRAINT "company_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_headquarters_id_fkey" FOREIGN KEY ("headquarters_id") REFERENCES "office" ("id")
);

CREATE INDEX "company_headquarters_id_idx" ON "company" USING btree ("headquarters_id");

CREATE INDEX "company_address_idx" ON "company" USING gin ("address");

CREATE INDEX "company_settings_idx" ON "company" USING gin ("settings");
