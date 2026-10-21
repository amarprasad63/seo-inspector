import type { PageSnapshot } from '../shared/types';
import { finding, passed, unavailable } from './finding';
import type { RuleOutcome } from './types';

const LANG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

export function evaluateTechnical(snapshot: PageSnapshot): RuleOutcome {
  const findings = [];
  const passedChecks = [];
  if (!snapshot.htmlLang) {
    findings.push(
      finding({
        ruleId: 'technical.lang-missing',
        name: 'Missing language',
        category: 'accessibility',
        severity: 'warning',
        kind: 'accessibility',
        message: 'The html element has no lang attribute.',
        why: 'A declared language helps browsers and assistive technology. It is not proof of international targeting.',
        evidence: 'html lang is empty.',
        remediation: 'Set lang to the language of the page, such as en or hi.',
        highlightId: null,
        selectorHint: 'html',
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang',
      }),
    );
  } else if (!LANG.test(snapshot.htmlLang)) {
    findings.push(
      finding({
        ruleId: 'technical.lang-invalid',
        name: 'Invalid language',
        category: 'accessibility',
        severity: 'warning',
        kind: 'accessibility',
        message: `html lang is "${snapshot.htmlLang}", which does not look like a language code.`,
        why: 'Assistive technology uses the language tag to choose pronunciation.',
        evidence: snapshot.htmlLang,
        remediation: 'Use a BCP 47 tag such as en or en-IN.',
        highlightId: null,
        selectorHint: 'html',
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang',
      }),
    );
  } else {
    passedChecks.push(passed({ ruleId: 'technical.lang', name: 'Language', category: 'accessibility', summary: snapshot.htmlLang }));
  }

  const charsetMeta = snapshot.metas.some((meta) => meta.kind === 'charset' || (meta.kind === 'http-equiv' && meta.key === 'content-type'));
  if (!charsetMeta) {
    findings.push(
      finding({
        ruleId: 'technical.charset',
        name: 'Character encoding',
        category: 'technical',
        severity: 'info',
        kind: 'technical',
        message: `No charset meta tag was found. The document encoding reported by the browser is ${snapshot.charset || 'unknown'}. The HTTP header was not read.`,
        why: 'Encoding can come from the server. A missing meta tag is not the same as mojibake.',
        evidence: snapshot.charset || 'unknown',
        remediation: 'Declare UTF-8 in the document or in the response header.',
        highlightId: null,
        selectorHint: 'meta[charset]',
      }),
    );
  } else {
    passedChecks.push(passed({ ruleId: 'technical.charset-present', name: 'Encoding', category: 'technical', summary: snapshot.charset || 'declared' }));
  }

  const viewport = snapshot.metas.find((meta) => meta.kind === 'name' && meta.key === 'viewport');
  if (!viewport) {
    findings.push(
      finding({
        ruleId: 'technical.viewport',
        name: 'Missing viewport',
        category: 'technical',
        severity: 'warning',
        kind: 'best-practice',
        message: 'No viewport meta tag was found.',
        why: 'Without a viewport, mobile browsers may lay the page out as a desktop page. This is not a Core Web Vitals measurement.',
        evidence: 'No meta[name=viewport].',
        remediation: 'Add a viewport tag such as width=device-width, initial-scale=1.',
        highlightId: null,
        selectorHint: 'meta[name=viewport]',
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag',
      }),
    );
  } else if (!viewport.content.trim()) {
    findings.push(
      finding({
        ruleId: 'technical.viewport-empty',
        name: 'Empty viewport',
        category: 'technical',
        severity: 'warning',
        kind: 'technical',
        message: 'The viewport meta tag is empty.',
        why: 'An empty viewport does not set the layout width.',
        evidence: '(empty)',
        remediation: 'Set the viewport content.',
        highlightId: null,
        selectorHint: 'meta[name=viewport]',
      }),
    );
  } else {
    passedChecks.push(passed({ ruleId: 'technical.viewport-present', name: 'Viewport', category: 'technical', summary: viewport.content }));
  }

  if (snapshot.landmarks.main === 0) {
    findings.push(
      finding({
        ruleId: 'technical.main-missing',
        name: 'No main landmark',
        category: 'accessibility',
        severity: 'info',
        kind: 'accessibility',
        message: 'No main element or role=main was found.',
        why: 'A main landmark helps keyboard and screen-reader users skip to content. Keyword analysis falls back to body text in that case.',
        evidence: 'main count 0',
        remediation: 'Wrap the primary content in main.',
        highlightId: null,
        selectorHint: 'main',
      }),
    );
  } else if (snapshot.landmarks.main > 1) {
    findings.push(
      finding({
        ruleId: 'technical.main-multiple',
        name: 'Multiple main landmarks',
        category: 'accessibility',
        severity: 'warning',
        kind: 'accessibility',
        message: `${snapshot.landmarks.main} main landmarks were found.`,
        why: 'More than one main makes the primary region ambiguous.',
        evidence: `main count ${snapshot.landmarks.main}`,
        remediation: 'Keep one main element.',
        highlightId: null,
        selectorHint: 'main',
      }),
    );
  } else {
    passedChecks.push(passed({ ruleId: 'technical.main', name: 'Main landmark', category: 'accessibility', summary: 'One main landmark.' }));
  }

  if (snapshot.counts.duplicateIds > 0) {
    findings.push(
      finding({
        ruleId: 'technical.duplicate-ids',
        name: 'Duplicate ids',
        category: 'technical',
        severity: 'warning',
        kind: 'technical',
        message: `${snapshot.counts.duplicateIds} id values are repeated in the collected sample.`,
        why: 'Duplicate ids break fragment links and labelled-by references.',
        evidence: snapshot.duplicateIdExamples.join(', ') || `${snapshot.counts.duplicateIds} duplicates`,
        remediation: 'Give each id a single element.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  if (snapshot.mixedContentUrls.length > 0) {
    findings.push(
      finding({
        ruleId: 'technical.mixed-content',
        name: 'HTTP resources on an HTTPS page',
        category: 'technical',
        severity: 'warning',
        kind: 'technical',
        message: `${snapshot.mixedContentUrls.length} collected resources use http:// on an https page.`,
        why: 'Browsers may block or warn on mixed content. The resources were not downloaded.',
        evidence: snapshot.mixedContentUrls.slice(0, 3).join(' | '),
        remediation: 'Load those resources over HTTPS.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  if (snapshot.counts.unlabeledControls > 0) {
    findings.push(
      finding({
        ruleId: 'technical.unlabeled-controls',
        name: 'Controls without labels',
        category: 'accessibility',
        severity: 'warning',
        kind: 'accessibility',
        message: `${snapshot.counts.unlabeledControls} form controls have no label, aria-label, or aria-labelledby.`,
        why: 'Unnamed fields are an accessibility problem. This is not a ranking check and it is not a WCAG conformance claim.',
        evidence: `${snapshot.counts.unlabeledControls} controls; ${snapshot.counts.forms} forms.`,
        remediation: 'Associate each control with a label.',
        highlightId: null,
        selectorHint: 'input',
      }),
    );
  }
  if (snapshot.counts.namelessButtons > 0) {
    findings.push(
      finding({
        ruleId: 'technical.nameless-buttons',
        name: 'Buttons without names',
        category: 'accessibility',
        severity: 'warning',
        kind: 'accessibility',
        message: `${snapshot.counts.namelessButtons} buttons have no text or accessible name.`,
        why: 'A button without a name cannot be understood out of visual context.',
        evidence: `${snapshot.counts.namelessButtons} buttons.`,
        remediation: 'Add visible text or an aria-label.',
        highlightId: null,
        selectorHint: 'button',
      }),
    );
  }
  if (snapshot.counts.untitledIframes > 0) {
    findings.push(
      finding({
        ruleId: 'technical.untitled-iframes',
        name: 'Iframes without titles',
        category: 'accessibility',
        severity: 'warning',
        kind: 'accessibility',
        message: `${snapshot.counts.untitledIframes} iframes have no title.`,
        why: 'A title tells people what the frame contains before they enter it.',
        evidence: `${snapshot.counts.untitledIframes} iframes.`,
        remediation: 'Add a title attribute that describes the frame.',
        highlightId: null,
        selectorHint: 'iframe',
      }),
    );
  }
  if (snapshot.counts.brokenAriaRefs > 0) {
    findings.push(
      finding({
        ruleId: 'technical.broken-aria',
        name: 'Broken ARIA reference',
        category: 'accessibility',
        severity: 'warning',
        kind: 'accessibility',
        message: `${snapshot.counts.brokenAriaRefs} elements reference an aria-labelledby or aria-describedby id that is not in the document.`,
        why: 'A missing id means the accessible name or description is incomplete.',
        evidence: `${snapshot.counts.brokenAriaRefs} references in the first 100 checked.`,
        remediation: 'Point the attribute at an id that exists.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  if (snapshot.counts.tablesWithoutHeader > 0) {
    findings.push(
      finding({
        ruleId: 'technical.tables',
        name: 'Tables without headers',
        category: 'accessibility',
        severity: 'info',
        kind: 'accessibility',
        message: `${snapshot.counts.tablesWithoutHeader} tables have no th cells.`,
        why: 'Data tables need headers. Layout tables are not distinguished here, so this is a hint, not a WCAG audit.',
        evidence: `${snapshot.counts.tables} tables.`,
        remediation: 'Use th for data tables.',
        highlightId: null,
        selectorHint: 'table',
      }),
    );
  }

  return {
    findings,
    passed: passedChecks,
    unavailable: [
      unavailable({
        ruleId: 'technical.web-vitals',
        name: 'Core Web Vitals',
        category: 'technical',
        reason: 'This audit does not measure Largest Contentful Paint, Interaction to Next Paint, or Cumulative Layout Shift.',
      }),
      unavailable({
        ruleId: 'technical.wcag',
        name: 'WCAG conformance',
        category: 'accessibility',
        reason: 'These checks are a partial DOM scan, not a WCAG conformance claim.',
      }),
    ],
  };
}
