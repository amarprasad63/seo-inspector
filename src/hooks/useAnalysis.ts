import { useEffect, useMemo, useState } from 'react';
import { LIMITS } from '../shared/limits';
import type { PageExtraction } from '../shared/types';
import { analyzePage, type Analysis } from '../validation/engine';

export function useAnalysis(extraction: PageExtraction | null): {
  analysis: Analysis | null;
  analyzing: boolean;
  failure: string | null;
} {
  const totalChars = extraction?.scripts.reduce((sum, script) => sum + script.raw.length, 0) ?? 0;
  const useWorker = extraction !== null && totalChars >= LIMITS.workerThresholdChars;

  const sync = useMemo(() => {
    if (!extraction || useWorker) return null;
    try {
      return { analysis: analyzePage(extraction), failure: null as string | null };
    } catch (error) {
      return {
        analysis: null,
        failure: error instanceof Error ? error.message : 'Analysis failed.',
      };
    }
  }, [extraction, useWorker]);

  const [workerAnalysis, setWorkerAnalysis] = useState<Analysis | null>(null);
  const [workerFailure, setWorkerFailure] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!extraction || !useWorker) return undefined;
    setAnalyzing(true);
    setWorkerFailure(null);
    let worker: Worker | null = null;
    let cancelled = false;
    try {
      worker = new Worker(new URL('../workers/analyze.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      try {
        if (!cancelled) {
          setWorkerAnalysis(analyzePage(extraction));
          setWorkerFailure(null);
        }
      } catch (fallbackError) {
        if (!cancelled) {
          setWorkerAnalysis(null);
          setWorkerFailure(fallbackError instanceof Error ? fallbackError.message : 'Analysis failed.');
        }
      }
      setAnalyzing(false);
      return undefined;
    }

    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: Analysis; error?: string }>) => {
      if (cancelled || event.data.id !== 1) return;
      if (event.data.ok && event.data.result) {
        setWorkerAnalysis(event.data.result);
        setWorkerFailure(null);
      } else {
        setWorkerAnalysis(null);
        setWorkerFailure(event.data.error ?? 'Analysis failed.');
      }
      setAnalyzing(false);
    };
    worker.onerror = () => {
      if (cancelled) return;
      try {
        setWorkerAnalysis(analyzePage(extraction));
        setWorkerFailure(null);
      } catch (error) {
        setWorkerAnalysis(null);
        setWorkerFailure(error instanceof Error ? error.message : 'Analysis failed.');
      }
      setAnalyzing(false);
    };
    worker.postMessage({ id: 1, extraction });

    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, [extraction, useWorker]);

  if (!useWorker) {
    return {
      analysis: sync?.analysis ?? null,
      analyzing: false,
      failure: sync?.failure ?? null,
    };
  }

  return { analysis: workerAnalysis, analyzing, failure: workerFailure };
}
