// src/content/contentScript.js

console.log("Content script loaded")

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SCRAPE_EMAILS") {
    const foundEmails = scrapeEmailsByRegex()
    sendResponse({ emails: foundEmails })
  }
  else if (request.type === "TEST_SELECTOR") {
    console.log('TEST_SELECTOR call received')
    //#mfe-app-container > div > div > main > div:nth-child(1) > div > article > div > table > thead:nth-child(2)
    //const Elem = document.querySelector("#mfe-app-container > div > div > main > div:nth-child(1) > div > article > div > table > thead:nth-child(2)")
    //console.log('element inside content script: ', Elem)
    //const elemHTML = Elem ? Elem.outerHTML : null
    console.log('content script, selector value received: ', request.selector)
    const thead = document.querySelector(request.selector);
    const headers = [];
    if (thead) {
      const thEls = thead.querySelectorAll("th, td");
      thEls.forEach(th => {
        
          headers.push(th.innerText.trim())
        
      });
    }
    console.log('headers content script: ', headers)
    sendResponse({ headerTitles:  headers })
    //sendResponse({ elem: 'elemHTML.slice(32)[0]' })
  }
  else if (request.type === 'SCRAPE_HEURISTIC') {
    // 1) Attempt table-based scraping
    const result = heuristicTableScrape()
    // 2) Fallback: do a global email/phone scrape if table is empty
    console.log('csrpt results: ', result)
    if (!result || !result.length) {
      const fallback = scrapeByRegex();
      console.log('csrpt fallback results: ', fallback)
      sendResponse({ data: fallback, usedFallback: true });
    } else {
      sendResponse({ data: result, usedFallback: false });
    }
  }
})

function scrapeEmailsByRegex() {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+/g
  const textContent = document.body.innerText
  const matches = textContent.match(regex) || []
  // Optional: remove duplicates or do something more advanced
  return Array.from(new Set(matches))
}




// 1) Check for tables with known columns
function heuristicTableScrape() {
  const tables = Array.from(document.querySelectorAll('table'));
  const allRows = [];

  tables.forEach(table => {
    const headerRow = table.querySelector('thead');
    if (!headerRow) return;

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    console.log('headerCells: ', headerCells)
    const colMap = headerCells.map(cell => cell.innerText.trim().toUpperCase());

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const rowData = {};

      colMap.forEach((colText, i) => {
        if (colText.includes('EMAIL')) {
          rowData.email = cells[i]?.innerText.trim();
        } else if (colText.includes('PHONE') || colText.includes('MOBILE')) {
          rowData.phone = cells[i]?.innerText.trim();
        } else if (colText.includes('NAME')) {
          rowData.name = cells[i]?.innerText.trim();
        }
        // etc. for other fields
      });

      // If we found something
      if (Object.keys(rowData).length > 0) {
        allRows.push(rowData);
      }
    });
  });

  return allRows;
}

// 2) Global regex fallback
function scrapeByRegex() {
  const text = document.body.innerText;
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]+/g;
  const phoneRegex = /\(?([0-9]{3})\)?([ .-]?)([0-9]{3})\2([0-9]{4})/; ///\+?\d{1,3}[.\-\s]?\(?\d{2,3}\)?[.\-\s]\d{3,4}[.\-\s]\d{3,4}/g;

  const emails = Array.from(new Set(text.match(emailRegex) || []));
  const phones = Array.from(new Set(text.match(phoneRegex) || []));
  console.log('phones caught: ', phones)
  return { emails, phones };
}

// TODO: We'll add "scrapeBySelector" next if needed
