/**
 * YouTube AI Chatbot - Popup Script
 * 
 * Handles:
 * 1. Fetching video URL from background script or active tab
 * 2. Sending user questions to the backend API
 * 3. Rendering chat messages with animations
 * 4. Error handling and loading states
 */

(() => {
  "use strict";

 
  const API_URL = "http://localhost:8000/chat";


  const chatContainer = document.getElementById("chatContainer");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const videoUrlInput = document.getElementById("videoUrl");
  const welcomeState = document.getElementById("welcomeState");

  // ==========================================
  // STATE
  // ==========================================

  let isLoading = false;
  let chatStarted = false;

  // ==========================================
  // INITIALIZATION
  // ==========================================

  /**
   * On popup open, attempt to get the current YouTube video URL
   * from the background script, then fall back to querying the active tab.
   */
  async function init() {
    try {
      // Method 1: Ask background script for cached URL
      const response = await chrome.runtime.sendMessage({ type: "GET_VIDEO_URL" });
      if (response?.url) {
        videoUrlInput.value = response.url;
        return;
      }
    } catch (e) {
      // Background script may not have a URL yet
    }

    try {
      // Method 2: Query the active tab directly
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes("youtube.com/watch")) {
        videoUrlInput.value = tab.url.split("&")[0];
      }
    } catch (e) {
      console.warn("Could not detect YouTube URL:", e);
    }
  }

  init();

  // ==========================================
  // MESSAGE RENDERING
  // ==========================================

  /**
   * Hides the welcome state when chat begins.
   */
  function hideWelcome() {
    if (!chatStarted && welcomeState) {
      welcomeState.style.display = "none";
      chatStarted = true;
    }
  }

  /**
   * Appends a message bubble to the chat container.
   * @param {"user"|"ai"} role - Who sent the message
   * @param {string} text - The message content
   */
  function addMessage(role, text) {
    hideWelcome();

    const wrapper = document.createElement("div");
    wrapper.className = `message message--${role}`;

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);
    chatContainer.appendChild(wrapper);

    // Auto-scroll to latest message
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  /**
   * Shows the typing indicator (three bouncing dots).
   * @returns {HTMLElement} The indicator element (for later removal)
   */
  function showTypingIndicator() {
    hideWelcome();

    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.id = "typingIndicator";

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("div");
      dot.className = "typing-dot";
      indicator.appendChild(dot);
    }

    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return indicator;
  }

  /**
   * Removes the typing indicator from the chat.
   */
  function removeTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) indicator.remove();
  }

  /**
   * Shows a transient error message in the chat area.
   * @param {string} message - Error description
   */
  function showError(message) {
    const toast = document.createElement("div");
    toast.className = "error-toast";
    toast.textContent = `⚠ ${message}`;
    chatContainer.appendChild(toast);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Auto-dismiss after 5 seconds
    setTimeout(() => toast.remove(), 5000);
  }

  // ==========================================
  // API COMMUNICATION
  // ==========================================

  /**
   * Sends the user's question to the backend and displays the response.
   * @param {string} question - User's question text
   */
  async function sendMessage(question) {
    const videoUrl = videoUrlInput.value.trim();

    // Validation
    if (!videoUrl) {
      showError("No video URL detected. Please open a YouTube video or paste a URL.");
      return;
    }

    if (!question.trim()) return;

    // Prevent double-sends
    if (isLoading) return;
    isLoading = true;

    // Show user message
    addMessage("user", question);

    // Clear input and disable
    chatInput.value = "";
    chatInput.disabled = true;
    sendBtn.disabled = true;

    // Show typing animation
    showTypingIndicator();

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: videoUrl,
          query: question.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      removeTypingIndicator();

      if (data.answer) {
        addMessage("ai", data.answer);
      } else {
        showError("Received an empty response from the server.");
      }
    } catch (err) {
      removeTypingIndicator();

      if (err.name === "TypeError" && err.message.includes("Failed to fetch")) {
        showError("Cannot reach the server. Is your backend running?");
      } else {
        showError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      isLoading = false;
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  /** Send on button click */
  sendBtn.addEventListener("click", () => {
    sendMessage(chatInput.value);
  });

  /** Send on Enter key */
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput.value);
    }
  });

  /** Focus input on popup open */
  chatInput.focus();
})();
