// ── Utilities ──

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function radixClick(element) {
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

// ── Composer ──

async function setPromptText(text) {
  const editor = document.getElementById("prompt-textarea");
  editor.focus();
  await delay(100);

  // ProseMirror doesn't respond to value setting — use execCommand
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);
  await delay(300);
}

async function clickSend() {
  await delay(300);
  const btn = await waitForElement('[data-testid="send-button"]', 5000);
  btn.click();
}

// ── Model Selection ──

async function selectModel(slug) {
  // slug: 'gpt-5-3' | 'gpt-5-4-thinking' | 'gpt-5-4-pro'
  const btn = await waitForElement('[data-testid="model-switcher-dropdown-button"]');
  radixClick(btn);
  await delay(300);

  const item = await waitForElement(`[data-testid="model-switcher-${slug}"]`);
  radixClick(item);
  await delay(300);
}

// ── Thinking Effort ──

async function selectThinkingEffort(effortText) {
  // effortText: 'Light' | 'Standard' | 'Extended' | 'Heavy'
  const pill = await waitForElement("button.__composer-pill", 5000);
  radixClick(pill);
  await delay(300);

  const option = await waitForElementWithText('[role="menuitemradio"]', effortText, 5000);
  radixClick(option);
  await delay(200);
}

async function trySelectThinkingEffort(effortText) {
  try {
    await selectThinkingEffort(effortText);
  } catch {
    // Effort pill may not be available — continue without it
  }
}

// ── Plus Menu Features ──

async function selectPlusMenuFeature(featureName) {
  const plusBtn = await waitForElement('[data-testid="composer-plus-btn"]');
  radixClick(plusBtn);
  await delay(300);

  // Try main menu first
  const items = document.querySelectorAll('[role="menuitemradio"], [role="menuitem"]');
  const target = Array.from(items).find(i => i.textContent.trim() === featureName);

  if (target) {
    radixClick(target);
    await delay(300);
    return;
  }

  // Feature might be in the "More" submenu
  const moreItem = Array.from(items).find(i => i.textContent.trim() === "More");
  if (moreItem) {
    moreItem.focus();
    moreItem.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await delay(300);

    const subOption = await waitForElementWithText('[role="menuitemradio"]', featureName, 5000);
    radixClick(subOption);
    await delay(300);
    return;
  }

  throw new Error(`Plus menu feature "${featureName}" not found`);
}

// ── Flows ──

async function flowThinking(prompt, effort) {
  await waitForElement("#prompt-textarea");
  await selectModel("gpt-5-4-thinking");
  await selectThinkingEffort(effort);
  await setPromptText(prompt);
  await clickSend();
}

async function flowPro(prompt, effort) {
  await waitForElement("#prompt-textarea");
  await selectModel("gpt-5-4-pro");
  await trySelectThinkingEffort(effort);
  await setPromptText(prompt);
  await clickSend();
}

async function flowDeepResearch(prompt) {
  await waitForElement("#prompt-textarea");
  await selectPlusMenuFeature("Deep research");
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
