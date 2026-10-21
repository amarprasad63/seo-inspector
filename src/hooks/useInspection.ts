import { useCallback, useEffect, useState } from 'react';
import { pageAccess } from '../shared/json';
import { PROTOCOL_VERSION, SOURCE, isExtractionMessage } from '../shared/protocol';
import type { PageExtraction } from '../shared/types';

export type InspectionPhase = 'loading' | 'ready' | 'restricted' | 'error';

export interface InspectionState {
  phase: InspectionPhase;
  detail: string;
  tabUrl: string;
  tabTitle: string;
  extraction: PageExtraction | null;
  tabId: number | null;
  refresh: () => void;
  openSidePanel: () => Promise<void>;
}

async function sendExtract(tabId: number): Promise<PageExtraction> {
  const response: unknown = await chrome.tabs.sendMessage(tabId, {
    source: SOURCE,
    version: PROTOCOL_VERSION,
    type: 'extract',
  });
  if (!isExtractionMessage(response)) {
    throw new Error('The page returned an unexpected inspector response.');
  }
  return response.payload;
}

async function injectContentScript(tabId: number): Promise<void> {
  const response: unknown = await chrome.runtime.sendMessage({
    source: SOURCE,
    version: PROTOCOL_VERSION,
    type: 'inject',
    tabId,
  });
  if (typeof response === 'object' && response !== null && (response as { ok?: boolean }).ok === true) return;
  const error =
    typeof response === 'object' && response !== null && 'error' in response
      ? String((response as { error?: unknown }).error ?? '')
      : '';
  throw new Error(
    error ||
      'Reload this page, then open the inspector again. The content script is not available on this tab yet.',
  );
}

async function requestExtraction(tabId: number): Promise<PageExtraction> {
  try {
    return await sendExtract(tabId);
  } catch {
    await injectContentScript(tabId);
    try {
      return await sendExtract(tabId);
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
      try {
        return await sendExtract(tabId);
      } catch {
        throw new Error(
          'Reload this page, then open the inspector again. Pages that were open before the extension was installed or updated sometimes need a reload.',
        );
      }
    }
  }
}

export async function openSidePanelForTab(tabId: number): Promise<void> {
  if (!chrome.sidePanel?.open) {
    throw new Error('This browser does not provide a side panel. Use the popup, or upgrade to Chromium 116 or newer.');
  }
  try {
    await chrome.sidePanel.open({ tabId });
    return;
  } catch {
    const response: unknown = await chrome.runtime.sendMessage({
      source: SOURCE,
      version: PROTOCOL_VERSION,
      type: 'open-side-panel',
      tabId,
    });
    if (typeof response === 'object' && response !== null && (response as { ok?: boolean }).ok === true) return;
    const error =
      typeof response === 'object' && response !== null && 'error' in response
        ? String((response as { error?: unknown }).error ?? '')
        : '';
    throw new Error(error || 'The side panel could not be opened from this browser.');
  }
}

export function useInspection(): InspectionState {
  const [phase, setPhase] = useState<InspectionPhase>('loading');
  const [detail, setDetail] = useState('Reading this page.');
  const [tabUrl, setTabUrl] = useState('');
  const [tabTitle, setTabTitle] = useState('');
  const [extraction, setExtraction] = useState<PageExtraction | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);

  const load = useCallback(async (id: number, quiet: boolean) => {
    let tab: chrome.tabs.Tab;
    try {
      tab = await chrome.tabs.get(id);
    } catch {
      setPhase('error');
      setDetail('This tab is no longer available.');
      setExtraction(null);
      return;
    }
    setTabUrl(tab.url ?? '');
    setTabTitle(tab.title ?? '');
    const access = pageAccess(tab.url);
    if (!access.ok) {
      setPhase('restricted');
      setDetail(access.reason);
      setExtraction(null);
      return;
    }
    if (!quiet) {
      setPhase('loading');
      setDetail('Reading this page.');
    }
    try {
      const payload = await requestExtraction(id);
      setExtraction(payload);
      setPhase('ready');
      setDetail('');
    } catch (error) {
      setPhase('error');
      setExtraction(null);
      setDetail(error instanceof Error ? error.message : 'This page could not be inspected.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const current = { id: null as number | null };

    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (cancelled || tab?.id == null) {
        if (!cancelled) {
          setPhase('error');
          setDetail('No active tab is available.');
        }
        return;
      }
      current.id = tab.id;
      setTabId(tab.id);
      await load(tab.id, false);
    })();

    const onActivated = (info: { tabId: number }) => {
      current.id = info.tabId;
      setTabId(info.tabId);
      void load(info.tabId, false);
    };
    const onUpdated = (updatedId: number, changeInfo: { status?: string; url?: string }) => {
      if (updatedId !== current.id) return;
      if (changeInfo.status === 'complete' || typeof changeInfo.url === 'string') {
        void load(updatedId, true);
      }
    };
    const onMessage = (message: unknown, sender: chrome.runtime.MessageSender) => {
      if (!isExtractionMessage(message)) return;
      if (sender.tab?.id == null || sender.tab.id !== current.id) return;
      setExtraction(message.payload);
      setTabUrl(message.payload.url);
      setTabTitle(message.payload.title);
      setPhase('ready');
      setDetail('');
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, [load]);

  const refresh = useCallback(() => {
    if (tabId != null) void load(tabId, false);
  }, [load, tabId]);

  const openSidePanel = useCallback(async () => {
    if (tabId == null) throw new Error('No active tab is available.');
    await openSidePanelForTab(tabId);
  }, [tabId]);

  return { phase, detail, tabUrl, tabTitle, extraction, tabId, refresh, openSidePanel };
}
