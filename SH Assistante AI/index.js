// ===============================
// DOM
// ===============================
const input = document.getElementById("msg");
const chat = document.getElementById("chat");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const STORAGE_KEY = "sh_chat_history_v1";

// ===============================
// HTML safety
// ===============================
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================
// Format assistant output (ChatGPT-like)
// - triple backticks -> code block
// - inline `code`
// ===============================
function formatReply(text) {
  const raw = String(text || "");
  const parts = raw.split(/```/);
  let html = "";

  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];

    if (i % 2 === 0) {
      let safeText = escapeHtml(chunk);
      safeText = safeText.replace(/`([^`]+)`/g, "<code>$1</code>");
      safeText = safeText.replace(/\n/g, "<br>");
      html += safeText;
    } else {
      const firstNewline = chunk.indexOf("\n");
      let lang = "";
      let code = chunk;

      if (firstNewline !== -1) {
        lang = chunk.slice(0, firstNewline).trim();
        code = chunk.slice(firstNewline + 1);
      }

      // Wrap code in a container so we can add a Copy button
      html += `
        <div class="code-wrap">
          <button class="copy-btn" type="button">Copy</button>
          <pre><code${lang ? ` data-lang="${escapeHtml(lang)}"` : ""}>${escapeHtml(code)}</code></pre>
        </div>
      `;
    }
  }

  return html.trim();
}

// ===============================
// Render messages
// ===============================
function addUser(text) {
  chat.innerHTML += `
    <div class="user">
      <strong>You</strong><br>${escapeHtml(text)}
    </div>
  `;
  chat.scrollTop = chat.scrollHeight;
}

function addBot(text) {
  chat.innerHTML += `
    <div class="bot">
      <strong>🤖 SH Assistant</strong><br>${formatReply(text)}
    </div>
  `;
  chat.scrollTop = chat.scrollHeight;
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, chat.innerHTML);
}

function loadHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) chat.innerHTML = saved;
  chat.scrollTop = chat.scrollHeight;
}

// ===============================
// Input autosize
// ===============================
function autoResize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
}

// ===============================
// Send message
// ===============================
async function send() {
  const text = input.value.trim();
  if (!text) return;

  sendBtn.disabled = true;
  addUser(text);
  input.value = "";
  autoResize();

  const thinking = document.createElement("div");
  thinking.className = "bot";
  thinking.innerHTML = `<strong>🤖 SH Assistant</strong><br><em>Thinking…</em>`;
  chat.appendChild(thinking);
  chat.scrollTop = chat.scrollHeight;

  try {
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json().catch(() => ({}));
    thinking.remove();

    if (!res.ok) {
      addBot(`❌ Error: ${data?.error || "Request failed"}`);
      saveHistory();
      sendBtn.disabled = false;
      return;
    }

    addBot(data.reply || "No response returned.");
    saveHistory();
  } catch (err) {
    thinking.remove();
    addBot("❌ Network error contacting server.");
    saveHistory();
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

// ===============================
// Copy button handling (event delegation)
// ===============================
chat.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;

  const wrap = btn.closest(".code-wrap");
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

// ===============================
// Clear chat
// ===============================
clearBtn.addEventListener("click", () => {
  chat.innerHTML = "";
  localStorage.removeItem(STORAGE_KEY);
});

// ===============================
// Events
// ===============================
sendBtn.addEventListener("click", send);

input.addEventListener("input", autoResize);

input.addEventListener("keydown", (e) => {
  // Enter sends, Shift+Enter new line
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

// Load saved chat on startup
loadHistory();
autoResize();
