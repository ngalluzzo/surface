import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const authorSchema = z.object({
	id: z.uuid(),
	username: z.string().max(100),
	email: z.string().nullable().optional(),
});
export type Author = z.infer<typeof authorSchema>;

export const postSchema = z.object({
	id: z.uuid(),
	title: z.string().max(500),
	body: z.string().nullable().optional(),
	author_id: z.uuid(), // FK -> author.id
	reviewer_id: z.uuid().nullable().optional(), // FK -> author.id
	published_at: z.iso.datetime().nullable().optional(),
});
export type Post = z.infer<typeof postSchema>;
