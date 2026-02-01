import { useEffect, useMemo, useRef, useState } from "react";
import SupportService from "../services/SupportService";
import { HiOutlineBell, HiOutlineX } from "react-icons/hi";
import { useAuth } from "../context/AuthContext";
import { runUpdateNow } from "./VersionChecker";

const SOUND_STORAGE_KEY = "support_notification_sound";

/** Genera un WAV corto (beep) para notificaciones — mismo método que RauliAssistant. */
function createNotificationBeep() {
  const sampleRate = 8000;
  const durationSeconds = 0.2;
  const frequency = 660;
  const volume = 0.25;
  const samples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const headerSize = 44;
  const buffer = new Uint8Array(headerSize + samples);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) buffer[off + i] = s.charCodeAt(i); };
  const writeU32 = (off, v) => { buffer[off] = v & 0xff; buffer[off + 1] = (v >> 8) & 0xff; buffer[off + 2] = (v >> 16) & 0xff; buffer[off + 3] = (v >> 24) & 0xff; };
  const writeU16 = (off, v) => { buffer[off] = v & 0xff; buffer[off + 1] = (v >> 8) & 0xff; };
  writeStr(0, "RIFF");
  writeU32(4, 36 + samples);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  writeU32(16, 16);
  writeU16(20, 1);
  writeU16(22, 1);
  writeU32(24, sampleRate);
  writeU32(28, sampleRate);
  writeU16(32, 1);
  writeU16(34, 8);
  writeStr(36, "data");
  writeU32(40, samples);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const s = Math.sin(2 * Math.PI * frequency * t);
    buffer[headerSize + i] = 128 + Math.round(127 * volume * s);
  }
  let binary = "";
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const NOTIFICATION_BEEP = createNotificationBeep();

function playNotificationSound() {
  try {
    if (localStorage.getItem(SOUND_STORAGE_KEY) === "false") return;
    const audio = new Audio(NOTIFICATION_BEEP);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (_) {}
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_STORAGE_KEY) !== "false");
  const prevUnreadRef = useRef(undefined);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    const refresh = () => setNotifications(SupportService.listNotifications());
    refresh();
    const handler = () => {
      const list = SupportService.listNotifications();
      const visible = list.filter(
        (n) => n.user_id === "all" || n.user_id === user?.id || n.user_id === "anon"
      );
      const unread = visible.filter((n) => !n.read).length;
      if (prevUnreadRef.current !== undefined && unread > prevUnreadRef.current) {
        playNotificationSound();
      }
      prevUnreadRef.current = unread;
      setNotifications(list);
    };
    window.addEventListener("support-updated", handler);
    const initial = SupportService.listNotifications();
    const visibleInit = initial.filter(
      (n) => n.user_id === "all" || n.user_id === user?.id || n.user_id === "anon"
    );
    prevUnreadRef.current = visibleInit.filter((n) => !n.read).length;
    return () => window.removeEventListener("support-updated", handler);
  }, [user?.id]);

  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (n) => n.user_id === "all" || n.user_id === user?.id || n.user_id === "anon"
      ),
    [notifications, user?.id]
  );

  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !n.read).length,
    [visibleNotifications]
  );

  const onBellClick = () => {
    if (!audioUnlockedRef.current && soundOn) {
      audioUnlockedRef.current = true;
      try {
        const a = new Audio(NOTIFICATION_BEEP);
        a.volume = 0;
        a.play().catch(() => {});
      } catch (_) {}
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="relative">
      <button
        onClick={onBellClick}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border bg-slate-800/60 text-slate-200 border-slate-700 hover:bg-slate-700/60"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${unreadCount > 0 ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
        Notificaciones
        <HiOutlineBell className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900/90 border border-slate-700 rounded-xl shadow-xl p-4 z-40 glass-panel">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold">Centro de notificaciones</h4>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <HiOutlineX className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 mb-3 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={soundOn}
              onChange={(e) => {
                const v = e.target.checked;
                setSoundOn(v);
                localStorage.setItem(SOUND_STORAGE_KEY, v ? "true" : "false");
              }}
              className="rounded border-slate-600 bg-slate-800 text-emerald-500"
            />
            Sonido al recibir notificaciones (PC)
          </label>
          <div className="space-y-2 max-h-80 overflow-auto">
            {visibleNotifications.length === 0 && (
              <div className="text-xs text-slate-500">Sin notificaciones.</div>
            )}
            {visibleNotifications.map((note) => (
              <div key={note.id} className={`p-3 rounded-lg border ${note.read && note.type !== "update" ? "bg-slate-800/50 border-slate-700" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-white">{note.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{note.message}</p>
                  </div>
                  {!note.read && note.type !== "update" && (
                    <button
                      onClick={() => SupportService.markNotificationRead(note.id)}
                      className="text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      Marcar leído
                    </button>
                  )}
                </div>
                {(note.type === "update" || note.id === "update-available") && (
                  <button
                    onClick={() => runUpdateNow()}
                    className="mt-2 w-full py-2 px-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg"
                  >
                    Actualizar ahora
                  </button>
                )}
                <p className="text-[11px] text-slate-500 mt-2">{note.created_at && new Date(note.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
