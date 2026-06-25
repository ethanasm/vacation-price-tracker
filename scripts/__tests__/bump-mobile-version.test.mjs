import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"bump-mobile-version.mjs",
);

function withConfig(version, run, { quotes = "double" } = {}) {
	const dir = mkdtempSync(join(tmpdir(), "bump-"));
	const path = join(dir, "app.config.ts");
	const q = quotes === "single" ? "'" : '"';
	writeFileSync(
		path,
		`const config = {\n  name: ${q}Price Tracker${q},\n  version: ${q}${version}${q},\n};\nexport default config;\n`,
	);
	try {
		return run(path, dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function bump(path, args) {
	return execFileSync("node", [SCRIPT, ...args], {
		encoding: "utf8",
		env: { ...process.env, BUMP_MOBILE_CONFIG_PATH: path },
	}).trim();
}

test("--print returns the current version without writing (double quotes)", () => {
	withConfig("0.3.2", (path) => {
		assert.equal(bump(path, ["--print"]), "0.3.2");
		assert.match(readFileSync(path, "utf8"), /version: "0\.3\.2"/);
	});
});

test("patch bump increments the patch component (double quotes)", () => {
	withConfig("0.3.2", (path) => {
		assert.equal(bump(path, ["--type", "patch"]), "0.3.3");
		assert.match(readFileSync(path, "utf8"), /version: "0\.3\.3"/);
	});
});

test("--print and patch bump work with single-quote fixture (quote-agnostic)", () => {
	withConfig("0.3.2", (path) => {
		assert.equal(bump(path, ["--print"]), "0.3.2");
		assert.match(readFileSync(path, "utf8"), /version: '0\.3\.2'/);
		assert.equal(bump(path, ["--type", "patch"]), "0.3.3");
		assert.match(readFileSync(path, "utf8"), /version: '0\.3\.3'/);
	}, { quotes: "single" });
});

test("minor bump increments minor and zeroes patch", () => {
	withConfig("0.3.2", (path) => {
		assert.equal(bump(path, ["--type", "minor"]), "0.4.0");
	});
});

test("major bump maps to minor while pre-1.0", () => {
	withConfig("0.3.2", (path) => {
		assert.equal(bump(path, ["--type", "major"]), "0.4.0");
	});
});

test("major bump increments major once at or above 1.0", () => {
	withConfig("1.4.2", (path) => {
		assert.equal(bump(path, ["--type", "major"]), "2.0.0");
	});
});

test("--floor raises the base when the tag is ahead of the file", () => {
	withConfig("0.3.2", (path) => {
		// file says 0.3.2 but the last tag was 0.5.0 → patch off the floor → 0.5.1
		assert.equal(bump(path, ["--type", "patch", "--floor", "0.5.0"]), "0.5.1");
	});
});

test("--floor below the file version is ignored", () => {
	withConfig("0.3.2", (path) => {
		assert.equal(bump(path, ["--type", "patch", "--floor", "0.1.0"]), "0.3.3");
	});
});

test("rejects an invalid --type", () => {
	withConfig("0.3.2", (path) => {
		assert.throws(() => bump(path, ["--type", "bogus"]));
	});
});
