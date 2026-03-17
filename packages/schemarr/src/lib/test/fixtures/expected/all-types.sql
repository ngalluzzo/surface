CREATE TABLE "all_types" (
  "id" UUID NOT NULL,
  "label" TEXT,
  "short_code" VARCHAR(10),
  "website" TEXT,
  "age" INTEGER,
  "big_number" BIGINT,
  "score" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  "birth_date" DATE,
  "created_at" TIMESTAMPTZ,
  "metadata" JSONB,
  "tags" TEXT[],
  CONSTRAINT "all_types_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "all_types_metadata_idx" ON "all_types" USING gin ("metadata");
