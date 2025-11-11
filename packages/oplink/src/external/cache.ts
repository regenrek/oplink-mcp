import crypto from "node:crypto";
import { z } from "zod";
import uFuzzy from "@leeoniya/ufuzzy";
import type { ServerToolInfo } from "mcporter";
import { ExternalServerError, listExternalServerTools } from "../external-tools";

const ToolSnapshotSchema = z
	.object({
		name: z.string(),
	})
	.passthrough();

const AliasSnapshotSchema = z.object({
	alias: z.string(),
	versionHash: z.string().min(1),
	refreshedAt: z.number().nonnegative(),
	tools: z.array(ToolSnapshotSchema),
});

const CacheSnapshotSchema = z.record(AliasSnapshotSchema);

export type SerializedCache = z.infer<typeof CacheSnapshotSchema>;

export interface CachePersistenceAdapter {
	load(): Promise<SerializedCache | undefined>;
	save(cache: SerializedCache): Promise<void>;
}

interface CacheEntry {
	alias: string;
	versionHash: string;
	refreshedAt: number;
	tools: Map<string, ServerToolInfo>;
	lastError?: CacheErrorState;
	// Precomputed search haystacks for suggestions
	names: string[];
	namesNorm: string[];
	fieldsNorm: string[]; // name + " " + description
}

export interface CacheErrorState {
	message: string;
	timestamp: number;
}

export interface CacheDescribeView {
	alias: string;
	versionHash: string;
	refreshedAt: number;
	stale: boolean;
	toolCount: number;
	tools: ServerToolInfo[];
	lastError?: CacheErrorState;
}

export interface ExternalToolCacheOptions {
	ttlMs?: number;
	persistence?: CachePersistenceAdapter;
}

export interface EnsureOptions {
	forceRefresh?: boolean;
}

export interface ToolLookupOptions extends EnsureOptions {
	refreshIfMissing?: boolean;
}

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 5;

export class ExternalToolCache {
	private readonly configDir: string;
	private readonly ttlMs: number;
	private readonly persistence?: CachePersistenceAdapter;
	private readonly entries = new Map<string, CacheEntry>();
	private readonly inflight = new Map<string, Promise<CacheEntry>>();

	constructor(configDir: string, options: ExternalToolCacheOptions = {}) {
		this.configDir = configDir;
		this.ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
		this.persistence = options.persistence;
	}

	async restore(): Promise<void> {
		if (!this.persistence) {
			return;
		}
		let snapshot: SerializedCache | undefined;
		try {
			snapshot = await this.persistence.load();
		} catch (error) {
			console.error("Failed to load external tool cache snapshot:", error);
			return;
		}
		if (!snapshot) {
			return;
		}
		const parsed = CacheSnapshotSchema.safeParse(snapshot);
		if (!parsed.success) {
			console.error("Cached external tool snapshot is invalid:", parsed.error.message);
			return;
		}
		for (const [aliasKey, entry] of Object.entries(parsed.data)) {
			const alias = normalizeAlias(entry.alias || aliasKey);
			if (!alias) {
				continue;
			}
			const tools = new Map<string, ServerToolInfo>();
			for (const tool of entry.tools as ServerToolInfo[]) {
				if (!tool?.name) {
					continue;
				}
				tools.set(tool.name, tool);
			}
			const names = Array.from(tools.keys());
			const namesNorm = names.map((n) => normalizeText(n));
			const fieldsNorm = Array.from(tools.values()).map((t) =>
				normalizeText(`${t.name} ${t.description ?? ""}`),
			);
			this.entries.set(alias, {
				alias,
				versionHash: entry.versionHash,
				refreshedAt: entry.refreshedAt,
				tools,
				names,
				namesNorm,
				fieldsNorm,
			});
		}
	}

async ensureAliases(
	aliases: Iterable<string>,
	options?: EnsureOptions,
): Promise<void> {
	const unique = Array.from(new Set(Array.from(aliases).map(normalizeAlias))).filter(Boolean) as string[];
	await Promise.all(unique.map((alias) => this.ensureAlias(alias, options)));
}

async ensureAlias(alias: string, options?: EnsureOptions): Promise<void> {
	await this.ensureEntry(alias, options);
}

	async getTool(
		alias: string,
		toolName: string,
		options?: ToolLookupOptions,
	): Promise<ServerToolInfo> {
		const normalizedTool = toolName.trim();
		if (!normalizedTool) {
			throw new ExternalServerError("Tool name must be a non-empty string");
		}

	let entry = await this.ensureEntry(alias, options);
		let tool = entry.tools.get(normalizedTool);
		if (!tool && options?.refreshIfMissing !== false) {
			entry = await this.refreshAlias(alias);
			tool = entry.tools.get(normalizedTool);
		}
        if (!tool) {
            const suggestions = this.suggestToolsFromEntry(entry, normalizedTool, 3);
            const hint = suggestions.length > 0 ? ` Did you mean: ${suggestions.join(", ")}?` : "";
            const guidance =
              "Use the 'describe_tools' helper to see cached tools, or inspect the server directly with mcporter: 'npx mcporter list <server-url> --schema'";
            throw new ExternalServerError(
                `Server '${alias}' does not expose tool '${normalizedTool}'. ${guidance}.${hint}`,
            );
        }
		return tool;
	}

	getAliasView(alias: string): CacheDescribeView | undefined {
		const normalized = normalizeAlias(alias);
		if (!normalized) {
			return undefined;
		}
		const entry = this.entries.get(normalized);
		if (!entry) {
			return undefined;
		}
		return {
			alias: entry.alias,
			versionHash: entry.versionHash,
			refreshedAt: entry.refreshedAt,
			stale: this.isExpired(entry),
			toolCount: entry.tools.size,
			tools: Array.from(entry.tools.values()),
			lastError: entry.lastError,
		};
	}

getKnownAliases(): string[] {
	return Array.from(this.entries.keys());
}

private async ensureEntry(alias: string, options?: EnsureOptions): Promise<CacheEntry> {
	const normalized = normalizeAlias(alias);
	if (!normalized) {
		throw new ExternalServerError("Server alias must be a non-empty string");
	}
	const existing = this.entries.get(normalized);
	const needsRefresh =
		options?.forceRefresh === true ||
		!existing ||
		this.isExpired(existing);
	if (!needsRefresh && existing) {
		return existing;
	}
	return this.refreshAlias(normalized);
}

private async refreshAlias(alias: string): Promise<CacheEntry> {
	const normalized = normalizeAlias(alias);
		if (!normalized) {
			throw new ExternalServerError("Server alias must be a non-empty string");
		}
		const existing = this.inflight.get(normalized);
		if (existing) {
			return existing;
		}

		const pending = (async () => {
			const tools = await listExternalServerTools(normalized, this.configDir, true);
			const now = Date.now();
			const map = new Map<string, ServerToolInfo>();
			for (const tool of tools) {
				map.set(tool.name, tool);
			}
			const names = Array.from(map.keys());
			const namesNorm = names.map((n) => normalizeText(n));
			const fieldsNorm = Array.from(map.values()).map((t) =>
				normalizeText(`${t.name} ${t.description ?? ""}`),
			);
			const entry: CacheEntry = {
				alias: normalized,
				versionHash: hashTools(tools),
				refreshedAt: now,
				tools: map,
				names,
				namesNorm,
				fieldsNorm,
			};
			this.entries.set(normalized, entry);
			await this.persistSnapshot();
			return entry;
		})();

		this.inflight.set(normalized, pending);
		try {
			return await pending;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const current = this.entries.get(normalized);
			if (current) {
				current.lastError = {
					message,
					timestamp: Date.now(),
				};
			}
			throw error;
		} finally {
			if (this.inflight.get(normalized) === pending) {
				this.inflight.delete(normalized);
			}
		}
	}

	private isExpired(entry: CacheEntry): boolean {
		if (this.ttlMs <= 0) {
			return false;
		}
		return Date.now() - entry.refreshedAt > this.ttlMs;
	}

	private async persistSnapshot(): Promise<void> {
		if (!this.persistence) {
			return;
		}
		const snapshot: SerializedCache = {};
		for (const entry of this.entries.values()) {
			snapshot[entry.alias] = {
				alias: entry.alias,
				versionHash: entry.versionHash,
				refreshedAt: entry.refreshedAt,
				tools: Array.from(entry.tools.values()),
			};
		}
		try {
			await this.persistence.save(snapshot);
		} catch (error) {
			console.error("Failed to persist external tool cache:", error);
		}
	}

	private suggestToolsFromEntry(entry: CacheEntry, query: string, limit = 3): string[] {
		const q = normalizeText(query);
		if (!q) return [];
		const suggestions: string[] = [];
		try {
			const ufStrict = new uFuzzy({ intraMode: 0 });
			const resA: any = ufStrict.search(entry.namesNorm, q, 0, Math.max(10, limit));
			if (Array.isArray(resA) && Array.isArray(resA[2])) {
				const order: number[] = resA[2];
				for (const idx of order) {
					suggestions.push(entry.names[idx]);
					if (suggestions.length >= limit) break;
				}
			}
			if (suggestions.length < limit) {
				const ufLen = new uFuzzy({ intraMode: 1 });
				const resB: any = ufLen.search(entry.fieldsNorm, q, 0, Math.max(15, limit * 2));
				if (Array.isArray(resB) && Array.isArray(resB[2])) {
					const orderB: number[] = resB[2];
					for (const idx of orderB) {
						const name = entry.names[idx];
						if (!suggestions.includes(name)) suggestions.push(name);
						if (suggestions.length >= limit) break;
					}
				}
			}
		} catch {}
		return suggestions.slice(0, limit);
	}
}

function normalizeAlias(alias: string): string {
	return alias?.trim();
}

function normalizeText(input: string): string {
	return input
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

function hashTools(tools: ServerToolInfo[]): string {
	const serialized = tools
		.map((tool) => ({
			name: tool.name,
			description: tool.description ?? "",
			inputSchema: tool.inputSchema ?? null,
			outputSchema: tool.outputSchema ?? null,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
	return crypto.createHash("sha256").update(JSON.stringify(serialized)).digest("hex");
}
