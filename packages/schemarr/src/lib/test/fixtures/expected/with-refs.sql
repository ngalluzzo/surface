CREATE TABLE "author" (
  "id" UUID NOT NULL,
  "username" VARCHAR(100) NOT NULL,
  "email" TEXT,
  CONSTRAINT "author_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "post" (
  "id" UUID NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "body" TEXT,
  "author_id" UUID NOT NULL,
  "reviewer_id" UUID,
  "published_at" TIMESTAMPTZ,
  CONSTRAINT "post_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "author" ("id"),
  CONSTRAINT "post_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "author" ("id")
);

CREATE INDEX "post_author_id_idx" ON "post" USING btree ("author_id");

CREATE INDEX "post_reviewer_id_idx" ON "post" USING btree ("reviewer_id");
