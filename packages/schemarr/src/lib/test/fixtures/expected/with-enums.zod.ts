import { z } from "zod";

// --- Enums ---

export const ticketStatusSchema = z.enum([
	"open",
	"in_progress",
	"resolved",
	"closed",
]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketPrioritySchema = z.enum([
	"low",
	"medium",
	"high",
	"critical",
]);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketCategorySchema = z.enum(["bug", "feature", "support"]);
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

// --- Schemas ---

export const ticketSchema = z.object({
	id: z.uuid(),
	subject: z.string().max(300).nullable().optional(),
	status: ticketStatusSchema,
	priority: ticketPrioritySchema,
	category: ticketCategorySchema.nullable().optional(),
	duplicate_status: ticketStatusSchema.nullable().optional(),
});
export type Ticket = z.infer<typeof ticketSchema>;
