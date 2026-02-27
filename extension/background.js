let currentVideoUrl = "";

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "VIDEO_URL_DETECTED") {
    currentVideoUrl = message.url;
    sendResponse({ status: "ok" });
  }

  if (message.type === "GET_VIDEO_URL") {
    sendResponse({ url: currentVideoUrl });
  }

  // Return true to indicate async response
  return true;
});

// Listen for tab updates to reset URL when navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url?.includes("youtube.com/watch")) {
    currentVideoUrl = tab.url;
  }
});
