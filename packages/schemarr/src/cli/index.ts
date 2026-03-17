#!/usr/bin/env node
import { Command } from "commander";
import { convertCommand } from "./commands/convert";
import { initCommand } from "./commands/init";
import { bannerText, colors } from "./ui/banner";

const program = new Command();

program
	.name("schemarr")
	.description("JSON Schema Conversion Tool")
	.version("1.0.0", "-v, --version", "Output the version number")
	.helpOption("-h, --help", "Display help for command");

program.addCommand(convertCommand);
program.addCommand(
	new Command("init")
		.description("Interactive wizard to create a new conversion")
		.action(initCommand.handler),
);

program.action(() => {
	console.log(colors.bold(bannerText()));
	console.log(
		colors.info("Welcome to schemarr! Use --help to see available commands."),
	);
	console.log("");
	console.log(colors.dim("Quick start:"));
	console.log(colors.dim("  schemarr convert <schema.json>"));
	console.log(colors.dim("  schemarr init"));
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
	program.outputHelp();
}
