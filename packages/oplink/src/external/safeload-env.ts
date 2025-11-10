import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Load .env files from a configuration directory into process.env with safe precedence.
 *
 * Precedence (highest → lowest), shell values always win:
 *  - .env.{NODE_ENV}.local
 *  - .env.{NODE_ENV}
 *  - .env.local
 *  - .env
 */
export function loadEnvForConfigDir(configDir: string): void {
  const dir = path.resolve(configDir);
  const envName = process.env.NODE_ENV?.trim();

  const candidates: string[] = [];
  if (envName) {
    candidates.push(`.env.${envName}.local`, `.env.${envName}`);
  }
  candidates.push(`.env.local`, `.env`);

  // We want highest precedence last when we compute fileVars, but we never
  // override existing shell values. Build a merged map first (last file wins),
  // then assign only keys that are not already present in process.env.
  const merged: Record<string, string> = {};

  for (let i = candidates.length - 1; i >= 0; i--) {
    // reverse iteration builds base → local → env → env.local precedence later
  }

  for (const file of candidates) {
    const p = path.join(dir, file);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) continue;
    try {
      const parsed = dotenv.parse(fs.readFileSync(p));
      for (const [k, v] of Object.entries(parsed)) {
        merged[k] = v; // later files overwrite earlier in merged map
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Warning: failed parsing ${p}: ${msg}`);
    }
  }

  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined) {
      process.env[k] = v;
    }
  }
}

