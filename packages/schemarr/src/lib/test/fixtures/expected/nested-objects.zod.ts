import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const officeSchema = z.object({
	id: z.uuid(),
	location: z.string(),
	capacity: z.number().int().nullable().optional(),
});
export type Office = z.infer<typeof officeSchema>;

export const companySchema = z.object({
	id: z.uuid(),
	name: z.string(),
	address: z.object({ street: z.string(), city: z.string(), zip: z.string() }),
	settings: z.unknown().nullable().optional(),
	headquarters_id: z.uuid().nullable().optional(), // FK -> office.id
});
export type Company = z.infer<typeof companySchema>;
