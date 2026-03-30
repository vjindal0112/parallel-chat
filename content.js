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

function logAvailableElements(context) {
  const testIds = [...document.querySelectorAll("[data-testid]")]
    .map(el => el.getAttribute("data-testid"))
    .filter(id => /model|switcher|composer|research|plus/i.test(id));
  console.log(`[Parallel Chat] ${context} — data-testid attrs:`, testIds);

  const menuItems = [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')]
    .map(el => ({ role: el.getAttribute("role"), text: el.textContent.trim().substring(0, 60), testId: el.getAttribute("data-testid") }));
  if (menuItems.length) console.log(`[Parallel Chat] ${context} — menu items:`, menuItems);
}

async function openModelSwitcher() {
  // Try multiple selectors for the model switcher button
  const selectors = [
    '[data-testid="model-switcher-dropdown-button"]',
    '[data-testid*="model-switcher"]',
    '[aria-haspopup="menu"][data-testid*="model"]',
    'button[data-testid*="switcher"]',
  ];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn) {
      btn.click();
      await delay(400);
      return;
    }
  }
  // Log diagnostics before failing
  logAvailableElements("openModelSwitcher failed");
  throw new Error("Model switcher button not found");
}

async function selectModel(modelName) {
  await openModelSwitcher();

  // First try data-testid containing the model name
  const testIdPatterns = [
    `[data-testid*="${modelName}"]`,
    `[data-testid*="model-switcher"][data-testid*="${modelName}"]`,
  ];
  for (const sel of testIdPatterns) {
    const el = document.querySelector(sel);
    if (el) {
      el.click();
      await delay(500);
      return;
    }
  }

  // Fall back to text-based matching on menu items
  const menuItems = document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]');
  for (const el of menuItems) {
    const text = el.textContent.trim().toLowerCase();
    if (text.includes(modelName.toLowerCase())) {
      el.click();
      await delay(500);
      return;
    }
  }

  logAvailableElements(`selectModel("${modelName}") failed`);
  throw new Error(`Model option "${modelName}" not found in dropdown`);
}

async function selectThinkingEffort(effortText) {
  // Try multiple selectors for the thinking effort pill
  const pillSelectors = [
    "button.__composer-pill",
    '[data-testid*="effort"]',
    '[data-testid*="thinking"]',
    'button[aria-haspopup][class*="pill"]',
  ];
  let pill = null;
  for (const sel of pillSelectors) {
    pill = document.querySelector(sel);
    if (pill) break;
  }
  if (!pill) {
    logAvailableElements("selectThinkingEffort pill not found");
    throw new Error("Thinking effort pill not found");
  }
  pill.click();
  await delay(400);

  // Find and click the effort option — try multiple roles
  const option = await waitForElementWithText('[role="menuitemradio"], [role="menuitem"], [role="option"]', effortText, 5000);
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
  await selectModel("thinking");
  await selectThinkingEffort(effort);
  await setPromptText(prompt);
  await clickSend();
}

async function flowPro(prompt, effort) {
  await waitForElement("#prompt-textarea");
  await selectModel("pro");
  await trySelectThinkingEffort(effort);
  await setPromptText(prompt);
  await clickSend();
}

async function flowDeepResearch(prompt) {
  await waitForElement("#prompt-textarea");

  // Strategy 1: Try the model switcher dropdown for deep research
  let found = false;
  try {
    await openModelSwitcher();
    const menuItems = document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]');
    for (const el of menuItems) {
      if (/deep\s*research/i.test(el.textContent)) {
        el.click();
        found = true;
        break;
      }
    }
  } catch { /* continue to strategy 2 */ }

  // Strategy 2: Try the + / plus button menu
  if (!found) {
    const plusSelectors = [
      "#composer-plus-btn",
      '[data-testid="composer-plus-btn"]',
      '[data-testid*="plus"]',
      '[aria-label="Attach"]',
      'button[aria-label*="plus"]',
      'button[aria-label*="more"]',
    ];
    let plusBtn = null;
    for (const sel of plusSelectors) {
      plusBtn = document.querySelector(sel);
      if (plusBtn) break;
    }

    if (plusBtn) {
      plusBtn.click();
      await delay(400);
      const menuItems = document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]');
      for (const el of menuItems) {
        if (/deep\s*research/i.test(el.textContent)) {
          el.click();
          found = true;
          break;
        }
      }
    }
  }

  if (!found) {
    logAvailableElements("flowDeepResearch failed");
    throw new Error("Deep research option not found");
  }

  await delay(800);
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
