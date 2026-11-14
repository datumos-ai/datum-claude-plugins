#!/usr/bin/env node
// Structural validation of this marketplace — what CI runs (no dependencies).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const fail = (msg) => problems.push(msg);

const readJson = (rel) => {
  const file = path.join(root, rel);
  if (!existsSync(file)) return fail(`${rel}: missing`), null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    return fail(`${rel}: invalid JSON — ${err.message}`), null;
  }
};

const frontMatter = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2];
  }
  return fm;
};

const marketplace = readJson(".claude-plugin/marketplace.json");
if (marketplace) {
  for (const key of ["name", "owner", "plugins"]) {
    if (!(key in marketplace)) fail(`marketplace.json: missing "${key}"`);
  }
  const pluginRoot = marketplace.metadata?.pluginRoot ?? "./plugins";
  for (const entry of marketplace.plugins ?? []) {
    const dir = path.join(root, entry.source ?? path.join(pluginRoot, entry.name));
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      fail(`marketplace.json: plugin "${entry.name}" points at ${entry.source}, which is not a directory`);
      continue;
    }
    const manifest = readJson(path.relative(root, path.join(dir, ".claude-plugin", "plugin.json")));
    if (manifest) {
      if (manifest.name !== entry.name) fail(`${entry.name}: plugin.json name "${manifest.name}" ≠ marketplace entry`);
      if (manifest.version !== entry.version) {
        fail(`${entry.name}: plugin.json version ${manifest.version} ≠ marketplace entry ${entry.version} — bump both`);
      }
      if (!manifest.description) fail(`${entry.name}: plugin.json needs a description`);
    }
    const mcp = path.join(dir, ".mcp.json");
    if (existsSync(mcp)) {
      const servers = readJson(path.relative(root, mcp));
      if (servers) {
        for (const [name, def] of Object.entries(servers)) {
          if (!def.command && !def.url) fail(`${entry.name}/.mcp.json: server "${name}" needs command or url`);
          const text = JSON.stringify(def);
          if (/https?:\/\/|datum_[A-Za-z0-9]|Bearer /.test(text)) {
            fail(`${entry.name}/.mcp.json: server "${name}" must not carry a base URL, key or token (the CLI remembers the deployment)`);
          }
        }
      }
    }
    // A hooks module (Claude Code mods): every module hooks.json names, and the
    // $.state contract plugin.json names, must exist — CI has no Claude Code to
    // run `claude plugin validate`, so this is the structural half of it.
    const hooksJson = path.join(dir, "hooks", "hooks.json");
    if (existsSync(hooksJson)) {
      const hooks = readJson(path.relative(root, hooksJson));
      for (const mod of hooks?.modules ?? []) {
        if (!existsSync(path.join(dir, "hooks", mod))) fail(`${entry.name}: hooks/hooks.json names module ${mod}, which does not exist`);
      }
    }
    if (manifest?.types && !existsSync(path.join(dir, manifest.types))) {
      fail(`${entry.name}: plugin.json "types" ${manifest.types} does not exist`);
    }
    const skills = path.join(dir, "skills");
    if (existsSync(skills)) {
      for (const skill of readdirSync(skills)) {
        const file = path.join(skills, skill, "SKILL.md");
        if (!existsSync(file)) {
          fail(`${entry.name}: skills/${skill} has no SKILL.md`);
          continue;
        }
        const fm = frontMatter(readFileSync(file, "utf8"));
        if (!fm) fail(`${entry.name}: skills/${skill}/SKILL.md lacks front matter`);
        else {
          if (fm.name !== skill) fail(`${entry.name}: skills/${skill}/SKILL.md front matter name "${fm.name}" ≠ directory`);
          if (!fm.description) fail(`${entry.name}: skills/${skill}/SKILL.md needs a description`);
        }
      }
    }
    const commands = path.join(dir, "commands");
    if (existsSync(commands)) {
      for (const cmd of readdirSync(commands).filter((f) => f.endsWith(".md"))) {
        const fm = frontMatter(readFileSync(path.join(commands, cmd), "utf8"));
        if (!fm?.description) fail(`${entry.name}: commands/${cmd} needs front matter with a description`);
      }
    }
  }
}

// This repository is public: nothing in it names the organisation that
// operates a Datum instance, its hosts, registries, accounts or people.
// NOTICE names the copyright holder — the one deliberate exception.
const FORBIDDEN = [
  /ringier/i,
  /axel[\s-]?springer/i,
  /\brasp\b/i,
  /dreamlab/i,
  /grupaonet/i,
  /smartdev/i,
  /artifactory/i,
  /monetisation/i,
  /\b\d{12}\b/,
  /@datum\//,
];
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === ".git" || e.name === "node_modules") return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
for (const file of walk(root)) {
  const rel = path.relative(root, file);
  if (rel === "NOTICE" || rel === "LICENSE" || rel === path.join("scripts", "validate.mjs")) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const re of FORBIDDEN) {
        const m = line.match(re);
        if (m) fail(`${rel}:${i + 1}: "${m[0]}" must not appear in a public repository`);
      }
    });
}

if (problems.length) {
  console.error("validate: FAILED");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("validate: OK");
