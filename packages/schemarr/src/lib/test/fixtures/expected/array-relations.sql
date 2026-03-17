CREATE TABLE "course" (
  "id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "tags" TEXT[],
  CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lesson" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "duration_minutes" INTEGER,
  "course_id" UUID,
  CONSTRAINT "lesson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course" ("id")
);

CREATE INDEX "lesson_course_id_idx" ON "lesson" USING btree ("course_id");

CREATE TABLE "student" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_student" (
  "course_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  CONSTRAINT "course_student_pkey" PRIMARY KEY ("course_id", "student_id"),
  CONSTRAINT "course_student_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course" ("id"),
  CONSTRAINT "course_student_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student" ("id")
);

CREATE INDEX "course_student_course_id_idx" ON "course_student" USING btree ("course_id");

CREATE INDEX "course_student_student_id_idx" ON "course_student" USING btree ("student_id");
