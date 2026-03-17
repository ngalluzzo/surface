import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const allTypesSchema = z.object({
	id: z.uuid(),
	label: z.string().nullable().optional(),
	short_code: z.string().max(10).nullable().optional(),
	website: z.string().nullable().optional(),
	age: z.number().int().nullable().optional(),
	big_number: z.number().int().nullable().optional(),
	score: z.number().nullable().optional(),
	is_active: z.boolean().nullable().optional(),
	birth_date: z.iso.date().nullable().optional(),
	created_at: z.iso.datetime().nullable().optional(),
	metadata: z.unknown().nullable().optional(),
	tags: z.array(z.string()).nullable().optional(),
});
export type AllTypes = z.infer<typeof allTypesSchema>;
