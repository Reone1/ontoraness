import { program } from "commander";
import { createRequire } from "node:module";
import { onboardCommand } from "./commands/onboard.command.js";
import { generateCommand } from "./commands/generate.command.js";
import { validateCommand } from "./commands/validate.command.js";
import { reportCommand } from "./commands/report.command.js";
import { agentCommand } from "./commands/agent.command.js";

// package.json에서 버전을 동적으로 읽어 하드코딩 없이 유지
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

program
  .name("ontoraness")
  .description("AI Ontology + Harness system for Claude Code")
  .version(version);

program.addCommand(onboardCommand);
program.addCommand(generateCommand);
program.addCommand(validateCommand);
program.addCommand(reportCommand);
program.addCommand(agentCommand);

program.parse();
