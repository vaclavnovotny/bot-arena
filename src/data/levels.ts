export interface Signal {
  status: 'fail' | 'pass' | 'info';
  id: string;
  detail: string;
}

export interface LevelReport {
  n: number;
  section: 'Bot detection' | 'Selector resistance';
  title: string;
  family: string;
  testCode: string;
  failureMessage: string;
  signals: Signal[];
  layman: {
    problem: string;
    workaround: string;
  };
  playwright:
    | {
        kind: 'fixable';
        difficulty: 1 | 2 | 3 | 4 | 5;
        label: string;
        notes: string; // HTML allowed
      }
    | {
        kind: 'impossible';
        label: string;
        notes: string; // HTML allowed
      };
  aiva: {
    passes: boolean;
    fixes?: Array<
      | {
          kind: 'fixable';
          difficulty: 1 | 2 | 3 | 4 | 5;
          label: string;
          tags: string[];
          estimate: string;
        }
      | {
          kind: 'impossible';
          label: string;
          tags: string[];
          estimate: string;
        }
    >;
    notes: string; // HTML allowed
  };
}

export const sharedTest = (localN: number, urlPath: string) => `test('Level ${localN} sign in', async ({ page }) => {
  await page.goto('${urlPath}');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Access granted')).toBeVisible();
});`;

export const sharedFailure = `Error: expect(locator).toBeVisible() failed

Locator:  getByText('Access granted')
Expected: visible
Received: hidden
Timeout:  5000ms`;

export const selectorFailure = `Error: locator.fill: Test timeout of 30000ms exceeded.

Call log:
  - waiting for getByLabel('Email')
  - locator resolved to <no element matched>`;

export const levels: LevelReport[] = [
  {
    n: 1,
    section: 'Bot detection',
    title: 'The honest tell',
    family: 'Passive webdriver flags',
    testCode: sharedTest(1, '/bot-detection/level-1/'),
    failureMessage: sharedFailure,
    signals: [
      { status: 'fail', id: 'webdriver', detail: 'navigator.webdriver = true' },
      { status: 'fail', id: 'plugins', detail: 'navigator.plugins.length = 0 (expected > 0)' },
      { status: 'pass', id: 'languages', detail: 'navigator.languages = [en-US]' },
      { status: 'fail', id: 'ua-headless', detail: 'User-Agent contains "HeadlessChrome/148.0.7778.96"' },
      { status: 'pass', id: 'notif-permission', detail: 'Notification.permission and permissions.query agreed' },
    ],
    layman: {
      problem:
        'Browsers volunteer a lot about themselves to every site they visit — what version they are, what extensions are loaded, whether they are being controlled by an automation program. When Playwright drives a browser, the browser honestly admits "I am being automated" through a flag called <code>navigator.webdriver</code> that any site can read in a single line of JavaScript. Stock Playwright also has no plugins installed, no notification permissions set, and identifies itself as "HeadlessChrome" in its version string. Each of these is a yes/no question a site can ask in milliseconds.',
      workaround:
        'The browser inside a VNC session is a regular, fully-fledged Chrome that a regular user started. Nothing is automating it from the inside — the automation happens <em>outside</em> the browser, at the operating-system level, by moving a mouse and pressing keys on a remote desktop. The browser does not know it is being driven, so none of these flags get set, and it reports back the same values any real human visitor would.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 1,
      label: 'One-line init-script override',
      notes: `
        <p><strong>Verdict: the canonical checks here are a single-line <code>addInitScript</code> away from passing — they are the textbook example a stealth tutorial opens with.</strong></p>
        <p class="mt-2">Each of the five remaining signals can in principle be spoofed from Playwright:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li><code>navigator.webdriver</code> can be hidden via <code>--disable-blink-features=AutomationControlled</code> plus an <code>addInitScript</code> that redefines the property.</li>
          <li>The User-Agent can be spoofed with <code>--user-agent="..."</code> to strip the <code>HeadlessChrome</code> token.</li>
          <li><code>navigator.plugins</code>, <code>navigator.languages</code>, and the <code>Notification.permission</code> / <code>permissions.query</code> pair can all be patched via <code>Object.defineProperty</code> in an init script.</li>
        </ul>
        <p class="mt-2">Off-the-shelf stealth bundles (<code>playwright-extra</code> + <code>puppeteer-extra-plugin-stealth</code>) ship most of these patches already. The catch: every Chrome release introduces new tells, and commercial bot-detection vendors (Cloudflare, DataDome, PerimeterX, Imperva) maintain fingerprint databases of every known stealth-plugin signature. You spend more time updating your evasions than writing tests, and you only ever win <em>temporarily</em>.</p>
      `,
    },
    aiva: {
      passes: false,
      fixes: [
        {
          kind: 'fixable',
          difficulty: 1,
          label: 'Practical — init-script patch',
          tags: ['5-line patch in browser.ts', 'No architectural change', 'Vibe-codable'],
          estimate: '~30 minutes',
        },
        {
          kind: 'fixable',
          difficulty: 5,
          label: 'Clean — replace Puppeteer / CDP',
          tags: ['Rewrite control plane', 'X11/uinput steering', 'No CDP attached'],
          estimate: 'Multi-week refactor',
        },
      ],
      notes: `
        <p><strong>AIVA fails this level because of one signal: <code>navigator.webdriver = true</code>.</strong> AIVA launches Chrome via Puppeteer in <code>aiva-node/src/control-server/src/browser.ts:204</code> (<code>puppeteer.launch({...})</code>), and any browser attached via CDP has this flag set automatically by Chrome itself.</p>
        <p class="mt-3"><strong>The pragmatic fix is a single init script.</strong> Add this to AIVA's page-setup flow (e.g., next to the existing <code>hideCursorScript</code> wiring):</p>
        <pre class="mt-2 overflow-x-auto rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">await page.evaluateOnNewDocument(() =&gt; {
  Object.defineProperty(navigator, 'webdriver', {
    get: () =&gt; undefined,
    configurable: true,
  });
});</pre>
        <p class="mt-3">Bot Arena's L1 check is literally <code>navigator.webdriver === true</code> → FAIL. Returning <code>undefined</code> makes the check pass. This is exactly what every stealth plugin does (<code>puppeteer-extra-plugin-stealth</code>, <code>playwright-extra-stealth</code>, etc.). The original "multi-week refactor" estimate was for the architecturally pure fix — replacing Puppeteer/CDP entirely with a non-CDP control plane. That's the right answer if you need to pass sophisticated bot-detection vendors that fingerprint the <em>shape</em> of <code>navigator.webdriver</code> (own vs prototype descriptor, getter behaviour, etc.). For Bot Arena and most "naive equality check" detection layers, the 5-line patch is sufficient.</p>
        <p class="mt-3"><strong>Trade-off:</strong> the init-script patch is detectable by sites that audit property descriptors. If AIVA's target customers operate sites with enterprise-grade detection, the architectural path becomes the right long-term investment. For this demo and a wide class of real-world cases, the patch is the right answer today.</p>
      `,
    },
  },
  {
    n: 2,
    section: 'Bot detection',
    title: 'CDP attached',
    family: 'Headless / CDP-only tells',
    testCode: sharedTest(2, '/bot-detection/level-2/'),
    failureMessage: sharedFailure,
    signals: [
      { status: 'pass', id: 'driver-shims', detail: 'no cdc_* globals (Playwright is not Selenium)' },
      { status: 'pass', id: 'tostring-integrity', detail: 'Function.prototype.toString is native' },
      { status: 'fail', id: 'chrome-surface', detail: 'window.chrome.app and chrome.csi both missing (app=false, csi=false)' },
      { status: 'fail', id: 'browser-chrome-height', detail: 'outerHeight - innerHeight = 0px (no toolbars/tabs visible)' },
      { status: 'fail', id: 'screen-taskbar', detail: 'screen.availHeight = screen.height = 720 (no taskbar reserved)' },
    ],
    layman: {
      problem:
        '<strong>What "CDP" means:</strong> CDP stands for <em>Chrome DevTools Protocol</em> — the low-level remote-control interface Chrome exposes for tools like Chrome\'s own DevTools panel, Puppeteer, and Playwright. It is how those tools "drive" Chrome from outside the browser: clicking buttons, typing text, reading the DOM, taking screenshots — all without using a real keyboard and mouse. When CDP is attached, Chrome behaves slightly differently in measurable ways, and many of those differences also coincide with "I am running headless." <br /><br />A real laptop has visible chrome around every browser window — toolbars at the top, tabs, a Windows taskbar at the bottom, a macOS menu bar — and this chrome takes up real pixels. The browser can ask the screen "how much of you is mine, versus the OS\'s?" and the answer comes back in pixels. A headless automated browser has no chrome and no visible window at all, so the honest answer is zero. There is no way to fake having toolbars that do not exist.',
      workaround:
        'A VNC session streams a real, fully visible Chrome window running on a real desktop. There are real toolbars, a real taskbar, real OS chrome. Every measurement the page makes returns the same numbers any human visitor on any laptop would produce. Crucially, the automation happens <em>outside</em> the browser (at the OS level, moving a real cursor) — no CDP is attached, so Chrome behaves like an ordinary Chrome being used by an ordinary person.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 3,
      label: 'Partial — script signals only',
      notes: `
        <p><strong>Verdict: partially patchable in script; the pixel measurements require effectively rebuilding what VNC-AIVA already is.</strong></p>
        <p class="mt-2">The JavaScript-level signals (<code>chrome.app</code>, <code>chrome.csi</code>, driver shims, toString integrity) can be polyfilled with an <code>addInitScript</code> at page load. Easy.</p>
        <p class="mt-2">The window/screen pixel measurements are different. <code>outerHeight - innerHeight = 0</code> is true because the headless browser <em>literally has no toolbars</em>. Two ways out, neither great:</p>
        <ol class="mt-2 list-decimal space-y-2 pl-5">
          <li>Run headed (<code>headless: false</code>) on a server with Xvfb/Xvnc. But then you need a real desktop environment with a window manager and a panel to populate <code>screen.availHeight &lt; screen.height</code>, plus you need Chrome to actually display its chrome (not <code>--kiosk</code>). At that point, you have rebuilt the AIVA architecture from scratch.</li>
          <li>Spoof the values from JS — override <code>window.outerHeight</code>, <code>screen.height</code>, etc. via <code>addInitScript</code>. But the spoofs need to be internally consistent across signals: if you claim a 1080-pixel screen with a 40-pixel taskbar, the browser viewport's actual height needs to plausibly fit inside that. Cross-signal correlation catches these mismatches.</li>
        </ol>
        <p class="mt-2">In practice: an automation team trying to fix L2 with Playwright ends up reinventing AIVA badly.</p>
      `,
    },
    aiva: {
      passes: false,
      fixes: [
        {
          kind: 'fixable',
          difficulty: 2,
          label: 'Easy — drop 2 flags + add desktop env',
          tags: ['Config: drop 2 flags', 'Image: add desktop env'],
          estimate: 'Half a day',
        },
      ],
      notes: `
        <p><strong>AIVA currently fails this level for two reasons:</strong></p>
        <ol class="mt-2 list-decimal space-y-2 pl-5">
          <li>
            <strong>No visible browser chrome</strong> — AIVA's
            <code>browserArgs.ts</code> passes both <code>--start-fullscreen</code> and <code>--kiosk</code>.
            Both flags hide the toolbars, tabs, and address bar that any real Chrome window displays.
            With them dropped, <code>outerHeight - innerHeight</code> jumps from 0 px to the usual 80–120 px.
            <span class="font-mono text-[11px]">Drop: <code>--start-fullscreen</code>, <code>--kiosk</code></span>
          </li>
          <li>
            <strong>No taskbar</strong> — this one is outside Chrome's launch flags. AIVA's VNC session
            (Xvfb/Xvnc) has no window manager or desktop panel reserving screen pixels, so the X server
            reports <code>screen.availHeight === screen.height</code>. Adding a lightweight desktop
            environment to the AIVA image — XFCE, LXDE, or even just OpenBox + tint2 — with a panel/dock
            visible at the bottom of the screen would close this gap.
          </li>
        </ol>
      `,
    },
  },
  {
    n: 3,
    section: 'Bot detection',
    title: 'Mouse trajectory',
    family: 'Behavioural — mouse path and keystroke cadence',
    testCode: sharedTest(3, '/bot-detection/level-3/'),
    failureMessage: sharedFailure,
    signals: [
      { status: 'info', id: 'level3-armed', detail: 'recorder armed at page load' },
      { status: 'fail', id: 'mouse-trajectory', detail: 'only 1 mousemove point recorded between load and click (need ≥5 for a human-shaped curve)' },
      { status: 'pass', id: 'keystroke-cadence', detail: '0 keystrokes — page.fill() bypasses key events, so this check abstains' },
    ],
    layman: {
      problem:
        'When a human clicks a button on a web page, the mouse pointer travels there — left a bit, up a bit, curving naturally. That path leaves a trail of dozens of "I moved here" events along the way. Playwright does not do that. When you tell Playwright "click this button," the pointer instantly appears at the button\'s exact pixel and clicks. No travel, no curve. A page that records every mouse event notices that this click came out of nowhere — no human operates a computer like that.',
      workaround:
        'A VNC operator moves a real mouse cursor on a real operating system, generating the same continuous stream of mouse events any human would. Because the path is a <em>physical</em> movement (the cursor is dragged across the screen by a person or by image-recognition automation steering it), it has the same natural variation and curvature as any other user\'s.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 4,
      label: 'Per-interaction humanization; loses to ML defenders',
      notes: `
        <p><strong>Verdict: bypassable for the basic checks the arena performs, but Bezier-curve plugins alone do not defeat Cloudflare Bot Management or DataDome's behavioural model in production.</strong></p>
        <p class="mt-2">Playwright does expose lower-level mouse APIs that <em>can</em> generate intermediate moves:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li><code>page.mouse.move(x, y, { steps: 30 })</code> emits 30 intermediate <code>mousemove</code> events along a straight line.</li>
          <li>Wrap that in a Bezier-curve helper with randomized jitter and you produce trajectories with the right shape and curvature.</li>
          <li><code>page.keyboard.type(text, { delay: rand(80, 200) })</code> dispatches one key at a time with randomized inter-key delays.</li>
        </ul>
        <p class="mt-2">The catch: every interaction in the test suite needs this treatment. A one-line <code>page.click()</code> becomes a thirty-line "humanize" helper. And advanced behavioural fingerprinting (used by serious bot-detection vendors) trains ML models on real human mouse telemetry — they pick up on acceleration curves, overshoot-and-correct patterns, pause-before-click latency, and dozens of other features that synthetic Bezier curves don't replicate. So: bypassable here, in this demo. Increasingly hard against production-grade defenders.</p>
      `,
    },
    aiva: {
      passes: true,
      notes: `
        <p><strong>AIVA passes this level natively.</strong> The mouse cursor in AIVA's VNC session moves continuously across the screen at the OS level — exactly like any human user dragging a real mouse. No code or config change is needed here; this is one of the levels where running on a real machine wins by construction.</p>
      `,
    },
  },
  {
    n: 4,
    section: 'Bot detection',
    title: 'Fingerprint battery',
    family: 'Canvas, audio, WebGL renderer, font set',
    testCode: sharedTest(4, '/bot-detection/level-4/'),
    failureMessage: sharedFailure,
    signals: [
      { status: 'fail', id: 'webgl-renderer', detail: 'WebGL renderer = "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device …))" — software rasteriser, no GPU' },
      { status: 'pass', id: 'canvas-fp', detail: 'sha256 = f66453e0… (not on denylist — denylist is empty in v1)' },
      { status: 'pass', id: 'audio-fp', detail: 'sha256 = 543fb8e0… (not on denylist — denylist is empty in v1)' },
      { status: 'pass', id: 'font-probe', detail: 'Segoe UI Emoji, Arial Black, Comic Sans MS — UA-consistent for the Windows runner' },
    ],
    layman: {
      problem:
        'Real computers have real graphics cards from real manufacturers (Intel, NVIDIA, AMD), and each draws images and text in subtly different but characteristic ways. Real computers also have real font files installed by the operating system. Headless automated browsers have neither — they use a software-only graphics stack called <code>SwiftShader</code> that produces an obviously-different visual fingerprint, and they ship with a stripped-down set of fonts. A page can render a tiny invisible test image and hash the pixels; that single hash is usually enough to tell whether the browser is running on real silicon or a CI runner.',
      workaround:
        'A VNC session runs on a real machine with a real graphics stack and a real set of fonts. The fingerprints it produces match those of millions of other real desktop Chrome installations.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 4,
      label: 'Stealth pack + per-vendor maintenance',
      notes: `
        <p><strong>Verdict: solvable via stealth-class plugins, with continuous cat-and-mouse against sophisticated vendors.</strong></p>
        <p class="mt-2">Canvas / audio / WebGL renderer / font spoofing is the headline feature of <code>puppeteer-extra-plugin-stealth</code>, <code>playwright-extra</code>'s stealth bundle, <a href="https://github.com/rebrowser/rebrowser-patches" class="text-sky-700 underline hover:text-sky-900">rebrowser-patches</a>, and Camoufox. Drop one of these into a Playwright setup and the four signals this demo measures are routinely defeated; the maintainers have already solved cross-signal consistency for the common case — a "Chrome on Windows" fingerprint package is internally coherent across canvas hash, audio waveform, WebGL renderer, and font widths.</p>
        <p class="mt-2">The friction (4/5, not impossible) lives in the cat-and-mouse:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Detection vendors publish writeups identifying new tells in stealth packages and patch around them — see <a href="https://datadome.co/threat-research/how-datadome-detects-puppeteer-extra-stealth/" class="text-sky-700 underline hover:text-sky-900">DataDome on stealth's iframe-contentWindow leak</a>.</li>
          <li>Rebrowser-patches and Camoufox ship as continuously-updated drop-ins; staying current means tracking releases on the same cadence as the detection vendors.</li>
          <li>Higher-end defenders (Akamai) have moved primary detection to TLS-level fingerprinting (JA3/JA4), which neither stealth nor patched Playwright addresses on its own — that adds another tooling layer.</li>
        </ul>
        <p class="mt-2">For the named vendors and most production-grade detection, a Playwright suite picks a stealth stack and accepts a perpetual maintenance overhead. Not impossible, not trivial.</p>
      `,
    },
    aiva: {
      passes: true,
      fixes: [
        {
          kind: 'fixable',
          difficulty: 1,
          label: 'Trivial — hardening (not required)',
          tags: ['Config: drop 3 flags', 'Operational: harvest denylist hashes'],
          estimate: 'A few hours, only if hardening is desired',
        },
      ],
      notes: `
        <p><strong>AIVA passes this level — but partially by accident.</strong> AIVA's <code>browserArgs.ts</code> includes <code>--disable-gpu</code>, <code>--disable-webgl</code>, and <code>--disable-features=Vulkan,webgpu</code>, which make the WebGL renderer query return nothing. Bot Arena reports an empty renderer as <code>INFO</code> rather than <code>FAIL</code>, so AIVA slips past. Canvas, audio, and font fingerprints come from a real Linux Chrome on a real machine and look like any other desktop user.</p>
        <p class="mt-2"><strong>Latent risk:</strong> if Bot Arena's canvas/audio denylists in <code>src/detections/level4.ts</code> were populated with hashes harvested from AIVA's Chrome (which is the operational follow-up flagged in the implementation plan), this level would fail for AIVA too. Long-term, AIVA should consider whether <code>--disable-gpu</code>/<code>--disable-webgl</code> are still needed — they're a tell to fingerprint-aware sites because most real Chromes do have GPU.</p>
      `,
    },
  },
  {
    n: 5,
    section: 'Bot detection',
    title: 'Cloudflare Turnstile',
    family: 'Real third-party challenge',
    testCode: sharedTest(5, '/bot-detection/level-5/'),
    failureMessage: sharedFailure,
    signals: [
      { status: 'fail', id: 'turnstile', detail: 'no token — widget did not solve. Cloudflare refused to issue a token for the automated browser; server-side siteverify never called.' },
    ],
    layman: {
      problem:
        'Cloudflare Turnstile is the modern, invisible replacement for "click all the bicycle pictures" CAPTCHAs. When a page asks for it, Turnstile silently runs all the kinds of checks the previous four levels illustrate — plus an additional stack of private signals only Cloudflare knows about — and decides whether the visitor looks human enough to be issued a one-time "yes, this is a human" token. For automated browsers it simply refuses to issue the token. The server-side login check then sees no token and rejects the submission before it ever reaches the application code.',
      workaround:
        'A real Chrome session with a real fingerprint, real interaction history, and real mouse movement looks like any other paying customer to Turnstile. The token gets issued silently, exactly the same way it would for someone working from a coffee-shop laptop.',
    },
    playwright: {
      kind: 'impossible',
      label: 'Impossible without 3rd-party solver',
      notes: `
        <p><strong>Verdict: functionally impossible to bypass from inside Playwright. The only working "fix" is to outsource the problem.</strong></p>
        <p class="mt-2">Turnstile's logic is intentionally closed-source. It runs every kind of signal the previous four levels illustrate, plus a stack of private checks Cloudflare keeps to itself, plus IP reputation, plus behavioural analysis trained on the firehose of real human traffic across the Cloudflare network. Even a Playwright author who perfectly fixed levels 1-4, ran from a residential IP, and hand-rolled humanized interactions would still be classified as automated with high confidence — Cloudflare's behavioural model is too good.</p>
        <p class="mt-2">The "solution" used in the wild is paid CAPTCHA-solver services (2Captcha, anti-captcha, CapMonster, etc.). They route the challenge through real-browser farms — either real humans or sophisticated stealth setups — and return a valid token in a few seconds, for a few cents each. Wire one of those into your test:</p>
        <pre class="mt-2 overflow-x-auto rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">const token = await solver.solveTurnstile({
  sitekey: '0x4AAAAAADOBZMoei4aG9CNO',
  url: 'https://bot-arena.jhero.app/bot-detection/level-5/',
});
await page.evaluate((t) =&gt; {
  document.querySelector('input[name="cf-turnstile-response"]').value = t;
}, token);</pre>
        <p class="mt-2">This works — but it has defeated the original purpose of using Playwright. You have paid a third-party service to act as the human in front of the human-detector. Your "automated" tests now have a per-run cost and a human-in-the-loop dependency. This is exactly the kind of corner that VNC-AIVA, by being a real browser session at the OS level, avoids without any third-party dependency.</p>
      `,
    },
    aiva: {
      passes: false,
      fixes: [
        {
          kind: 'fixable',
          difficulty: 4,
          label: 'Hard — partially externally-bound',
          tags: ['Blocked on L1', 'Blocked on L2', 'Residential IP infrastructure'],
          estimate: 'Inherits L1 + infra work; Cloudflare ML remains uncertain',
        },
      ],
      notes: `
        <p><strong>AIVA currently fails this level as a cascading consequence of L1 and L2.</strong> Cloudflare Turnstile silently runs many of the same signals — <code>navigator.webdriver</code>, browser-chrome dimensions, fingerprint plausibility — plus its own private checks, plus IP reputation. Two contributing causes inside AIVA's control:</p>
        <ol class="mt-2 list-decimal space-y-2 pl-5">
          <li>
            <strong>Signal leakage from L1 and L2.</strong> Fixing the Puppeteer/CDP attachment, dropping <code>--incognito</code>/<code>--disable-extensions</code>, and dropping <code>--kiosk</code>/<code>--start-fullscreen</code> would all reduce Turnstile's confidence that the visitor is automated. Closing L1 + L2 likely moves Turnstile from "refuse / interactive challenge" to "silent pass" for many sites.
          </li>
          <li>
            <strong>IP reputation.</strong> If AIVA runs on a datacenter or cloud-region IP, Turnstile downgrades by default. Running through a residential proxy or from end-user infrastructure improves the score meaningfully — and is independent of any AIVA code change.
          </li>
        </ol>
        <p class="mt-2"><em>Turnstile's logic is partially closed-source, so even a perfectly-configured AIVA may occasionally fail. This level is the only one where success isn't fully under AIVA's control.</em></p>
      `,
    },
  },
  {
    n: 6,
    section: 'Selector resistance',
    title: 'Canvas-rendered login',
    family: 'No DOM to query — pixels only',
    testCode: sharedTest(1, '/selector-resistance/level-1/'),
    failureMessage: selectorFailure,
    signals: [
      { status: 'info', id: 'no-dom', detail: 'Only one DOM element exists in the form region: a <canvas>. No <input>, no <button>, no <label>.' },
      { status: 'fail', id: 'getByLabel-email', detail: "page.getByLabel('Email') — locator resolved to <no element matched>" },
      { status: 'fail', id: 'getByLabel-password', detail: "page.getByLabel('Password') — locator resolved to <no element matched>" },
      { status: 'fail', id: 'getByRole-button', detail: "page.getByRole('button', { name: 'Sign in' }) — locator resolved to <no element matched>" },
    ],
    layman: {
      problem:
        'A small but growing class of web apps draws their entire user interface inside a single <code>&lt;canvas&gt;</code> element — Figma, Google Sheets, Photoshop Web, web games. The browser sees one big rectangular pixel buffer; everything inside it (text, buttons, input boxes) is just paint. There is no DOM tree to walk, no element to grab, no label to query. A selector-based automation tool literally has nothing to interact with.',
      workaround:
        'An image-aware automation tool — like the classic AIVA — does not look at the DOM at all. It looks at the rendered pixels, recognises the visible "Email" text and the box right under it, and clicks at those coordinates. It then types using OS-level keystrokes, which the canvas receives as ordinary keyboard events. The DOM\'s absence is irrelevant; the pixels are the contract.',
    },
    playwright: {
      kind: 'impossible',
      label: 'Impossible without external vision',
      notes: `
        <p><strong>Verdict: impossible with selector-based Playwright. The DOM is empty of anything to query.</strong></p>
        <p class="mt-2">Playwright's locator APIs all resolve to nothing here:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li><code>page.getByLabel('Email')</code> — no <code>&lt;label&gt;</code> element exists.</li>
          <li><code>page.getByRole('textbox')</code> — no <code>&lt;input&gt;</code> element exists.</li>
          <li><code>page.getByText('Sign in')</code> — the text "Sign in" is painted pixels, not a text node.</li>
        </ul>
        <p class="mt-2">The only theoretical path is to take a screenshot from Playwright, pass it to an external OCR / template-matching pipeline to find UI elements visually, then use <code>page.mouse.click(x, y)</code> at the resolved coordinates and <code>page.keyboard.type(...)</code> to fill them. At that point you have built a worse version of the classic AIVA — and you've moved the actual automation outside Playwright entirely.</p>
        <p class="mt-2">There is no Playwright-native way to interact with canvas-rendered UIs. This is a structural mismatch between the tool and the target, not an arms race over signals.</p>
      `,
    },
    aiva: {
      passes: true,
      notes: `
        <p><strong>AIVA passes this level natively.</strong> AIVA's automation model is image-based from the ground up: it screenshots the visible browser surface, identifies UI elements by what they look like, and dispatches OS-level mouse and keyboard events at the right coordinates. The DOM is incidental — AIVA never touched it on the way in, so it does not matter that there is no DOM to touch here.</p>
        <p class="mt-2">This level is the strongest single argument for pixel-based automation as a category. Selector-based tools are not just <em>blocked</em> here — they are <em>structurally unable</em> to attempt the task at all.</p>
      `,
    },
  },
  {
    n: 7,
    section: 'Selector resistance',
    title: 'Dynamic selectors',
    family: 'Real form, randomised identifiers',
    testCode: sharedTest(2, '/selector-resistance/level-2/'),
    failureMessage: selectorFailure,
    signals: [
      { status: 'info', id: 'form-rendered', detail: 'A real <form> with real <input> elements — but every id/name/class is randomised per request, and there are no <label> elements.' },
      { status: 'fail', id: 'getByLabel-email', detail: "page.getByLabel('Email') fails — no <label> element associates with the input." },
      { status: 'pass', id: 'getByRole-button', detail: "page.getByRole('button', { name: 'Sign in' }) works (button text is stable)." },
      { status: 'info', id: 'fallback-fragility', detail: 'Even structural fallbacks like input:nth-of-type(1) work this run, but break on the next form revision.' },
    ],
    layman: {
      problem:
        'Modern web apps frequently ship with build-time CSS-in-JS, which produces randomised class names. Some apps go further and randomise every attribute — <code>id</code>, <code>name</code>, <code>class</code>, <code>aria-label</code> — on every page request, and omit <code>&lt;label&gt;</code> elements altogether. A human still reads "Email" off the screen and types in the box below. A test that uses accessibility-based locators sees nothing it can grab — every locator it had hardcoded is now stale.',
      workaround:
        'AIVA reads "Email" from the screen pixels and clicks the input it visually identifies as a text box just below the label text. It does not look at attributes; it looks at the rendered shape of the page. Randomising the DOM has no effect on it — the visual layout is what matters.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 4,
      label: 'Brittle workarounds, no stable selector',
      notes: `
        <p><strong>Verdict: possible with brittle fallback selectors, but the entire promise of accessibility-based testing is gone.</strong></p>
        <p class="mt-2">Playwright's normal idioms break:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li><code>page.getByLabel('Email')</code> — no <code>&lt;label&gt;</code> element exists, so this returns nothing.</li>
          <li><code>page.getByRole('textbox', { name: 'Email' })</code> — no accessible name, so this returns nothing.</li>
          <li><code>page.getByPlaceholder('Email')</code> — no <code>placeholder</code>, so this returns nothing.</li>
        </ul>
        <p class="mt-2">Possible fallbacks, in increasing brittleness:</p>
        <ol class="mt-2 list-decimal space-y-1 pl-5">
          <li><code>page.locator('input[type="email"]')</code> — works this run; breaks if the input type is also randomised, or another email input is added.</li>
          <li><code>page.locator('input').nth(0)</code> — works this run; breaks the moment the form reorders or grows.</li>
          <li><code>page.locator('div:has-text("Email") + input')</code> — works for this layout; breaks if the DOM structure is rewritten.</li>
        </ol>
        <p class="mt-2">For a truly hostile site, every fallback is one revision away from breaking. The maintenance burden grows linearly with the number of forms; the test suite becomes the single largest source of flakiness in the project.</p>
      `,
    },
    aiva: {
      passes: true,
      notes: `
        <p><strong>AIVA passes this level natively.</strong> AIVA does not look at attributes. It looks at the visible rendering: a label that says "Email", an input box beneath it, a similar pair for "Password", a dark button labelled "Sign in". Randomising the DOM attributes changes nothing about that visual layout — the OCR and template matching find the same targets in the same places.</p>
        <p class="mt-2">As a category, "selector resistance" is invisible to AIVA by construction. Every visual automation tool — AIVA, image-based RPA platforms, agentic vision models — sits in this same advantage zone.</p>
      `,
    },
  },
  {
    n: 8,
    section: 'Selector resistance',
    title: 'Closed Shadow DOM',
    family: 'Sealed web component',
    testCode: sharedTest(3, '/selector-resistance/level-3/'),
    failureMessage: selectorFailure,
    signals: [
      { status: 'info', id: 'sealed-mounted', detail: '<sealed-login> custom element with attachShadow({ mode: "closed" })' },
      { status: 'fail', id: 'getByLabel-email', detail: "page.getByLabel('Email') — locator cannot pierce a closed shadow root." },
      { status: 'fail', id: 'shadow-piercer', detail: "page.locator('sealed-login >>> input') — the >>> combinator works only on OPEN shadow roots." },
      { status: 'fail', id: 'getByText-granted', detail: 'page.getByText("Access granted") fails too — the success message also lives inside the sealed shadow.' },
    ],
    layman: {
      problem:
        'Many modern web apps build their UI as Web Components — small, self-contained widgets where the internal structure is intentionally hidden from outside code. A "closed shadow root" is the strongest form of this: even your own JavaScript running on the same page cannot read or write what is inside. This is a deliberate privacy and encapsulation boundary used by component libraries, design systems, and many enterprise SaaS frontends. To a test, the component is a black box: the element exists, but the inputs, the button, and even the success message are unreachable.',
      workaround:
        'A vision-based automation tool screenshots the rendered page and finds the input visually. The DOM privacy boundary is irrelevant — the rendered pixels are public. AIVA reads "Email", finds the box beneath it, clicks, types — exactly like a human looking at the screen. Closed shadow roots make automation harder only for tools that look at the DOM; they make it no harder for tools that look at the screen.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 3,
      label: 'Init-script monkey-patch of attachShadow',
      notes: `
        <p><strong>Verdict: solvable in Playwright via a documented workaround, but with timing-sensitive caveats — and most real enterprise apps avoid closed shadow anyway.</strong></p>
        <p class="mt-2">The Playwright maintainers' own suggestion (<a href="https://github.com/microsoft/playwright/issues/23047" class="text-sky-700 underline hover:text-sky-900">issue #23047</a>) is to monkey-patch <code>Element.prototype.attachShadow</code> in an <code>addInitScript</code> hook so every subsequent <code>attachShadow({mode:'closed'})</code> call actually returns an open root:</p>
        <pre class="mt-2 overflow-x-auto rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">await context.addInitScript(() =&gt; {
  const orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (options) {
    return orig.call(this, { ...options, mode: 'open' });
  };
});</pre>
        <p class="mt-2">Playwright's normal piercing locators then work as if the app had opted into open shadow.</p>
        <p class="mt-2">The caveats are real:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>The init script must land <em>before</em> the framework caches a reference to <code>Element.prototype.attachShadow</code>. Some polyfills and bundlers grab the reference at module-load time and defeat the patch.</li>
          <li>App code that re-attaches a root via a stashed reference bypasses the patch.</li>
          <li>A CDP fallback (<code>DOM.querySelector</code> with <code>pierce: true</code>) exists for inspection but Playwright does not surface it in <code>Locator</code>; you would drop to <code>context.newCDPSession</code> for read-only access.</li>
        </ul>
        <p class="mt-2"><strong>Real enterprise apps overwhelmingly avoid closed shadow.</strong> Salesforce LWC uses synthetic shadow (a polyfill, fully queryable) by default; native mode uses <code>mode: 'open'</code>. SAP UI5 Web Components and ServiceNow Now Experience both use open shadow. Closed-mode shadow is largely a worst-case demo construction; in production, the real friction with web-component-heavy frontends is deep shadow nesting and framework-specific selector conventions, not the shadow seal itself.</p>
      `,
    },
    aiva: {
      passes: true,
      notes: `
        <p><strong>AIVA passes this level natively.</strong> AIVA reads the rendered page through screenshots and OCR; it has no concept of DOM accessibility at all. The shadow boundary is invisible to it because the pixels on the screen do not know they are coming from a sealed component. The form is filled, submitted, and "Access granted" is visible — same as any other login page.</p>
        <p class="mt-2">As a category, web-component-heavy frontends (Salesforce Lightning, ServiceNow, SAP UI5, and most enterprise design systems) put selector-based testing in a permanent disadvantage. Vision-based tools are unaffected.</p>
      `,
    },
  },
  {
    n: 9,
    section: 'Selector resistance',
    title: 'Iframe-embedded form',
    family: 'Form in a child browsing context',
    testCode: sharedTest(4, '/selector-resistance/level-4/'),
    failureMessage: selectorFailure,
    signals: [
      { status: 'info', id: 'iframe-mounted', detail: 'The form is in an <iframe srcdoc="..."> with its own document.' },
      { status: 'fail', id: 'getByLabel-email', detail: "page.getByLabel('Email') — runs on the main frame only; the form is in a child frame so the locator never resolves." },
      { status: 'fail', id: 'getByText-granted', detail: 'page.getByText("Access granted") — same problem; the message lives in the child frame.' },
      { status: 'info', id: 'requires-frame-locator', detail: 'Test would have to be rewritten to use page.frameLocator("iframe").getByLabel(...) — every assertion + interaction explicitly frame-scoped.' },
    ],
    layman: {
      problem:
        'A huge fraction of production websites embed third-party widgets via iframes — Stripe payment forms, Auth0 login dialogs, Cloudflare challenges, embedded support chats, social login buttons. From the page\'s perspective the iframe is a single rectangle; the form inside it is in a separate document with its own DOM. Playwright\'s standard locators (the ones every tutorial teaches) only search the main page, so they silently miss anything inside a frame. The test fails the same way as if the form did not exist.',
      workaround:
        'AIVA does not know or care whether a region of the screen comes from the main page or a child frame. The screenshot is one image; the form is one rectangle of pixels; the email box sits below the "Email" text. Vision-based automation traverses frame boundaries for free, because frames are a DOM concept that does not exist in the rendered image.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 3,
      label: 'Requires every test to be frame-aware',
      notes: `
        <p><strong>Verdict: solvable but every test that touches frame content has to be rewritten with explicit <code>frameLocator</code> calls.</strong></p>
        <p class="mt-2">The frame-aware version of this test would look like:</p>
        <pre class="mt-2 overflow-x-auto rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">const frame = page.frameLocator('iframe[title="login-frame"]');
await frame.getByLabel('Email').fill('user@example.com');
await frame.getByLabel('Password').fill('hunter2');
await frame.getByRole('button', { name: 'Sign in' }).click();
await expect(frame.getByText('Access granted')).toBeVisible();</pre>
        <p class="mt-2">For a single iframe this is annoying but tractable. In real applications the cost compounds: every Stripe payment field, every Auth0 step, every embedded widget is a separate frame. Some frames are cross-origin (Stripe Elements, for example), at which point Playwright cannot reach in at all — you would need a separate test running against the iframe URL directly, with no shared session.</p>
        <p class="mt-2">Net effect: frame-heavy SaaS produces brittle, fragmented test suites where one frame change cascades into many test rewrites.</p>
      `,
    },
    aiva: {
      passes: true,
      notes: `
        <p><strong>AIVA passes this level natively.</strong> AIVA's screenshot includes the iframe contents because the browser composites them into the page exactly like any other element. The image-recognition pipeline sees one form, finds the inputs visually, clicks and types. Frame boundaries do not exist at the pixel level.</p>
        <p class="mt-2">This is a major real-world advantage. Payment flows (Stripe, Adyen, Braintree), embedded auth (Auth0, Okta, WorkOS), and most "embedded SDK" patterns ship as iframes — usually cross-origin. Vision-based automation handles them by construction; selector-based testing handles them only after significant per-frame rewrites, and not at all when the frames are cross-origin.</p>
      `,
    },
  },
  {
    n: 10,
    section: 'Selector resistance',
    title: 'Slider verification',
    family: 'Drag-to-align CAPTCHA',
    testCode: sharedTest(5, '/selector-resistance/level-5/'),
    failureMessage: sharedFailure,
    signals: [
      { status: 'pass', id: 'inputs-fillable', detail: 'Email and Password are reachable via getByLabel — those parts work.' },
      { status: 'fail', id: 'slider-not-solved', detail: 'The slider knob was never dragged into the target zone — verified flag stays false on submit.' },
      { status: 'fail', id: 'access-granted-not-shown', detail: 'expect(getByText("Access granted")).toBeVisible() times out because the form refused submission with "Blocked — verification required".' },
    ],
    layman: {
      problem:
        'Slider CAPTCHAs are the dominant anti-bot pattern across the Chinese internet (GeeTest, NetEase, Tencent, Alibaba) and increasingly common in Western anti-bot stacks (Cloudflare interactive, AWS WAF, ticketing platforms). The user is shown a randomised image with a notched gap, and a draggable puzzle piece somewhere else. To pass, drag the piece into the gap. The position of the gap is part of an image — there is no DOM hint for where it is. A test can drag, but only a tool that can SEE the gap knows where to drag to.',
      workaround:
        'A vision-based automation tool screenshots the slider, finds the highlighted target zone in the image, computes its X coordinate, and dispatches an OS-level mouse drag to that exact position. The drag is real — the browser receives a real sequence of mousemove events from a real cursor. The slider sees a human-shaped gesture and unlocks the form.',
    },
    playwright: {
      kind: 'impossible',
      label: 'Impossible without external vision',
      notes: `
        <p><strong>Verdict: impossible from inside Playwright. Playwright can drag (mouse.down/move/up at coordinates) but it cannot SEE the target zone.</strong></p>
        <p class="mt-2">The only paths a Playwright author has:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Take a screenshot via Playwright, pass the image to an external OCR / template-matching service, extract the target X coordinate, dispatch <code>page.mouse.down/move/up</code>. At that point you have built half of AIVA inside your test runner.</li>
          <li>Use a paid CAPTCHA-solving service (similar to the Turnstile case). The service routes the challenge through real browsers, returns the solved token. Per-run cost + third-party dependency.</li>
        </ul>
        <p class="mt-2">For real production slider CAPTCHAs (GeeTest, Alibaba, AWS WAF), the gap position is also rotated, scaled, and obfuscated with noise — generic OCR fails. Vendor-specific solver services are the only working option, and they cost ~$1-3 per 1000 solves.</p>
      `,
    },
    aiva: {
      passes: false,
      fixes: [
        {
          kind: 'fixable',
          difficulty: 3,
          label: 'Moderate — add drag-and-drop primitive to AIVA',
          tags: ['New interaction primitive', 'Code change'],
          estimate: 'Days of work',
        },
      ],
      notes: `
        <p><strong>AIVA currently fails this level because it does not yet have a drag-and-drop interaction primitive.</strong> Vision recognition of the target zone is already covered by the existing screenshot pipeline; what is missing is the ability to dispatch a sustained mouse-down → mousemove sequence → mouse-up gesture as a single action.</p>
        <p class="mt-2">Adding the primitive is a moderate-sized piece of work — it touches the input-dispatch layer of the VNC control plane and needs a small UX vocabulary for "drag from X to Y at speed Z" in the recorder. Once it lands, every slider CAPTCHA (GeeTest, Alibaba, AWS WAF, Turnstile interactive) and every other drag-shaped interaction (sortable lists, signature pads, file pickers with drag-in) becomes accessible at the same time.</p>
      `,
    },
  },
  {
    n: 11,
    section: 'Selector resistance',
    title: 'Image-only labels',
    family: 'No DOM text — labels are pixels',
    testCode: sharedTest(6, '/selector-resistance/level-6/'),
    failureMessage: selectorFailure,
    signals: [
      { status: 'info', id: 'inputs-present', detail: 'Real <input> elements exist in the DOM, but they have no <label>, no aria-label, no placeholder, no title.' },
      { status: 'fail', id: 'getByLabel-email', detail: "page.getByLabel('Email') — no <label> element associates with anything." },
      { status: 'fail', id: 'getByText-email', detail: 'page.getByText("Email") — the text "Email" is inside an <img> as SVG, not as a text node.' },
      { status: 'fail', id: 'getByRole-textbox', detail: 'page.getByRole("textbox", { name: "Email" }) — no accessible name on the input.' },
    ],
    layman: {
      problem:
        'Some sites — historically many banks, brokerages, anti-scrape news sites, and some CAPTCHA prompts — render every visible label as an image, deliberately to defeat scrapers and automated tools. From a human standpoint the form looks perfectly normal: "Email" written above an empty field, "Password" written above another, "Sign in" on the button. From a test\'s standpoint there is no text anywhere — every "label" is a graphic with empty alt text. Accessibility-based selectors find nothing.',
      workaround:
        'Vision-based automation reads the rendered image with OCR exactly the way a human reads it. It sees "Email" written above a text-input-shaped rectangle and clicks. The fact that the text is an image rather than a DOM text node is invisible to OCR — they\'re both pixels.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 4,
      label: 'No semantic anchors; only brittle structural selectors',
      notes: `
        <p><strong>Verdict: only brittle structural fallbacks remain. The promise of accessibility-driven testing is gone here.</strong></p>
        <p class="mt-2">Every label is an SVG/PNG image with empty alt. Playwright's accessibility-based locators return empty:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li><code>page.getByLabel('Email')</code> — no <code>&lt;label&gt;</code> element exists.</li>
          <li><code>page.getByRole('textbox', { name: 'Email' })</code> — no accessible name on the input.</li>
          <li><code>page.getByPlaceholder('Email')</code> — no placeholder.</li>
          <li><code>page.getByText('Email')</code> — text is in image pixels, not a DOM text node.</li>
        </ul>
        <p class="mt-2">Possible fallbacks:</p>
        <ol class="mt-2 list-decimal space-y-1 pl-5">
          <li><code>page.locator('input').nth(0)</code> — works this layout; breaks on the slightest reorder.</li>
          <li>Click at hard-coded pixel coordinates via <code>page.mouse.click(x, y)</code> — exactly the kind of brittle, screen-resolution-dependent code that motivates moving away from selector tests in the first place.</li>
          <li>Integrate an OCR library, OCR the screenshot, find the label position, derive coordinates — at which point your test suite has reimplemented visual automation badly.</li>
        </ol>
        <p class="mt-2">In real production deployments (bank login keypads with shuffled-position digit images), each session also changes the layout — so even nth-child fallbacks decay across runs.</p>
      `,
    },
    aiva: {
      passes: true,
      notes: `
        <p><strong>AIVA passes this level natively.</strong> AIVA's primary input is the rendered screenshot, processed through OCR for text recognition. "Email" is the same to it whether it came from a DOM text node, an inline SVG, a PNG, or pixel-by-pixel canvas painting. The label-and-input-below visual pattern is recognised the same way regardless of how the page was built.</p>
        <p class="mt-2">As a category, image-rendered text is everywhere in legacy financial and government software (and increasingly in anti-scraping CAPTCHAs that render even their prompt text as images). For DOM-based testing it is structurally impossible to do reliably. For vision-based automation it is no different from any other login page.</p>
      `,
    },
  },
  {
    n: 12,
    section: 'Selector resistance',
    title: 'Cross-origin iframe',
    family: 'Form on a different origin',
    testCode: sharedTest(7, '/selector-resistance/level-7/'),
    failureMessage: selectorFailure,
    signals: [
      { status: 'info', id: 'iframe-cross-origin', detail: 'iframe src is a data: URI with an opaque origin — cross-origin to the parent page.' },
      { status: 'fail', id: 'getByLabel-email', detail: "page.getByLabel('Email') — main-frame-scoped, finds nothing." },
      { status: 'fail', id: 'frameLocator-blocked', detail: 'page.frameLocator("iframe").getByLabel("Email") — Playwright refuses to script into a cross-origin frame; browser same-origin policy.' },
      { status: 'fail', id: 'getByText-granted', detail: 'expect(getByText("Access granted")).toBeVisible() — the message lives inside the cross-origin frame and is invisible to the parent.' },
    ],
    layman: {
      problem:
        'When a form is embedded in an iframe — like a Stripe payment field — the canonical Playwright pattern <code>page.getByLabel(\'Email\').fill(...)</code> fails because it is scoped to the main frame, and the form is in a child frame. Same-origin policy prevents <em>scripts running in the host page</em> from reaching the widget\'s internals — but Playwright is not such a script. It operates outside the page\'s JS sandbox and has a dedicated <code>frameLocator</code> API for descending into iframes (including cross-origin ones). The arena\'s demo amplifies the trap by using a <code>data:</code> URI, which has an opaque origin that defeats URL-based frame matching; selector-based <code>frameLocator(\'iframe\')</code> still works in principle.',
      workaround:
        'AIVA does not look at the DOM. Its input is the composited screenshot, where the browser draws cross-origin content into the same image as everything else. The Stripe card field, the iframe contents — all visible as pixels. AIVA sees the "Email" label and clicks the input below it, with no special-case code for frames.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 3,
      label: 'frameLocator + stable inner selectors',
      notes: `
        <p><strong>Verdict: solvable in Playwright via <code>frameLocator</code>. Same-origin policy restricts scripts running on the parent page, not the automation driver itself.</strong></p>
        <p class="mt-2">Playwright talks to the browser via its own protocol (CDP+ in Chromium), and Chromium reassigns the tracked session to an out-of-process iframe when one is detected. So <code>page.frameLocator(...)</code>, <code>page.frame(...)</code>, and <code>locator.contentFrame()</code> all work across origins. Stripe ships official Playwright testing patterns for filling card fields inside their iframe:</p>
        <pre class="mt-2 overflow-x-auto rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">await page
  .frameLocator('iframe[name^="__privateStripeFrame"]')
  .locator('[data-elements-stable-field-name="cardNumber"]')
  .fill('4242424242424242');</pre>
        <p class="mt-2">The friction is real but not categorical:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Test authors must know which iframe holds the target field (selectors like <code>iframe[name="*"]</code> or positional indices).</li>
          <li>Stable inner selectors are vendor-supplied — Stripe gives <code>data-elements-stable-field-name</code>; not every widget does.</li>
          <li>The arena's <code>data:</code> URI variant is harder than typical cross-origin iframes because the opaque origin defeats URL-based frame matching, but selector-based matching still works.</li>
          <li>Network-response interception across out-of-process iframes has known limitations (see <a href="https://github.com/microsoft/playwright/issues/20809" class="text-sky-700 underline hover:text-sky-900">#20809</a>) — relevant if the test needs to inspect the iframe's traffic.</li>
        </ul>
        <p class="mt-2"><strong>The real-world examples need correction.</strong> Auth0 Universal Login is not embedded as an iframe in production — Auth0 sets <code>X-Frame-Options: deny</code>, so the login flow is a top-level navigation to <code>*.auth0.com</code> that Playwright fills directly. Cloudflare Turnstile <em>is</em> a cross-origin iframe, but the friction is fingerprinting + behavioural scoring + server-side token verification, not the iframe boundary — that belongs in Bot Detection level 5. Stripe Elements is the one genuine cross-origin iframe case from the original list, and Playwright handles it routinely.</p>
      `,
    },
    aiva: {
      passes: false,
      fixes: [
        {
          kind: 'fixable',
          difficulty: 1,
          label: 'Trivial — enable cross-origin iframes in AIVA launch config',
          tags: ['Browser config', 'No code change'],
          estimate: 'Minutes',
        },
      ],
      notes: `
        <p><strong>AIVA currently fails this level — but only because its embedded Chrome blocks cross-origin iframes via its launch configuration.</strong> Once cross-origin iframes are allowed in the browser config, the iframe renders normally and AIVA reads the form pixels just like any other page region. The architectural advantage is intact; only a launch-time flag stands in the way.</p>
        <p class="mt-2">After the flag flips, this is a major real-world advantage. Payment forms, hosted auth dialogs, CAPTCHA challenges, embedded SDKs — all of which use cross-origin iframes by industry convention — render normally for AIVA. Selector-based testing handles them only via fragile vendor-specific workarounds, or not at all.</p>
      `,
    },
  },
  {
    n: 13,
    section: 'Selector resistance',
    title: 'Virtual scrolling',
    family: 'Windowed list — off-screen items are absent from DOM',
    testCode: sharedTest(8, '/selector-resistance/level-8/'),
    failureMessage: selectorFailure,
    signals: [
      { status: 'info', id: 'list-virtualised', detail: '1,000 logical accounts; only ~10 visible rows are mounted in the DOM at any moment.' },
      { status: 'fail', id: 'getByLabel-email', detail: "page.getByLabel('Email') — no Email field exists on this page; the email is selected by clicking a row." },
      { status: 'fail', id: 'getByText-target', detail: 'page.getByText("user-371@example.com") — the row for user-371 is not currently mounted; locator returns empty.' },
      { status: 'info', id: 'scroll-required', detail: 'A working test would have to detect virtualisation, compute the row\'s scroll position, scrollTop into view, then click. Requires bespoke per-list logic.' },
    ],
    layman: {
      problem:
        'Performant lists in modern web apps only render the rows currently inside the visible viewport — a technique called virtual scrolling or windowing. Used by Slack\'s message history, Notion\'s database views, Gmail\'s thread list, every data-grid library (AG Grid, MUI X, TanStack Virtual). When a test wants to click an item that is 500 rows down, the row simply does not exist in the DOM until the list has been scrolled past it. Standard test idioms ("find the row, click it") return nothing.',
      workaround:
        'A vision-based automation tool already has a scroll-and-recognise loop built into its pipeline. It scrolls the visible viewport, takes a new screenshot, looks for the target visually, scrolls again, and repeats until the target appears. This is exactly what a human does. AIVA does not need to know that the list is virtualised — it does what humans do.',
    },
    playwright: {
      kind: 'fixable',
      difficulty: 4,
      label: 'Requires bespoke per-list scroll logic',
      notes: `
        <p><strong>Verdict: solvable with significant per-list bespoke code; the standard test idioms do not work.</strong></p>
        <p class="mt-2">For each virtualised list a test interacts with, the test author has to:</p>
        <ol class="mt-2 list-decimal space-y-1 pl-5">
          <li>Know that the list is virtualised (it might not be obvious from the rendered HTML).</li>
          <li>Know the total number of rows and the row height to compute where to scroll.</li>
          <li>Dispatch a programmatic scroll on the list container, wait for the new rows to mount, query, repeat.</li>
          <li>Alternatively, scroll incrementally and probe for the target row after each step.</li>
        </ol>
        <p class="mt-2">All of this is custom code that lives inside the test suite. Different virtualisation libraries (react-window, TanStack Virtual, AG Grid) expose different APIs — there is no portable solution. And many sites virtualise BOTH rows AND columns, multiplying the complexity.</p>
        <p class="mt-2">For real apps with very long lists (Gmail, Slack, AG Grid dashboards), the per-test cost compounds: every test that needs to click a non-visible item has its own scroll helper, its own retry logic, its own flake mode.</p>
      `,
    },
    aiva: {
      passes: true,
      notes: `
        <p><strong>AIVA passes this level natively.</strong> Visual automation systems are built around a perception loop: screenshot, look, decide what to do, act, screenshot again. Scrolling a virtualised list is exactly the same as scrolling any other long list — AIVA scrolls a screen, looks for the target, scrolls again if needed. Whether the rows are virtualised, all-DOM, or paginated does not matter — they are all just visible rows on screen at the moment of the screenshot.</p>
        <p class="mt-2">As a category, every data-heavy SaaS app (Slack, Notion, Linear, Salesforce, ServiceNow, every CRM and ERP) uses virtualisation. Selector-based testing builds an ever-growing pile of per-list scrollers; vision-based automation does not.</p>
      `,
    },
  },
];
