"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface TranscriptionPanelProps {
  /** Whether live streaming is active */
  isLive: boolean;
  /** Called when a new transcript is available */
  onTranscript?: (text: string) => void;
  /** Called when a translation is available */
  onTranslation?: (text: string, lang: string) => void;
}

const LANGUAGES = [
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Chinese",
  "Japanese",
  "Korean",
  "Arabic",
  "Hindi",
  "Russian",
  "Filipino",
];

export default function TranscriptionPanel({
  isLive,
  onTranscript,
  onTranslation,
}: TranscriptionPanelProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ text: string; translation: string; lang: string; timestamp: number }>
  >([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptDebouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start listening to microphone
  const startListening = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Check supported MIME types
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        if (blob.size < 1000) return; // Skip tiny recordings

        // Convert to base64
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          await transcribeAudio(base64, mimeType.split(";")[0]);
        };
        reader.readAsDataURL(blob);
      };

      // Record in 5-second chunks
      recorder.start();
      setIsListening(true);

      // Periodic stop/restart for chunked transcription
      const chunkInterval = setInterval(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          setTimeout(() => {
            if (streamRef.current && streamRef.current.active) {
              const newRecorder = new MediaRecorder(streamRef.current, {
                mimeType,
              });
              mediaRecorderRef.current = newRecorder;
              audioChunksRef.current = [];

              newRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
              };
              newRecorder.onstop = recorder.onstop;
              newRecorder.start();
            }
          }, 100);
        }
      }, 5000);

      // Store interval for cleanup
      (recorder as unknown as { _chunkInterval: ReturnType<typeof setInterval> })._chunkInterval =
        chunkInterval;
    } catch (err) {
      console.error("Microphone access error:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      const interval = (
        recorder as unknown as { _chunkInterval?: ReturnType<typeof setInterval> }
      )._chunkInterval;
      if (interval) clearInterval(interval);

      if (recorder.state === "recording") {
        recorder.stop();
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  // Transcribe audio via backend Gemini endpoint
  const transcribeAudio = useCallback(
    async (audioBase64: string, mimeType: string) => {
      try {
        const resp = await fetch("http://localhost:8000/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_base64: audioBase64,
            mime_type: mimeType,
          }),
        });
        const data = await resp.json();

        if (data.transcript) {
          const newText = data.transcript.trim();
          if (newText) {
            setTranscript((prev) => {
              const updated = prev ? `${prev} ${newText}` : newText;
              onTranscript?.(updated);
              return updated;
            });
            setInterimTranscript("");

            // Auto-translate
            if (autoTranslate) {
              translateText(newText);
            }
          }
        }
      } catch (err) {
        console.error("Transcription error:", err);
      }
    },
    [autoTranslate, onTranscript]
  );

  // Translate via backend Gemini endpoint
  const translateText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setIsTranslating(true);
      try {
        const resp = await fetch("http://localhost:8000/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            target_language: targetLanguage,
          }),
        });
        const data = await resp.json();

        if (data.translation) {
          setTranslation(data.translation);
          onTranslation?.(data.translation, targetLanguage);

          // Add to history
          setHistory((prev) => [
            {
              text,
              translation: data.translation,
              lang: targetLanguage,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 19),
          ]);
        }
      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        setIsTranslating(false);
      }
    },
    [targetLanguage, onTranslation]
  );

  const clearTranscript = () => {
    setTranscript("");
    setTranslation("");
    setInterimTranscript("");
  };

  return (
    <div className="space-y-4">
      {/* Live Transcription */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          {isListening && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
          Live Transcription
        </h3>

        <div className="flex gap-2 mb-3">
          {!isListening ? (
            <button
              onClick={startListening}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              🎙️ Start Listening
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              ⏹ Stop Listening
            </button>
          )}
          <button
            onClick={clearTranscript}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-xs mb-2 p-2 bg-red-900/20 rounded">
            {error}
          </div>
        )}

        {/* Transcript display */}
        <div className="bg-gray-800 rounded-lg p-3 min-h-[60px] mb-3">
          <div className="text-sm text-white">
            {transcript || (
              <span className="text-gray-600 italic">
                {isListening
                  ? "Listening... speak now"
                  : "Press Start Listening to begin transcription"}
              </span>
            )}
            {interimTranscript && (
              <span className="text-gray-400 italic"> {interimTranscript}</span>
            )}
          </div>
        </div>
      </div>

      {/* Translation */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          Translation
        </h3>

        <div className="flex gap-2 mb-3">
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <button
            onClick={() => translateText(transcript)}
            disabled={!transcript || isTranslating}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isTranslating ? "..." : "Translate"}
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-500 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
            className="rounded bg-gray-800 border-gray-600"
          />
          Auto-translate new speech
        </label>

        {/* Translation output */}
        <div className="bg-gray-800 rounded-lg p-3 min-h-[60px]">
          <div className="text-sm text-indigo-300">
            {translation || (
              <span className="text-gray-600 italic">
                Translation will appear here
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Translation History */}
      {history.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Recent Translations
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {history.map((item, i) => (
              <div
                key={`${item.timestamp}-${i}`}
                className="bg-gray-800/50 rounded-lg p-2 text-xs"
              >
                <div className="text-white mb-1">{item.text}</div>
                <div className="text-indigo-400">
                  → {item.translation}{" "}
                  <span className="text-gray-600">({item.lang})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
