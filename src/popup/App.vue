<template>
  <div class="p-4 min-w-[320px] text-gray-800">
    <h1 class="text-xl font-semibold mb-3">Row ID Table Collector (Enhanced) v0.0.3</h1>

    <!-- Button row -->
    <div class="flex space-x-2 mb-3">
      <button class="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition" @click="scanTables">
        Scan Tables
      </button>
      <div class="text-sm text-gray-600 flex items-center">
        {{ statusMsg }}
      </div>
    </div>

    <!-- List of scanned tables -->
    <div v-if="tables.length" class="space-y-4">
      <div v-for="tbl in tables" :key="tbl.index" class="border border-gray-300 rounded p-3">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-medium">Table #{{ tbl.index }}</span>
            <span class="ml-2 text-sm text-gray-500">
              ({{ tbl.rowCount }} rows)
            </span>
          </div>
          <label class="inline-flex items-center space-x-1">
            <input type="checkbox" v-model="tbl.tableHighlighted" @change="onToggleTable(tbl)"
              class="h-4 w-4 text-pink-500" />
            <span class="text-sm">Highlight Table</span>
          </label>
        </div>

        <!-- Columns -->
        <div class="mt-2 ml-3 space-y-1">
          <div v-if="!tbl.columns.length" class="text-sm text-gray-500">
            (No header row found)
          </div>
          <div v-for="col in tbl.columns" :key="col.colIndex" class="flex items-center space-x-2">
            <input type="checkbox" v-model="col.colHighlighted" @change="onToggleColumn(tbl, col)"
              class="h-4 w-4 text-blue-600" />
            <span class="text-sm">
              Column <strong>{{ col.colIndex }}</strong>:
              <em>{{ col.text || "(empty)" }}</em>
            </span>
          </div>
        </div>

        <!-- Observe / Collect data toggle -->
        <div class="flex items-center mt-3">
          <label class="mr-2 text-sm font-medium text-gray-700">
            Observe / Collect data
          </label>
          <input type="checkbox" v-model="tbl.collectData" @change="onToggleCollectData(tbl)"
            class="h-4 w-4 text-green-600" />
        </div>
      </div>
    </div>

    <!-- Collected data -->
    <div v-if="collectedRows.length" class="mt-4 border-t pt-3">
      <div class="mt-4 flex gap-2" v-if="filteredCollectedRows.length && !currentTableIndex">
        <button class="bg-green-500 text-white px-4 py-2 rounded" @click="exportAsCSV">
          Export as CSV
        </button>
        <button class="bg-yellow-500 text-white px-4 py-2 rounded" @click="exportAsJSON">
          Export as JSON
        </button>
      </div>
      <div class="flex items-center mb-2 space-x-2">
        <h2 class="text-sm font-semibold">
          Collected Data ({{ collectedRows.length }} rows)
        </h2>
        <button class="bg-gray-200 rounded px-2 py-1 text-sm hover:bg-gray-300 transition"
          @click="refreshCollectedData">
          Refresh Data
        </button>
        <button class="bg-gray-200 rounded px-2 py-1 text-sm hover:bg-gray-300 transition" @click="stopCollecting">
          Stop Collecting
        </button>
      </div>

      <table class="table-auto w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th v-for="header in selectedHeaders" :key="header" class="border border-gray-300 px-2 py-1">
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in filteredCollectedRows" :key="rowIndex">
            <td v-for="(value, colIndex) in row" :key="colIndex" class="border border-gray-300 px-2 py-1">
              {{ value }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
  import { computed, onMounted, ref } from "vue";

  const tables = ref([]);
  const statusMsg = ref("Idle.");
  const collectedRows = ref([]);

  // Track which table is being observed
  let currentTableIndex = null;

  // Computed: Filtered rows based on selected columns
  const filteredCollectedRows = computed(() => {
    if (currentTableIndex === null) return [];

    const currentTable = tables.value.find(t => t.index === currentTableIndex);
    if (!currentTable) return [];

    // Get indices of selected columns
    const selectedColIndices = currentTable.columns
      .filter(col => col.colHighlighted)
      .map(col => col.colIndex);

    // Filter rows based on selected column indices
    return collectedRows.value.map(row => {
      return selectedColIndices.map(idx => row.rowValues[idx] || "");
    });
  });

  // Computed: Selected column headers
  const selectedHeaders = computed(() => {
    if (currentTableIndex === null) return [];

    const currentTable = tables.value.find(t => t.index === currentTableIndex);
    if (!currentTable) return [];

    return currentTable.columns
      .filter(col => col.colHighlighted)
      .map(col => col.text || "(Unnamed)");
  });

  /******************************
   * onMounted -> Check Observer State
   ******************************/
  onMounted(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: "GET_OBSERVER_STATE" }, (resp) => {
        if (chrome.runtime.lastError) {
          // Possibly no content script or error
          return;
        }
        if (!resp) return;

        const observedIdx = resp.currentObservedTableIndex;
        if (typeof observedIdx === "number") {
          // Currently observing a table
          currentTableIndex = observedIdx;
          scanTables(() => {
            const theTable = tables.value.find(t => t.index === observedIdx);
            if (theTable) {
              theTable.collectData = true;
              refreshCollectedData();
            }
          });
        }
      });
    });
  });

  /******************************
   * SCAN TABLES
   ******************************/
  function scanTables(cb = () => { }) {
    statusMsg.value = "Scanning...";
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;

      chrome.tabs.sendMessage(tabs[0].id, { type: "SCAN_TABLES" }, (response) => {
        if (chrome.runtime.lastError) {
          statusMsg.value = "Error: " + chrome.runtime.lastError.message;
          return cb();
        }
        if (!response || !response.tables) {
          statusMsg.value = "No tables found.";
          return cb();
        }

        // Store scanned tables
        tables.value = response.tables.map(t => ({
          ...t,
          tableHighlighted: false,
          collectData: false,
          columns: t.columns.map(c => ({
            ...c,
            colHighlighted: false
          }))
        }));
        statusMsg.value = `Found ${tables.value.length} table(s).`;
        cb();
      });
    });
  }

  /******************************
   * TOGGLE TABLE HIGHLIGHT
   ******************************/
  function onToggleTable(tbl) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "TOGGLE_TABLE_HIGHLIGHT",
        tableIndex: tbl.index,
        highlight: tbl.tableHighlighted
      }, (resp) => {
        if (chrome.runtime.lastError) {
          statusMsg.value = chrome.runtime.lastError.message;
          return;
        }
        statusMsg.value = resp?.success
          ? `Table #${tbl.index} highlight -> ${tbl.tableHighlighted}`
          : "Highlight call failed.";
      });
    });
  }

  /******************************
   * TOGGLE COLUMN HIGHLIGHT
   ******************************/
  function onToggleColumn(tbl, col) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "TOGGLE_COLUMN_HIGHLIGHT",
        tableIndex: tbl.index,
        colIndex: col.colIndex,
        highlight: col.colHighlighted
      }, (resp) => {
        if (chrome.runtime.lastError) {
          statusMsg.value = chrome.runtime.lastError.message;
          return;
        }
        statusMsg.value = resp?.success
          ? `Table #${tbl.index}, col #${col.colIndex} highlight -> ${col.colHighlighted}`
          : "Column highlight call failed.";
      });
    });
  }

  /******************************
   * OBSERVE / COLLECT DATA
   ******************************/
  function onToggleCollectData(tbl) {
    if (tbl.collectData) {
      if (currentTableIndex !== null && currentTableIndex !== tbl.index) {
        stopCollecting();
      }
      currentTableIndex = tbl.index;
      startCollecting(tbl.index);
    } else {
      if (currentTableIndex === tbl.index) {
        stopCollecting();
      }
    }
  }

  function startCollecting(tableIndex) {
    collectedRows.value = [];
    statusMsg.value = `Observing table #${tableIndex} for new rows...`;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "START_OBSERVE_TABLE",
        tableIndex
      }, (resp) => {
        if (chrome.runtime.lastError) {
          statusMsg.value = chrome.runtime.lastError.message;
          return;
        }
        if (resp?.success) {
          refreshCollectedData();
        }
      });
    });
  }

  function stopCollecting() {
    if (currentTableIndex !== null) {
      const tblObj = tables.value.find(t => t.index === currentTableIndex);
      if (tblObj) {
        tblObj.collectData = false;
      }
      currentTableIndex = null;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: "STOP_OBSERVE_TABLE" }, (resp) => {
        if (chrome.runtime.lastError) {
          statusMsg.value = chrome.runtime.lastError.message;
          return;
        }
        if (resp?.success) {
          statusMsg.value = "Stopped observing.";
        }
      });
    });
  }

  /******************************
   * REFRESH DATA
   ******************************/
  function refreshCollectedData() {
    if (currentTableIndex === null) {
      statusMsg.value = "No table is being observed.";
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "GET_COLLECTED_DATA",
        tableIndex: currentTableIndex
      }, (resp) => {
        if (chrome.runtime.lastError) {
          statusMsg.value = chrome.runtime.lastError.message;
          return;
        }
        if (resp?.data) {
          collectedRows.value = resp.data;
          statusMsg.value = `Fetched ${resp.data.length} row(s).`;
        }
      });
    });
  }

  /******************************
 * EXPORT METHODS
 ******************************/
function exportAsCSV() {
  if (!filteredCollectedRows.value.length) {
    alert("No data to export.");
    return;
  }

  const headers = selectedHeaders.value.join(",");
  const rows = filteredCollectedRows.value.map(row => row.join(",")).join("\n");

  const csvContent = `${headers}\n${rows}`;
  downloadFile(csvContent, "export.csv", "text/csv");
}

function exportAsJSON() {
  if (!filteredCollectedRows.value.length) {
    alert("No data to export.");
    return;
  }

  const jsonContent = JSON.stringify({
    headers: selectedHeaders.value,
    rows: filteredCollectedRows.value,
  }, null, 2);

  downloadFile(jsonContent, "export.json", "application/json");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

</script>
