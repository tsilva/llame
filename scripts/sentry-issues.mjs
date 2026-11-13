#!/usr/bin/env node

import path from "node:path";

const DEFAULT_SENTRY_ORG = "tsilva";
const DEFAULT_SENTRY_PROJECT = path.basename(process.cwd());
const DEFAULT_SENTRY_BASE_URL = "https://sentry.io";
const HELP_TEXT = `Usage: node scripts/sentry-issues.mjs [--days 7] [--limit 10] [--status unresolved]

List recent Sentry issues for the configured project.

Options:
  --days <n>      Look back this many days. Default: 7
  --limit <n>     Maximum number of issues to return. Default: 10
  --status <v>    unresolved, resolved, ignored, or all. Default: unresolved
  --help          Show this help output
`;

function getOption(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP_TEXT.trim());
  process.exit(0);
}

const authToken = process.env.SENTRY_AUTH_TOKEN;
const org = process.env.SENTRY_ORG ?? DEFAULT_SENTRY_ORG;
const project = process.env.SENTRY_PROJECT ?? DEFAULT_SENTRY_PROJECT;
const baseUrl = process.env.SENTRY_BASE_URL ?? DEFAULT_SENTRY_BASE_URL;

if (process.env.SENTRY_VAULT_TRANSPORT !== undefined
      ? process.env.SENTRY_VAULT_TRANSPORT !== "agent-vault" || authToken !== "sentry_read_public_placeholder"
      : !authToken || authToken === "sentry_read_public_placeholder") {
  exitWithError(
    "Set SENTRY_AUTH_TOKEN in the server environment; configured proxy sessions require their reviewed placeholder.",
  );
}

const days = Number.parseInt(getOption("--days", "7"), 10);
const limit = Number.parseInt(getOption("--limit", "10"), 10);
const status = getOption("--status", "unresolved");

if (!Number.isFinite(days) || days < 1) {
  exitWithError("--days must be a positive integer.");
}

if (!Number.isFinite(limit) || limit < 1) {
  exitWithError("--limit must be a positive integer.");
}

if (!["unresolved", "resolved", "ignored", "all"].includes(status)) {
  exitWithError("--status must be one of: unresolved, resolved, ignored, all.");
}

const projectLookupUrl = new URL(
  `/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/`,
  baseUrl,
);

const projectResponse = await fetch(projectLookupUrl, {
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${authToken}`,
  },
});

if (!projectResponse.ok) {
  await projectResponse.body?.cancel();
  exitWithError(`Sentry project lookup failed (${projectResponse.status}); provider details withheld.`);
}

const projectDetails = await projectResponse.json();
const projectId = projectDetails.id;

if (!projectId) {
  exitWithError(`Sentry project lookup for ${org}/${project} did not return a project id.`);
}

const issuesUrl = new URL(`/api/0/organizations/${encodeURIComponent(org)}/issues/`, baseUrl);
issuesUrl.searchParams.set("limit", String(limit));
issuesUrl.searchParams.append("project", String(projectId));

const queryParts = [];
if (status !== "all") {
  queryParts.push(`is:${status}`);
}
queryParts.push(`firstSeen:-${days}d`);
issuesUrl.searchParams.set("query", queryParts.join(" "));

const response = await fetch(issuesUrl, {
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${authToken}`,
  },
});

if (!response.ok) {
  await response.body?.cancel();
  exitWithError(`Sentry API request failed (${response.status}); provider details withheld.`);
}

const issues = await response.json();

if (!Array.isArray(issues) || issues.length === 0) {
  console.log(
    `No ${status === "all" ? "" : `${status} `}issues found for ${org}/${project} in the last ${days} day(s).`,
  );
  process.exit(0);
}

console.log(
  `Recent ${status === "all" ? "" : `${status} `}issues for ${org}/${project} in the last ${days} day(s):`,
);

for (const issue of issues) {
  const title = issue.title ?? issue.culprit ?? issue.id;
  const count = issue.count ?? "0";
  const users = issue.userCount ?? "0";
  const level = issue.level ?? "unknown";
  const lastSeen = issue.lastSeen ?? "unknown";
  const link = issue.permalink ?? `${baseUrl.replace(/\/$/, "")}/organizations/${org}/issues/${issue.id}/`;

  console.log(`- [${level}] ${title}`);
  console.log(`  id=${issue.id} count=${count} users=${users} lastSeen=${lastSeen}`);
  console.log(`  ${link}`);
}
