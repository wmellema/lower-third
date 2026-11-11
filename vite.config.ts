import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const core = fileURLToPath(new URL("./src/core/", import.meta.url));

// CasparCG 2.4 ships CEF 117; 2.5 ships CEF 142.
export const target = "chrome117";

export const alias = [
	{ find: /^tally$/, replacement: `${core}index.ts` },
	{ find: /^tally\//, replacement: core },
];

// Dev server: the gallery lives at / and every template at /templates/<name>/.
export default defineConfig({
	resolve: { alias },
	build: { target },
	server: { open: "/" },
});
