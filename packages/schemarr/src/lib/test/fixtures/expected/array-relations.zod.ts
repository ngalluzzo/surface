import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const courseSchema = z.object({
	id: z.uuid(),
	name: z.string().max(200),
	tags: z.array(z.string()).nullable().optional(),
});
export type Course = z.infer<typeof courseSchema>;

export const lessonSchema = z.object({
	id: z.uuid(),
	title: z.string(),
	duration_minutes: z.number().int().nullable().optional(),
	course_id: z.uuid().nullable().optional(), // FK -> course.id
});
export type Lesson = z.infer<typeof lessonSchema>;

export const studentSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	email: z.string().nullable().optional(),
});
export type Student = z.infer<typeof studentSchema>;

export const courseStudentSchema = z.object({
	course_id: z.uuid(), // FK -> course.id
	student_id: z.uuid(), // FK -> student.id
});
export type CourseStudent = z.infer<typeof courseStudentSchema>;
