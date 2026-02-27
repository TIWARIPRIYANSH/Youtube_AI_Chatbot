(() => {
  "use strict";

  /**
   * Extracts the current YouTube video URL from the address bar.
   * Only returns a URL if we're on a /watch page.
   * @returns {string|null} The video URL or null
   */
  function getVideoUrl() {
    const url = window.location.href;
    if (url.includes("youtube.com/watch")) {
      return url.split("&")[0]; // Clean URL, keep only video ID param
    }
    return null;
  }

  /**
   * Sends the detected video URL to the background script.
   */
  function sendVideoUrl() {
    const url = getVideoUrl();
    if (url) {
      chrome.runtime.sendMessage(
        { type: "VIDEO_URL_DETECTED", url },
        (response) => {
          if (chrome.runtime.lastError) {
            // Extension context may be invalidated; silently ignore
            return;
          }
        }
      );
    }
  }

  // Initial detection
  sendVideoUrl();

  // YouTube uses SPA navigation — detect URL changes via History API
  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // Small delay to let YouTube finish updating the page
      setTimeout(sendVideoUrl, 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also detect popstate (back/forward navigation)
  window.addEventListener("popstate", () => {
    setTimeout(sendVideoUrl, 500);
  });
})();

