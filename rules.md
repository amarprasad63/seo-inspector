# SEO Inspector — Rules & thresholds

**Audience:** SEO, Product, and Business  
**Purpose:** Explain what the extension checks, how the score works, when Assets & Performance raises warnings, and what the tool does *not* claim.

---

## Who this is for

| Team | How to use this page |
| --- | --- |
| **SEO** | Understand findings, severities, and when a score moves — without treating the number as a Google ranking score |
| **Product** | See what is in scope, what is heuristic, and what the extension refuses to guess |
| **Business** | Know what “good” looks like in the tool, and what promises we should not make to customers or stakeholders |

Everything below runs **locally in the browser**. Nothing is uploaded. There is no Google API, ranking API, or account.

---

## What users see

The extension audits the **current page** and groups results into sections such as Overview, Metadata, Keywords, Headings, Social, Links, Images, **Assets & Performance**, Indexability, Structured data, Technical SEO, Content, and Recommendations.

Each finding has a severity:

| Label | Plain meaning | Does it change a score? |
| --- | --- | --- |
| **Error** | Something basic is missing or broken (for example no page title, or structured data that does not parse) | Yes (−10 on the matching score) |
| **Warning** | Likely problem or important gap | Yes (−3 on the matching score) |
| **Info** | Context, suggestion, or display guidance | No |
| **Passed** | The check ran and looked fine | Counted separately; no penalty |
| **Could not evaluate** | The tool did not have enough evidence | Not passed and not failed |

---

## The SEO score (and what it is not)

### The headline number

The main number is an **on-page SEO score**. It starts at **100** and goes down when on-page SEO issues are found.

| Severity | Points removed (once per rule) |
| --- | ---: |
| Error | 10 |
| Warning | 3 |
| Info | 0 |

**Important behaviors:**

- The same issue on many elements still deducts **once**. Example: 50 images missing alt text → one accessibility deduction, with a count of how many images matched.
- Fixing a finding improves the diagnostic. It does **not** guarantee a ranking change in Google.
- If the tool could not run enough of its checks (coverage under **70%**), the score is marked **provisional**.

### Four separate scores

| Score | What it reflects | Moves the headline SEO number? |
| --- | --- | --- |
| **On-page SEO** | Title, description, indexability signals, many technical gaps, broken structured-data markup | Yes — this *is* the headline |
| **Accessibility** | Missing H1, missing alt, unnamed links, unlabeled controls, iframe titles | No |
| **Social metadata** | Open Graph / Twitter (X) sharing tags | No |
| **Structured data** | Schema / rich-result *eligibility* gaps | No |

**Exception to keep in mind:** if JSON-LD on the page is **invalid** (does not parse), that still hurts the **on-page SEO** score, because the markup on the page is broken. Gaps in rich-result *eligibility* stay on the structured-data score only.

### When two findings are really one issue

Only one penalty is taken when findings describe the same underlying problem — for example several canonical problems on the same tags, or a robots tag that both says `noindex` and contradicts itself.

### What the score never means

- It is **not** a Google ranking score.
- It is **not** proof that a URL is indexed or will be indexed.
- It is **not** a Core Web Vitals or WCAG certification.
- Raising the number does **not** guarantee more traffic.

---

## On-page audit rules (by topic)

Below: what triggers a finding, in product language. Length limits on titles and descriptions are **display guidance**, not ranking requirements.

### Metadata

| Situation | Severity | Score impact |
| --- | --- | --- |
| No page title | Error | On-page SEO |
| Title present | Passed | — |
| Title length outside ~15–60 characters | Info | None |
| More than one title tag | Warning | On-page SEO |
| No meta description | Warning | On-page SEO |
| Empty meta description | Warning | On-page SEO |
| Description length outside ~50–160 characters | Info | None |
| Multiple description tags | Warning | On-page SEO |
| Meta keywords tag present | Info | None (legacy) |
| Duplicate titles across other pages | Could not evaluate | Other pages are not crawled |

### Keywords (only if the user enters targets)

These are **optional guidance** when someone types a primary keyword (and optional secondary / brand).

| Situation | Severity |
| --- | --- |
| Primary keyword missing from title | Info |
| Primary keyword missing from H1 | Info |
| Primary keyword missing from body content | Info |
| Exact phrase looks heavily repeated | Info |
| Title and H1 look poorly aligned | Info |

Keyword frequency is descriptive. It is **not** a density target.

### Headings

| Situation | Severity | Score impact |
| --- | --- | --- |
| No H1 | Warning | Accessibility |
| Exactly one H1 | Passed | — |
| Multiple H1s | Info | None |
| Empty heading | Warning | On-page / a11y |
| Very long heading | Info | None |
| Hidden heading | Info | None |
| Heading level jump (for example H2 → H4) | Info | None |
| Repeated heading text | Info | None |
| Too many headings to list | Info | Remainder not marked as passed |

### Social sharing (Open Graph / Twitter)

| Situation | Severity | Score impact |
| --- | --- | --- |
| Important `og:` tags missing (title, description, type, url, image, …) | Warning | Social only |
| Empty or conflicting social tags | Warning | Social only |
| Relative or malformed social URLs | Warning | Social only |
| `og:url` differs from canonical | Info | None |
| Twitter tags missing (may fall back to Open Graph) | Info | None |
| Unknown Twitter card type / missing card image when needed | Warning | Social only |

Missing social tags are a **sharing** gap. Google Search does not require them for ranking.

### Links

| Situation | Severity | Score impact |
| --- | --- | --- |
| Link has no accessible name (no text, no image alt) | Warning | Accessibility |
| Empty or malformed destination | Warning | On-page SEO |
| Generic text (“click here”, “read more”, …) | Info | None |
| In-page `#fragment` with no matching element | Warning | On-page SEO |
| Opens in new tab without `noopener` / `noreferrer` | Info | None |
| Uses nofollow / sponsored / ugc | Info | Described, not treated as an error |
| Broken links | Could not evaluate | Destinations are not requested |

### Images (SEO / accessibility section)

This is the **Images** audit. File **weight** and load time live under [Assets & Performance](#assets--performance).

| Situation | Severity | Score impact |
| --- | --- | --- |
| Visible image missing `alt` | Warning | Accessibility |
| Empty `alt` (decorative) | Info | None — not treated as an error |
| Very long or generic alt (“image”, filename, …) | Info | None |
| No width/height attributes | Info | None |
| Image failed to load | Warning | On-page SEO |
| Lazy-loaded image that appears above the fold | Info | None |
| Image stretched far beyond its real pixel size | Info | None |
| Image file size in bytes | Could not evaluate in this section | See Assets & Performance |

### Indexability

| Situation | Severity | Score impact |
| --- | --- | --- |
| `noindex` (or similar) in robots meta | Warning | On-page SEO — directive on the page; not proof of index status |
| Conflicting robots directives | Warning | On-page SEO |
| `nofollow` in robots meta | Info | None |
| Missing canonical | Info | None |
| Multiple / empty / invalid canonicals | Warning | On-page SEO |
| Canonical URL differs from the current URL | Info | Often intentional |
| Meta refresh | Warning | On-page SEO |
| Invalid or conflicting hreflang | Warning | On-page SEO |
| hreflang return links on other URLs | Could not evaluate | Other pages not fetched |
| Tracking parameters in the URL | Info | None |
| Page served over HTTP | Info | None |
| robots.txt, `X-Robots-Tag`, redirects, “is it indexed?” | Could not evaluate | Not available from the page alone |

### Technical & accessibility

| Situation | Severity | Score impact |
| --- | --- | --- |
| Missing or invalid page language | Warning | Accessibility |
| Missing or empty viewport | Warning | On-page SEO |
| No main landmark / multiple mains | Info / Warning | Accessibility when multiple |
| Duplicate element ids | Warning | On-page SEO |
| HTTP assets on an HTTPS page | Warning | On-page SEO |
| Unlabeled form controls, nameless buttons, untitled iframes | Warning | Accessibility |
| Broken ARIA references | Warning | Accessibility |
| Tables without headers | Info | None |
| Core Web Vitals | Could not evaluate | Not measured here |
| Full WCAG conformance | Could not evaluate | Not a WCAG audit |

### Content

| Situation | Severity |
| --- | --- |
| Very little visible text | Info |
| Analyzed text was truncated because the page is very long | Info |
| Repeated paragraphs | Info |
| No paragraphs found | Info |
| Content quality, expertise, originality, search intent | Could not evaluate — intentionally out of scope |

### Structured data (JSON-LD)

| Area | What it means | Typical severity | Score |
| --- | --- | --- | --- |
| Syntax / structure broken | Script empty, not valid JSON, truncated, or broken graph | Error / Warning | On-page SEO |
| Schema.org notes | Unknown types/properties in our local subset | Info | Structured data |
| Rich-result eligibility | Gaps for types such as JobPosting, Product, Article, FAQ, and similar | Warning / Info | Structured data |
| Soft recommendations | For example relative URLs on image/logo | Info | Structured data |

Quiet rich-result checks do **not** mean the page is eligible in Google. The official Rich Results Test is linked from the UI but **not** called automatically.

---

## Assets & Performance

This section inventories resources the page loads (images, JavaScript, CSS, fonts, video, XHR/fetch, and other) and flags heavy or risky patterns.

**It does not change the on-page SEO score.**  
Thresholds are **starting heuristics** for discussion — not industry-wide performance standards.

### How size is judged

1. Prefer **bytes transferred** when the browser exposes them.
2. Otherwise use **compressed body size** when available.
3. If size is hidden (common for third-party files) → shown as **Unavailable**, not as “0 KB”.

A URL found only in the HTML is **not** treated as successfully downloaded until the browser reports a network timing entry.

XHR / Fetch / Other resources show size when possible but do **not** use the size thresholds below yet.

### When size raises a warning or critical flag

| Asset type | Warning above | Critical above |
| --- | ---: | ---: |
| Images | 200 KB | 500 KB |
| JavaScript | 100 KB | 300 KB |
| CSS | 50 KB | 150 KB |
| Fonts | 100 KB | 200 KB |
| Videos | 2 MB | 5 MB |

### When load time raises a flag

| Level | Load duration |
| --- | --- |
| Warning | Slower than **1 second** |
| Critical | Slower than **3 seconds** |

### When the page has “too many” resources

| Level | Inventoried assets |
| --- | ---: |
| Warning | 100 or more |
| Critical | 200 or more |

### Other asset findings (by theme)

**Images**

| Situation | Level | Notes |
| --- | --- | --- |
| Natural pixel size much larger than what is shown on screen (≥ 2×) | Warning | Oversized download for the display size |
| Missing width or height attributes | Info | Can contribute to layout shift |
| Below the fold without lazy loading | Info | Suggestion only |
| Above the fold with lazy loading | Info | Usually not recommended for hero / LCP images |
| Older formats (JPG, PNG, …) vs WebP/AVIF | Info | Suggestion, not a hard requirement |
| Hosted on a third-party domain | Info | — |

**JavaScript**

| Situation | Level | Notes |
| --- | --- | --- |
| Large file (see size table) | Warning / Critical | — |
| Slow to load (see duration table) | Warning / Critical | — |
| In the page head without async/defer/module | Warning | Treated as potentially render-blocking based on how it is included — not by file extension alone |
| Third-party script | Info | — |

**CSS**

| Situation | Level | Notes |
| --- | --- | --- |
| Large or slow stylesheet | Warning / Critical | — |
| Enabled, not print-only | Warning | Potentially render-blocking |

**Fonts**

| Situation | Level | Notes |
| --- | --- | --- |
| Large font file | Warning / Critical | — |
| Third-party font host | Info | — |
| Several related font variants for the same family | Info | Confirm older formats are still needed |

**General**

| Situation | Level | Notes |
| --- | --- | --- |
| Listed in HTML but not seen in network timing | Info | May still be loading, blocked, unused, or outside the timing buffer |
| Size unavailable (often cross-origin) | Info | Not the same as a zero-byte file |
| Large third-party resource | Warning / Critical | Uses the JavaScript size thresholds as a shared “large third party” bar |

### What Assets & Performance will never claim

- That JavaScript or CSS is **unused** (usage is not measured)
- That a file is render-blocking **only** because of its extension
- That every image should be lazy-loaded (above-the-fold / likely LCP images are treated carefully)
- That converting formats is mandatory
- That “Unavailable” size means the file is empty

---

## What “good” looks like

| Area | A healthy page typically… |
| --- | --- |
| Metadata | Has one clear title and a useful meta description |
| Headings | Has a single clear H1 and a sensible outline |
| Images (SEO) | Gives meaningful alt text where content matters; decorative images use empty alt |
| Indexability | Does not accidentally `noindex` pages that should be searchable |
| Social | Has Open Graph tags if social sharing matters for the product |
| Structured data | Parses cleanly if present; rich-result gaps are reviewed, not assumed fatal |
| Assets | Keeps heavy files under the heuristic thresholds, or has a clear reason they are large |
| Score | Is used as a **checklist**, not a KPI for rankings |

---

## FAQ

**Q: Is a higher score better SEO in Google?**  
A: Not as a guarantee. The score is an internal diagnostic of on-page signals the extension can see. Google rankings use many signals we do not measure.

**Q: Why didn’t missing alt text tank the headline SEO score?**  
A: Missing alt is scored under **Accessibility**. It still shows as a warning in the report; it does not move the on-page SEO number.

**Q: Why is social missing tags a warning but not an SEO penalty?**  
A: Sharing tags help previews on social platforms. They are not treated here as a Google Search requirement.

**Q: The Assets section says size is Unavailable. Is that a zero-byte file?**  
A: No. The browser often hides byte sizes for cross-origin files unless the other site allows timing disclosure. We refuse to invent a size.

**Q: Can we tell customers “fix these and you’ll rank”?**  
A: No. Preferred wording: the extension highlights on-page and performance *risks* and *gaps* visible on the current page. Ranking impact depends on search engines and competition.

**Q: Does the tool crawl the whole site?**  
A: No. One page at a time. No sitewide duplicate detection, no robots.txt fetch, no redirect-chain analysis.

**Q: Are Assets thresholds final product standards?**  
A: No. They are configurable starting heuristics for flagging heavy assets. Product and SEO can raise or lower them later with clear communication.

---

## Limits worth knowing

To stay fast and private, inventories are capped (for example hundreds of images/links, a character limit on analyzed text, hundreds of assets). Items beyond the cap are **not** marked as passed — the report says they were omitted.
