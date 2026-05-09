const path = require("node:path");
const fs = require("node:fs");

function parseCliArgs(argv = []) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const result = {
    prompt: "",
    projectId: "",
    output: "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const nextValue = args[index + 1];
    const promptMatch = /^--prompt=(.+)$/u.exec(token);
    const projectMatch = /^--(?:project|project-id)=(.+)$/u.exec(token);
    const outputMatch = /^--output=(.+)$/u.exec(token);

    if (promptMatch) {
      result.prompt = String(promptMatch[1]).trim();
      continue;
    }

    if (projectMatch) {
      result.projectId = String(projectMatch[1]).trim();
      continue;
    }

    if (outputMatch) {
      result.output = String(outputMatch[1]).trim();
      continue;
    }

    if ((token === "--prompt" || token === "-p") && nextValue) {
      result.prompt = String(nextValue).trim();
      index += 1;
      continue;
    }

    if ((token === "--project" || token === "--project-id") && nextValue) {
      result.projectId = String(nextValue).trim();
      index += 1;
      continue;
    }

    if ((token === "--output" || token === "-o") && nextValue) {
      result.output = String(nextValue).trim();
      index += 1;
      continue;
    }
  }

  if (!result.prompt) {
    throw new Error("A prompt is required. Use --prompt \"...\".");
  }

  return result;
}

function parseDotEnv(contents) {
  const env = {};
  const text = typeof contents === "string" ? contents : "";

  text.split(/\r?\n/).forEach(function (line) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  });

  return env;
}

function loadDotEnvFile(cwd, fileName = ".env") {
  const filePath = path.resolve(cwd, fileName);

  if (!fs.existsSync(filePath)) {
    return {};
  }

  return parseDotEnv(fs.readFileSync(filePath, "utf8"));
}

function buildOutputPath(cwd, outputFileName) {
  const rawFileName = String(outputFileName || "stitch-output.html").trim() || "stitch-output.html";
  const normalizedFileName = path.basename(rawFileName);

  return path.resolve(cwd, "page_example", normalizedFileName);
}

function resolveStitchConfig({ cliArgs = {}, env = {}, cwd = process.cwd() } = {}) {
  const fileEnv = loadDotEnvFile(cwd);
  const mergedEnv = {
    ...fileEnv,
    ...env,
  };
  const apiKey = String(mergedEnv.STITCH_API_KEY || "").trim();
  const projectId = String(cliArgs.projectId || mergedEnv.STITCH_PROJECT_ID || "").trim();

  if (!apiKey) {
    throw new Error("STITCH_API_KEY is required. Set it in .env or your shell environment.");
  }

  if (!projectId) {
    throw new Error("A Stitch project id is required. Use --project or STITCH_PROJECT_ID.");
  }

  return {
    apiKey,
    prompt: String(cliArgs.prompt || "").trim(),
    projectId,
    outputPath: buildOutputPath(cwd, cliArgs.output || mergedEnv.STITCH_OUTPUT || ""),
  };
}

module.exports = {
  buildOutputPath,
  loadDotEnvFile,
  parseCliArgs,
  parseDotEnv,
  resolveStitchConfig,
};
