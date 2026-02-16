const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const toggleThemeBtn = document.getElementById("toggleThemeBtn");

// ✅ Correct endpoint (public, no API key)
const BACKEND_URL =
  "https://sh-backend-api-production-5b7e.up.railway.app/api/public/chat";


const STORAGE_KEY = "sh_assistant_chat_v2";
const THEME_KEY = "sh_assistant_theme_v1";

// --------------------
// Theme (migraine friendly)
// --------------------
function applyTheme(theme) {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  localStorage.setItem(THEME_KEY, theme);
}
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

toggleThemeBtn.addEventListener("click", () => {
  const cur = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
});

// --------------------
// Utilities
// --------------------
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function autoResize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
}

// Map language names to Prism classes
function normalizeLang(lang) {
  const l = (lang || "").toLowerCase().trim();
  if (!l) return "plaintext";
  if (l === "js") return "javascript";
  if (l === "ts") return "typescript";
  if (l === "html") return "markup";
  if (l === "sh" || l === "shell") return "bash";
  return l;
}

// Convert assistant text into HTML with:
// - fenced code blocks ```lang ...```
// - inline `code`
// - line breaks
function renderAssistant(text) {
  const raw = String(text || "");
  const parts = raw.split(/```/);
  let html = "";

  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];

    if (i % 2 === 0) {
      let safe = escapeHtml(chunk);
      safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
      safe = safe.replace(/\n/g, "<br>");
      html += safe;
    } else {
      const firstNewline = chunk.indexOf("\n");
      let lang = "";
      let code = chunk;

      if (firstNewline !== -1) {
        lang = chunk.slice(0, firstNewline).trim();
        code = chunk.slice(firstNewline + 1);
      }

      const prismLang = normalizeLang(lang);
      const label = prismLang === "plaintext" ? "code" : prismLang;

      html += `
        <div class="codewrap">
          <div class="codebar">
            <div class="lang">${escapeHtml(label)}</div>
            <button class="copy" type="button">Copy</button>
          </div>
          <pre class="language-${escapeHtml(prismLang)}"><code class="language-${escapeHtml(prismLang)}">${escapeHtml(code)}</code></pre>
        </div>
      `;
    }
  }

  return html.trim();
}

function addMessage({ role, content }) {
  const isUser = role === "user";

  const row = document.createElement("div");
  row.className = `msg ${isUser ? "user" : "bot"}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = isUser ? "Y" : "SH";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = isUser ? "You" : "SH Assistant";

  const body = document.createElement("div");
  body.className = "body";

  if (isUser) {
    body.innerHTML = escapeHtml(content).replace(/\n/g, "<br>");
  } else {
    body.innerHTML = renderAssistant(content);
  }

  bubble.appendChild(meta);
  bubble.appendChild(body);

  if (!isUser) row.appendChild(avatar);
  row.appendChild(bubble);

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  // Syntax highlight just-added blocks
  if (!isUser && window.Prism) Prism.highlightAllUnder(bubble);

  saveChat();
}

function saveChat() {
  localStorage.setItem(STORAGE_KEY, chat.innerHTML);
}
function loadChat() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) chat.innerHTML = saved;
  chat.scrollTop = chat.scrollHeight;
  if (window.Prism) Prism.highlightAllUnder(chat);
}
loadChat();

// Copy buttons (event delegation)
chat.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy");
  if (!btn) return;

  const wrap = btn.closest(".codewrap");
  const code = wrap?.querySelector("pre code")?.innerText || "";

  try {
    await navigator.clipboard.writeText(code);
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = "Copy"), 1200);
  } catch {
    btn.textContent = "Failed";
    setTimeout(() => (btn.textContent = "Copy"), 1200);
  }
});

// Clear chat
clearBtn.addEventListener("click", () => {
  chat.innerHTML = "";
  localStorage.removeItem(STORAGE_KEY);
});

// --------------------
// Send
// --------------------
async function send() {
  const text = input.value.trim();
  if (!text) return;

  sendBtn.disabled = true;
  addMessage({ role: "user", content: text });

  input.value = "";
  autoResize();

  const thinkingId = `thinking-${Date.now()}`;
  addMessage({ role: "assistant", content: "_Thinking…_" });

  const last = chat.lastElementChild;
  if (last) last.id = thinkingId;

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json().catch(() => ({}));
    const reply = data.reply || data.message || data.error || "No response returned.";

    const thinkingRow = document.getElementById(thinkingId);
    if (thinkingRow) thinkingRow.remove();

    addMessage({ role: "assistant", content: reply });
  } catch (err) {
    const thinkingRow = document.getElementById(thinkingId);
    if (thinkingRow) thinkingRow.remove();
    addMessage({ role: "assistant", content: "❌ Network error contacting backend." });
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn.addEventListener("click", send);
input.addEventListener("input", autoResize);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

autoResize();
