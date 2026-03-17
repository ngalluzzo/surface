CREATE TABLE "product" (
  "id" UUID NOT NULL,
  "sku" VARCHAR(50) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "quantity" INTEGER,
  "weight_kg" DOUBLE PRECISION,
  "rating" DOUBLE PRECISION,
  "email" TEXT,
  CONSTRAINT "product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_sku_check_1" CHECK (sku ~ '^[A-Z]{2,4}-[0-9]{4,8}$'),
  CONSTRAINT "product_name_check_1" CHECK (char_length(name) >= 1),
  CONSTRAINT "product_price_check_1" CHECK (price > 0),
  CONSTRAINT "product_quantity_check_1" CHECK (quantity >= 0),
  CONSTRAINT "product_quantity_check_2" CHECK (quantity <= 999999),
  CONSTRAINT "product_weight_kg_check_1" CHECK (weight_kg >= 0),
  CONSTRAINT "product_rating_check_1" CHECK (rating >= 0),
  CONSTRAINT "product_rating_check_2" CHECK (rating <= 5),
  CONSTRAINT "product_sku_key" UNIQUE ("sku"),
  CONSTRAINT "product_email_key" UNIQUE ("email")
);

CREATE UNIQUE INDEX "product_sku_idx" ON "product" USING btree ("sku");

CREATE UNIQUE INDEX "product_email_idx" ON "product" USING btree ("email");
