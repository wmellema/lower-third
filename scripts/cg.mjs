// Sends CG commands to a CasparCG server over AMCP, for driving the built
// templates on a real channel.
//
//   npm run cg -- add lower-third sample:0        data from templates/<name>/preview.json
//   npm run cg -- add ticker ./my-data.json       data from a file
//   npm run cg -- update '{"title":"Hi"}'         inline JSON
//   npm run cg -- next | stop | remove | play | clear
//   npm run cg -- invoke "flash('Replay')"
//
// Options: --host (127.0.0.1) --port (5250) --channel (1-20) --layer (1),
// or CASPAR_HOST / CASPAR_PORT.
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		host: { type: "string", default: process.env.CASPAR_HOST ?? "127.0.0.1" },
		port: { type: "string", default: process.env.CASPAR_PORT ?? "5250" },
		channel: { type: "string", default: "1-20" },
		layer: { type: "string", default: "1" },
	},
});

const [command, ...rest] = positionals;
const quote = (text) => `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const cg = `CG ${values.channel}`;

function data(arg, template) {
	if (!arg) return "";
	const sample = /^sample:(\d+)$/.exec(arg);
	if (sample) {
		if (!template) throw new Error("sample:N needs a template name");
		const preview = JSON.parse(readFileSync(`templates/${template}/preview.json`, "utf8"));
		const found = preview.samples?.[Number(sample[1])];
		if (!found) throw new Error(`${template} has no sample ${sample[1]}`);
		return JSON.stringify(found.data);
	}
	if (existsSync(arg)) return JSON.stringify(JSON.parse(readFileSync(arg, "utf8")));
	return JSON.stringify(JSON.parse(arg));
}

const lines = {
	add: () => `${cg} ADD ${values.layer} ${quote(rest[0])} 1 ${quote(data(rest[1], rest[0]))}`,
	update: () => `${cg} UPDATE ${values.layer} ${quote(data(rest[0]))}`,
	play: () => `${cg} PLAY ${values.layer}`,
	next: () => `${cg} NEXT ${values.layer}`,
	stop: () => `${cg} STOP ${values.layer}`,
	remove: () => `${cg} REMOVE ${values.layer}`,
	invoke: () => `${cg} INVOKE ${values.layer} ${quote(rest[0])}`,
	clear: () => `${cg} CLEAR`,
};

if (!lines[command] || (["add", "invoke"].includes(command) && !rest[0])) {
	console.error("usage: npm run cg -- add <template> [json|file|sample:N] | update <data> | play | next | stop | remove | invoke <call> | clear");
	process.exit(1);
}

const line = lines[command]();
console.log(`> ${line}`);
const socket = connect(Number(values.port), values.host, () => socket.write(`${line}\r\n`));
socket.setTimeout(3000, () => {
	console.error("No reply from CasparCG");
	socket.destroy();
	process.exitCode = 1;
});
socket.on("data", (chunk) => {
	const reply = chunk.toString().trim();
	console.log(`< ${reply}`);
	if (!/^20\d/.test(reply)) process.exitCode = 1;
	socket.end();
});
socket.on("error", (e) => {
	console.error(`Cannot reach CasparCG at ${values.host}:${values.port}: ${e.message}`);
	process.exitCode = 1;
});
