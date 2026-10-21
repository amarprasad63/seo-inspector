const RING_ID = 'seo-inspector-highlight';

export function isInspectorNode(node: Node | null): boolean {
  return node instanceof Element && (node.id === RING_ID || node.closest(`#${RING_ID}`) != null);
}

export function highlightElement(doc: Document, element: Element): void {
  const previous = doc.getElementById(RING_ID);
  previous?.remove();
  element.scrollIntoView({ block: 'center', inline: 'nearest' });
  const rect = element.getBoundingClientRect();
  const ring = doc.createElement('div');
  ring.id = RING_ID;
  ring.style.position = 'fixed';
  ring.style.left = `${Math.max(0, rect.left - 2)}px`;
  ring.style.top = `${Math.max(0, rect.top - 2)}px`;
  ring.style.width = `${Math.max(rect.width, 8)}px`;
  ring.style.height = `${Math.max(rect.height, 8)}px`;
  ring.style.border = '2px solid #1a73e8';
  ring.style.borderRadius = '4px';
  ring.style.pointerEvents = 'none';
  ring.style.zIndex = '2147483646';
  ring.style.boxSizing = 'border-box';
  doc.documentElement.append(ring);
}