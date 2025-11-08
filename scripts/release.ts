import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface PackageTarget {
	name: string;
	dir: string;
	bump?: boolean;
	publish?: boolean;
	access?: "public" | "restricted";
}

const packageTargets: PackageTarget[] = [
	{ name: "root", dir: ".", bump: true },
	{ name: "@oplink/core", dir: "packages/oplink", bump: true, publish: true, access: "public" },
	{ name: "oplink", dir: "packages/cli", bump: true, publish: true, access: "public" },
	{ name: "@oplink/test-utils", dir: "packages/test-utils", bump: true },
];

function run(command: string, cwd: string) {
	console.log(`Executing: ${command} in ${cwd}`);
	execSync(command, { stdio: "inherit", cwd });
}

function ensureCleanWorkingTree() {
	const status = execSync("git status --porcelain", { cwd: "." })
		.toString()
		.trim();
	if (status.length > 0) {
		throw new Error(
			"Working tree has uncommitted changes. Please commit or stash them before running the release script.",
		);
	}
}

/**
 * Bump version in package.json
 * @param pkgPath Path to the package directory
 * @param type Version bump type: 'major', 'minor', 'patch', or specific version
 * @returns The new version
 */
function bumpVersion(
	pkgPath: string,
	type: "major" | "minor" | "patch" | string,
): string {
	const pkgJsonPath = path.join(pkgPath, "package.json");
	const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
	const currentVersion = pkgJson.version;
	let newVersion: string;

	if (type === "major" || type === "minor" || type === "patch") {
		// Parse current version
		const [major, minor, patch] = currentVersion.split(".").map(Number);

		// Bump version according to type
		if (type === "major") {
			newVersion = `${major + 1}.0.0`;
		} else if (type === "minor") {
			newVersion = `${major}.${minor + 1}.0`;
		} else {
			// patch
			newVersion = `${major}.${minor}.${patch + 1}`;
		}
	} else {
		// Use the provided version string directly
		newVersion = type;
	}

	// Update package.json
	pkgJson.version = newVersion;
	fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`);

	console.log(
		`Bumped version from ${currentVersion} to ${newVersion} in ${pkgJsonPath}`,
	);
	return newVersion;
}

/**
 * Bump version in all package.json files
 * @param versionBump Version bump type or specific version
 * @returns The new version
 */
function bumpAllVersions(
	versionBump: "major" | "minor" | "patch" | string = "patch",
): string {
	const rootTarget = packageTargets.find(
		(target) => target.dir === "." && target.bump,
	);
	if (!rootTarget) {
		throw new Error("Release script requires a root package entry");
	}
	const rootPath = path.resolve(rootTarget.dir);
	const newVersion = bumpVersion(rootPath, versionBump);

	for (const target of packageTargets) {
		if (!target.bump || target.dir === ".") {
			continue;
		}
		const pkgPath = path.resolve(target.dir);
		const manifestPath = path.join(pkgPath, "package.json");
		if (!fs.existsSync(manifestPath)) {
			console.warn(`Skipping ${target.name}; no package.json found at ${manifestPath}`);
			continue;
		}
		bumpVersion(pkgPath, newVersion);
	}

	return newVersion;
}

/**
 * Create a git commit and tag for the release
 * @param version The version to tag
 */
function createGitCommitAndTag(version: string) {
	console.log("Creating git commit and tag...");

	try {
		// Stage all changes
		run("git add .", ".");

		// Create commit with version message
		run(`git commit -m "chore: release v${version}"`, ".");

		// Create tag
		run(`git tag -a v${version} -m "Release v${version}"`, ".");

		// Push commit and tag to remote
		console.log("Pushing commit and tag to remote...");
		run("git push", ".");
		run("git push --tags", ".");

		console.log(`Successfully created and pushed git tag v${version}`);
	} catch (error) {
		console.error("Failed to create git commit and tag:", error);
		throw error;
	}
}

async function publishPackages(
	versionBump: "major" | "minor" | "patch" | string = "patch",
) {
	ensureCleanWorkingTree();

	const newVersion = bumpAllVersions(versionBump);

	createGitCommitAndTag(newVersion);

	for (const target of packageTargets.filter((pkg) => pkg.publish)) {
		const pkgPath = path.resolve(target.dir);
		const manifestPath = path.join(pkgPath, "package.json");
		if (!fs.existsSync(manifestPath)) {
			console.warn(`Skipping publish for ${target.name}; missing ${manifestPath}`);
			continue;
		}
		const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
		if (manifest.private) {
			console.warn(
				`Skipping publish for ${target.name}; package.json is marked private`,
			);
			continue;
		}
		const accessFlag = target.access === "public" ? " --access public" : "";
		console.log(`Publishing ${target.name}@${newVersion}...`);
		run(`pnpm publish --no-git-checks${accessFlag}`, pkgPath);
	}
}

// Get version bump type from command line arguments
const args = process.argv.slice(2);
const versionBumpArg = args[0] || "patch"; // Default to patch

publishPackages(versionBumpArg).catch(console.error);
