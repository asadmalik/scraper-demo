// TODO: If we need a background service worker for more complex tasks

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed.")
  })
  
  // Example message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // TODO: handle requests from popup or content script if needed
    console.log("Background received message:", request)
  })
  