export interface NodeLike {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly parentElement: NodeLike | null;
  getAttribute?(name: string): string | null;
  querySelectorAll?(selector: string): ArrayLike<NodeLike>;
}

export interface MutationLike {
  readonly type: string;
  readonly attributeName: string | null;
  readonly target: NodeLike;
  readonly addedNodes: ArrayLike<NodeLike>;
  readonly removedNodes: ArrayLike<NodeLike>;
}

export function isJsonLdScriptElement(node: NodeLike | null | undefined): boolean {
  if (!node || node.nodeType !== 1) return false;
  if (node.nodeName.toUpperCase() !== 'SCRIPT') return false;
  const type = node.getAttribute?.('type');
  if (!type) return false;
  const mime = type.split(';')[0]?.trim().toLowerCase();
  return mime === 'application/ld+json';
}

export function shouldHandleMutation(record: MutationLike): boolean {
  if (record.type === 'characterData') {
    return isJsonLdScriptElement(record.target.parentElement);
  }
  if (record.type === 'attributes') {
    if (record.target.nodeName.toUpperCase() !== 'SCRIPT') return false;
    if (record.attributeName === 'type') return true;
    if (record.attributeName === 'id') return isJsonLdScriptElement(record.target);
    return false;
  }
  if (record.type === 'childList') {
    return includesJsonLd(record.addedNodes) || includesJsonLd(record.removedNodes);
  }
  return false;
}

function includesJsonLd(nodes: ArrayLike<NodeLike>): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    if (nodeMayContainJsonLd(nodes[index])) return true;
  }
  return false;
}

function nodeMayContainJsonLd(node: NodeLike | undefined): boolean {
  if (!node) return false;
  if (node.nodeType === 3) return isJsonLdScriptElement(node.parentElement);
  if (isJsonLdScriptElement(node)) return true;
  if (typeof node.querySelectorAll !== 'function') return false;
  const scripts = node.querySelectorAll('script');
  for (let index = 0; index < scripts.length; index += 1) {
    if (isJsonLdScriptElement(scripts[index])) return true;
  }
  return false;
}
