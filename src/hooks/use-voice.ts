"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Speech Recognition (voice → text) ─────────────────────────────────────

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export interface UseVoiceInputReturn {
  /** Whether the browser supports speech recognition */
  supported: boolean;
  /** Whether we're currently listening */
  listening: boolean;
  /** The interim (in-progress) transcript while speaking */
  interimTranscript: string;
  /** Start listening. Calls onResult with final transcript when done. */
  startListening: () => void;
  /** Stop listening manually */
  stopListening: () => void;
  /** Any error message */
  error: string | null;
}

export function useVoiceInput(
  onResult: (transcript: string) => void
): UseVoiceInputReturn {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const hasSpeech =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setSupported(hasSpeech);
  }, []);

  const startListening = useCallback(() => {
    if (!supported) return;
    setError(null);
    finalTranscriptRef.current = "";
    setInterimTranscript("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = finalTranscriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      finalTranscriptRef.current = final;
      setInterimTranscript(final + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" is expected when we call stop()
      if (event.error !== "aborted") {
        setError(
          event.error === "not-allowed"
            ? "Microphone access denied. Please allow microphone in your browser settings."
            : `Speech recognition error: ${event.error}`
        );
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      const transcript = finalTranscriptRef.current.trim();
      if (transcript) {
        onResult(transcript);
      }
      setInterimTranscript("");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    supported,
    listening,
    interimTranscript,
    startListening,
    stopListening,
    error,
  };
}

// ─── Text-to-Speech (text → voice) ─────────────────────────────────────────

export interface UseVoiceSpeakReturn {
  /** Whether the browser supports speech synthesis */
  supported: boolean;
  /** Whether currently speaking */
  speaking: boolean;
  /** Speak the given text aloud */
  speak: (text: string) => void;
  /** Stop speaking */
  stop: () => void;
  /** Toggle auto-speak on/off */
  autoSpeak: boolean;
  setAutoSpeak: (value: boolean) => void;
}

export function useVoiceSpeak(): UseVoiceSpeakReturn {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Clean up text — remove markdown artifacts
      const cleaned = text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/#{1,6}\s/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();

      if (!cleaned) return;

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Try to pick a natural-sounding voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Samantha") ||
            v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Enhanced"))
      );
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [supported]
  );

  const stop = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [supported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (supported && typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  return { supported, speaking, speak, stop, autoSpeak, setAutoSpeak };
}
