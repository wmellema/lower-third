// Scaffolds a new template:  npm run new -- my-graphic
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
	console.error("usage: npm run new -- <name>   (lowercase letters, digits and dashes)");
	process.exit(1);
}
const dir = join("templates", name);
if (existsSync(dir)) {
	console.error(`${dir} already exists`);
	process.exit(1);
}

const files = {
	"index.html": `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>${name}</title>
		<script type="module" src="./main.ts"></script>
	</head>
	<body>
		<div class="graphic" data-graphic>
			<h1 data-field="title">Title</h1>
			<p data-field="subtitle" data-if="subtitle"></p>
		</div>
	</body>
</html>
`,
	"style.scss": `// 1rem = 16px on a 1080p channel. --safe-x/--safe-y mark the graphics-safe area.
.graphic {
	position: absolute;
	left: var(--safe-x);
	bottom: var(--safe-y);
	padding: 1rem 2rem;
	background: var(--background, rgb(0 0 0 / 0.85));
	color: var(--text, #fff);
	font-family: system-ui, sans-serif;
}

h1 {
	margin: 0;
	font-size: 3rem;
}

p {
	margin: 0.25rem 0 0;
	font-size: 1.5rem;
}
`,
	"main.ts": `import "tally/base.css";
import "./style.scss";
import { gsap } from "gsap";
import { defineGraphic } from "tally";

interface Data {
	title: string;
	subtitle?: string;
}

defineGraphic<Data>({
	fields: {
		title: { label: "Title", required: true },
		subtitle: { label: "Subtitle" },
	},

	in: ({ root }) => gsap.from(root, { x: -40, opacity: 0, duration: 0.5, ease: "power3.out" }),

	out: ({ root }) =>
		gsap.to(root, {
			x: -40,
			opacity: 0,
			duration: 0.4,
			ease: "power3.in",
			onComplete: () => gsap.set(root, { clearProps: "transform,opacity" }),
		}),
});
`,
	"preview.json": `${JSON.stringify(
		{
			title: name,
			description: "A new template.",
			samples: [{ label: "Example", data: { title: "Hello", subtitle: "From CasparCG" } }],
		},
		null,
		"\t",
	)}
`,
};

mkdirSync(dir, { recursive: true });
for (const [file, content] of Object.entries(files)) writeFileSync(join(dir, file), content);
console.log(`Created ${dir}. Run npm run dev and open http://localhost:5173/#${name}`);
