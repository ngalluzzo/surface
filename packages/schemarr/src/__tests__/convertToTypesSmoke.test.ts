import { describe, expect, test } from "bun:test";
import { convertToTypes } from "../convert";

describe("convertToTypes smoke test", () => {
	test("convertToTypes is exported and callable", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "User",
			type: "object",
			properties: {
				name: {
					type: "string",
				},
			},
			required: ["name"],
		};

		const result = convertToTypes(schema);

		if (result.kind === "err") {
			console.log("Error:", result.error);
		}

		expect(result.kind).toBe("ok");

		if (result.kind === "ok") {
			expect(result.value).toContain("export type");
			expect(typeof result.value).toBe("string");
		}
	});
});
