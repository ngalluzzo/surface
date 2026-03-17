import type { CodegenEmitter } from "../types";
import { emitZodEnum } from "./emitEnum";
import { emitField } from "./emitField";
import { emitZodObject } from "./emitObject";
import { emitZodSchema } from "./emitZodSchema";
import { mapTypeToZod } from "./typeMap";

export const zodEmitter: CodegenEmitter = {
	name: "zod",
	mapType: mapTypeToZod,
	emitField: (col, checks) => {
		const checkConstraints = checks.filter(
			(c): c is Extract<typeof c, { kind: "check" }> => c.kind === "check",
		);
		return emitField(col, { checks: checkConstraints });
	},
	emitEnum: emitZodEnum,
	emitObject: emitZodObject,
	emitSchema: emitZodSchema,
};
