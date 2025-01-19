// TODO: This script lives in the actual web pages you visit.
//       We'll do the scraping logic here using a regex or user-provided selector.

console.log("Content script loaded")

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SCRAPE_EMAILS") {
    const foundEmails = scrapeEmailsByRegex()
    sendResponse({ emails: foundEmails })
  }
})

function scrapeEmailsByRegex() {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+/g
  const textContent = document.body.innerText
  const matches = textContent.match(regex) || []
  // Optional: remove duplicates or do something more advanced
  return Array.from(new Set(matches))
}

// TODO: We'll add "scrapeBySelector" next if needed
