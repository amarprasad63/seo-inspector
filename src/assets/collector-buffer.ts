/** Minimal shape shared between the live Performance API and unit tests. */
export interface PerformanceResourceTimingLike {
  name: string;
  entryType?: string;
  startTime: number;
  duration: number;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  responseStatus?: number;
}

export class ResourceTimingBuffer {
  private readonly items = new Map<string, PerformanceResourceTimingLike>();
  private readonly maxEntries: number;

  constructor(maxEntries = 800) {
    this.maxEntries = maxEntries;
  }

  add(entry: PerformanceResourceTimingLike): void {
    const key = `${entry.name}\u0000${entry.startTime}\u0000${entry.duration}\u0000${entry.initiatorType}`;
    if (this.items.has(key)) return;
    if (this.items.size >= this.maxEntries) {
      const first = this.items.keys().next().value;
      if (typeof first === 'string') this.items.delete(first);
    }
    this.items.set(key, entry);
  }

  snapshot(): PerformanceResourceTimingLike[] {
    return [...this.items.values()];
  }

  clear(): void {
    this.items.clear();
  }
}
