// Builds every template in templates/ into one self-contained HTML file
// (scripts, styles and fonts inlined), so it loads from CasparCG's template
// folder over file:// with nothing else next to it.
//
//   npm run build                      -> dist/<name>.html
//   npm run build -- lower-third       -> only that template
//   npm run build -- --out <dir>       -> e.g. straight into CasparCG's template folder
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { alias, target } from "../vite.config.ts";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { out: { type: "string", default: process.env.TALLY_OUT ?? "dist" } },
});

const templatesDir = resolve("templates");
const out = resolve(values.out);
const tmp = join(out, ".tally-build");
const names = readdirSync(templatesDir).filter(
	(name) => !name.startsWith("_") && existsSync(join(templatesDir, name, "index.html")),
);
const selected = positionals.length ? names.filter((n) => positionals.includes(n)) : names;
if (!selected.length) throw new Error(`No templates matched: ${positionals.join(", ")}`);

mkdirSync(out, { recursive: true });
for (const name of selected) {
	await build({
		configFile: false,
		root: join(templatesDir, name),
		publicDir: false,
		logLevel: "warn",
		resolve: { alias },
		plugins: [viteSingleFile({ removeViteModuleLoader: true })],
		build: { target, cssTarget: target, outDir: join(tmp, name), emptyOutDir: true },
	});
	renameSync(join(tmp, name, "index.html"), join(out, `${name}.html`));
	console.log(`built ${join(values.out, `${name}.html`)}`);
}
rmSync(tmp, { recursive: true, force: true });
