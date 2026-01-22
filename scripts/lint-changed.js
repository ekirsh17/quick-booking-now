#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";

const eventName = process.env.GITHUB_EVENT_NAME;
const eventPath = process.env.GITHUB_EVENT_PATH;

const readEventPayload = () => {
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(eventPath, "utf8"));
  } catch {
    return null;
  }
};

const payload = readEventPayload();
let baseSha;
let headSha;

if (eventName === "pull_request" && payload?.pull_request) {
  baseSha = payload.pull_request.base?.sha;
  headSha = payload.pull_request.head?.sha;
} else if (eventName === "push" && payload) {
  baseSha = payload.before;
  headSha = payload.after;
}

if (!headSha) {
  headSha = process.env.GITHUB_SHA || execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}
if (!baseSha) {
  baseSha = execSync("git rev-parse HEAD~1", { encoding: "utf8" }).trim();
}

const diffOutput = execSync(`git diff --name-only ${baseSha} ${headSha}`, {
  encoding: "utf8",
});

const files = diffOutput
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((file) => /\.(ts|tsx)$/.test(file));

if (files.length === 0) {
  console.log("No TypeScript changes to lint.");
  process.exit(0);
}

const quotedFiles = files.map((file) => `"${file.replace(/"/g, '\\"')}"`).join(" ");
execSync(`pnpm exec eslint ${quotedFiles}`, { stdio: "inherit" });
