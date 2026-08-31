/**
 * StaffChat.js — Sam Cafe Admin Panel — Staff Interactions / Chat
 * ─────────────────────────────────────────────────────────────
 * Left sidebar: every other staff member at the caller's own venue
 * (Super Admin sees the venue currently selected in the topbar
 * switcher), with a last-message preview + unread badge. Selecting
 * one opens a 1:1 thread with:
 *   - text input
 *   - file attach (any file, <2MB)
 *   - voice recorder (MediaRecorder → audio message)
 *   - camera (photo snap or short video recording)
 *   - tick-mark delivery/read status (sent / delivered / seen)
 * Topbar: share / download / select-mode toggles, plus a "more
 * options" (⋮) dropdown — Info, Export Chat, Clear Chat.
 *
 * Self-fetching page — talks to /chat/* directly rather than routing
 * through the app-wide adminData bag, since conversations are a
 * personal, high-frequency data stream that doesn't belong in the
 * shared business-data cache.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

import api from "../../api";
import socket from "../../socket";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { getAvatarColor } from "../../utils/avatarColor";
import { fmtDateTime } from "../../utils/dateUtils";
import { exportToExcel } from "../../utils/excelUtils";
import Button3D from "../../components/Button3D";
import CustomDropdown from "../../components/CustomDropdown";
import "./StaffChat.css";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function timeOnly(iso) {
  const parts = fmtDateTime(iso).split(",");
  return parts[1]?.trim() || "";
}

function describeMessage(m) {
  if (!m) return "";
  if (m.type === "text") return m.text;
  if (m.type === "file") return `📎 ${m.fileName || "a file"}`;
  if (m.type === "image") return "📷 Photo";
  if (m.type === "video") return "🎥 Video";
  if (m.type === "audio") return "🎤 Voice message";
  return m.type;
}

/* ── Icons (inline SVG — no matching assets exist in src/icon) ───────── */
const IconSend = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.5 21l19-9-19-9v7l14 2-14 2z" /></svg>
);
const IconAttach = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.4 11.2l-8.9 8.9a5 5 0 01-7.1-7.1l8.5-8.5a3.5 3.5 0 014.9 4.9L9.7 17.5a2 2 0 01-2.9-2.9l7.6-7.6" /></svg>
);
const IconMic = ({ active }) => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill={active ? "#e74c3c" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v4" /></svg>
);
const IconCamera = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
);
const IconClip = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.4 11.2l-8.9 8.9a5 5 0 01-7.1-7.1l8.5-8.5a3.5 3.5 0 014.9 4.9L9.7 17.5a2 2 0 01-2.9-2.9l7.6-7.6" /></svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
const IconInfo = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
);
const IconShare = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.6l6.8-3.8M8.6 13.4l6.8 3.8" /></svg>
);
const IconDownload = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>
);
const IconCheckSquare = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
);
const IconBack = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
);
const IconClose = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
);
const IconZoomIn = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" /></svg>
);
const IconZoomOut = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M8 11h6" /></svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 8.4-8 11-4.6-2.6-8-6-8-11V5l8-3z" /></svg>
);

/** Tick-mark status: none (still sending) / sent / delivered / seen. */
function TickStatus({ message }) {
  if (message.readAt) {
    return (
      <span className="chat-tick chat-tick-seen" title={`Seen ${timeOnly(message.readAt)}`}>
        <svg viewBox="0 0 20 12" width="16" height="10" fill="none"><path d="M1 6l3.5 3.5L11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 6l3.5 3.5L19 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    );
  }
  if (message.deliveredAt) {
    return (
      <span className="chat-tick chat-tick-delivered" title={`Delivered ${timeOnly(message.deliveredAt)}`}>
        <svg viewBox="0 0 20 12" width="16" height="10" fill="none"><path d="M1 6l3.5 3.5L11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 6l3.5 3.5L19 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    );
  }
  return (
    <span className="chat-tick chat-tick-sent" title="Sent">
      <svg viewBox="0 0 14 12" width="12" height="10" fill="none"><path d="M1 6l3.5 3.5L13 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export default function StaffChat() {
  const { admin, isSuperAdmin: viewerIsSuperAdmin } = useAuth();
  const { venueId: topbarVenueId, isSuperAdmin } = useVenue();
  const { toast } = useToast();

  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [topbarMenuChoice, setTopbarMenuChoice] = useState(""); // CustomDropdown's controlled value for the "more options" menu — see handleTopbarMenuChoice
  const [recording, setRecording] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState("photo"); // "photo" | "video"
  const [videoRecording, setVideoRecording] = useState(false);

  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessages, setInfoMessages] = useState([]); // messages shown in the info panel (whole thread or one selected message)
  const [mediaViewer, setMediaViewer] = useState(null); // the message being viewed full-screen
  const [zoom, setZoom] = useState(1);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState([]);
  const [sharePanel, setSharePanel] = useState(null); // "selection" | message obj | null

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const mediaStageRef = useRef(null);

  const selectedStaff = useMemo(
    () => staffList.find((s) => s.id === selectedId) || null,
    [staffList, selectedId]
  );

  // Super Admin messages are one-way: a Super Admin can message any
  // staff member, but staff can't reply back to a Super Admin. The
  // real enforcement lives server-side (POST /chat/:staffId rejects
  // it) — this just drives the UI so staff see why the input is gone
  // instead of getting a silent failure.
  const canReply = viewerIsSuperAdmin || !selectedStaff || selectedStaff.roleGroup !== "Super Admin";

  /* ── Load sidebar staff list (Super Admin: scoped to topbar venue) ── */
  const loadStaffList = useCallback(async () => {
    try {
      const params = isSuperAdmin && topbarVenueId ? { venueId: topbarVenueId } : {};
      const res = await api.get("/chat/staff", { params });
      setStaffList(res.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load staff list");
    } finally {
      setLoadingStaff(false);
    }
  }, [toast, isSuperAdmin, topbarVenueId]);

  useEffect(() => {
    loadStaffList();
  }, [loadStaffList]);

  // Super Admin switched venues in the topbar — the currently open
  // conversation may no longer belong to that venue, so drop back to
  // the placeholder rather than showing a stale thread.
  useEffect(() => {
    if (isSuperAdmin) setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topbarVenueId]);

  /* ── Socket: register this admin, listen for live events ────────── */
  useEffect(() => {
    if (!admin?.id) return undefined;
    socket.emit("chat:register", { adminId: admin.id });

    const handleMessage = (msg) => {
      const otherId = msg.fromId === admin.id ? msg.toId : msg.fromId;
      const isOpenThread = otherId === selectedId;

      setMessages((prev) => {
        if (isOpenThread && !prev.some((m) => m.id === msg.id)) return [...prev, msg];
        return prev;
      });

      // Notify the RECEIVER only, and only when they're not already
      // looking at that exact thread — a permanent (no-timer) toast per
      // requirement, dismissed by the × button.
      if (msg.fromId !== admin.id && !isOpenThread) {
        const fromName = staffList.find((s) => s.id === msg.fromId)?.name || "A staff member";
        toast.info(`💬 New message from ${fromName}: ${describeMessage(msg)}`, "permanent");
      }
      if (isOpenThread && msg.fromId !== admin.id) {
        api.patch(`/chat/${msg.fromId}/read`).catch(() => { });
      }

      loadStaffList();
    };

    const handleCleared = ({ roomId, scope }) => {
      if (selectedId) {
        const myRoom = [admin.id, selectedId].sort().join("__");
        if (roomId === myRoom) {
          setMessages([]);
          if (scope === "everyone") toast.info("The other participant cleared this conversation for everyone", "permanent");
        }
      }
      loadStaffList();
    };

    const handleDelivered = ({ toId, messageIds }) => {
      setMessages((prev) =>
        prev.map((m) => (messageIds.includes(m.id) ? { ...m, deliveredAt: new Date().toISOString() } : m))
      );
    };

    const handleRead = ({ messageIds, readAt }) => {
      setMessages((prev) =>
        prev.map((m) => (messageIds.includes(m.id) ? { ...m, readAt, deliveredAt: m.deliveredAt || readAt } : m))
      );
    };

    // Fires once at midnight when the server purges everything from
    // before today (see chat.js's scheduleMidnightChatPurge) — clear
    // the open thread and refresh the sidebar previews so nobody's
    // looking at messages that no longer exist server-side.
    const handlePurged = () => {
      setMessages([]);
      loadStaffList();
    };

    socket.on("chat:message", handleMessage);
    socket.on("chat:cleared", handleCleared);
    socket.on("chat:delivered", handleDelivered);
    socket.on("chat:read", handleRead);
    socket.on("chat:purged", handlePurged);
    return () => {
      socket.off("chat:message", handleMessage);
      socket.off("chat:cleared", handleCleared);
      socket.off("chat:delivered", handleDelivered);
      socket.off("chat:read", handleRead);
      socket.off("chat:purged", handlePurged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id, selectedId, staffList]);

  /* ── Load a thread when a staff member is selected ───────────── */
  useEffect(() => {
    if (!selectedId) return;
    setLoadingThread(true);
    setSelectMode(false);
    setSelectedMsgIds([]);
    api
      .get(`/chat/${selectedId}`)
      .then((res) => setMessages(res.data || []))
      .catch((err) => toast.error(err?.response?.data?.error || "Failed to load conversation"))
      .finally(() => setLoadingThread(false));
    api.patch(`/chat/${selectedId}/read`).then(() => loadStaffList()).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Send helpers ─────────────────────────────────────────────── */
  const sendPayload = useCallback(
    async (payload, toIdOverride) => {
      const toId = toIdOverride || selectedId;
      if (!toId) return;
      setSending(true);
      try {
        const res = await api.post(`/chat/${toId}`, payload);
        // Rely solely on the chat:message socket echo to append the
        // message (server emits it back to the sender too) — appending
        // it here AND via the echo was producing duplicate bubbles.
        loadStaffList();
        return res.data;
      } catch (err) {
        toast.error(err?.response?.data?.error || "Failed to send message");
        return null;
      } finally {
        setSending(false);
      }
    },
    [selectedId, toast, loadStaffList]
  );

  const handleSendText = (e) => {
    e.preventDefault();
    if (!canReply) return;
    const value = text.trim();
    if (!value || !selectedId) return;
    setText("");
    sendPayload({ type: "text", text: value });
  };

  const handleSendHi = () => {
    if (!canReply || !selectedId) return;
    sendPayload({ type: "text", text: "Hi 👋" });
  };

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canReply) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.warning("File is larger than 2MB — please pick a smaller file");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
    sendPayload({ type, fileName: file.name, fileType: file.type, fileData: dataUrl });
  };

  /* ── Voice recorder ───────────────────────────────────────────── */
  const startRecording = async () => {
    if (!canReply) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > MAX_FILE_BYTES) {
          toast.warning("Recording is larger than 2MB — try a shorter clip");
          return;
        }
        const dataUrl = await readFileAsDataUrl(blob);
        sendPayload({ type: "audio", fileName: `voice-${Date.now()}.webm`, fileType: "audio/webm", fileData: dataUrl });
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone access was denied or is unavailable");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  /* ── Camera (photo + video) ───────────────────────────────────── */
  const openCamera = async (mode) => {
    if (!canReply) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: mode === "video",
      });
      streamRef.current = stream;
      setCameraMode(mode);
      setCameraOpen(true);
    } catch {
      toast.error("Camera access was denied or is unavailable");
    }
  };

  // Attaches the live camera stream to the <video> preview once it's
  // actually mounted. Doing this in an effect (keyed on cameraOpen)
  // instead of a setTimeout right after getUserMedia avoids the race
  // where the ref isn't attached yet when the callback runs — that
  // race was why the photo preview never appeared (capture then read
  // a blank canvas) and why the video preview stayed empty even though
  // the underlying recording worked fine.
  useEffect(() => {
    if (cameraOpen && videoPreviewRef.current && streamRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
      videoPreviewRef.current.play?.().catch(() => { });
    }
  }, [cameraOpen]);

  // Touchpad "pinch zoom" arrives as a wheel event with ctrlKey set.
  // React's onWheel is passive by default, so preventDefault() inside a
  // JSX handler doesn't reliably stop the browser from zooming the
  // whole page — only a manually-attached, non-passive native listener
  // does. This keeps the gesture scoped to just the media stage.
  useEffect(() => {
    const stage = mediaStageRef.current;
    if (!mediaViewer || !stage) return undefined;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(3, Math.max(1, +(z + delta).toFixed(2))));
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [mediaViewer]);

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setVideoRecording(false);
  };

  const capturePhoto = async () => {
    const video = videoPreviewRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.warning("Camera preview isn't ready yet — give it a second and try again");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        if (blob.size > MAX_FILE_BYTES) {
          toast.warning("Photo is larger than 2MB — try again with more light or a smaller frame");
          return;
        }
        const dataUrl = await readFileAsDataUrl(blob);
        sendPayload({ type: "image", fileName: `photo-${Date.now()}.jpg`, fileType: "image/jpeg", fileData: dataUrl });
        closeCamera();
      },
      "image/jpeg",
      0.85
    );
  };

  const startVideoCapture = () => {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    videoChunksRef.current = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && videoChunksRef.current.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
      if (blob.size > MAX_FILE_BYTES) {
        toast.warning("Video is larger than 2MB — please record something shorter");
        closeCamera();
        return;
      }
      const dataUrl = await readFileAsDataUrl(blob);
      sendPayload({ type: "video", fileName: `video-${Date.now()}.webm`, fileType: "video/webm", fileData: dataUrl });
      closeCamera();
    };
    recorder.start();
    videoRecorderRef.current = recorder;
    setVideoRecording(true);
  };

  const stopVideoCapture = () => {
    videoRecorderRef.current?.stop();
  };

  /* ── Topbar "more options" dropdown actions ──────────────────── */
  const handleClearChat = () => {
    setClearModalOpen(true);
  };

  const runClearChat = async (scope) => {
    if (!selectedStaff) return;
    try {
      await api.delete(`/chat/${selectedStaff.id}`, { params: { scope } });
      setMessages([]);
      loadStaffList();
      toast.success(scope === "everyone" ? "Conversation cleared for everyone" : "Conversation cleared for you");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to clear conversation");
    } finally {
      setClearModalOpen(false);
    }
  };

  const handleExportChat = () => {
    exportMessages(messages);
  };

  const exportMessages = (list) => {
    if (!selectedStaff) return;
    const rows = list.map((m) => ({
      From: m.fromId === admin?.id ? admin?.name || "Me" : selectedStaff.name,
      Type: m.type,
      Message: m.type === "text" ? m.text : m.fileName || m.type,
      Sent: fmtDateTime(m.createdAt),
      Delivered: m.deliveredAt ? fmtDateTime(m.deliveredAt) : "—",
      Seen: m.readAt ? fmtDateTime(m.readAt) : "—",
    }));
    const ok = exportToExcel({
      rows,
      sheetName: "Chat",
      fileName: `chat-${selectedStaff.name.replace(/\s+/g, "_")}-${Date.now()}.xlsx`,
    });
    if (!ok) toast.warning("No messages to export yet");
    else toast.success("Chat exported");
  };

  const handleInfo = () => {
    setInfoMessages(messages);
    setInfoOpen(true);
  };

  const handleSingleMsgInfo = () => {
    if (selectedMsgIds.length !== 1) return;
    const msg = messages.find((m) => m.id === selectedMsgIds[0]);
    if (!msg) return;
    setInfoMessages([msg]);
    setInfoOpen(true);
  };

  // Dispatcher for the "more options" CustomDropdown — its interaction
  // model is select-a-value/onChange(value), so each menu action is
  // modeled as a one-shot "selection" that fires the matching handler
  // and is intentionally never fed back as the dropdown's current
  // value (topbarMenuChoice always resets to "" straight after), so
  // the trigger doesn't end up permanently displaying whichever action
  // was last clicked as if it were a persisted selection.
  const handleTopbarMenuChoice = (val) => {
    setTopbarMenuChoice("");
    if (val === "info") handleInfo();
    else if (val === "export") handleExportChat();
    else if (val === "clear") handleClearChat();
  };

  /* ── Select mode: bulk delete / download / export / share ───────── */
  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedMsgIds([]);
  };

  const toggleMsgSelected = (id) => {
    setSelectedMsgIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedMsgIds.includes(m.id)),
    [messages, selectedMsgIds]
  );

  const handleBulkDelete = () => {
    if (selectedMsgIds.length === 0 || !selectedStaff) return;
    toast.confirm(`Delete ${selectedMsgIds.length} selected message(s) for you? The other side keeps their copy.`, async () => {
      try {
        await api.delete(`/chat/${selectedStaff.id}/messages`, { data: { ids: selectedMsgIds } });
        setMessages((prev) => prev.filter((m) => !selectedMsgIds.includes(m.id)));
        setSelectedMsgIds([]);
        setSelectMode(false);
        toast.success("Deleted");
      } catch (err) {
        toast.error(err?.response?.data?.error || "Failed to delete messages");
      }
    });
  };

  const downloadDataUrl = (dataUrl, fileName) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleBulkDownload = () => {
    const withFiles = selectedMessages.filter((m) => m.fileData);
    if (withFiles.length === 0) {
      toast.warning("No files in the current selection");
      return;
    }
    withFiles.forEach((m) => downloadDataUrl(m.fileData, m.fileName));
  };

  const handleBulkExport = () => {
    if (selectedMsgIds.length === 0) {
      toast.warning("Select at least one message first");
      return;
    }
    exportMessages(selectedMessages);
  };

  const handleTopbarDownload = () => {
    const withFiles = messages.filter((m) => m.fileData);
    if (withFiles.length === 0) {
      toast.warning("No files in this conversation yet");
      return;
    }
    withFiles.forEach((m) => downloadDataUrl(m.fileData, m.fileName));
  };

  /* ── Share (internal staff + external apps) ──────────────────── */
  const openShareForSelection = () => {
    if (selectMode && selectedMsgIds.length > 0) {
      setSharePanel({ kind: "selection", messages: selectedMessages });
    } else if (selectedStaff) {
      setSharePanel({ kind: "selection", messages });
    }
  };

  const shareText = (payload) =>
    payload.messages
      .map((m) => (m.type === "text" ? m.text : `[${m.type}] ${m.fileName || ""}`))
      .join("\n");

  const shareToStaff = async (targetStaffId) => {
    if (!sharePanel) return;
    for (const m of sharePanel.messages) {
      // eslint-disable-next-line no-await-in-loop
      await sendPayload(
        m.type === "text"
          ? { type: "text", text: m.text }
          : { type: m.type, fileName: m.fileName, fileType: m.fileType, fileData: m.fileData },
        targetStaffId
      );
    }
    toast.success("Shared");
    setSharePanel(null);
  };

  const shareExternal = (channel) => {
    if (!sharePanel) return;
    const text = encodeURIComponent(shareText(sharePanel));
    const urls = {
      whatsapp: `https://wa.me/?text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${window.location.origin}&quote=${text}`,
      gmail: `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent("Shared from Sam Cafe Staff Chat")}&body=${text}`,
    };
    window.open(urls[channel], "_blank", "noopener,noreferrer");
    setSharePanel(null);
  };

  /* ── Sidebar list filtering ───────────────────────────────────── */
  const filteredStaff = staffList.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className={`chat-page${selectedStaff ? " chat-conversation-open" : ""}`}>
      {/* ───────── Sidebar ───────── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Staff Chat</h2>
          <div className="chat-search">
            <IconSearch />
            <input
              type="text"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="chat-staff-list">
          {loadingStaff ? (
            <div className="chat-empty-hint">Loading staff…</div>
          ) : filteredStaff.length === 0 ? (
            <div className="chat-empty-hint">No staff found</div>
          ) : (
            filteredStaff.map((s) => (
              <button
                key={s.id}
                className={`chat-staff-item${s.id === selectedId ? " active" : ""}`}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="chat-avatar" style={{ background: getAvatarColor(s.name) }}>
                  {initials(s.name)}
                </span>
                <span className="chat-staff-info">
                  <span className="chat-staff-name-row">
                    <span className="chat-staff-name">
                      {s.name}
                      {s.roleGroup === "Super Admin" && (
                        <span className="chat-superadmin-badge" title="Super Admin">
                          <IconShield /> Super Admin
                        </span>
                      )}
                    </span>
                    {s.lastMessage && (
                      <span className="chat-staff-time">{timeOnly(s.lastMessage.at)}</span>
                    )}
                  </span>
                  <span className="chat-staff-preview">
                    {s.lastMessage
                      ? `${s.lastMessage.fromMe ? "You: " : ""}${s.lastMessage.text}`
                      : s.roleTitle || s.roleGroup || "No messages yet"}
                  </span>
                </span>
                {s.unreadCount > 0 && <span className="chat-unread-badge">{s.unreadCount}</span>}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ───────── Conversation ───────── */}
      <section className="chat-main">
        {!selectedStaff ? (
          <div className="chat-placeholder">
            <div className="chat-placeholder-icon">💬</div>
            <p>Select a staff member to start chatting</p>
          </div>
        ) : (
          <>
            <div className="chat-topbar">
              <button
                type="button"
                className="chat-icon-btn chat-back-btn"
                title="Back to staff list"
                onClick={() => setSelectedId(null)}
              >
                <IconBack />
              </button>
              <span className="chat-avatar" style={{ background: getAvatarColor(selectedStaff.name) }}>
                {initials(selectedStaff.name)}
              </span>
              <div className="chat-topbar-info">
                <span className="chat-topbar-name">
                  {selectedStaff.name}
                  {selectedStaff.roleGroup === "Super Admin" && (
                    <span className="chat-superadmin-badge" title="Super Admin">
                      <IconShield /> Super Admin
                    </span>
                  )}
                </span>
                <span className="chat-topbar-role">{selectedStaff.roleTitle || selectedStaff.roleGroup}</span>
              </div>

              <div className="chat-topbar-toolbar">
                <button
                  type="button"
                  className={`chat-icon-btn${selectMode ? " active" : ""}`}
                  title={selectMode ? "Exit select mode" : "Select messages"}
                  onClick={toggleSelectMode}
                >
                  <IconCheckSquare />
                </button>
                <button
                  type="button"
                  className="chat-icon-btn"
                  title="Share conversation"
                  onClick={openShareForSelection}
                >
                  <IconShare />
                </button>
                <button
                  type="button"
                  className="chat-icon-btn"
                  title="Download all files in this chat"
                  onClick={handleTopbarDownload}
                >
                  <IconDownload />
                </button>

                <div className="chat-topbar-actions chat-more-dropdown">
                  <CustomDropdown
                    value={topbarMenuChoice}
                    onChange={handleTopbarMenuChoice}
                    placeholder={null}
                    options={[
                      { value: "info", label: (<span className="chat-dropdown-option"><IconInfo /> Info</span>) },
                      { value: "export", label: (<span className="chat-dropdown-option"><IconClip /> Export Chat</span>) },
                      { value: "clear", label: (<span className="chat-dropdown-option chat-dropdown-option-danger"><IconTrash /> Clear Chat</span>) },
                    ]}
                  />
                </div>
              </div>
            </div>

            {selectMode && (
              <div className="chat-select-bar">
                <span>{selectedMsgIds.length} selected</span>
                <div className="chat-select-actions">
                  {selectedMsgIds.length === 1 && (
                    <button type="button" onClick={handleSingleMsgInfo} title="Info">
                      <IconInfo /> <span>Info</span>
                    </button>
                  )}
                  <button type="button" onClick={handleBulkDownload} title="Download">
                    <IconDownload /> <span>Download</span>
                  </button>
                  <button type="button" onClick={handleBulkExport} title="Export">
                    <IconClip /> <span>Export</span>
                  </button>
                  <button type="button" onClick={openShareForSelection} title="Share">
                    <IconShare /> <span>Share</span>
                  </button>
                  <button type="button" className="danger" onClick={handleBulkDelete} title="Delete">
                    <IconTrash /> <span>Delete</span>
                  </button>
                </div>
              </div>
            )}

            <div className="chat-messages">
              {loadingThread ? (
                <div className="chat-empty-hint chat-loading-hint">
                  <span className="chat-spinner" aria-hidden="true" />
                  Loading conversation…
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-empty-hint">No messages yet — say hello 👋</div>
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isMine={m.fromId === admin?.id}
                    selectMode={selectMode}
                    isSelected={selectedMsgIds.includes(m.id)}
                    onToggleSelect={() => toggleMsgSelected(m.id)}
                    onOpenMedia={() => setMediaViewer(m)}
                    showSuperAdminTag={!viewerIsSuperAdmin && m.fromId !== admin?.id && selectedStaff?.roleGroup === "Super Admin"}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {!canReply ? (
              <div className="chat-locked-bar">
                <IconShield />
                <span>
                  Messages from a <strong>Super Admin</strong> are announcements — you can't reply here.
                </span>
              </div>
            ) : (
              <form className="chat-input-bar" onSubmit={handleSendText}>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={handleFilePick}
                />
                <button
                  type="button"
                  className="chat-icon-btn"
                  title="Attach file (max 2MB)"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconAttach />
                </button>
                <button
                  type="button"
                  className="chat-icon-btn"
                  title="Take photo / record video"
                  onClick={() => openCamera("photo")}
                >
                  <IconCamera />
                </button>
                <button
                  type="button"
                  className={`chat-icon-btn${recording ? " recording" : ""}`}
                  title={recording ? "Stop recording" : "Record voice message"}
                  onClick={recording ? stopRecording : startRecording}
                >
                  <IconMic active={recording} />
                </button>

                <input
                  type="text"
                  className="chat-text-input"
                  placeholder={recording ? "Recording…" : "Type a message"}
                  value={text}
                  disabled={recording}
                  onChange={(e) => setText(e.target.value)}
                />

                <button
                  type="button"
                  className="chat-hi-btn"
                  title="Send a quick Hi"
                  disabled={sending || recording}
                  onClick={handleSendHi}
                >
                  👋 <span>Hi</span>
                </button>

                <Button3D type="submit" iconOnly disabled={sending || !text.trim()} title="Send">
                  <IconSend />
                </Button3D>
              </form>
            )}
          </>
        )}
      </section>

      {/* ───────── Camera overlay ───────── */}
      {cameraOpen && (
        <div className="chat-camera-overlay">
          <div className="chat-camera-modal">
            <video ref={videoPreviewRef} autoPlay muted playsInline className="chat-camera-preview" />
            <div className="chat-camera-controls">
              <div className="chat-camera-mode-toggle">
                <button
                  type="button"
                  className={cameraMode === "photo" ? "active" : ""}
                  onClick={() => setCameraMode("photo")}
                  disabled={videoRecording}
                >
                  Photo
                </button>
                <button
                  type="button"
                  className={cameraMode === "video" ? "active" : ""}
                  onClick={() => setCameraMode("video")}
                  disabled={videoRecording}
                >
                  Video
                </button>
              </div>

              <div className="chat-camera-actions">
                <Button3D variant="cancel" onClick={closeCamera}>
                  Cancel
                </Button3D>
                {cameraMode === "photo" ? (
                  <Button3D onClick={capturePhoto}>Capture</Button3D>
                ) : videoRecording ? (
                  <Button3D variant="danger" onClick={stopVideoCapture}>
                    ● Stop Recording
                  </Button3D>
                ) : (
                  <Button3D onClick={startVideoCapture}>● Start Recording</Button3D>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────── Clear chat: "for me" vs "for everyone" ───────── */}
      {clearModalOpen && selectedStaff && (
        <div className="confirm-overlay" onClick={() => setClearModalOpen(false)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <h4 className="confirm-danger">Clear this conversation?</h4>
            <p>
              Choose whether to clear your copy of the chat with <strong>{selectedStaff.name}</strong>, or wipe it
              for both of you. This can't be undone.
            </p>
            <div className="confirm-actions chat-clear-actions">
              <Button3D variant="cancel" onClick={() => setClearModalOpen(false)}>
                Cancel
              </Button3D>
              <Button3D variant="save" onClick={() => runClearChat("me")}>
                Clear for me
              </Button3D>
              <Button3D variant="danger" onClick={() => runClearChat("everyone")}>
                Clear for everyone
              </Button3D>
            </div>
          </div>
        </div>
      )}

      {/* ───────── Conversation info: send/deliver/seen timings ───────── */}
      {infoOpen && selectedStaff && (
        <div className="chat-info-overlay" onClick={() => setInfoOpen(false)}>
          <div className="chat-info-panel" onClick={(e) => e.stopPropagation()}>
            <div className="chat-info-header">
              <span>{infoMessages.length === 1 ? "Message Info" : "Conversation Info"}</span>
              <button type="button" className="chat-icon-btn" onClick={() => setInfoOpen(false)}>
                <IconClose />
              </button>
            </div>
            <div className="chat-info-body">
              {infoMessages.length === 0 ? (
                <div className="chat-empty-hint">No messages yet</div>
              ) : (
                infoMessages.map((m) => (
                  <div key={m.id} className="chat-info-row">
                    <div className="chat-info-row-top">
                      <span className="chat-info-from">{m.fromId === admin?.id ? "You" : selectedStaff.name}</span>
                      <span className="chat-info-preview">{describeMessage(m)}</span>
                    </div>
                    <div className="chat-info-row-times">
                      <span>Sent: {fmtDateTime(m.createdAt)}</span>
                      <span>Delivered: {m.deliveredAt ? fmtDateTime(m.deliveredAt) : "—"}</span>
                      <span>Seen: {m.readAt ? fmtDateTime(m.readAt) : "—"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────── Image/video overlay: zoom, download, delete ───────── */}
      {mediaViewer && (
        <div
          className="chat-media-overlay"
          onClick={() => {
            setMediaViewer(null);
            setZoom(1);
          }}
        >
          <div className="chat-media-toolbar" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} title="Zoom out">
              <IconZoomOut />
            </button>
            <span className="chat-media-zoom-level">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} title="Zoom in">
              <IconZoomIn />
            </button>
            <button
              type="button"
              onClick={() => downloadDataUrl(mediaViewer.fileData, mediaViewer.fileName)}
              title="Download"
            >
              <IconDownload />
            </button>
            {mediaViewer.fromId === admin?.id && (
              <button
                type="button"
                className="danger"
                title="Delete for me"
                onClick={() => {
                  const id = mediaViewer.id;
                  toast.confirm("Delete this message for you? The other side keeps their copy.", () => {
                    api.delete(`/chat/${selectedStaff.id}/messages`, { data: { ids: [id] } }).then(() => {
                      setMessages((prev) => prev.filter((m) => m.id !== id));
                      setMediaViewer(null);
                      setZoom(1);
                      toast.success("Deleted");
                    }).catch((err) => toast.error(err?.response?.data?.error || "Failed to delete"));
                  });
                }}
              >
                <IconTrash />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMediaViewer(null);
                setZoom(1);
              }}
              title="Close"
            >
              <IconClose />
            </button>
          </div>
          <div className="chat-media-stage" ref={mediaStageRef} onClick={(e) => e.stopPropagation()}>
            {mediaViewer.type === "image" ? (
              <img
                src={mediaViewer.fileData}
                alt={mediaViewer.fileName || "image"}
                style={{ transform: `scale(${zoom})` }}
                className="chat-media-full"
              />
            ) : (
              <video src={mediaViewer.fileData} controls autoPlay className="chat-media-full" style={{ transform: `scale(${zoom})` }} />
            )}
          </div>
        </div>
      )}

      {/* ───────── Share panel: internal staff + external apps ───────── */}
      {sharePanel && (
        <div className="chat-info-overlay" onClick={() => setSharePanel(null)}>
          <div className="chat-info-panel chat-share-panel" onClick={(e) => e.stopPropagation()}>
            <div className="chat-info-header">
              <span>Share {sharePanel.messages.length > 1 ? `${sharePanel.messages.length} messages` : "message"}</span>
              <button type="button" className="chat-icon-btn" onClick={() => setSharePanel(null)}>
                <IconClose />
              </button>
            </div>
            <div className="chat-info-body">
              <div className="chat-share-section-title">Share with staff</div>
              <div className="chat-share-staff-list">
                {staffList
                  .filter((s) => s.id !== selectedId)
                  .map((s) => (
                    <button key={s.id} className="chat-share-staff-item" onClick={() => shareToStaff(s.id)}>
                      <span className="chat-avatar chat-avatar-sm" style={{ background: getAvatarColor(s.name) }}>
                        {initials(s.name)}
                      </span>
                      <span>{s.name}</span>
                    </button>
                  ))}
              </div>

              <div className="chat-share-section-title">Share externally</div>
              <div className="chat-share-external-list">
                <button className="chat-share-external-item" onClick={() => shareExternal("whatsapp")}>
                  <span className="chat-share-ext-icon" style={{ background: "#25D366" }}>W</span>
                  WhatsApp
                </button>
                <button className="chat-share-external-item" onClick={() => shareExternal("gmail")}>
                  <span className="chat-share-ext-icon" style={{ background: "#EA4335" }}>G</span>
                  Gmail
                </button>
                <button className="chat-share-external-item" onClick={() => shareExternal("facebook")}>
                  <span className="chat-share-ext-icon" style={{ background: "#1877F2" }}>f</span>
                  Facebook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   MessageBubble — renders one message by type
───────────────────────────────────────── */
function MessageBubble({ message, isMine, selectMode, isSelected, onToggleSelect, onOpenMedia, showSuperAdminTag }) {
  const time = timeOnly(message.createdAt);
  const isMedia = message.type === "image" || message.type === "video";

  return (
    <div
      className={`chat-bubble-row${isMine ? " mine" : ""}${selectMode ? " select-mode" : ""}${isSelected ? " is-selected" : ""}`}
      onClick={selectMode ? onToggleSelect : undefined}
    >
      {selectMode && (
        <input
          type="checkbox"
          className="chat-bubble-checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="chat-bubble">
        {showSuperAdminTag && (
          <span className="chat-superadmin-badge chat-bubble-superadmin-badge">
            <IconShield /> Super Admin
          </span>
        )}
        {message.type === "text" && <span className="chat-bubble-text">{message.text}</span>}

        {message.type === "image" && (
          <img
            src={message.fileData}
            alt={message.fileName || "image"}
            className="chat-bubble-media"
            onClick={(e) => {
              if (selectMode) return;
              e.stopPropagation();
              onOpenMedia();
            }}
          />
        )}

        {message.type === "video" && (
          <video
            src={message.fileData}
            controls
            className="chat-bubble-media"
            onClick={(e) => {
              if (selectMode) e.preventDefault();
            }}
          />
        )}

        {message.type === "audio" && (
          <audio src={message.fileData} controls className="chat-bubble-audio" />
        )}

        {message.type === "file" && (
          <a
            href={message.fileData}
            download={message.fileName || "file"}
            className="chat-bubble-file"
            onClick={(e) => selectMode && e.preventDefault()}
          >
            📎 {message.fileName || "Download file"}
          </a>
        )}

        {isMedia && !selectMode && (
          <button type="button" className="chat-bubble-expand" onClick={(e) => { e.stopPropagation(); onOpenMedia(); }} title="View full size">
            ⤢
          </button>
        )}

        <span className="chat-bubble-meta">
          <span className="chat-bubble-time">{time}</span>
          {isMine && <TickStatus message={message} />}
        </span>
      </div>
    </div>
  );
}