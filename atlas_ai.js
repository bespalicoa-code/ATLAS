(() => {
  "use strict";

  if (window.ATLAS_AI_LOADED) return;
  window.ATLAS_AI_LOADED = true;

  const API_URL = "/api/ai";
  const STORAGE_KEY = "atlas-ai-chat-v2";

  let history = [];
  let busy = false;

  try {
    const saved = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (Array.isArray(saved)) {
      history = saved
        .filter(
          item =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
        )
        .slice(-20);
    }
  } catch (_) {}

  const style = document.createElement("style");

  style.textContent = `
    #atlasAI {
      --atlas-primary: #635bdb;
      --atlas-bg: #f5f7fc;
      --atlas-text: #20243a;
      --atlas-border: #e5e8f1;
      color: var(--atlas-text);
      font-family: Inter, system-ui, sans-serif;
      width: 100%;
    }

    #atlasAI * {
      box-sizing: border-box;
    }

    #atlasAI .atlas-shell {
      max-width: 1050px;
      margin: 20px auto;
      border: 1px solid var(--atlas-border);
      border-radius: 20px;
      overflow: hidden;
      background: white;
      box-shadow: 0 12px 40px rgba(30, 40, 80, .08);
    }

    #atlasAI .atlas-header {
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      background: linear-gradient(120deg, #5148c9, #8276ef);
      color: white;
    }

    #atlasAI .atlas-avatar {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: rgba(255,255,255,.2);
      font-size: 25px;
    }

    #atlasAI .atlas-header h2 {
      margin: 0;
      font-size: 19px;
    }

    #atlasAI .atlas-header p {
      margin: 5px 0 0;
      font-size: 12px;
      opacity: .9;
    }

    #atlasAI .atlas-status {
      margin-left: auto;
      font-size: 11px;
      white-space: nowrap;
    }

    #atlasAI .atlas-shortcuts {
      display: flex;
      gap: 8px;
      padding: 14px;
      overflow-x: auto;
      border-bottom: 1px solid var(--atlas-border);
    }

    #atlasAI .atlas-chip {
      flex: 0 0 auto;
      padding: 9px 12px;
      border: 1px solid var(--atlas-border);
      border-radius: 10px;
      background: white;
      color: var(--atlas-text);
      cursor: pointer;
      font-size: 12px;
    }

    #atlasAI .atlas-chip:hover {
      border-color: var(--atlas-primary);
      color: var(--atlas-primary);
    }

    #atlasAI .atlas-messages {
      height: min(55vh, 520px);
      min-height: 300px;
      overflow-y: auto;
      padding: 20px;
      background: var(--atlas-bg);
    }

    #atlasAI .atlas-message {
      display: flex;
      margin-bottom: 18px;
    }

    #atlasAI .atlas-message.user {
      justify-content: flex-end;
    }

    #atlasAI .atlas-bubble {
      max-width: 88%;
      padding: 13px 16px;
      border-radius: 15px;
      font-size: 14px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    #atlasAI .atlas-message.assistant .atlas-bubble {
      background: white;
      border: 1px solid var(--atlas-border);
      border-top-left-radius: 4px;
    }

    #atlasAI .atlas-message.user .atlas-bubble {
      background: var(--atlas-primary);
      color: white;
      border-top-right-radius: 4px;
      white-space: pre-wrap;
    }

    #atlasAI .atlas-bubble p {
      margin: 0 0 10px;
    }

    #atlasAI .atlas-bubble p:last-child {
      margin-bottom: 0;
    }

    #atlasAI .atlas-bubble ul {
      padding-left: 22px;
    }

    #atlasAI .atlas-bubble pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    #atlasAI .atlas-composer {
      padding: 16px;
      background: white;
      border-top: 1px solid var(--atlas-border);
    }

    #atlasAI .atlas-input-row {
      display: flex;
      gap: 10px;
      align-items: flex-end;
    }

    #atlasAI .atlas-input {
      flex: 1;
      min-width: 0;
      resize: vertical;
      min-height: 48px;
      max-height: 160px;
      border: 1px solid var(--atlas-border);
      border-radius: 13px;
      padding: 13px;
      outline: none;
      font: inherit;
      font-size: 14px;
      color: var(--atlas-text);
      background: white;
    }

    #atlasAI .atlas-input:focus {
      border-color: var(--atlas-primary);
      box-shadow: 0 0 0 3px rgba(99,91,219,.1);
    }

    #atlasAI .atlas-send {
      border: 0;
      border-radius: 12px;
      padding: 14px 18px;
      background: var(--atlas-primary);
      color: white;
      font-weight: 700;
      cursor: pointer;
    }

    #atlasAI .atlas-send:disabled {
      opacity: .5;
      cursor: wait;
    }

    #atlasAI .atlas-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 10px;
      font-size: 11px;
      color: #777d91;
    }

    #atlasAI .atlas-clear {
      border: 0;
      background: none;
      color: var(--atlas-primary);
      cursor: pointer;
    }

    #atlasAI .atlas-error {
      color: #b42318;
    }

    @media(max-width:600px) {
      #atlasAI .atlas-shell {
        margin: 8px auto;
        border-radius: 14px;
      }

      #atlasAI .atlas-messages {
        height: 55vh;
        padding: 13px;
      }

      #atlasAI .atlas-bubble {
        max-width: 95%;
      }

      #atlasAI .atlas-status {
        display: none;
      }

      #atlasAI .atlas-send {
        padding: 14px;
      }
    }
  `;

  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "atlasAI";

  root.innerHTML = `
    <div class="atlas-shell">
      <header class="atlas-header">
        <div class="atlas-avatar">✦</div>
        <div>
          <h2>ATLAS AI</h2>
          <p>Asistentul tău inteligent</p>
        </div>
        <div class="atlas-status">● Asistent online</div>
      </header>

      <div class="atlas-shortcuts">
        <button class="atlas-chip" data-prompt="Creează un test grilă de geografie despre Europa, cu 10 întrebări și explicații.">🌍 Creează un test</button>
        <button class="atlas-chip" data-prompt="Propune o lecție de geografie interactivă pentru gimnaziu.">📚 Planifică o lecție</button>
        <button class="atlas-chip" data-prompt="Propune cinci activități pentru recapitularea geografiei.">💡 Idei de activități</button>
        <button class="atlas-chip" data-prompt="Ajută-mă să îmbunătățesc platforma ATLAS.">⚙️ Îmbunătățește ATLAS</button>
      </div>

      <div class="atlas-messages" id="atlasMessages" aria-live="polite"></div>

      <div class="atlas-composer">
        <div class="atlas-input-row">
          <textarea
            class="atlas-input"
            id="atlasInput"
            rows="1"
            maxlength="5000"
            placeholder="Scrie o întrebare sau o comandă..."
            aria-label="Mesaj pentru ATLAS AI"
          ></textarea>
          <button class="atlas-send" id="atlasSend">Trimite ➤</button>
        </div>
        <div class="atlas-footer">
          <span>ATLAS AI · Verifică informațiile importante.</span>
          <button class="atlas-clear" id="atlasClear">Conversație nouă</button>
        </div>
      </div>
    </div>
  `;

  function mount() {
    if (document.getElementById("atlasAI")) return;

    const existingPage = document.getElementById("aiPage");

    if (existingPage) {
      existingPage.innerHTML = "";
      existingPage.appendChild(root);
      existingPage.classList.remove("hidden");
      return;
    }

    document.body.appendChild(root);
  }

  mount();

  const messagesEl = root.querySelector("#atlasMessages");
  const input = root.querySelector("#atlasInput");
  const send = root.querySelector("#atlasSend");

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  // Formatare limitată și sigură: nu permite HTML primit de la AI.
  function formatText(text) {
    const safe = escapeHTML(text);

    return safe
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^### (.+)$/gm, "<strong>$1</strong>")
      .replace(/^- (.+)$/gm, "• $1")
      .replace(/\n/g, "<br>");
  }

  function renderMessage(role, content) {
    const row = document.createElement("div");
    row.className = `atlas-message ${role}`;

    const bubble = document.createElement("div");
    bubble.className = "atlas-bubble";

    if (role === "assistant") {
      bubble.innerHTML = formatText(content);
    } else {
      bubble.textContent = content;
    }

    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    return row;
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history.slice(-20))
      );
    } catch (_) {}
  }

  function renderWelcome() {
    messagesEl.innerHTML = "";

    renderMessage(
      "assistant",
      "Salut! Sunt ATLAS AI. 🌍\n\n" +
      "Te pot ajuta cu geografia, lecțiile, testele, ideile didactice " +
      "și utilizarea platformei. Scrie-mi ce dorești să facem!"
    );

    history.forEach(item => {
      renderMessage(item.role, item.content);
    });
  }

  async function sendMessage(text) {
    if (busy) return;

    const message = String(text || "").trim();

    if (!message) return;

    busy = true;
    send.disabled = true;
    input.disabled = true;

    renderMessage("user", message);

    const previousHistory = history.slice(-12);

    history.push({
      role: "user",
      content: message
    });

    const loading = renderMessage("assistant", "Se generează răspunsul…");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          history: previousHistory
        })
      });

      let data;

      try {
        data = await response.json();
      } catch (_) {
        throw new Error("Serverul a returnat un răspuns invalid.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Serviciul AI a întâmpinat o eroare.");
      }

      if (typeof data.text !== "string" || !data.text.trim()) {
        throw new Error("AI-ul nu a returnat un răspuns.");
      }

      const answer = data.text.trim();

      loading.remove();
      renderMessage("assistant", answer);

      history.push({
        role: "assistant",
        content: answer
      });

      history = history.slice(-20);
      saveHistory();
    } catch (error) {
      loading.remove();

      renderMessage(
        "assistant",
        "Nu am putut obține răspunsul. " +
        (error.message || "Verifică conexiunea și configurarea serverului.")
      );
    } finally {
      busy = false;
      send.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  send.addEventListener("click", () => {
    const text = input.value.trim();

    if (!text) return;

    input.value = "";
    sendMessage(text);
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send.click();
    }
  });

  root.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      sendMessage(button.dataset.prompt);
    });
  });

  root.querySelector("#atlasClear").addEventListener("click", () => {
    history = [];

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}

    renderWelcome();
    input.focus();
  });

  renderWelcome();

  // API public pentru integrarea ulterioară cu aplicația ATLAS.
  window.ATLASAI = {
    send: sendMessage,

    clear() {
      history = [];
      saveHistory();
      renderWelcome();
    },

    getHistory() {
      return history.map(item => ({ ...item }));
    }
  };
})();
