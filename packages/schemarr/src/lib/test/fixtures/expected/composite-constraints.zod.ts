import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const courseEnrollmentSchema = z.object({});
export type CourseEnrollment = z.infer<typeof courseEnrollmentSchema>;

export const courseSchema = z.object({
	id: z.uuid(),
	title: z.string().max(200),
	courseenrollment_id: z.uuid(), // FK -> course_enrollment.id
});
export type Course = z.infer<typeof courseSchema>;

export const studentSchema = z.object({
	id: z.uuid(),
	name: z.string().max(100),
	courseenrollment_id: z.uuid(), // FK -> course_enrollment.id
});
export type Student = z.infer<typeof studentSchema>;

export const courseStudentSchema = z.object({
	course_id: z.uuid(), // FK -> course.id
	student_id: z.uuid(), // FK -> student.id
	enrolled_at: z.iso.datetime().nullable().optional(),
	courseenrollment_id: z.uuid(), // FK -> course_enrollment.id
});
export type CourseStudent = z.infer<typeof courseStudentSchema>;
