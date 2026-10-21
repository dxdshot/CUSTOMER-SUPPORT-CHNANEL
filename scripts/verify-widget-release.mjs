import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

function releaseFrom(source, path) {
  const assets = source.match(/assets:\s*["']([^"']+)["']/)?.[1];
  const storage = source.match(/storage:\s*["']([^"']+)["']/)?.[1];
  assert.ok(assets, `${path} must declare an asset release`);
  assert.ok(storage, `${path} must declare a storage release`);
  return { assets, storage };
}

const sourceRelease = releaseFrom(read("src/widget/version.ts"), "src/widget/version.ts");
const embedRelease = releaseFrom(read("src/widget/embed.ts"), "src/widget/embed.ts");
const builtVersionRelease = releaseFrom(read("public/widget/version.js"), "public/widget/version.js");
const builtEmbed = read("public/widget/embed.js");
const builtEmbedRelease = releaseFrom(builtEmbed, "public/widget/embed.js");

assert.deepEqual(embedRelease, sourceRelease, "the classic embed and dashboard snippet must use one release");
assert.deepEqual(builtVersionRelease, sourceRelease, "the built version module must match its source");
assert.deepEqual(builtEmbedRelease, sourceRelease, "the built embed must match its source");
assert.match(builtEmbed, new RegExp(`widget\\.js\\?v=\\$\\{WIDGET_RELEASE\\.assets\\}`));

const builtWidget = read("public/widget/widget.js");
assert.match(builtWidget, /options\.transport\.sendPreset\(message\.presetQuestion/);
assert.doesNotMatch(builtWidget, /input\.value\s*=\s*preset\.question/);
assert.match(builtWidget, /message\.id\.startsWith\("preset-"\)/);
assert.match(builtWidget, /!message\.presetQuestion\s*&&\s*!presetVisitorIds\.has\(message\.id\)/);
assert.match(builtWidget, /hasSentManualVisitorMessage && !emailPromptDone/);
assert.match(builtWidget, /emailTrigger\.addEventListener\("click"/);
assert.match(builtWidget, /emailCardOpen\s*=\s*true/);
const emailDismissHandler = builtWidget.match(
  /emailDismiss\.addEventListener\("click", \(\) => \{([\s\S]*?)\n\s*\}\);/,
)?.[1];
assert.ok(emailDismissHandler, "the email Skip handler must remain present");
assert.match(emailDismissHandler, /emailCardOpen\s*=\s*false/);
assert.doesNotMatch(emailDismissHandler, /emailPromptDone/);
assert.match(
  builtWidget,
  /formWrap\.hidden\s*=\s*form\.hidden\s*&&\s*emailTrigger\.hidden\s*&&\s*emailPrompt\.hidden\s*&&\s*firstChat\.hidden/,
);
assert.doesNotMatch(builtWidget, /topline-title/);

const builtStyles = read("public/widget/styles.js");
assert.match(builtStyles, /--accent-fill:var\(--blue\)/);
assert.match(builtStyles, /\.header\{[^}]*background:var\(--accent-fill\)/);
assert.match(builtStyles, /\.first-chat\{[^}]*background:var\(--accent-fill\)/);
assert.match(builtStyles, /\.email-trigger\{[^}]*justify-content:center[^}]*background:var\(--blue\)/);
assert.doesNotMatch(builtStyles, /var\(--warning\)/);
assert.match(builtStyles, /\.widget\[data-maximized=true\] \.email-trigger\{[^}]*max-width:720px[^}]*margin:0 auto/);
assert.match(builtStyles, /\.widget\[data-maximized=true\] \.input\{[^}]*min-height:36px[^}]*max-height:120px/);
assert.match(builtStyles, /\.email-trigger:not\(\[hidden\]\)~\.composer,[^{]*\{[^}]*border-top:0/);
assert.match(builtStyles, /\.widget\[data-maximized=true\] \.identity-text\{[^}]*top:50%/);
assert.match(builtStyles, /\.email-save\{[^}]*background:var\(--blue\)/);
assert.match(builtStyles, /\.email-skip\{[^}]*background:var\(--muted\)/);

console.log("Widget release, preset send, email disclosure, and shared accent contracts passed.");
