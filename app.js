const MONTHS = [
  "2025.9",
  "2025.10",
  "2025.11",
  "2025.12",
  "2026.1",
  "2026.2",
  "2026.3",
  "2026.4",
  "2026.5",
];

const STORAGE_KEY = "st-memory-chat-progress-v2";
const PIC_EXT = { "2026.5": "png" };

const el = {
  phone: document.querySelector("#phone"),
  intro: document.querySelector("#introScreen"),
  introContinue: document.querySelector("#introContinue"),
  desktop: document.querySelector("#desktopScreen"),
  app: document.querySelector("#appScreen"),
  desktopClock: document.querySelector("#desktopClock"),
  clock: document.querySelector("#clock"),
  backButton: document.querySelector("#backButton"),
  menuButton: document.querySelector("#menuButton"),
  recordMenu: document.querySelector("#recordMenu"),
  chatTitle: document.querySelector("#chatTitle"),
  typing: document.querySelector("#typing"),
  chatView: document.querySelector("#chatView"),
  galleryView: document.querySelector("#galleryView"),
  summaryView: document.querySelector("#summaryView"),
  chat: document.querySelector("#chat"),
  advance: document.querySelector("#advance"),
  advanceText: document.querySelector("#advanceText"),
  composer: document.querySelector(".composer"),
  galleryGrid: document.querySelector("#galleryGrid"),
  summaryList: document.querySelector("#summaryList"),
  modal: document.querySelector("#memoryModal"),
  memoryLabel: document.querySelector("#memoryLabel"),
  memoryTitle: document.querySelector("#memoryTitle"),
  memoryImage: document.querySelector("#memoryImage"),
  memoryText: document.querySelector("#memoryText"),
  memoryContinue: document.querySelector("#memoryContinue"),
  bgm: document.querySelector("#bgm"),
};

let chapters = [];
let fragments = new Map();
let beEvents = [];
let heEvents = [];
let mailAddress = "";
let mode = "normal";
let activeChapterIndex = 0;
let activeEvents = [];
let cursor = 0;
let typingLocked = false;
let modalAction = null;
let audioStarted = false;

const progress = loadProgress();

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      introSeen: Boolean(saved.introSeen),
      latestMonth: saved.latestMonth || MONTHS[0],
      unlockedMonths: Array.isArray(saved.unlockedMonths) ? saved.unlockedMonths : [],
      normalComplete: Boolean(saved.normalComplete),
      beComplete: Boolean(saved.beComplete),
      heComplete: Boolean(saved.heComplete),
    };
  } catch {
    return {
      introSeen: false,
      latestMonth: MONTHS[0],
      unlockedMonths: [],
      normalComplete: false,
      beComplete: false,
      heComplete: false,
    };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Progress persistence is optional; the app still works if storage is unavailable.
  }
}

function setHidden(node, hidden) {
  node.hidden = hidden;
}

function updateClock() {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
  el.clock.textContent = time;
  el.desktopClock.textContent = time;
}

function normalizeLine(line) {
  return line
    .replace(/\uFEFF/g, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .trim();
}

function monthFromText(text) {
  const match = text.match(/(\d{4})[.\-/年](\d{1,2})/);
  return match ? `${match[1]}.${Number(match[2])}` : "";
}

function dateWeight(text) {
  const match = text.match(/(\d{4})[.\-/年](\d{1,2})(?:[.\-/月](\d{1,2}))?/);
  if (!match) return 0;
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3] || 1);
}

function cleanMessageText(text) {
  return text
    .replace(/^[、,，:：\s]+/, "")
    .replace(/[（(]\s*消息未发出\s*[）)]/g, "")
    .replace("我也好像被抱抱", "我也好想被抱抱")
    .trim();
}

function isUnsentMessage(text, options = {}) {
  return Boolean(options.unsent || /消息未发出/.test(text));
}

function isRelativeTimeLine(line) {
  return /^\d+\s*(?:min|mins|minute|minutes|hour|hours)\s+lat(?:e|er)$/i.test(line);
}

function appendMessage(items, speaker, text, options = {}) {
  const cleanText = cleanMessageText(text);
  if (!cleanText) return;
  const unsent = isUnsentMessage(text, options);
  const last = items[items.length - 1];
  if (last && last.type === "message" && last.mergeNext && last.speaker === speaker) {
    last.text = cleanText;
    last.unsent = last.unsent || unsent;
    last.mergeNext = false;
    return;
  }
  items.push({
    type: "message",
    speaker,
    text: cleanText,
    unsent,
  });
}

function parseChatMarkdown(markdown, options = {}) {
  const logs = [];
  let log = null;
  let pendingSpeaker = "";
  const defaultSpeaker = options.defaultSpeaker || "";

  markdown.split(/\r?\n/).forEach((raw) => {
    const line = normalizeLine(raw);
    if (!line) return;

    if (line === "####") {
      pendingSpeaker = "";
      log = null;
      return;
    }

    const timeMatch = line.match(/^T\s*[:：]\s*(.+)$/i);
    if (timeMatch) {
      const text = timeMatch[1].trim();
      log = {
        date: text,
        month: monthFromText(text),
        weight: dateWeight(text),
        events: [{ type: "time", text }],
      };
      logs.push(log);
      pendingSpeaker = "";
      return;
    }

    if (!log) {
      log = { date: "", month: "", weight: 0, events: [] };
      logs.push(log);
    }

    if (isRelativeTimeLine(line)) {
      log.events.push({ type: "time", text: line });
      pendingSpeaker = "";
      return;
    }

    const speakerMatch = line.match(/^([AB])\s*[:：]\s*(.*)$/i);
    if (speakerMatch) {
      appendMessage(log.events, speakerMatch[1].toUpperCase(), speakerMatch[2], options);
      pendingSpeaker = "";
      return;
    }

    const noColonMatch = line.match(/^([AB])([^\w\s].+|[\u4e00-\u9fff].*)$/i);
    if (noColonMatch && !defaultSpeaker) {
      appendMessage(log.events, noColonMatch[1].toUpperCase(), noColonMatch[2], options);
      pendingSpeaker = "";
      return;
    }

    if (/^[AB]$/i.test(line) && !defaultSpeaker) {
      pendingSpeaker = line.toUpperCase();
      log.events.push({ type: "message", speaker: pendingSpeaker, text: "", mergeNext: true });
      return;
    }

    if (pendingSpeaker) {
      appendMessage(log.events, pendingSpeaker, line, options);
      pendingSpeaker = "";
      return;
    }

    appendMessage(log.events, defaultSpeaker || "A", line, options);
  });

  return logs.map((item) => ({
    ...item,
    events: item.events.filter((event) => event.type !== "message" || event.text),
  }));
}

function parseFragments(markdown) {
  const result = new Map();
  markdown.split("####").forEach((block) => {
    const lines = block
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter(Boolean);
    if (!lines.length) return;
    const timeLine = lines.find((line) => /^T\s*[:：]/i.test(line));
    if (!timeLine) return;
    const title = timeLine.replace(/^T\s*[:：]\s*/i, "");
    const body = lines.filter((line) => line !== timeLine);
    result.set(title, { title, body });
  });
  return result;
}

function buildChapters(logs) {
  return MONTHS.map((month) => {
    const events = logs
      .filter((log) => log.month === month)
      .flatMap((log) => log.events);
    return {
      id: month,
      title: month,
      events,
      image: `./pic/${month}.${PIC_EXT[month] || "webp"}`,
    };
  }).filter((chapter) => chapter.events.length);
}

function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  el.bgm.volume = 0.42;
  el.bgm.play().catch(() => {
    audioStarted = false;
  });
}

function showScreen(name) {
  setHidden(el.intro, name !== "intro");
  setHidden(el.desktop, name !== "desktop");
  setHidden(el.app, name !== "app");
  el.recordMenu.hidden = true;
}

function showView(name) {
  setHidden(el.chatView, name !== "chat");
  setHidden(el.galleryView, name !== "gallery");
  setHidden(el.summaryView, name !== "summary");
  el.menuButton.hidden = name !== "chat";
}

function applyBackground(kind) {
  el.phone.classList.toggle("past-bg", kind === "past");
  el.phone.classList.toggle("future-bg", kind === "future");
}

function setHeader(title, subtitle) {
  el.chatTitle.textContent = title;
  el.typing.textContent = subtitle;
}

function nextEventIsIncoming() {
  return activeEvents[cursor]?.type === "message" && activeEvents[cursor]?.speaker === "B";
}

function updateConversationStatus() {
  if (mode === "be") {
    el.typing.textContent = "最后一次上线：很久以前";
    return;
  }
  el.typing.textContent = nextEventIsIncoming() ? "正在输入中..." : "在线";
}

function showDesktop() {
  showScreen("desktop");
  applyBackground("past");
}

function showGallery() {
  showScreen("app");
  showView("gallery");
  setHeader("Pic", "记忆碎片");
  applyBackground("past");
  renderGallery();
}

function showSummary() {
  showScreen("app");
  showView("summary");
  setHeader("Summery", "记忆碎片");
  applyBackground("past");
  renderSummary();
}

function currentChapterIndex() {
  const saved = chapters.findIndex((chapter) => chapter.id === progress.latestMonth);
  return saved >= 0 ? saved : 0;
}

function showNormalChat(index = currentChapterIndex(), options = {}) {
  if (!chapters.length) return;
  mode = "normal";
  activeChapterIndex = Math.max(0, Math.min(index, chapters.length - 1));
  const chapter = chapters[activeChapterIndex];
  activeEvents = chapter.events;
  cursor = 0;
  showScreen("app");
  showView("chat");
  setHeader("123ST", "在线");
  applyBackground("past");
  el.chat.innerHTML = "";
  el.advance.disabled = false;
  el.advanceText.textContent = options.replayAll ? "已读完" : "轻触继续";
  el.advance.classList.add("ready");

  if (options.replayAll) {
    activeEvents.forEach((event) => renderEvent(event, { immediate: true }));
    el.advance.disabled = true;
    el.typing.textContent = "在线";
    return;
  }

  progress.latestMonth = chapter.id;
  saveProgress();
  updateConversationStatus();
}

function showEnding(kind) {
  mode = kind;
  activeEvents = kind === "be" ? beEvents : heEvents;
  cursor = 0;
  showScreen("app");
  showView("chat");
  applyBackground(kind === "he" ? "future" : "plain");
  setHeader(kind === "be" ? "夏？" : "夏", kind === "be" ? "最后一次上线：很久以前" : "在线");
  el.chat.innerHTML = "";
  el.advance.disabled = false;
  el.advanceText.textContent = "轻触继续";
  el.advance.classList.add("ready");
  updateConversationStatus();
}

function pulseChat() {
  el.chat.classList.remove("tap-pulse");
  void el.chat.offsetWidth;
  el.chat.classList.add("tap-pulse");
}

function scrollToEnd() {
  el.chat.scrollTo({ top: el.chat.scrollHeight, behavior: "smooth" });
}

function renderTypingBubble(side) {
  const row = document.createElement("div");
  row.className = `message ${side} typing-row`;
  row.innerHTML = `
    <div class="bubble">
      <span class="typing-dots" aria-label="正在输入">
        <i></i><i></i><i></i>
      </span>
    </div>
  `;
  el.chat.append(row);
  scrollToEnd();
  return row;
}

function renderEvent(item, options = {}) {
  if (item.type === "time") {
    const node = document.createElement("div");
    node.className = "time";
    node.textContent = item.text;
    el.chat.append(node);
    scrollToEnd();
    return;
  }

  const side = item.speaker === "B" ? "left" : "right";
  const addMessage = () => {
    const row = document.createElement("div");
    row.className = `message ${side}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = item.text;
    if (item.unsent) {
      const marker = document.createElement("span");
      marker.className = "unsent";
      marker.textContent = "!";
      row.append(marker);
    }
    row.append(bubble);
    el.chat.append(row);
    scrollToEnd();
  };

  if (options.immediate) {
    addMessage();
    return;
  }

  typingLocked = true;
  el.advance.disabled = true;
  el.advance.classList.remove("ready");
  updateConversationStatus();
  const typingRow = renderTypingBubble(side);
  window.setTimeout(() => {
    typingRow.remove();
    addMessage();
    typingLocked = false;
    el.advance.disabled = false;
    el.advance.classList.add("ready");
    updateConversationStatus();
  }, side === "left" ? 420 : 160);
}

function next() {
  if (typingLocked || el.modal.hidden === false || el.chatView.hidden) return;
  startAudio();
  pulseChat();

  if (cursor < activeEvents.length) {
    renderEvent(activeEvents[cursor]);
    cursor += 1;
    if (activeEvents[cursor - 1]?.type === "time") {
      updateConversationStatus();
    }
    if (cursor >= activeEvents.length) {
      window.setTimeout(handleChapterEnd, 360);
    }
    return;
  }

  handleChapterEnd();
}

function handleChapterEnd() {
  if (typingLocked) return;

  if (mode === "normal") {
    const chapter = chapters[activeChapterIndex];
    unlockMonth(chapter.id);
    showMemoryModal(chapter);
    return;
  }

  if (mode === "be") {
    progress.beComplete = true;
    saveProgress();
    showSimpleModal("未来篇", "梦醒之后，还会有另一个明天。", () => showEnding("he"));
    return;
  }

  if (mode === "he") {
    progress.heComplete = true;
    saveProgress();
    renderMailChoice();
  }
}

function unlockMonth(month) {
  if (!progress.unlockedMonths.includes(month)) {
    progress.unlockedMonths.push(month);
  }
  if (month === MONTHS[MONTHS.length - 1]) {
    progress.normalComplete = true;
  }
  saveProgress();
}

function showMemoryModal(chapter) {
  const fragment = fragments.get(chapter.id);
  el.memoryLabel.textContent = "记忆碎片已收集";
  el.memoryTitle.textContent = chapter.id;
  el.memoryImage.hidden = false;
  el.memoryImage.src = chapter.image;
  el.memoryImage.alt = `${chapter.id} 记忆配图`;
  el.memoryText.innerHTML = "";
  (fragment?.body || ["这段记忆已经被保存。"]).forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    el.memoryText.append(p);
  });
  modalAction = () => {
    if (activeChapterIndex + 1 < chapters.length) {
      showNormalChat(activeChapterIndex + 1);
    } else {
      showEnding("be");
    }
  };
  el.modal.hidden = false;
}

function showSimpleModal(title, text, action) {
  el.memoryLabel.textContent = "进度";
  el.memoryTitle.textContent = title;
  el.memoryImage.hidden = true;
  el.memoryText.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = text;
  el.memoryText.append(p);
  modalAction = action;
  el.modal.hidden = false;
}

function closeModal() {
  el.modal.hidden = true;
  const action = modalAction;
  modalAction = null;
  if (typeof action === "function") action();
}

function renderMailChoice() {
  if (document.querySelector(".mail-choice")) return;
  el.advance.disabled = true;
  el.advanceText.textContent = "已结束";
  const card = document.createElement("article");
  card.className = "mail-choice";
  card.innerHTML = `
    <p>如果可以的话，写点东西给我吧。</p>
    <a href="mailto:${mailAddress}?subject=给拾音的回信">唤醒发送邮件</a>
  `;
  el.chat.append(card);
  scrollToEnd();
}

function renderMenu() {
  el.recordMenu.innerHTML = "";
  const title = document.createElement("p");
  title.className = "record-title";
  title.textContent = "已阅读篇章";
  el.recordMenu.append(title);

  const months = progress.unlockedMonths.slice().sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  if (!months.length) {
    const empty = document.createElement("p");
    empty.className = "record-empty";
    empty.textContent = "还没有读完的篇章";
    el.recordMenu.append(empty);
  }

  months.forEach((month) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = month;
    button.addEventListener("click", () => {
      el.recordMenu.hidden = true;
      const index = chapters.findIndex((chapter) => chapter.id === month);
      showNormalChat(index, { replayAll: true });
    });
    el.recordMenu.append(button);
  });

  if (progress.beComplete) {
    const be = document.createElement("button");
    be.type = "button";
    be.textContent = "未来篇：假结局";
    be.addEventListener("click", () => {
      el.recordMenu.hidden = true;
      showEnding("be");
    });
    el.recordMenu.append(be);
  }

  if (progress.heComplete) {
    const he = document.createElement("button");
    he.type = "button";
    he.textContent = "未来篇：真结局";
    he.addEventListener("click", () => {
      el.recordMenu.hidden = true;
      showEnding("he");
    });
    el.recordMenu.append(he);
  }
}

function renderGallery() {
  el.galleryGrid.innerHTML = "";
  MONTHS.forEach((month) => {
    const unlocked = progress.unlockedMonths.includes(month);
    const card = document.createElement("article");
    card.className = `memory-tile ${unlocked ? "" : "locked"}`;
    if (unlocked) {
      card.innerHTML = `
        <img src="./pic/${month}.${PIC_EXT[month] || "webp"}" alt="${month} 记忆配图" />
        <strong>${month}</strong>
      `;
    } else {
      card.innerHTML = `<span></span><strong>${month}</strong><p>未收集</p>`;
    }
    el.galleryGrid.append(card);
  });
}

function renderSummary() {
  el.summaryList.innerHTML = "";
  const months = progress.unlockedMonths.slice().sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  if (!months.length) {
    el.summaryList.innerHTML = '<p class="empty-state">还没有收集到记忆碎片。</p>';
    return;
  }

  months.forEach((month) => {
    const fragment = fragments.get(month);
    const item = document.createElement("article");
    item.className = "summary-card";
    const paragraphs = (fragment?.body || []).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
    item.innerHTML = `<h3>${month}</h3>${paragraphs}`;
    el.summaryList.append(item);
  });
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

async function loadText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cannot load ${path}`);
  return response.text();
}

async function initData() {
  const [normalMd, fragmentMd, beMd, heMd] = await Promise.all([
    loadText("./for.md"),
    loadText("./To.md"),
    loadText("./be.md"),
    loadText("./he.md"),
  ]);
  chapters = buildChapters(parseChatMarkdown(normalMd));
  fragments = parseFragments(fragmentMd);
  beEvents = parseChatMarkdown(beMd, { defaultSpeaker: "A", unsent: true }).flatMap((log) => log.events);
  heEvents = parseChatMarkdown(heMd, { defaultSpeaker: "A" })
    .flatMap((log) => log.events)
    .filter((event) => !(event.type === "message" && event.text.includes("mailto")));
  const mailMatch = heMd.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  mailAddress = mailMatch ? mailMatch[0] : "heronesukun@foxmail.com";
}

function bindEvents() {
  el.introContinue.addEventListener("click", () => {
    startAudio();
    progress.introSeen = true;
    saveProgress();
    showNormalChat(currentChapterIndex());
  });

  el.desktop.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    startAudio();
    if (button.dataset.view === "chat") {
      showNormalChat(currentChapterIndex());
    } else if (button.dataset.view === "gallery") {
      showGallery();
    } else if (button.dataset.view === "summary") {
      showSummary();
    }
  });

  el.backButton.addEventListener("click", showDesktop);
  el.advance.addEventListener("click", next);
  el.chat.addEventListener("click", next);
  el.memoryContinue.addEventListener("click", closeModal);
  el.menuButton.addEventListener("click", () => {
    renderMenu();
    el.recordMenu.hidden = !el.recordMenu.hidden;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!el.modal.hidden) {
      closeModal();
      return;
    }
    next();
  });
}

async function init() {
  updateClock();
  window.setInterval(updateClock, 15000);
  bindEvents();

  try {
    await initData();
    if (progress.introSeen) {
      showDesktop();
    } else {
      showScreen("intro");
      applyBackground("plain");
    }
  } catch {
    showScreen("app");
    showView("chat");
    el.chat.innerHTML = '<p class="error">数据读取失败，请确认 md 文件和资源目录存在。</p>';
    el.advance.disabled = true;
  }
}

init();
