<template>
    <div class="p-7 min-w-96">
      <h1 class="text-xl font-bold mb-4">Email Scraper</h1>
  
      <!-- TODO: UI to trigger scraping, show results, partial data, etc. -->
      <button
        class="bg-blue-500 text-white px-4 py-2 rounded"
        @click="scrapeEmails"
      >
        Scrape Emails
      </button>
      <input type="text" value="" class="inset-1 border-cyan-500 rounded-sm p-2" placeholder="Insert Selector" ref="selectorInput"/>
      <button @click="testSelector" class="bg-red-300 text-black px-4 py-2 rounded">
        Test Selector
      </button>
      <button class="bg-green-300 text-black px-4 py-2 rounded" @click="selectByHeuristic">Test Heuristic</button>
  <div >
    Data 7: 
{{ myData }}
  </div>
      <div v-if="emails.length" class="mt-4">
        <h2 class="font-semibold mb-2">Found Emails:</h2>
        <ul class="list-disc list-inside">
          <li v-for="(email, idx) in emails" :key="idx">{{ email }}</li>
        </ul>
      </div>
    </div>
  </template>
  
  <script setup>
  
  import { ref } from 'vue';

  const emails = ref([])
  const myData = ref('')
  const selectorInput = ref();

  function selectByHeuristic(){
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "SCRAPE_HEURISTIC" },
          (response) => {
            //console.log('response: ', response)
            if (response && response.headerTitles) {
              
              //myData.value = response.headerTitles;
              console.log('received selectByHeuristic in popup: ', response)
            }
          }
        )
      }
    })
  }
  
function testSelector(){
  console.log('selector value: ', selectorInput.value.value);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "TEST_SELECTOR", selector:  selectorInput.value.value},
          (response) => {
            console.log('response: ', response)
            if (response && response.headerTitles) {
              
              myData.value = response.headerTitles;
              console.log('received data in popup: ', response)
            }
          }
        )
      }
    })
}

  // TODO: This function will ask the content script to scrape emails.
  function scrapeEmails() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "SCRAPE_EMAILS" },
          (response) => {
            console.log('scrape response: ', response)
            if (response && response.emails) {
              emails.value = response.emails
            }
          }
        )
      }
    })
  }
  </script>