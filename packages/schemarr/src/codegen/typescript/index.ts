import type { CodegenEmitter } from "../types";
import { emitTsEnum } from "./emitEnum";
import { emitTsObject } from "./emitObject";
import { emitTsSchema } from "./emitSchema";
import { mapTypeToTs } from "./typeMap";

export const typescriptEmitter: CodegenEmitter = {
	name: "typescript",
	mapType: mapTypeToTs,
	emitField: () => {
		throw new Error("emitField is not supported for TypeScript emitter");
	},
	emitEnum: emitTsEnum,
	emitObject: emitTsObject,
	emitSchema: emitTsSchema,
};
