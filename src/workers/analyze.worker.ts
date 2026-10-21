import { analyzePage } from '../validation/engine';
import type { PageExtraction } from '../shared/types';
import type { Analysis } from '../validation/engine';

interface WorkerRequest {
  id: number;
  extraction: PageExtraction;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: Analysis;
  error?: string;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const response: WorkerResponse = { id: event.data.id, ok: false };
  try {
    response.ok = true;
    response.result = analyzePage(event.data.extraction);
  } catch (error) {
    response.error = error instanceof Error ? error.message : 'Analysis failed.';
  }
  scope.postMessage(response);
};
