export const toSchemaVarName = (irName: string): string => {
	const camel = toCamelCase(irName);
	return `${camel}Schema`;
};

export const toPascalCase = (irName: string): string => {
	if (irName === "") return "";
	return irName
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
};

export const toCamelCase = (irName: string): string => {
	if (irName === "") return "";
	if (!irName.includes("_")) {
		return irName.charAt(0).toLowerCase() + irName.slice(1);
	}
	const words = irName.split("_");
	return words
		.filter((word) => word.length > 0)
		.map((word, index) =>
			index === 0
				? word.toLowerCase()
				: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join("");
};
