export const toPascalCase = (irName: string): string => {
	if (irName === "") return "";
	return irName
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
};
