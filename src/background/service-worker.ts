import { isInjectRequest, isOpenSidePanelRequest } from '../shared/protocol';

function configureSidePanel(): void {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
}

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  configureSidePanel();
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isInjectRequest(message)) {
    chrome.scripting
      .executeScript({
        target: { tabId: message.tabId },
        files: ['content/content-script.js'],
      })
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Could not inject the content script.',
        });
      });
    return true;
  }

  if (isOpenSidePanelRequest(message)) {
    if (!chrome.sidePanel?.open) {
      sendResponse({ ok: false, error: 'This browser does not provide the side panel API.' });
      return false;
    }
    chrome.sidePanel
      .open({ tabId: message.tabId })
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Could not open the side panel.',
        });
      });
    return true;
  }

  return false;
});
