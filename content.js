// ── Utilities ──

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForElement(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve(el);
      }
    }, 200);
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timeout waiting for: ${selector}`));
    }, timeout);
  });
}

function waitForElementWithText(selector, text, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const els = document.querySelectorAll(selector);
      for (const el of els) {
        if (el.textContent.trim() === text) return el;
      }
      return null;
    };
    const found = check();
    if (found) return resolve(found);
    const interval = setInterval(() => {
      const found = check();
      if (found) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve(found);
      }
    }, 200);
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timeout waiting for "${text}" in ${selector}`));
    }, timeout);
  });
}

async function setPromptText(text) {
  const textarea = await waitForElement("#prompt-textarea");
  textarea.focus();
  await delay(100);

  // Select all existing content and replace with our text
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);
  await delay(300);
}

async function clickSend() {
  await delay(300);
  const btn = document.querySelector("#composer-submit-button")
    || document.querySelector('[data-testid="send-button"]');
  if (!btn) throw new Error("Send button not found");
  btn.click();
}

// ── Model Selection ──

async function selectModel(testId) {
  const modelBtn = await waitForElement('[data-testid="model-switcher-dropdown-button"]');
  modelBtn.click();
  await delay(400);

  const modelOption = await waitForElement(`[data-testid="${testId}"]`);
  modelOption.click();
  await delay(500);
}

async function selectThinkingEffort(effortText) {
  // Click the thinking effort pill to open the dropdown
  const pill = await waitForElement("button.__composer-pill", 5000);
  pill.click();
  await delay(400);

  // Find and click the effort option
  const option = await waitForElementWithText('[role="menuitemradio"]', effortText, 5000);
  option.click();
  await delay(300);
}

async function trySelectThinkingEffort(effortText) {
  try {
    await selectThinkingEffort(effortText);
  } catch {
    // Effort pill may not be available for this model — continue without it
  }
}

// ── Flows ──

async function flowThinking(prompt, effort) {
  await waitForElement("#prompt-textarea");
  await selectModel("model-switcher-gpt-5-4-thinking");
  await selectThinkingEffort(effort);
  await setPromptText(prompt);
  await clickSend();
}

async function flowPro(prompt, effort) {
  await waitForElement("#prompt-textarea");
  await selectModel("model-switcher-gpt-5-4-pro");
  await trySelectThinkingEffort(effort);
  await setPromptText(prompt);
  await clickSend();
}

async function flowDeepResearch(prompt) {
  await waitForElement("#prompt-textarea");

  // Open the + menu
  const plusBtn = await waitForElement("#composer-plus-btn");
  plusBtn.click();
  await delay(400);

  // Select "Deep research"
  const drOption = await waitForElementWithText('[role="menuitemradio"]', "Deep research");
  drOption.click();
  await delay(800);

  // Enter prompt (the composer may have reset after mode switch)
  await setPromptText(prompt);
  await clickSend();
}

// ── Message Handler ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "configure-and-send") {
    const { prompt, config } = message;
    run(prompt, config).catch(err => console.error("[Parallel Chat]", err));
  }
});

async function run(prompt, config) {
  if (config.model === "thinking") {
    await flowThinking(prompt, config.effort);
  } else if (config.model === "pro") {
    await flowPro(prompt, config.effort);
  } else if (config.model === "deep-research") {
    await flowDeepResearch(prompt);
  }
}
