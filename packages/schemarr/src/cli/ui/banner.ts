export { default as chalk } from "chalk";

export const banner = () => {
	return `
   ___  __  __  _____
  / __||  \\/  ||_   _|
 | (_  | |\\/| |  | |
  \\___||_|  |_|  |_|
  `;
};

export const bannerText = () => {
	return `
   ___  __  __  _____
  / __||  \\/  ||_   _|
 | (_  | |\\/| |  | |
  \\___||_|  |_|  |_|
  
  JSON Schema Conversion Tool
`;
};

export const colors = {
	success: (text: string) => `\x1b[32m${text}\x1b[0m`,
	error: (text: string) => `\x1b[31m${text}\x1b[0m`,
	warning: (text: string) => `\x1b[33m${text}\x1b[0m`,
	info: (text: string) => `\x1b[36m${text}\x1b[0m`,
	dim: (text: string) => `\x1b[90m${text}\x1b[0m`,
	bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};
