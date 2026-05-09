import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helperModule from "./stitch-generate-html-helpers.js";
import { stitch } from "@google/stitch-sdk";

const {
  parseCliArgs,
  resolveStitchConfig,
} = helperModule;

async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const config = resolveStitchConfig({
    cliArgs,
    env: process.env,
    cwd,
  });

  process.env.STITCH_API_KEY = config.apiKey;

  const project = config.projectId
    ? stitch.project(config.projectId)
    : await stitch.createProject(config.projectTitle);
  const screen = await project.generate(config.prompt);
  const htmlUrl = await screen.getHtml();
  const response = await fetch(htmlUrl);

  if (!response.ok) {
    throw new Error(`Failed to download generated HTML: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
  await fs.writeFile(config.outputPath, html, "utf8");

  if (!config.projectId) {
    process.stdout.write(`Created Stitch project: ${project.id}\n`);
  }

  process.stdout.write(`Generated HTML saved to ${config.outputPath}\n`);
  process.stdout.write(`Source URL: ${htmlUrl}\n`);
}

main().catch(function (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
