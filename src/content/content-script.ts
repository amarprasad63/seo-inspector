import { collectJsonLd } from './extract';
import { createDebounced } from './debounce';
import { highlightElement, isInspectorNode } from './highlight';
import { pageSignature } from './signature';
import { LIMITS } from '../shared/limits';
import { PROTOCOL_VERSION, SOURCE, isExtractRequest, isHighlightRequest } from '../shared/protocol';

const INSTALLED = '__jsonLdSchemaInspectorInstalled';

function install(): void {
  const host = globalThis as typeof globalThis & { [INSTALLED]?: boolean };
  if (host[INSTALLED]) return;
  host[INSTALLED] = true;
  if (!document.documentElement) return;

  const elements = new Map<string, Element>();
  let lastSignature = '';

  const read = () => {
    elements.clear();
    return collectJsonLd(document, LIMITS, (id, element) => {
      elements.set(id, element);
    });
  };

  const publish = (): void => {
    const payload = read();
    const signature = pageSignature(payload);
    if (signature === lastSignature) return;
    lastSignature = signature;
    void chrome.runtime
      .sendMessage({ source: SOURCE, version: PROTOCOL_VERSION, type: 'extraction', payload })
      .catch(() => undefined);
  };

  const debounced = createDebounced(publish, LIMITS.mutationDebounceMs);
  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (isInspectorNode(mutation.target)) return false;
      if (mutation.type === 'childList') {
        const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
        if (nodes.length > 0 && nodes.every((node) => isInspectorNode(node))) return false;
      }
      return true;
    });
    if (relevant) debounced.trigger();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['content', 'href', 'rel', 'alt', 'src', 'name', 'property', 'http-equiv', 'lang', 'charset', 'type', 'id', 'hidden', 'aria-hidden'],
  });

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (isHighlightRequest(message)) {
      const element = elements.get(message.highlightId);
      if (!element || !element.isConnected) {
        sendResponse({ ok: false, error: 'That element is no longer on the page. Refresh and try again.' });
        return;
      }
      highlightElement(document, element);
      sendResponse({ ok: true });
      return;
    }
    if (!isExtractRequest(message)) return;
    const payload = read();
    lastSignature = pageSignature(payload);
    sendResponse({ source: SOURCE, version: PROTOCOL_VERSION, type: 'extraction', payload });
  });

  window.addEventListener(
    'pagehide',
    () => {
      debounced.cancel();
      observer.disconnect();
      document.getElementById('seo-inspector-highlight')?.remove();
    },
    { once: true },
  );

  publish();
}

install();
