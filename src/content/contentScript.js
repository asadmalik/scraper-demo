// contentScript.js

console.log("[contentScript] Loaded.");

/********************************************************
 * GLOBAL STATE
 ********************************************************/

let scannedTables = [];         // { tableElement, index, highlighted, rowCount, columns[] }
let collectedData = {};         // collectedData[tableIndex] = array of row objects
let seenRowIds = {};            // seenRowIds[tableIndex] = Set of row IDs
let currentObserver = null;     // MutationObserver instance
let currentObservedTableIndex = null;  // which table we're observing, if any

/********************************************************
 * SCAN TABLES
 ********************************************************/
function scanTablesOnPage() {
  const tables = Array.from(document.querySelectorAll("table"));
  scannedTables = [];

  tables.forEach((table, idx) => {
    // count <tbody> rows
    let rowCount = 0;
    const tbodies = table.querySelectorAll("tbody");
    tbodies.forEach(tb => {
      rowCount += tb.querySelectorAll("tr").length;
    });

    // gather columns from first <thead> row
    let columns = [];
    const thead = table.querySelector("thead");
    if (thead) {
      const firstRow = thead.querySelector("tr");
      if (firstRow) {
        const headerCells = Array.from(firstRow.querySelectorAll("th, td"));
        columns = headerCells.map((cell, colIndex) => ({
          colIndex,
          text: cell.innerText.trim(),
          highlighted: false
        }));
      }
    }

    scannedTables.push({
      tableElement: table,
      index: idx,
      highlighted: false,
      rowCount,
      columns
    });

    // init data arrays
    if (!collectedData[idx]) {
      collectedData[idx] = [];
    }
    if (!seenRowIds[idx]) {
      seenRowIds[idx] = new Set();
    }
  });

  // return minimal info for the popup
  return scannedTables.map(tbl => ({
    index: tbl.index,
    rowCount: tbl.rowCount,
    columns: tbl.columns.map(c => ({
      colIndex: c.colIndex,
      text: c.text
    }))
  }));
}

/********************************************************
 * HIGHLIGHT TABLE/COLUMN
 ********************************************************/
function toggleTableHighlight(tableIndex, shouldHighlight) {
  const tblInfo = scannedTables.find(t => t.index === tableIndex);
  if (!tblInfo) return;
  tblInfo.highlighted = shouldHighlight;

  const el = tblInfo.tableElement;
  if (shouldHighlight) {
    el.style.outline = "2px dotted rgba(255, 0, 0, 0.6)";
    el.style.backgroundColor = "rgba(255, 0, 0, 0.07)";
  } else {
    el.style.outline = "";
    el.style.backgroundColor = "";
  }
}

function toggleColumnHighlight(tableIndex, colIndex, shouldHighlight) {
  const tblInfo = scannedTables.find(t => t.index === tableIndex);
  if (!tblInfo) return;

  const table = tblInfo.tableElement;
  // highlight <thead>
  const thead = table.querySelector("thead");
  if (thead) {
    const firstRow = thead.querySelector("tr");
    if (firstRow) {
      const cells = firstRow.querySelectorAll("th, td");
      if (cells[colIndex]) {
        cells[colIndex].style.backgroundColor = shouldHighlight ? "rgba(0, 128, 255, 0.15)" : "";
      }
    }
  }

  // highlight <tbody>
  const tbodies = table.querySelectorAll("tbody");
  tbodies.forEach(tb => {
    const rows = tb.querySelectorAll("tr");
    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells[colIndex]) {
        cells[colIndex].style.backgroundColor = shouldHighlight ? "rgba(0, 128, 255, 0.15)" : "";
      }
    });
  });
}

/********************************************************
 * MUTATION OBSERVER & ROW PARSING
 ********************************************************/

/**
 * Start observing a table for changes. We'll parse *all rows* once, then for each
 * childList mutation, re-parse all rows again. This ensures we catch new data
 * even if the site re-renders or replaces entire chunks.
 */
function startObservingTable(tableIndex) {
  stopObservingTable(); // in case we were observing another one

  const tblInfo = scannedTables.find(t => t.index === tableIndex);
  if (!tblInfo) return;
  const tableEl = tblInfo.tableElement;

  currentObservedTableIndex = tableIndex;

  // re-init our stored data if you want a fresh start
  // or we can keep the old data. 
  // For a fresh approach:
  collectedData[tableIndex] = [];
  seenRowIds[tableIndex].clear();

  // parse all existing rows
  parseAllRowsAndAppend(tableIndex);

  // set up observer
  currentObserver = new MutationObserver(mutationList => {
    let relevantChange = false;
    for (const mutation of mutationList) {
      if (mutation.type === "childList") {
        // If the site re-renders <tr> or <tbody>, we want to re-parse
        relevantChange = true;
        break;
      }
    }
    // If relevant changes, re-parse
    if (relevantChange) {
      parseAllRowsAndAppend(tableIndex);
    }
  });

  currentObserver.observe(tableEl, {
    childList: true,
    subtree: true
  });
}

function stopObservingTable() {
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }
  currentObservedTableIndex = null;
}

/**
 * Parse all <tbody> rows, build row ID, append new ones to collectedData if not seen.
 */
function parseAllRowsAndAppend(tableIndex) {
  const tblInfo = scannedTables.find(t => t.index === tableIndex);
  if (!tblInfo) return;
  const tableEl = tblInfo.tableElement;

  const tbodies = tableEl.querySelectorAll("tbody");
  tbodies.forEach(tb => {
    const rows = tb.querySelectorAll("tr");
    rows.forEach(row => {
      const rowId = getRowId(row);
      if (!seenRowIds[tableIndex].has(rowId)) {
        seenRowIds[tableIndex].add(rowId);
        const rowValues = parseRowValues(row);
        collectedData[tableIndex].push({ rowId, rowValues });
      }
    });
  });
}

/**
 * Row ID function: use entire row text as the ID or do a real hash if collisions matter.
 */
function getRowId(tr) {
  return tr.innerText.trim();
}

/**
 * Convert <td> text to array
 */
function parseRowValues(tr) {
  return Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
}

/**
 * Get all the data we have for tableIndex
 */
function getCollectedData(tableIndex) {
  return collectedData[tableIndex] || [];
}

/********************************************************
 * GET OBSERVER STATE
 * so popup can re-initialize if needed
 ********************************************************/
function getObserverState() {
  return {
    currentObservedTableIndex
  };
}

/********************************************************
 * MESSAGE HANDLER
 ********************************************************/
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SCAN_TABLES") {
    const data = scanTablesOnPage();
    sendResponse({ tables: data });
    return true;
  }
  else if (request.type === "TOGGLE_TABLE_HIGHLIGHT") {
    toggleTableHighlight(request.tableIndex, request.highlight);
    sendResponse({ success: true });
    return true;
  }
  else if (request.type === "TOGGLE_COLUMN_HIGHLIGHT") {
    toggleColumnHighlight(request.tableIndex, request.colIndex, request.highlight);
    sendResponse({ success: true });
    return true;
  }
  else if (request.type === "START_OBSERVE_TABLE") {
    startObservingTable(request.tableIndex);
    sendResponse({ success: true });
    return true;
  }
  else if (request.type === "STOP_OBSERVE_TABLE") {
    stopObservingTable();
    sendResponse({ success: true });
    return true;
  }
  else if (request.type === "GET_COLLECTED_DATA") {
    const data = getCollectedData(request.tableIndex);
    sendResponse({ data });
    return true;
  }
  else if (request.type === "GET_OBSERVER_STATE") {
    sendResponse(getObserverState());
    return true;
  }
});
