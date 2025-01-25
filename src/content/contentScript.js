// contentScript.js

console.log("Content script loaded");

/**
 * A simple function to wait (async/await).
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simple regex-based scrape of all emails on the page (document.body.innerText).
 */
function scrapeEmailsByRegex() {
  const regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]+/g;
  const textContent = document.body.innerText || "";
  const matches = textContent.match(regex) || [];
  return Array.from(new Set(matches)); // unique
}

/**
 * Auto-scroll approach:
 *  - Scroll to bottom,
 *  - Wait,
 *  - Scrape new emails,
 *  - Stop if no new emails since last scroll or max scroll attempts reached.
 */
async function autoScrollAndScrapeEmails(options = {}) {
  console.log("autoScrollAndScrape called with options:", options);

  const {
    maxScrollAttempts = 50,
    scrollDelay = 3000, // ms
    noNewDataStop = true,
  } = options;

  let allEmails = new Set();
  let previousCount = 0;

  for (let i = 0; i < maxScrollAttempts; i++) {
    // 1) Scroll to bottom
    window.scrollTo(0, document.body.scrollHeight);

    // 2) Wait for lazy load
    await wait(scrollDelay);

    // 3) Scrape
    const newEmails = scrapeEmailsByRegex();
    newEmails.forEach(e => allEmails.add(e));

    console.log(
      `[autoScrollAndScrapeEmails] After scroll #${i}, total unique emails: ${allEmails.size}`,
      allEmails
    );

    // 4) If no new emails found => stop
    if (noNewDataStop && allEmails.size === previousCount) {
      console.log(`[autoScrollAndScrapeEmails] No new emails on scroll #${i}. Stopping.`);
      break;
    }
    previousCount = allEmails.size;
  }

  return Array.from(allEmails);
}

/**
 * Heuristic table-scrape approach:
 *  - Looks for all <table> elements.
 *  - Finds the first <thead> in each table.
 *  - Creates a "colMap" from the text of each TH/TD in that thead row.
 *  - Then scans <tbody> tr to see if colMap includes "EMAIL"/"PHONE"/"NAME".
 *  - Returns an array of row objects.
 */
function heuristicTableScrape() {
  const tables = Array.from(document.querySelectorAll("table"));
  const allRows = [];

  tables.forEach(table => {
    // get the first <thead> (some pages have multiple <thead>)
    const thead = table.querySelector("thead");
    if (!thead) return;

    const headerCells = Array.from(thead.querySelectorAll("th, td"));
    console.log("headerCells in heuristic:", headerCells);
    const colMap = headerCells.map(cell => cell.innerText.trim().toUpperCase());

    // gather rows in <tbody>
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll("td"));
      const rowData = {};

      colMap.forEach((colText, i) => {
        if (colText.includes("EMAIL")) {
          rowData.email = cells[i]?.innerText.trim();
        } else if (colText.includes("PHONE") || colText.includes("MOBILE")) {
          rowData.phone = cells[i]?.innerText.trim();
        } else if (colText.includes("NAME")) {
          rowData.name = cells[i]?.innerText.trim();
        }
        // etc. if you want more fields
      });

      if (Object.keys(rowData).length > 0) {
        allRows.push(rowData);
      }
    });
  });

  return allRows;
}

/**
 * Fallback global approach to find both emails & phone # in the entire page text.
 */
function scrapeByRegex2() {
  const text = document.body.innerText || "";

  // Basic email
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]+/g;
  // A naive phone pattern (3-3-4)
  const phoneRegex = /\(?([0-9]{3})\)?([ .-]?)([0-9]{3})\2([0-9]{4})/g;

  const emails = Array.from(new Set(text.match(emailRegex) || []));
  const phones = Array.from(new Set(text.match(phoneRegex) || []));
  console.log("fallback phones caught:", phones);

  return { emails, phones };
}

/**
 * Listen for messages from popup or background scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SCRAPE_EMAILS") {
    const foundEmails = scrapeEmailsByRegex();
    sendResponse({ emails: foundEmails });
  }
  else if (request.type === "AUTO_SCROLL_SCRAPE") {
    console.log("Received AUTO_SCROLL_SCRAPE message.");
    autoScrollAndScrapeEmails({ maxScrollAttempts: 20, scrollDelay: 2000 })
      .then(resultEmails => {
        console.log("AutoScroll done. Found emails:", resultEmails);
        sendResponse({ emails: resultEmails });
      })
      .catch(err => {
        console.error("Error in autoScrollAndScrapeEmails:", err);
        sendResponse({ emails: [], error: String(err) });
      });
    return true; // Must return true to keep message channel open for async
  }
  else if (request.type === "SCRAPE_HEURISTIC") {
    // Attempt the table-based approach
    const result = heuristicTableScrape();
    console.log("Heuristic results:", result);

    if (!result || !result.length) {
      // fallback
      const fallback = scrapeByRegex2();
      console.log("Heuristic fallback results:", fallback);
      sendResponse({ data: fallback, usedFallback: true });
    } else {
      sendResponse({ data: result, usedFallback: false });
    }
  }
  else if (request.type === "TEST_SELECTOR") {
    console.log("TEST_SELECTOR call received. Selector:", request.selector);
    const thead = document.querySelector(request.selector);
    const headers = [];

    if (thead) {
      const thEls = thead.querySelectorAll("th, td");
      thEls.forEach(th => {
        headers.push(th.innerText.trim());
      });
    }
    console.log("headers from TEST_SELECTOR:", headers);
    sendResponse({ headerTitles: headers });
  }
});
