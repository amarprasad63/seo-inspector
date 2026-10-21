# JSON-LD Schema Inspector

A Manifest V3 browser extension that inspects JSON-LD on the current page, lists typed entities, and runs local validation. Parsing and validation stay in the browser. The extension does not upload page data, call an API, or use an account.

It runs in Chrome and other Chromium browsers that support Manifest V3, the side panel, and ES module service workers. The manifest sets `minimum_chrome_version` to **116**. Firefox is not a target: its side-panel and extension APIs differ.

## Install and build

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm run build` typechecks, bundles the popup and side panel with Vite, bundles the content script and service worker with esbuild, and checks that `dist/manifest.json` points at files that exist.

Load the extension:

1. Open the browser's extensions page (`chrome://extensions`, `edge://extensions`, or the equivalent).
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `dist/` directory produced by `npm run build`.

Reload the extension after each production build. If a tab was already open, reload that tab once so the content script is attached.

## How to use it

1. Open an ordinary `http` or `https` page.
2. Click the toolbar icon for a compact popup, or use **Open side panel** for a wider tree.
3. **Refresh** reads the page again. The content script also watches for JSON-LD scripts added, removed, or edited, and pushes an update after a short debounce.
4. **Schemas** lists every object with `@type`, including nodes inside `@graph`, arrays, and nested properties such as `author` or `hiringOrganization`.
5. **Validation** lists syntax, JSON-LD structure, Schema.org subset, Google rich-result, and recommendation findings. Filter by severity or category.
6. **Raw JSON** shows each original script, including scripts that failed to parse.
7. **Export** downloads a JSON report with the page URL and title, extraction time, raw scripts, parsed JSON when parsing succeeded, entities, and findings.

Restricted pages (`chrome://`, `edge://`, `about:`, the Chrome Web Store, and similar) show an explanation instead of a stack trace. The extension reads only the top frame, not iframes or closed shadow roots.

## Permissions

| Permission | Why it is required |
| --- | --- |
| `host_permissions` for `http://*/*` and `https://*/*` | The content script must read `script[type="application/ld+json"]` on ordinary web pages, including pages opened before the extension was installed. It does not request access to `file:`, browser settings, or extension pages. |
| `scripting` | Re-injects the content script when a matching tab was open before installation or the script is missing. |
| `activeTab` | Complements the toolbar action when the user invokes the extension. |
| `tabs` | Reads the active tab URL and title so the popup and side panel can follow tab switches and explain restricted pages. |
| `sidePanel` | Opens the persistent inspector beside the page. |

The content script sends script text, element ids, the page URL, the document title, and an extraction timestamp. It does not send the rest of the page HTML.

## Privacy

- No telemetry, analytics, or remote upload.
- No backend, database, or API key.
- No execution of scripts found in the page.
- JSON-LD is shown as text through React. It is not turned into HTML.
- The popup and side panel load their own packaged files. A network log may show `chrome-extension://` requests for those files. Page JSON-LD is not part of those requests.
- A script longer than 2,000,000 characters is truncated. The UI and the export say so, and they include the original length plus the retained prefix. Shorter scripts are kept in full, even when the JSON is invalid.

Limits live in `src/shared/limits.ts`.

## Validation methodology

Findings are local diagnostics. They are grouped so a syntax error is not presented as a Google ranking failure:

| Category | What it means |
| --- | --- |
| JSON syntax | The script is empty, truncated, not valid JSON, or a primitive root such as `null` or a string. |
| JSON-LD structure | Missing or unfamiliar `@context`, a broken `@graph` or `@list`, a root node with no `@type`, or duplicate `@id` values. An unfamiliar context is informational. Valid JSON-LD that this tool does not recognize is not marked invalid for that reason alone. |
| Schema.org | A **subset** of Schema.org types and properties shipped with the extension. Unknown types and unknown properties are informational. This is not complete Schema.org conformance. |
| Google rich results | Versioned checks for JobPosting, Product snippets, Article / NewsArticle / BlogPosting, BreadcrumbList, Event, Recipe, VideoObject, Organization logo, LocalBusiness (and included subtypes such as Restaurant and Dentist), and FAQPage. Required gaps are errors. Recommended gaps are warnings. FAQ eligibility and Top stories policy are informational. |
| SEO recommendation | Notes such as relative URLs on `image` or `logo`. These are not errors. |

Google rules were last checked against Google Search Central documentation on **2026-10-01**. Google changes rich-result requirements. Each Google finding links to the documentation used for that feature.

The extension does **not** claim that a page is eligible for a rich result when these checks are quiet. Use the [Google Rich Results Test](https://search.google.com/test/rich-results) for Google's own result. That tool is only linked. It is not called from the extension.

Missing recommended properties are warnings or notes, not errors. Rules run only for the schema types they name. A `WebPage` is not checked as a `JobPosting`.

## What the content script watches

It collects every main-frame `script` whose MIME type is `application/ld+json`, including a charset parameter. For each script it records the index, element id, raw text, parse status, and parse error when there is one. Large scripts are not parsed on the page thread; the extension page parses them, in a worker when the total text is large, so the site and the panel stay responsive.

Mutation observation is debounced. Unrelated DOM edits do not re-send data. Identical script text is not sent again.

## Project layout

```text
src/
  background/service-worker.ts
  content/content-script.ts
  parser/
  validation/
  components/
  hooks/
  workers/analyze.worker.ts
  App.tsx
public/manifest.json
popup.html
sidepanel.html
```

Popup and side panel render the same `App` with a `mode` prop.

## Tests

Vitest covers parsing, `@graph`, nested entities, multiple `@type` values, invalid JSON, empty scripts, duplicate ids, Google rules, search, export of broken raw JSON, truncation, mutation filtering, and safe rendering of untrusted strings.

```bash
npm test
npm run lint
```

## Manual check after loading `dist/`

- A page with no JSON-LD shows zero scripts and an empty Schemas state.
- A page with two JSON-LD scripts lists both, including one that is invalid JSON, and export still contains that raw text.
- Expanding a nested object in Schemas shows and hides children.
- Search narrows entities and findings.
- The side panel opens from the popup and shows the same page.
- A `chrome://` tab explains that the page cannot be inspected.
- The browser network panel shows no requests from the extension to an analytics or API host while you inspect a page.
