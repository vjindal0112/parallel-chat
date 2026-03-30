chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "launchAll") {
    handleLaunch(message.prompt, message.configs);
  }
});

async function handleLaunch(prompt, configs) {
  const promises = configs.map(config => launchTab(prompt, config));
  await Promise.allSettled(promises);
}

async function launchTab(prompt, config) {
  const tab = await chrome.tabs.create({ url: "https://chatgpt.com/", active: false });

  // Wait for the tab to finish loading
  await waitForTabLoad(tab.id);

  // Give the SPA a moment to hydrate
  await delay(2000);

  // Inject the content script
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  });

  // Small delay to let content script initialize its listener
  await delay(200);

  // Send the configuration
  await chrome.tabs.sendMessage(tab.id, {
    action: "configure-and-send",
    prompt,
    config,
  });
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
