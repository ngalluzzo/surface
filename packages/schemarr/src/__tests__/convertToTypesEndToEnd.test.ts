import { describe, expect, test } from "bun:test";
import { convertToTypes } from "../convert";

describe("convertToTypes end-to-end demo", () => {
	test("demonstrates complete workflow from JSON to TypeScript types", () => {
		const jsonSchema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "Blog",
			type: "object",
			properties: {
				posts: {
					type: "array",
					items: {
						$ref: "#/definitions/Post",
					},
				},
				settings: {
					type: "object",
					properties: {
						theme: {
							type: "string",
							enum: ["light", "dark", "auto"],
						},
					},
				},
			},
			definitions: {
				Post: {
					type: "object",
					properties: {
						id: {
							type: "string",
							format: "uuid",
						},
						title: {
							type: "string",
						},
						content: {
							type: "string",
						},
						published: {
							type: "boolean",
						},
						tags: {
							type: "array",
							items: {
								type: "string",
							},
						},
					},
					required: ["id", "title", "published"],
				},
			},
		};

		const result = convertToTypes(jsonSchema);

		expect(result.kind).toBe("ok");

		if (result.kind === "ok") {
			const types = result.value;

			// Settings object becomes jsonb/unknown by default
			expect(types).toContain("export type Blog =");
			expect(types).toContain("export type Post =");

			// Should contain array type
			expect(types).toContain("Array<string>");

			// Should have nullable/optional semantics
			expect(types).toContain("content: string | null");

			// Should have boolean type
			expect(types).toContain("published: boolean");

			// Should NOT contain Zod
			expect(types).not.toContain("import { z } from");
			expect(types).not.toContain("z.object");
			expect(types).not.toContain("z.infer");
		}
	});
});
