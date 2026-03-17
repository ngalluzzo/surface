CREATE TYPE "order_status" AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');

CREATE TABLE "customer" (
  "id" UUID NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "full_name" VARCHAR(200),
  "phone" VARCHAR(20),
  "created_at" TIMESTAMPTZ,
  CONSTRAINT "customer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_email_unique" UNIQUE ("email")
);

CREATE TABLE "order" (
  "id" UUID NOT NULL,
  "order_number" VARCHAR(20),
  "customer_id" UUID NOT NULL,
  "status" "order_status" NOT NULL,
  "shipping_address" JSONB,
  "notes" TEXT,
  "total_cents" INTEGER,
  "placed_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ,
  CONSTRAINT "order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_order_number_unique" UNIQUE ("order_number"),
  CONSTRAINT "order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer" ("id"),
  CONSTRAINT "order_total_cents_gte" CHECK ("total_cents" >= 0),
  CONSTRAINT "order_order_number_pattern" CHECK ("order_number" ~ '^ORD-[0-9]+$')
);

CREATE TABLE "line_item" (
  "id" UUID NOT NULL,
  "product_name" VARCHAR(200) NOT NULL,
  "sku" VARCHAR(50),
  "quantity" INTEGER NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "order_id" UUID NOT NULL,
  CONSTRAINT "line_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "line_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order" ("id"),
  CONSTRAINT "line_item_quantity_gte" CHECK ("quantity" >= 1),
  CONSTRAINT "line_item_unit_price_cents_gte" CHECK ("unit_price_cents" >= 0)
);
