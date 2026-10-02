const appUrl = chrome.runtime.getURL('app.html');

chrome.action.onClicked.addListener(async (clickedTab) => {
  const existing = (await chrome.tabs.query({})).filter((tab) => tab.url?.startsWith(appUrl));
  if (existing.length) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId !== undefined) {
      await chrome.windows.update(existing[0].windowId, { focused: true });
    }
    return;
  }
  const source = clickedTab.url?.startsWith('https://search.scielo.org/')
    ? `?source=${encodeURIComponent(clickedTab.url)}` : '';
  await chrome.tabs.create({ url: `${appUrl}${source}` });
});
