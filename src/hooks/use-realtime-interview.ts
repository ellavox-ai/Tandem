"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export type SpeakerState = "idle" | "user-speaking" | "model-speaking";

export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface VoiceCompletion {
  title: string;
  description: string;
  assignee: string | null;
  priority: string;
  labels: string[];
  should_create: boolean;
}

interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

export interface UseRealtimeInterviewReturn {
  status: ConnectionStatus;
  speakerState: SpeakerState;
  transcript: TranscriptEntry[];
  completion: VoiceCompletion | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
  audioLevel: number;
}

export function useRealtimeInterview(
  taskId: string,
  onComplete?: (completion: VoiceCompletion) => void
): UseRealtimeInterviewReturn {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [speakerState, setSpeakerState] = useState<SpeakerState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [completion, setCompletion] = useState<VoiceCompletion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const statusRef = useRef<ConnectionStatus>("idle");

  // Accumulate model transcript deltas before the final done event
  const modelTranscriptBuffer = useRef("");
  const sessionReady = useRef(false);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    analyserRef.current = null;
    sessionReady.current = false;
    modelTranscriptBuffer.current = "";
    statusRef.current = "idle";
    setAudioLevel(0);
  }, []);

  const sendEvent = useCallback((event: RealtimeEvent) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify(event));
    }
  }, []);

  const handleServerEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case "session.created":
          sessionReady.current = true;
          sendEvent({ type: "response.create" });
          break;

        case "input_audio_buffer.speech_started":
          setSpeakerState("user-speaking");
          break;

        case "input_audio_buffer.speech_stopped":
          setSpeakerState("idle");
          break;

        case "response.audio_transcript.delta":
          if (typeof event.delta === "string") {
            modelTranscriptBuffer.current += event.delta;
          }
          setSpeakerState("model-speaking");
          break;

        case "response.audio_transcript.done":
          if (typeof event.transcript === "string" && event.transcript.trim()) {
            setTranscript((prev) => {
              const next = [
                ...prev,
                {
                  role: "assistant" as const,
                  text: event.transcript as string,
                  timestamp: Date.now(),
                },
              ];
              transcriptRef.current = next;
              return next;
            });
          }
          modelTranscriptBuffer.current = "";
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (
            typeof event.transcript === "string" &&
            event.transcript.trim()
          ) {
            setTranscript((prev) => {
              const next = [
                ...prev,
                {
                  role: "user" as const,
                  text: event.transcript as string,
                  timestamp: Date.now(),
                },
              ];
              transcriptRef.current = next;
              return next;
            });
          }
          break;

        case "response.function_call_arguments.done": {
          const name = event.name as string;
          const callId = event.call_id as string;
          const args = event.arguments as string;

          if (name === "complete_interview") {
            try {
              const parsed = JSON.parse(args);
              const comp: VoiceCompletion = {
                title: String(parsed.title || ""),
                description: String(parsed.description || ""),
                assignee: parsed.assignee || null,
                priority: String(parsed.priority || "P2"),
                labels: Array.isArray(parsed.labels) ? parsed.labels : [],
                should_create: parsed.should_create !== false,
              };

              setCompletion(comp);
              onComplete?.(comp);

              // Respond to the tool call so the model can say goodbye
              sendEvent({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify({ status: "success" }),
                },
              });
              sendEvent({ type: "response.create" });

              // Persist using ref to avoid stale closure
              persistCompletion(taskId, comp, transcriptRef.current);
            } catch {
              console.error("Failed to parse completion arguments:", args);
            }
          }
          break;
        }

        case "response.done":
          setSpeakerState("idle");
          break;

        case "error":
          console.error("Realtime API error:", event);
          setError(
            (event.error as { message?: string })?.message ||
              "Realtime session error"
          );
          break;
      }
    },
    [sendEvent, taskId, onComplete]
  );

  const startAudioLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const poll = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length / 255;
        setAudioLevel(avg);
        rafRef.current = requestAnimationFrame(poll);
      };
      rafRef.current = requestAnimationFrame(poll);
    } catch {
      // Audio context may not be available
    }
  }, []);

  const connect = useCallback(async () => {
    if (statusRef.current === "connecting" || statusRef.current === "connected")
      return;

    statusRef.current = "connecting";
    setStatus("connecting");
    setError(null);
    setTranscript([]);
    setCompletion(null);
    setSpeakerState("idle");

    // Each connection attempt gets its own PC instance.
    // After every await we verify pcRef still points to it —
    // cleanup() nulls the ref, so a mismatch means we were torn down.
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    const wasAbandoned = () => pcRef.current !== pc;

    try {
      // Remote audio output
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // Local microphone input (async — component may unmount during this)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (wasAbandoned()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;
      pc.addTrack(stream.getTracks()[0]);
      startAudioLevelMonitor(stream);

      // Data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        statusRef.current = "connected";
        setStatus("connected");
      });

      dc.addEventListener("message", (e) => {
        try {
          const event = JSON.parse(e.data) as RealtimeEvent;
          handleServerEvent(event);
        } catch {
          // Ignore unparseable messages
        }
      });

      dc.addEventListener("close", () => {
        statusRef.current = "idle";
        setStatus("idle");
      });

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          statusRef.current = "error";
          setError("Connection lost");
          setStatus("error");
          cleanup();
        }
      };

      // Create and set local SDP offer
      const offer = await pc.createOffer();
      if (wasAbandoned()) return;

      await pc.setLocalDescription(offer);
      if (wasAbandoned()) return;

      // Send SDP to our server, which proxies to OpenAI
      const sdpResponse = await fetch(`/api/realtime/${taskId}`, {
        method: "POST",
        body: offer.sdp,
        headers: { "Content-Type": "application/sdp" },
      });

      if (wasAbandoned()) return;

      if (!sdpResponse.ok) {
        throw new Error(
          `Failed to create session: ${sdpResponse.status} ${sdpResponse.statusText}`
        );
      }

      const answerSdp = await sdpResponse.text();
      if (wasAbandoned()) return;

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      if (wasAbandoned()) return;

      const msg =
        err instanceof Error ? err.message : "Failed to connect";
      setError(
        msg.includes("Permission denied") || msg.includes("NotAllowedError")
          ? "Microphone access denied. Please allow microphone access in your browser settings."
          : msg
      );
      statusRef.current = "error";
      setStatus("error");
      cleanup();
    }
  }, [taskId, handleServerEvent, startAudioLevelMonitor, cleanup]);

  const disconnect = useCallback(() => {
    statusRef.current = "idle";
    cleanup();
    setSpeakerState("idle");
    setStatus("idle");
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    speakerState,
    transcript,
    completion,
    connect,
    disconnect,
    error,
    audioLevel,
  };
}

async function persistCompletion(
  taskId: string,
  completion: VoiceCompletion,
  transcript: TranscriptEntry[]
) {
  try {
    await fetch(`/api/interviews/${taskId}/voice-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...completion,
        transcript: transcript.map((t) => ({ role: t.role, text: t.text })),
      }),
    });
  } catch (err) {
    console.error("Failed to persist voice interview completion:", err);
  }
}
