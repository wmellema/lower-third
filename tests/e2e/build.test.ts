// Loads every built template from dist/ over file://, the way CasparCG does,
// and drives it with the exact calls CasparCG's HTML producer makes.
// Run with `npm run check` (builds first). TALLY_SCREENS=1 also writes
// docs/screens/<name>.jpg on a stand-in studio background.
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toXml } from "../../src/dev/payload";

const dist = resolve("dist");
const names = existsSync(dist)
	? readdirSync(dist).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5))
	: [];

interface Preview {
	samples: { label: string; data: unknown }[];
	actions?: { call: string }[];
}

// Same escaping as CasparCG's html_cg_proxy: the data becomes one JS string literal.
function casparUpdate(data: string): string {
	const escaped = data
		.trim()
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
	return `update("${escaped}")`;
}

const STUDIO = `radial-gradient(circle at 18% 30%, rgb(255 178 92 / 0.5), transparent 12%),
	radial-gradient(circle at 82% 26%, rgb(90 140 255 / 0.4), transparent 14%),
	radial-gradient(ellipse at 50% 120%, rgb(255 90 60 / 0.3), transparent 55%),
	radial-gradient(ellipse at 50% 45%, #3a3f52, #12141c 75%)`;

let browser: Browser;
beforeAll(async () => {
	browser = await chromium.launch();
});
afterAll(async () => {
	await browser?.close();
});

async function open(name: string): Promise<{ page: Page; errors: string[] }> {
	const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
	page.on("requestfailed", (r) => errors.push(`failed to load ${r.url()}`));
	await page.goto(pathToFileURL(join(dist, `${name}.html`)).href);
	return { page, errors };
}

const state = (page: Page) => page.evaluate(() => window.tally?.state);
const settle = (page: Page, want: string) =>
	page.waitForFunction((s) => window.tally?.state === s, want, { timeout: 5000 });

describe.skipIf(!names.length)("built templates", () => {
	describe.each(names)("%s", (name) => {
		const preview: Preview = JSON.parse(readFileSync(join("templates", name, "preview.json"), "utf8"));
		const sample = preview.samples[0].data;

		it("plays, steps, runs actions and stops over file://", async () => {
			const { page, errors } = await open(name);
			expect(await state(page)).toBe("idle");

			// CG ADD with play-on-load: update, then play.
			await page.evaluate(casparUpdate(JSON.stringify(sample)));
			await page.evaluate("play()");
			await settle(page, "on");
			await page.waitForTimeout(1200);

			if (process.env.TALLY_SCREENS) {
				mkdirSync("docs/screens", { recursive: true });
				await page.evaluate((bg) => (document.documentElement.style.background = bg), STUDIO);
				await page.screenshot({ path: `docs/screens/${name}.jpg`, type: "jpeg", quality: 85 });
				await page.evaluate(() => (document.documentElement.style.background = ""));
			}

			await page.evaluate("next()");
			for (const action of preview.actions ?? []) {
				const call = action.call.endsWith(")") ? action.call : `${action.call}()`;
				await page.evaluate(call);
			}
			await page.evaluate("stop()");
			await settle(page, "idle");
			await page.evaluate("remove()");
			expect(errors).toEqual([]);
			await page.close();
		}, 30_000);

		it("accepts the same data as CasparCG Client XML", async () => {
			const { page, errors } = await open(name);
			await page.evaluate(casparUpdate(toXml(sample)));
			const fromXml = await page.evaluate(() => JSON.stringify(window.tally?.steps));
			await page.reload();
			await page.evaluate(casparUpdate(JSON.stringify(sample)));
			const fromJson = await page.evaluate(() => JSON.stringify(window.tally?.steps));
			// XML carries every value as a string.
			const stringify = (s: string) => JSON.stringify(JSON.parse(s), (_k, v) => (typeof v === "number" || typeof v === "boolean" ? String(v) : v));
			expect(fromXml).toBe(stringify(fromJson));
			expect(errors).toEqual([]);
			await page.close();
		});
	});
});
