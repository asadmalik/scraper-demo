<template>
  <div class="p-4" style="min-width: 500px;">
    <h1 class="text-xl font-bold mb-2">Email Scraper</h1>

    <!-- 1) One-time regex scrape button -->
    <button
      class="bg-blue-500 text-white px-3 py-1 rounded mr-2"
      @click="scrapeEmails"
    >
      Scrape Emails (One-Time)
    </button>

    <!-- 2) Auto-scroll approach -->
    <button
      class="bg-green-500 text-white px-3 py-1 rounded mr-2"
      @click="onAutoScrollScrapeClick"
    >
      Scroll & Scrape
    </button>

    <!-- 3) Heuristic approach -->
    <button
      class="bg-yellow-500 text-black px-3 py-1 rounded mr-2"
      @click="selectByHeuristic"
    >
      Test Heuristic
    </button>

    <!-- 4) TEST_SELECTOR: user-provided CSS selector -->
    <div class="mt-4">
      <input
        ref="selectorInput"
        type="text"
        class="border border-gray-400 px-2 py-1"
        placeholder="Enter CSS selector (e.g. #container > table > thead)"
      />
      <button
        class="bg-red-300 text-black px-2 py-1 rounded ml-2"
        @click="testSelector"
      >
        Test Selector
      </button>
    </div>

    <!-- Some debug output -->
    <div class="mt-2 text-sm text-gray-700">
      <strong>v1.8: Debug / MyData:</strong> {{ myData }}
    </div>

    <!-- Display Emails Found -->
    <div v-if="emails.length" class="mt-4">
      <h2 class="font-semibold mb-1">Found Emails ({{ emails.length }})</h2>
      <ol class="list-decimal ml-5">
        <li
          v-for="(email, idx) in emails"
          :key="idx"
          class="text-sm"
        >
          {{ email }}
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

// Reactive state
const emails = ref([]);
const myData = ref(""); // For debug info
const selectorInput = ref(null);

// 1) One-time regex
function scrapeEmails() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "SCRAPE_EMAILS" }, (response) => {
      console.log("[popup] SCRAPE_EMAILS response:", response);
      if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError.message);
        return;
      }
      if (response?.emails) {
        emails.value = response.emails;
      }
    });
  });
}

// 2) Auto-scroll approach
function onAutoScrollScrapeClick() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) return;
    chrome.tabs.sendMessage(
      tabs[0].id,
      { type: "AUTO_SCROLL_SCRAPE" },
      (response) => {
        console.log("[popup] AUTO_SCROLL_SCRAPE response:", response);
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError.message);
          return;
        }
        if (!response) {
          console.warn("No response from content script.");
          return;
        }
        if (response.emails) {
          emails.value = response.emails;
        }
      }
    );
  });
}

// 3) Heuristic approach (table-based)
function selectByHeuristic() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "SCRAPE_HEURISTIC" }, (response) => {
      console.log("[popup] SCRAPE_HEURISTIC response:", response);
      if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError.message);
        return;
      }
      if (!response) {
        console.warn("No response from content script.");
        return;
      }

      // If fallback was used => response.data is { emails: [...], phones: [...] }
      // Otherwise, it's an array of row objects
      if (response.usedFallback) {
        myData.value = `Fallback: ${JSON.stringify(response.data)}`;
      } else {
        myData.value = `Heuristic Rows: ${JSON.stringify(response.data)}`;
      }
    });
  });
}

// 4) CSS Selector approach
function testSelector() {
  const selectorVal = selectorInput.value?.value || "";
  console.log("[popup] testSelector with:", selectorVal);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) return;
    chrome.tabs.sendMessage(
      tabs[0].id,
      { type: "TEST_SELECTOR", selector: selectorVal },
      (response) => {
        console.log("[popup] TEST_SELECTOR response:", response);
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError.message);
          return;
        }
        if (response?.headerTitles) {
          myData.value = "HEADER TITLES: " + JSON.stringify(response.headerTitles);
        } else {
          myData.value = "No headers found or invalid selector?";
        }
      }
    );
  });
}
</script>
