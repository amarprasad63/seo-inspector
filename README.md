# SEO Inspector

A Manifest V3 extension that audits the current page in the browser. It covers on-page metadata, keywords, headings, social tags, links, images, indexability signals, technical and accessibility hints, and JSON-LD structured data.

Nothing is uploaded. There is no SEO API, telemetry, or account. The score is an internal diagnostic, not a Google ranking score.

Chrome and other Chromium browsers with Manifest V3, the side panel, and ES module service workers are supported. `minimum_chrome_version` is **116**. Firefox is not a target.

## Install and build

```bash
npm install
npm run typecheck
npm test
npm run lint
npm run build
```

`npm run build` typechecks, bundles the popup and side panel with Vite, bundles the content script and service worker with esbuild, and checks that `dist/manifest.json` points at files that exist.

Load the extension:

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `dist/` directory.

Reload the extension after each production build. Reload an already-open tab once so the content script attaches.

## How to use it

1. Open an ordinary `http` or `https` page.
2. Click the toolbar icon. The popup shows one audit section at a time.
3. **Open side panel** for the full section list.
4. **Refresh** reads the page again. The content script also watches relevant DOM edits and pushes an update after a short debounce when the collected snapshot or JSON-LD actually changed.
5. Use the section list for Overview, Metadata, Keywords, Headings, Social, Links, Images, Indexability, Structured data, Technical SEO, Content analysis, and Recommendations.
6. **Highlight** scrolls to a heading, link, or image and draws an outline. It does not run page script.
7. **Export JSON** downloads the raw JSON-LD, parsed data, audit findings, score breakdown, and checks that could not be evaluated. **Export text** downloads a plain-language report.

Restricted pages (`chrome://`, `edge://`, `about:`, the Chrome Web Store, and similar) show an explanation. The extension reads the top frame only, not iframes or closed shadow roots.

## Permissions

| Permission | Why it is required |
| --- | --- |
| `host_permissions` for `http://*/*` and `https://*/*` | The content script must read the current page, including tabs opened before install. It does not request `file:`, browser settings, or extension pages. |
| `scripting` | Re-injects the content script when it is missing. |
| `activeTab` | Complements the toolbar action. |
| `tabs` | Reads the active tab URL and title, follows tab switches, and explains restricted pages. |
| `sidePanel` | Opens the persistent audit beside the page. |
| `storage` | Optionally remembers the primary keyword, secondary keywords, and brand on this device when **Remember on this device** is checked. Unchecking it deletes that saved value. |

The content script sends a bounded snapshot: URL, title, meta and link tags, headings, a capped image and anchor inventory, landmark and form counts, and visible text up to the configured character limit. It also sends JSON-LD script text. It does not send the full HTML document.

## Privacy

- No telemetry, analytics, remote upload, or API key.
- No request to Google Rich Results Test, robots.txt, link destinations, or image files during the audit.
- Keyword text stays in the extension. It is sent to `chrome.storage.local` only if you ask to remember it.
- Extracted text is rendered as text. Page HTML is not executed and is not assigned to `innerHTML`.
- A social preview image loads only after **Show preview image**.
- Highlighting uses a fixed outline element inserted by the content script. It does not evaluate a selector from the page.
- The popup and side panel load their own packaged files. A network log may show `chrome-extension://` requests for those files.

Limits live in `src/shared/limits.ts`. When a list or text extract is capped, the audit says so. Omitted items are not marked as passed.

## Audit methodology

Findings use four severities:

| Severity | Meaning |
| --- | --- |
| Error | The page is missing something basic, such as a document title, or JSON-LD is invalid. |
| Warning | A likely problem or an important gap, such as a missing description, `noindex`, or an image with no `alt` attribute. |
| Info | Context, a heuristic, or a display suggestion. Info does not change the score. |
| Passed | The check ran and did not fail. Passed checks are counted separately. |

A check that cannot be evaluated is listed under **Could not evaluate**. It is not passed and it is not failed. That includes robots.txt, `X-Robots-Tag`, redirect chains, response headers, image byte size, whether a link is broken, cross-page duplicate titles, hreflang return links, Core Web Vitals, and WCAG conformance.

### Score

The score starts at 100. Each rule id deducts once, using its strongest severity: error 10, warning 3, info 0. Fifty images missing `alt` are one warning deduction, and the finding list still shows the instances up to a per-rule cap. Disabled rules are excluded. The overview lists the deductions and lets you turn a rule off for the current session.

Improving the score does not guarantee a ranking change. The label in the product says this is not a Google ranking score.

### What is a requirement, a practice, or a heuristic

| Source | How this extension uses it |
| --- | --- |
| [Google title links](https://developers.google.com/search/docs/appearance/title-link) | A missing title is an error. Character length is display guidance (about 15–60), not a ranking rule. |
| [Google snippets](https://developers.google.com/search/docs/appearance/snippet) | A missing meta description is a warning because Google may write the snippet. Length is guidance (about 50–160), not a requirement. |
| [Robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) | `noindex` is reported as a directive. The extension does not know if the URL is indexed. |
| [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | A canonical that differs from the current URL is informational. It may be intentional. |
| [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions) | `hreflang` codes are checked in this document. Return links on other URLs are not fetched. |
| [Google Images](https://developers.google.com/search/docs/appearance/google-images) | Missing `alt` is a warning. Empty `alt` is decorative and is not an error. File size is unknown. |
| [Qualify outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) | `nofollow`, `sponsored`, and `ugc` are described and are not errors. |
| [Open Graph](https://ogp.me/) | Missing `og:title`, `og:description`, `og:type`, `og:url`, or `og:image` is a sharing warning, not a Google Search requirement. |
| Twitter/X cards | Missing `twitter:*` tags are informational. The preview falls back to Open Graph when those tags are empty. Platform support changes, so this is not a full card validator. |
| JSON-LD | See the validation table below. Schema.org coverage is a subset. Google rich-result checks were last reviewed **2026-10-01**. |

On-page rules in this extension were last reviewed **2026-10-21**.

Keyword frequency is occurrences divided by analyzed words. It is not a density target. Phrase matching lowercases text, treats punctuation as a space, and requires a word boundary. The analyzed text is either the `main` region, or the body minus navigation, footer, and aside when there is no `main`. Scripts, styles, hidden content, form controls, and SVG are excluded. This is not a perfect main-content detector. The included text is visible in Content analysis.

## JSON-LD validation

Structured data still uses the original parser and rule modules. Findings are also summarized in the audit.

| Category | What it means |
| --- | --- |
| JSON syntax | The script is empty, truncated, not valid JSON, or a primitive root. |
| JSON-LD structure | Missing or unfamiliar `@context`, a broken `@graph` or `@list`, a root node with no `@type`, or duplicate `@id` values. |
| Schema.org | A subset of types and properties shipped with the extension. Unknown types and properties are informational. This is not complete Schema.org conformance. |
| Google rich results | Local checks for JobPosting, Product snippets, Article, BreadcrumbList, Event, Recipe, VideoObject, Organization logo, LocalBusiness, and FAQPage. Quiet checks do not mean the page is eligible. |
| SEO recommendation | Notes such as relative URLs on `image` or `logo`. |

The [Google Rich Results Test](https://search.google.com/test/rich-results) is linked from the validation panel. It is not called.

## Architecture

```text
content script
  collect JSON-LD + page snapshot
  debounce mutations, publish only when the signature changes
        ↓ chrome.runtime message
popup / side panel
  JSON-LD analysis (worker when the scripts are large)
  SEO rules on the snapshot (pure functions, no network)
        ↓
sections, score, JSON export, text report
```

Extraction, rules, and React UI are separate. `src/seo/` does not render HTML. `src/validation/` is unchanged as the JSON-LD engine. `src/content/collect-page.ts` only collects evidence.

Popup and side panel render the same `App` with a `mode` prop.

## Add a rule

1. Add a pure function in the relevant `src/seo/` module that returns findings, passed checks, or an unavailable check.
2. Give it a stable `ruleId`, a severity, a kind (`technical`, `accessibility`, `best-practice`, or `optional`), evidence, and a remediation sentence that does not claim a ranking penalty.
3. Call it from `auditPage` in `src/seo/engine.ts`.
4. Add a unit test that builds a `PageSnapshot` with `tests/seo-fixture.ts` and does not need a browser.
5. If the rule depends on a new DOM field, add that field in `collect-page.ts` and cover it with `tests/seo-snapshot.test.ts`.

A new category needs a value on `AuditCategory`, a label, a section id if it should appear in the nav, and a branch in `AuditView`.

## Tests

```bash
npm test
npm run lint
```

Vitest covers JSON-LD parsing and validation, metadata, keywords, Open Graph and Twitter fallback, headings, images, links, indexability, score deduplication, export, snapshot extraction, truncation, and safe rendering.

## Known limitations

- One page only. No crawl, no site-wide duplicate detection, no robots.txt, no redirect chain, no response headers.
- Links are not fetched, so none are reported as broken. Images are not downloaded, so none are reported as large in bytes.
- `X-Robots-Tag` is unavailable. A `noindex` meta tag is a directive, not proof the URL is absent from the index.
- Hidden detection uses the `hidden` attribute, `aria-hidden`, inline style, and computed `display` / `visibility`. It can miss headings hidden only by a class animation.
- Viewport position for lazy images is unknown when layout boxes are empty.
- Core Web Vitals are not measured. Accessibility checks are not a WCAG audit.
- Content quality, expertise, originality, and search intent are not judged.
- Shadow DOM and iframes are not scanned.
- The social preview does not execute markup from the page. Image dimensions that are not in meta tags stay unknown.
- Keyword memory uses `chrome.storage.local` only after you opt in.

## Manual check after loading `dist/`

- A normal page shows a score, and the overview numbers match the findings.
- A page with `noindex` says indexing status is unknown.
- An image with no `alt` attribute is a warning. An image with `alt=""` is not an error.
- Structured data still lists invalid JSON-LD raw text in export.
- Highlight scrolls to a heading on the page.
- Remembering a keyword survives closing the popup, and clearing the checkbox removes it.
- A `chrome://` tab explains that the page cannot be inspected.
- The network panel shows no analytics or SEO API calls while you inspect a page.
