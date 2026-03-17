import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const productSchema = z.object({
	id: z.uuid(),
	sku: z
		.string()
		.max(50)
		.regex(/^[A-Z]{2,4}-[0-9]{4,8}$/), // unique
	name: z.string().max(200),
	price: z.number().gt(0),
	quantity: z.number().int().min(0).max(999999).nullable().optional(),
	weight_kg: z.number().min(0).nullable().optional(),
	rating: z.number().min(0).max(5).nullable().optional(),
	email: z.string().nullable().optional(), // unique
});
export type Product = z.infer<typeof productSchema>;
