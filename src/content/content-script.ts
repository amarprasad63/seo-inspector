import { collectJsonLd } from './extract';
import { createDebounced } from './debounce';
import { shouldHandleMutation, type MutationLike } from './dom-filter';
import { scriptSignature } from './signature';
import { LIMITS } from '../shared/limits';
import { PROTOCOL_VERSION, SOURCE, isExtractRequest } from '../shared/protocol';

const INSTALLED = '__jsonLdSchemaInspectorInstalled';

function install(): void {
  const host = globalThis as typeof globalThis & { [INSTALLED]?: boolean };
  if (host[INSTALLED]) return;
  host[INSTALLED] = true;
  if (!document.documentElement) return;

  let lastSignature = '';

  const publish = (): void => {
    const payload = collectJsonLd(document);
    const signature = scriptSignature(payload.scripts);
    if (signature === lastSignature) return;
    lastSignature = signature;
    void chrome.runtime
      .sendMessage({ source: SOURCE, version: PROTOCOL_VERSION, type: 'extraction', payload })
      .catch(() => undefined);
  };

  const debounced = createDebounced(publish, LIMITS.mutationDebounceMs);
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => shouldHandleMutation(mutation as unknown as MutationLike))) debounced.trigger();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['type', 'id'],
  });

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isExtractRequest(message)) return;
    const payload = collectJsonLd(document);
    lastSignature = scriptSignature(payload.scripts);
    sendResponse({ source: SOURCE, version: PROTOCOL_VERSION, type: 'extraction', payload });
  });

  window.addEventListener(
    'pagehide',
    () => {
      debounced.cancel();
      observer.disconnect();
    },
    { once: true },
  );

  publish();
}

install();
