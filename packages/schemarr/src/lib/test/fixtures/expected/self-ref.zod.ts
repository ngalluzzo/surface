import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const userSchema = z.object({
	id: z.uuid(),
	email: z.string().max(255),
	name: z.string().nullable().optional(),
	manager: z.string().nullable().optional(),
});
export type User = z.infer<typeof userSchema>;
