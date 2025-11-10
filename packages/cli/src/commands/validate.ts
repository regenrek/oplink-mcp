import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineCommand } from "citty";
import { colors } from "consola/utils";
import { load } from "js-yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { cwdArgs, logLevelArgs } from "./_shared";
import { logger } from "../utils/logger";

async function loadJson(p: string) {
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw);
}

export default defineCommand({
  meta: {
    name: "validate",
    description: "Validate .mcp-workflows/workflows.yaml and servers.json against Oplink schemas",
  },
  args: {
    ...cwdArgs,
    ...logLevelArgs,
    config: {
      type: "string",
      description: "Path to .mcp-workflows directory",
    },
  },
  async run({ args }) {
    const base = path.resolve(String(args.config || path.join(String(args.cwd || "."), ".mcp-workflows")));
    const workflowsPath = path.join(base, "workflows.yaml");
    const serversPath = path.join(base, "servers.json");

    const schemaDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "schema");
    const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false, meta: false });
    addFormats(ajv);
    const wfSchemaPath = path.join(schemaDir, "oplink-workflows.schema.json");
    const svSchemaPath = path.join(schemaDir, "oplink-servers.schema.json");

    const wfSchema = await loadJson(wfSchemaPath);
    const svSchema = await loadJson(svSchemaPath);

    const validateWorkflows = ajv.compile(wfSchema);
    const validateServers = ajv.compile(svSchema);

    let ok = true;

    try {
      const wfRaw = await readFile(workflowsPath, "utf8");
      const wfDoc = load(wfRaw) as unknown;
      const valid = validateWorkflows(wfDoc);
      if (!valid) {
        ok = false;
        logger.error(colors.red(`workflows.yaml is invalid:`));
        for (const err of validateWorkflows.errors || []) {
          logger.log(` - ${err.instancePath || "/"} ${err.message}`);
        }
      } else {
        logger.success(colors.green(`Validated ${path.relative(process.cwd(), workflowsPath)}`));
      }
    } catch (e: any) {
      ok = false;
      logger.error(`Failed to read/validate workflows.yaml: ${e.message}`);
    }

    try {
      const svRaw = await readFile(serversPath, "utf8");
      const svDoc = JSON.parse(svRaw);
      const valid = validateServers(svDoc);
      if (!valid) {
        ok = false;
        logger.error(colors.red(`servers.json is invalid:`));
        for (const err of validateServers.errors || []) {
          logger.log(` - ${err.instancePath || "/"} ${err.message}`);
        }
      } else {
        logger.success(colors.green(`Validated ${path.relative(process.cwd(), serversPath)}`));
      }
    } catch (e: any) {
      ok = false;
      logger.error(`Failed to read/validate servers.json: ${e.message}`);
    }

    if (!ok) {
      process.exitCode = 1;
    }
  },
});
