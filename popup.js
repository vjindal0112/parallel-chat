const CONFIG_MAP = {
  "thinking-standard": { model: "thinking", effort: "Standard" },
  "thinking-extended": { model: "thinking", effort: "Extended" },
  "pro-extended":      { model: "pro",      effort: "Extended" },
  "deep-research":     { model: "deep-research" },
};

document.getElementById("send-btn").addEventListener("click", () => {
  const prompt = document.getElementById("prompt").value.trim();
  if (!prompt) return;

  const checked = [...document.querySelectorAll(".configs input:checked")];
  if (checked.length === 0) return;

  const configs = checked.map(cb => ({
    id: cb.value,
    ...CONFIG_MAP[cb.value],
  }));

  const btn = document.getElementById("send-btn");
  const status = document.getElementById("status");
  btn.disabled = true;
  status.textContent = `Opening ${configs.length} tab(s)...`;

  chrome.runtime.sendMessage({ action: "launchAll", prompt, configs });

  // Close popup after a short delay to let the message send
  setTimeout(() => window.close(), 300);
});
