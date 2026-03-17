CREATE TABLE "user" (
  "id" UUID NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "name" TEXT,
  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);
