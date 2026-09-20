#!/usr/bin/env node
/*
  Builds the shipping mobile app out of farm-app.html: drops the desktop
  preview chrome (the documentation rail and the phone frame), inlines the
  Terra stylesheets, and lets the app fill the device viewport.

  farm-app.html stays the single source for markup and behaviour — re-run
  this after editing it.

    node build-mobile.js
*/
const fs = require('fs');
const path = require('path');

const root = __dirname;
const src = fs.readFileSync(path.join(root, 'farm-app.html'), 'utf8');

const grab = (re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`build-mobile: could not find ${what} in farm-app.html`);
  return m[1];
};

// App CSS minus the preview-only shell rules.
const appCss = grab(/<style>([\s\S]*?)<\/style>/, '<style> block')
  .replace(/\/\* @preview-shell-start[\s\S]*?@preview-shell-end \*\/\n/, '');

const screens = grab(/<div class="phone-screen" id="app">([\s\S]*?)\s*<!-- @app-end -->/, 'screen markup');
const sprite = grab(/(<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" style="display:none"[\s\S]*?<\/svg>)/, 'icon sprite');
const script = grab(/<script>([\s\S]*?)<\/script>/, '<script> block');

const css = ['tokens', 'textures', 'components']
  .map(n => `/* ---- ${n}.css ---- */\n` + fs.readFileSync(path.join(root, 'design-system', `${n}.css`), 'utf8'))
  .join('\n');

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SupaFarm</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#F7F8F6">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="description" content="SupaFarm — log farm work by voice. Talk, snap a photo, and Anara files it for you.">
<style>
${css}
</style>
<style>
  *,*::before,*::after{ box-sizing:border-box; }
  html,body{ height:100%; }
  body{
    margin:0; background:var(--bg-app); font-family:var(--font-sans); color:var(--text-primary);
    overscroll-behavior:none; -webkit-tap-highlight-color:transparent;
  }

  /* The app owns the viewport. dvh keeps the tab bar put when mobile
     browser chrome slides away mid-scroll. */
  #app{
    position:relative; overflow:hidden; background:var(--surface);
    width:100%; height:100vh; height:100dvh; margin:0 auto;
  }

  /* Opened on a desktop, it sits as a phone-width column rather than
     stretching a mobile layout across the whole window. */
  @media (min-width:600px){
    body{ display:flex; align-items:center; justify-content:center; padding:24px; }
    #app{ width:400px; height:min(860px, calc(100dvh - 48px)); border-radius:28px; box-shadow:var(--shadow-lg); }
  }

${appCss.replace(/^\s*\*,\*::before,\*::after\{ box-sizing:border-box; \}\n\s*body\{[^\n]*\n\n/, '')}

  /* Last, so they win over the screen rules above: respect the notch and
     the home indicator. */
  .status-bar{ padding-top:calc(16px + env(safe-area-inset-top)) !important; }
  .tabbar{ padding-bottom:calc(6px + env(safe-area-inset-bottom)); }
  .screen-footer{ padding-bottom:calc(12px + env(safe-area-inset-bottom)); }
  .cap-record{ padding-bottom:calc(14px + env(safe-area-inset-bottom)); }

  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
  }
</style>
</head>
<body class="terra">

<div id="app">
${screens}
</div>

${sprite}

<script>${script}</script>

</body>
</html>
`;

fs.writeFileSync(path.join(root, 'farm-app.mobile.html'), out);
console.log(`farm-app.mobile.html — ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB`);
