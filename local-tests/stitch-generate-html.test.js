const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const {
  parseCliArgs,
  resolveStitchConfig,
  buildOutputPath,
} = require("../scripts/stitch-generate-html-helpers");

test("parseCliArgs reads prompt project and output options", () => {
  const result = parseCliArgs([
    "--prompt",
    "Generate admin landing page",
    "--project",
    "project-123",
    "--output",
    "landing.html",
  ]);

  assert.deepEqual(result, {
    prompt: "Generate admin landing page",
    projectId: "project-123",
    output: "landing.html",
  });
});

test("parseCliArgs supports equals-style flags for npm run passthrough", () => {
  const result = parseCliArgs([
    "--prompt=Generate admin landing page",
    "--project=project-123",
    "--output=landing.html",
  ]);

  assert.deepEqual(result, {
    prompt: "Generate admin landing page",
    projectId: "project-123",
    output: "landing.html",
  });
});

test("parseCliArgs rejects missing prompt", () => {
  assert.throws(() => parseCliArgs(["--project", "project-123"]), /A prompt is required/);
});

test("resolveStitchConfig reads env values and keeps output inside page_example by default", () => {
  const result = resolveStitchConfig({
    cliArgs: {
      prompt: "Generate vocabulary landing page",
      projectId: "project-123",
      output: "landing.html",
    },
    env: {
      STITCH_API_KEY: "test-key",
    },
    cwd: "D:\\codes\\alpineJsProjects\\alpine-lang-learning-app",
  });

  assert.equal(result.apiKey, "test-key");
  assert.equal(result.prompt, "Generate vocabulary landing page");
  assert.equal(result.projectId, "project-123");
  assert.equal(
    result.outputPath,
    path.resolve("D:\\codes\\alpineJsProjects\\alpine-lang-learning-app", "page_example", "landing.html"),
  );
});

test("resolveStitchConfig rejects missing api key", () => {
  assert.throws(
    () => resolveStitchConfig({
      cliArgs: {
        prompt: "Generate vocabulary landing page",
      },
      env: {},
      cwd: "D:\\codes\\alpineJsProjects\\alpine-lang-learning-app",
    }),
    /STITCH_API_KEY is required/,
  );
});

test("buildOutputPath keeps generated html under page_example", () => {
  const result = buildOutputPath(
    "D:\\codes\\alpineJsProjects\\alpine-lang-learning-app",
    "..\\unsafe\\landing.html",
  );

  assert.equal(
    result,
    path.resolve("D:\\codes\\alpineJsProjects\\alpine-lang-learning-app", "page_example", "landing.html"),
  );
});
