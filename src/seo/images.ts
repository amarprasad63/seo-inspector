import type { ImageEntry, PageSnapshot } from '../shared/types';
import { finding } from './finding';
import type { RuleOutcome } from './types';

const GENERIC_ALT = /^(image|photo|picture|img|icon|banner|graphic|spacer|untitled)$/i;

export function evaluateImages(snapshot: PageSnapshot): RuleOutcome {
  const findings = [];
  let missing = 0;
  let empty = 0;
  for (const image of snapshot.images) {
    if (image.hidden) continue;
    if (!image.altPresent) {
      missing += 1;
      findings.push(imageFinding(image, 'images.missing-alt', 'Missing alt attribute', 'warning', 'accessibility', 'This image has no alt attribute.', 'If the image conveys information, add alternative text. An omitted alt attribute is different from an empty one.', 'Add alt text, or alt="" when the image is decorative.'));
    } else if (!image.alt?.trim()) {
      empty += 1;
      findings.push(imageFinding(image, 'images.empty-alt', 'Empty alt text', 'info', 'accessibility', 'This image has empty alt text, which marks it as decorative.', 'Empty alt is correct for decorative images. It is not reported as an error.', 'Leave it empty only when the image adds no information.'));
    } else {
      const alt = image.alt.trim();
      if (alt.length > 180) {
        findings.push(imageFinding(image, 'images.alt-long', 'Long alt text', 'info', 'optional', `Alt text is ${alt.length} characters.`, 'Very long alt text is hard to listen to. There is no universal character limit.', 'Describe the image briefly. Put longer detail in the page text.', alt));
      }
      if (GENERIC_ALT.test(alt) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(alt)) {
        findings.push(imageFinding(image, 'images.alt-generic', 'Generic alt text', 'info', 'accessibility', 'Alt text looks like a filename or a generic label.', 'Generic alt text rarely describes the image.', 'Replace it with a short description, or use empty alt if the image is decorative.', alt));
      }
    }
    if (!image.widthAttr && !image.heightAttr) {
      findings.push(imageFinding(image, 'images.dimensions', 'Missing width and height', 'info', 'best-practice', 'This image has no width or height attribute.', 'Reserved space reduces layout jump. It is not a ranking requirement, and byte size was not measured.', 'Set width and height to the image’s intrinsic pixel size when you know it.'));
    }
    if (image.failed) {
      findings.push(imageFinding(image, 'images.failed', 'Image failed to load', 'warning', 'technical', 'The browser finished loading this image and reported no intrinsic width.', 'A failed image is missing for visitors. This is not a guess about file size.', 'Open the image URL and replace it if the file does not load.', image.src || '(no src)'));
    }
    if (image.loading?.toLowerCase() === 'lazy' && image.aboveFold === true) {
      findings.push(imageFinding(image, 'images.lazy-above-fold', 'Lazy image in the first screen', 'info', 'optional', 'This image uses loading=lazy and was in the first viewport when the page was read.', 'Lazy-loading the first visible image can delay it. Viewport detection can be wrong in unusual layouts.', image.src));
    } else if (image.loading?.toLowerCase() === 'lazy' && image.aboveFold == null) {
      findings.push(imageFinding(image, 'images.lazy-position-unknown', 'Lazy image position unknown', 'info', 'optional', 'loading=lazy is set, but the viewport position could not be measured.', 'This check does not guess whether the image is above the fold.', image.src));
    }
    if (image.naturalWidth > 0 && image.renderedWidth > image.naturalWidth * 2 && image.renderedWidth > 0) {
      findings.push(imageFinding(image, 'images.scaled-up', 'Image displayed larger than its pixels', 'info', 'optional', 'The rendered width is more than twice the intrinsic width. Byte size was not measured, so this does not say the file is large.', 'Scaling a small image up makes it look soft.', `Rendered ${image.renderedWidth}px; intrinsic ${image.naturalWidth}px.`));
    }
  }
  if (snapshot.caps.imagesOmitted > 0) {
    findings.push(
      finding({
        ruleId: 'images.capped',
        name: 'Image list capped',
        category: 'images',
        severity: 'info',
        kind: 'technical',
        message: `${snapshot.caps.imagesOmitted} images were not inventoried.`,
        why: 'Omitted images were not marked as passing.',
        evidence: `Collected ${snapshot.images.length}.`,
        remediation: 'Use the page’s own image review for the rest, or raise maxImages.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  return {
    findings,
    passed: missing === 0 && snapshot.images.some((image) => !image.hidden)
      ? [{ ruleId: 'images.alt-present', name: 'Image alternatives', category: 'images', summary: `Every collected visible image has an alt attribute. ${empty} use empty alt and are treated as decorative, not as errors.` }]
      : [],
    unavailable: [
      { ruleId: 'images.bytes', name: 'Image file size', category: 'images', reason: 'Image files were not downloaded, so byte size is unknown.' },
    ],
  };
}

function imageFinding(
  image: ImageEntry,
  ruleId: string,
  name: string,
  severity: 'error' | 'warning' | 'info',
  kind: 'technical' | 'accessibility' | 'best-practice' | 'optional',
  message: string,
  why: string,
  remediation: string,
  evidence = image.src || image.selectorHint,
): ReturnType<typeof finding> {
  return finding({
    ruleId,
    name,
    category: 'images',
    severity,
    kind,
    message,
    why,
    evidence,
    remediation,
    highlightId: image.highlightId,
    selectorHint: image.selectorHint,
    docsUrl: 'https://developers.google.com/search/docs/appearance/google-images',
  });
}
