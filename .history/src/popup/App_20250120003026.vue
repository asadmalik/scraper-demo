<template>
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">Email Scraper</h1>
  
      <!-- TODO: UI to trigger scraping, show results, partial data, etc. -->
      <button
        class="bg-blue-500 text-white px-4 py-2 rounded"
        @click="scrapeEmails"
      >
        Scrape Emails
      </button>
  
      <div v-if="emails.length" class="mt-4">
        <h2 class="font-semibold mb-2">Found Emails:</h2>
        <ul class="list-disc list-inside">
          <li v-for="(email, idx) in emails" :key="idx">{{ email }}</li>
        </ul>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue'
  
  const emails = ref<string[]>([])
  
  // TODO: This function will ask the content script to scrape emails.
  function scrapeEmails() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "SCRAPE_EMAILS" },
          (response) => {
            if (response && response.emails) {
              emails.value = response.emails
            }
          }
        )
      }
    })
  }
  </script>
  
  <style scoped>
  /* You can still use Tailwind classes in your template */
  </style>
  