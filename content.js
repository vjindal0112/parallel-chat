// ── Utilities ──

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Full synthesized pointer+mouse+click sequence with coordinates.
// Required for elements that are visibility:hidden (e.g. the effort submenu
// triggers, which only become visible on CSS :hover and cannot be reached by
// a real coordinate click).
function fireClick(el) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: cx,
    clientY: cy,
    button: 0,
    buttons: 1,
  };
  el.dispatchEvent(new PointerEvent("pointerover", { ...base, pointerType: "mouse" }));
  el.dispatchEvent(new PointerEvent("pointerenter", { ...base, pointerType: "mouse" }));
  el.dispatchEvent(new MouseEvent("mouseover", base));
  el.dispatchEvent(new MouseEvent("mouseenter", base));
  el.dispatchEvent(new PointerEvent("pointerdown", { ...base, pointerType: "mouse" }));
  el.dispatchEvent(new MouseEvent("mousedown", base));
  el.dispatchEvent(new PointerEvent("pointerup", { ...base, pointerType: "mouse" }));
  el.dispatchEvent(new MouseEvent("mouseup", base));
  el.dispatchEvent(new MouseEvent("click", base));
}

function waitForElement(selector, timeout = 15000, root = document) {
  return new Promise((resolve, reject) => {
    const found = root.querySelector(selector);
    if (found) return resolve(found);
    const interval = setInterval(() => {
      const el = root.querySelector(selector);
      if (el) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve(el);
      }
    }, 100);
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timeout waiting for: ${selector}`));
    }, timeout);
  });
}

function waitFor(predicate, timeout = 10000, label = "predicate") {
  return new Promise((resolve, reject) => {
    const found = predicate();
    if (found) return resolve(found);
    const interval = setInterval(() => {
      const result = predicate();
      if (result) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve(result);
      }
    }, 100);
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timeout waiting for: ${label}`));
    }, timeout);
  });
}

function findOpenSubmenu() {
  const menus = document.querySelectorAll(
    '[data-radix-menu-content][data-state="open"]'
  );
  for (const m of menus) {
    if (m.getAttribute("data-side") === "right") return m;
  }
  return null;
}

function findMenuItemByText(root, text) {
  const items = root.querySelectorAll('[role="menuitemradio"], [role="menuitem"]');
  for (const el of items) {
    if (el.textContent.trim() === text) return el;
  }
  return null;
}

// ── Composer text + send ──

async function setPromptText(text) {
  const editor = await waitForElement("#prompt-textarea");
  editor.focus();
  await delay(50);
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);
  await delay(200);
}

async function clickSend() {
  // Send button only appears once text exists. Try the testid first,
  // then fall back to a button inside the form labelled "Send".
  const btn = await waitFor(() => {
    const byTestid = document.querySelector('[data-testid="send-button"]');
    if (byTestid) return byTestid;
    const form = document.querySelector("form");
    if (!form) return null;
    const candidates = form.querySelectorAll("button");
    for (const b of candidates) {
      const label = (b.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("send") && !label.includes("voice")) return b;
    }
    return null;
  }, 8000, "send button");
  fireClick(btn);
}

// ── Model picker ──

function getModelPill() {
  const form = document.querySelector("form");
  if (!form) return null;
  // Prefer the neutral composer pill that opens a popup menu.
  const pills = form.querySelectorAll(
    'button.__composer-pill.__composer-pill--neutral[aria-haspopup="menu"]'
  );
  // The model pill is typically the right-side one. If multiple, take the last.
  return pills[pills.length - 1] || form.querySelector("button.__composer-pill.__composer-pill--neutral");
}

async function openModelPicker() {
  const pill = await waitFor(getModelPill, 8000, "model picker pill");
  // If menu is already open, do nothing.
  if (pill.getAttribute("aria-expanded") === "true") return;
  fireClick(pill);
  await delay(200);
}

// Selects a model with a given thinking-effort by traversing into its submenu.
// modelTestid: 'model-switcher-gpt-5-5-thinking' | 'model-switcher-gpt-5-5-pro'
// effortTestid: '<modelTestid>-thinking-effort'
async function selectModelWithEffort(modelTestid, effortText) {
  await openModelPicker();

  const effortTrigger = await waitForElement(
    `[data-testid="${modelTestid}-thinking-effort"]`,
    5000
  );

  // The effort trigger is visibility:hidden until the parent row is hovered.
  // Synthesized pointer events still activate it even while visually hidden.
  fireClick(effortTrigger);

  const submenu = await waitFor(findOpenSubmenu, 5000, "effort submenu");

  const option = await waitFor(
    () => findMenuItemByText(submenu, effortText),
    5000,
    `submenu option "${effortText}"`
  );
  fireClick(option);
  await delay(300);
}

// ── Plus menu (Deep Research) ──

async function selectPlusMenuFeature(featureName) {
  const plusBtn = await waitForElement('[data-testid="composer-plus-btn"]');
  fireClick(plusBtn);
  await delay(200);

  const target = await waitFor(() => {
    const items = document.querySelectorAll(
      '[role="menuitemradio"], [role="menuitem"]'
    );
    for (const el of items) {
      if (el.textContent.trim() === featureName && el.offsetParent !== null) {
        return el;
      }
    }
    return null;
  }, 5000, `plus-menu item "${featureName}"`);

  fireClick(target);
  await delay(300);
}

// ── Flows ──

async function flowThinking(prompt, effort) {
  await waitForElement("#prompt-textarea");
  await selectModelWithEffort("model-switcher-gpt-5-5-thinking", effort);
  await setPromptText(prompt);
  await clickSend();
}

async function flowPro(prompt, effort) {
  await waitForElement("#prompt-textarea");
  await selectModelWithEffort("model-switcher-gpt-5-5-pro", effort);
  await setPromptText(prompt);
  await clickSend();
}

async function flowDeepResearch(prompt) {
  await waitForElement("#prompt-textarea");
  await selectPlusMenuFeature("Deep research");
  // DR auto-switches the model to Thinking; no further model selection needed.
  await setPromptText(prompt);
  await clickSend();
}

// ── Message handler ──

chrome.runtime.onMessage.addListener((message) => {
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
