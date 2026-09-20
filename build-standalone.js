#!/usr/bin/env node
/*
  Inlines the Terra stylesheets into a screen file so it can be opened from
  disk, or published somewhere that blocks sibling asset requests, without
  losing the design system. design-system/*.css stays the source of truth —
  re-run this after changing tokens, textures or components.

    node build-standalone.js farm-app.html farm-app.standalone.html
    node build-standalone.js design-system/index.html terra-design-system.standalone.html
*/
const fs = require('fs');
const path = require('path');

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) {
  console.error('usage: node build-standalone.js <source.html> <output.html>');
  process.exit(1);
}

const root = __dirname;
const srcPath = path.resolve(root, inFile);
const src = fs.readFileSync(srcPath, 'utf8');

// Swap every local <link rel=stylesheet> for the stylesheet's contents.
// hrefs resolve against the source file's own directory, the way the browser
// resolves them — not against the repo root. The design-system page links
// "tokens.css"; farm-app.html links "design-system/tokens.css".
const srcDir = path.dirname(srcPath);
let out = src.replace(
  /[ \t]*<link rel="stylesheet" href="([^"]+)">\n?/g,
  (match, href) => {
    if (/^https?:/.test(href)) return match;
    const css = fs.readFileSync(path.resolve(srcDir, href), 'utf8');
    return `<style>\n/* ---- inlined from ${href} ---- */\n${css}\n</style>\n`;
  }
);

// The artifact host supplies its own doctype/head/body, so hand it page
// content only — and keep the .terra scope that <body class="terra"> gave us.
out = out
  .replace(/^[\s\S]*?<head>\s*/, '')
  .replace(/\s*<\/head>\s*/, '\n')
  .replace(/<body class="terra">/, '<div class="terra">')
  .replace(/<\/body>\s*<\/html>\s*$/, '</div>\n');

fs.writeFileSync(path.resolve(root, outFile), out);
console.log(`${outFile} — ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB`);
