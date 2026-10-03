import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./RecordingOverlay.css";
import { commands, events } from "@/bindings";
import type {
  AppCategory,
  StreamPhase,
  StreamPhaseEvent,
  StreamTextEvent,
  StreamWorkKind,
  WritingStyle,
} from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";

type OverlayState = "recording" | "streaming" | "transcribing" | "processing";

// Rocket Styles: sent when the chord key marks this recording for Styles.
type StylesActive = {
  style: WritingStyle;
  category: AppCategory;
  app_name: string;
};

// The live trace plots the mic level over the last ~2.4s (levels arrive at
// ~30/s). Its viewBox is 100 x TRACE_H; the line rests on TRACE_BASE when silent.
const TRACE_POINTS = 72;
const TRACE_H = 20;
const TRACE_BASE = 17;
const TRACE_PEAK = 3;

const traceY = (amp: number) => TRACE_BASE - amp * (TRACE_BASE - TRACE_PEAK);

/** Smooth path through evenly spaced samples (Catmull-Rom as cubic Béziers). */
const tracePath = (amps: number[]): string => {
  const step = 100 / (amps.length - 1);
  const pts = amps.map((a, i) => [i * step, traceY(a)] as const);
  let d = `M${pts[0][0]} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(i - 1, 0)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(i + 2, pts.length - 1)];
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d;
};

/** Rocket's mark: an ascent arc ending in the vehicle. The dot doubles as the
 *  capture light — dim while the mic arms, Rocket orange once samples flow. */
const RocketMark: React.FC<{ ready: boolean }> = ({ ready }) => (
  <svg
    className={`hud-mark ${ready ? "ready" : ""}`}
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        id="hud-mark-arc"
        gradientUnits="userSpaceOnUse"
        x1="3"
        y1="15"
        x2="12"
        y2="4"
      >
        <stop offset="0" stopColor="currentColor" stopOpacity="0.15" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.95" />
      </linearGradient>
    </defs>
    <path
      d="M3 15.2C3 9.6 6.3 5.2 11.4 4.3"
      fill="none"
      stroke="url(#hud-mark-arc)"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <circle className="hud-mark-dot" cx="12.6" cy="4.1" r="2.2" />
  </svg>
);

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  // `Stream::play()` returning does not mean hardware callbacks are flowing.
  // Stay visually in an arming state until the backend processes the first
  // actual microphone sample chunk.
  const [captureReady, setCaptureReady] = useState(false);
  const [trace, setTrace] = useState<number[]>(() =>
    Array(TRACE_POINTS).fill(0),
  );
  const [streamText, setStreamText] = useState<StreamTextEvent>({
    committed: "",
    tentative: "",
  });
  const [phase, setPhase] = useState<StreamPhase>("listening");
  const [stylesActive, setStylesActive] = useState<StylesActive | null>(null);
  const [workKind, setWorkKind] = useState<StreamWorkKind>("transcribing");
  const [elapsed, setElapsed] = useState(0);
  // Bumped on each new streaming session so the Live card remounts fresh (replays
  // the pop-in, and never animates in from the previous panel's open size).
  const [session, setSession] = useState(0);
  // Overlay placement (top vs bottom of the screen). The Live panel grows downward
  // from a top overlay (oldest line under the pill) and upward from a bottom one.
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  // True once live text overflows the cap. A top overlay fades its top edge only
  // while overflowing, so the resting first line stays crisp flush under the pill.
  const [overflowing, setOverflowing] = useState(false);

  const levelRef = useRef(0);
  // Live-text scroll-back: the text region "sticks" to the newest line while the
  // user is at the bottom; if they scroll up to read history, auto-follow pauses
  // until they scroll back down.
  const capRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const direction = getLanguageDirection(i18n.language);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        const overlayState = event.payload as OverlayState;
        // Reset synchronously before settings I/O. A fast microphone can emit
        // recording-ready while the awaits below are in flight; resetting after
        // them would overwrite that event and leave the overlay stuck arming.
        if (overlayState === "recording" || overlayState === "streaming") {
          setCaptureReady(false);
          levelRef.current = 0;
          setTrace(Array(TRACE_POINTS).fill(0));
          setStreamText({ committed: "", tentative: "" });
          setElapsed(0);
        }

        await syncLanguageFromSettings();
        // The Live panel flows downward from a top overlay and upward from a
        // bottom one; read the placement so the layout can flip to match.
        try {
          const settings = await commands.getAppSettings();
          if (settings.status === "ok") {
            setPosition(
              settings.data.overlay_position === "top" ? "top" : "bottom",
            );
          }
        } catch {
          // Keep the previous/default placement if settings can't be read.
        }
        setState(overlayState);
        if (overlayState === "streaming") {
          setPhase("listening");
          setWorkKind("transcribing");
          setSession((s) => s + 1); // remount the card fresh for this session
        }
        setIsVisible(true);
      });

      // The Styles label for a recording is sent as it starts, which can land
      // before its show-overlay, so it's cleared when the overlay hides.
      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
        setCaptureReady(false);
        setStylesActive(null);
      });

      const unlistenReady = await listen("recording-ready", () => {
        setElapsed(0);
        setCaptureReady(true);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        // 16 FFT buckets; the lower ones carry speech. Blend mean and peak so
        // both steady and plosive sounds register, then ease toward it.
        const voice = (event.payload as number[]).slice(0, 10);
        const mean = voice.reduce((sum, v) => sum + (v || 0), 0) / voice.length;
        const peak = Math.max(...voice.map((v) => v || 0));
        const target = Math.min(1, Math.pow((mean + peak) / 2, 0.7) * 1.15);
        levelRef.current = levelRef.current * 0.45 + target * 0.55;
        const level = levelRef.current;
        setTrace((prev) => [...prev.slice(1), level]);
      });

      const unlistenStyles = await listen<StylesActive>(
        "styles-active",
        (event) => setStylesActive(event.payload),
      );

      const unlistenStream = await events.streamTextEvent.listen((event) => {
        setStreamText(event.payload);
      });

      const unlistenPhase = await events.streamPhaseEvent.listen((event) => {
        const payload: StreamPhaseEvent = event.payload;
        setPhase(payload.phase);
        if (payload.kind) setWorkKind(payload.kind);
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenReady();
        unlistenLevel();
        unlistenStyles();
        unlistenStream();
        unlistenPhase();
      };
    };

    setupEventListeners();
  }, []);

  // Elapsed capture timer starts only once microphone samples are flowing.
  const listening =
    state === "recording" || (state === "streaming" && phase !== "working");
  useEffect(() => {
    if (!listening || !isVisible || !captureReady) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [listening, isVisible, captureReady]);

  // Stick to the bottom as text streams in — but only while pinned, so a user who
  // has scrolled up to read history isn't yanked back down by the next chunk.
  useLayoutEffect(() => {
    const el = capRef.current;
    if (!el) return;
    // Fade the top edge only once text actually overflows the cap.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
    if (pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [streamText]);

  // Each fresh streaming session starts pinned to the bottom, fade cleared.
  useEffect(() => {
    pinnedRef.current = true;
    setOverflowing(false);
  }, [session]);

  if (!isVisible) return null;

  // Re-pin when the user is within ~a line of the bottom; unpin otherwise.
  const handleStreamScroll = () => {
    const el = capRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 16;
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ---- Shared building blocks (one visual language for every overlay form) ----

  // Styles context: the style, the app it was picked for, and that app's kind.
  const contextRow = stylesActive && (
    <div className="hud-context">
      <span className="hud-style">
        {t(`settings.styles.style.${stylesActive.style}.label`)}
      </span>
      {stylesActive.app_name && (
        <span className="hud-app">{stylesActive.app_name}</span>
      )}
      <span className="hud-category">
        {t(`settings.styles.category.${stylesActive.category}`)}
      </span>
    </div>
  );

  const cancelBtn = (
    <button
      className="hud-cancel"
      aria-label="cancel"
      onClick={() => commands.cancelOperation()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M5 5 L11 11 M11 5 L5 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

  // mark | live trace | timer | cancel
  const listeningRow = (
    <div className="hud-row">
      <RocketMark ready={captureReady} />
      <div className={`hud-trace ${captureReady ? "" : "arming"}`}>
        <svg viewBox={`0 0 100 ${TRACE_H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient
              id="hud-contrail"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="100"
              y2="0"
            >
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="0.6" stopColor="currentColor" stopOpacity="0.45" />
              <stop offset="1" stopColor="currentColor" stopOpacity="1" />
            </linearGradient>
          </defs>
          <path
            d={tracePath(trace)}
            fill="none"
            stroke="url(#hud-contrail)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="hud-trace-head"
          style={{
            top: `${(traceY(trace[trace.length - 1]) / TRACE_H) * 100}%`,
          }}
        />
      </div>
      <span className="hud-timer">{fmtTime(elapsed)}</span>
      {cancelBtn}
    </div>
  );

  // mark | label | comet | cancel
  const workingRow = (label: string) => (
    <div className="hud-row working">
      <RocketMark ready={true} />
      <span className="hud-label">{label}</span>
      <div className="hud-comet">
        <i />
      </div>
      {cancelBtn}
    </div>
  );

  const polishLabel = stylesActive
    ? t("overlay.formatting")
    : t("overlay.processing");

  // ---- Live overlay: a pill that opens into a panel as text streams in ----
  if (state === "streaming") {
    const hasText =
      streamText.committed.length > 0 || streamText.tentative.length > 0;
    const working = phase === "working";

    return (
      <div dir={direction} className={`ov-stage ${position}`}>
        <div
          key={session}
          className={`hud live ${hasText ? "open" : ""} ${
            stylesActive ? "styled" : ""
          }`}
        >
          {working
            ? workingRow(
                workKind === "polishing"
                  ? polishLabel
                  : t("overlay.transcribing"),
              )
            : listeningRow}
          {contextRow}
          <div className="hud-text">
            <div className="hud-text-clip">
              <div
                className={`hud-text-cap ${overflowing ? "overflowing" : ""}`}
                ref={capRef}
                onScroll={handleStreamScroll}
              >
                <p>
                  <span className="committed">
                    {streamText.committed ? streamText.committed + " " : ""}
                  </span>
                  <span className="tentative">{streamText.tentative}</span>
                  {!working && <span className="hud-caret" />}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Minimal overlay: one row — the live trace while recording, or a label
  // with a travelling comet while transcribing / formatting.
  const working = state === "transcribing" || state === "processing";
  const workLabel =
    state === "processing" ? polishLabel : t("overlay.transcribing");

  return (
    <div
      dir={direction}
      className={`ov-stage ${position} ov-fade ${isVisible ? "show" : ""}`}
    >
      <div className={`hud compact ${stylesActive ? "styled" : ""}`}>
        {working ? workingRow(workLabel) : listeningRow}
        {contextRow}
      </div>
    </div>
  );
};

export default RecordingOverlay;
