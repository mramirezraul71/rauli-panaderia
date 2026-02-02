const STORAGE_KEYS = {
  tickets: "support_tickets",
  users: "support_users",
  notifications: "support_notifications",
  activity: "support_activity",
  installs: "support_installations",
  installId: "support_install_id",
  console: "support_console_logs"
};

let consoleInitialized = false;
let consoleBuffer = [];

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const emitUpdate = () => {
  try {
    window.dispatchEvent(new CustomEvent("support-updated"));
  } catch {}
};

const serializeArgs = (args) =>
  args.map((arg) => {
    if (typeof arg === "string") return arg;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }).join(" ");

export const SupportService = {
  initConsoleCapture() {
    if (consoleInitialized) return;
    consoleInitialized = true;
    const wrap = (level) => {
      const original = console[level];
      console[level] = (...args) => {
        try {
          const entry = {
            level,
            message: serializeArgs(args),
            timestamp: new Date().toISOString()
          };
          consoleBuffer = [...consoleBuffer, entry].slice(-50);
          writeJSON(STORAGE_KEYS.console, consoleBuffer);
          emitUpdate();
        } catch {}
        return original.apply(console, args);
      };
    };
    ["log", "warn", "error", "info"].forEach(wrap);
  },
  getRecentConsoleLogs(limit = 5) {
    const stored = readJSON(STORAGE_KEYS.console, []);
    const source = stored.length ? stored : consoleBuffer;
    return source.slice(-limit);
  },
  trackInstall() {
    const existing = localStorage.getItem(STORAGE_KEYS.installId);
    if (existing) return existing;
    const installId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(STORAGE_KEYS.installId, installId);
    const total = Number(localStorage.getItem(STORAGE_KEYS.installs) || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.installs, String(total));
    emitUpdate();
    return installId;
  },
  trackActivity() {
    const key = new Date().toISOString().slice(0, 10);
    const activity = readJSON(STORAGE_KEYS.activity, {});
    activity[key] = (activity[key] || 0) + 1;
    writeJSON(STORAGE_KEYS.activity, activity);
    emitUpdate();
  },
  upsertUser({ id, plan, device }) {
    if (!id) return;
    const users = readJSON(STORAGE_KEYS.users, []);
    const existing = users.find((u) => u.id === id);
    const payload = {
      id,
      plan: plan || "FREE",
      device: device || "",
      updated_at: new Date().toISOString()
    };
    if (existing) {
      Object.assign(existing, payload);
    } else {
      users.push({ ...payload, created_at: payload.updated_at });
    }
    writeJSON(STORAGE_KEYS.users, users);
    emitUpdate();
  },
  listUsers() {
    return readJSON(STORAGE_KEYS.users, []);
  },
  createTicket(ticket) {
    const tickets = readJSON(STORAGE_KEYS.tickets, []);
    tickets.unshift(ticket);
    writeJSON(STORAGE_KEYS.tickets, tickets);
    emitUpdate();
  },
  listTickets() {
    return readJSON(STORAGE_KEYS.tickets, []);
  },
  getTickets(userId) {
    const tickets = readJSON(STORAGE_KEYS.tickets, []);
    return userId ? tickets.filter(t => t.user_id === userId) : tickets;
  },
  updateTicket(id, data) {
    const tickets = readJSON(STORAGE_KEYS.tickets, []);
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx >= 0) {
      tickets[idx] = { ...tickets[idx], ...data, updated_at: new Date().toISOString() };
      writeJSON(STORAGE_KEYS.tickets, tickets);
      emitUpdate();
    }
  },
  addNotification(notification) {
    const notifications = readJSON(STORAGE_KEYS.notifications, []);
    notifications.unshift(notification);
    writeJSON(STORAGE_KEYS.notifications, notifications);
    emitUpdate();
  },
  listNotifications() {
    return readJSON(STORAGE_KEYS.notifications, []);
  },
  markNotificationRead(id) {
    const notifications = readJSON(STORAGE_KEYS.notifications, []);
    const idx = notifications.findIndex((n) => n.id === id);
    if (idx >= 0) {
      notifications[idx] = { ...notifications[idx], read: true };
      writeJSON(STORAGE_KEYS.notifications, notifications);
      emitUpdate();
    }
  }
};

export default SupportService;
