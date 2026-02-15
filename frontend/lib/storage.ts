/**
 * Local storage helpers for saving/loading recording sessions.
 * Recordings are stored as JSON arrays of frames with landmarks + haptic data.
 */

export interface RecordedFrame {
  timestamp: number;
  frameSrc: string; // base64 JPEG data URL
  landmarks: Array<{ x: number; y: number; z: number; index: number }>;
  lipBoundingBox: { x: number; y: number; width: number; height: number } | null;
  mouthOpenness: number;
  phoneme: string | null;
  hapticPattern: number[] | null;
}

export interface RecordingSession {
  id: string;
  name: string;
  createdAt: number;
  duration: number; // milliseconds
  frameCount: number;
  transcript: string;
  translation: string;
  targetLanguage: string;
}

const RECORDINGS_INDEX_KEY = "chd_recordings_index";
const RECORDING_PREFIX = "chd_recording_";

/**
 * Get the list of all saved recording sessions (metadata only).
 */
export function getRecordingsList(): RecordingSession[] {
  try {
    const raw = localStorage.getItem(RECORDINGS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save a recording's frames to localStorage.
 * Frames are stored separately from index to keep the index lightweight.
 */
export function saveRecording(
  name: string,
  frames: RecordedFrame[],
  transcript: string = "",
  translation: string = "",
  targetLanguage: string = ""
): RecordingSession | null {
  if (frames.length === 0) return null;

  const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const duration = frames[frames.length - 1].timestamp - frames[0].timestamp;

  const session: RecordingSession = {
    id,
    name: name || `Recording ${new Date().toLocaleTimeString()}`,
    createdAt: Date.now(),
    duration,
    frameCount: frames.length,
    transcript,
    translation,
    targetLanguage,
  };

  try {
    // Save frames
    localStorage.setItem(RECORDING_PREFIX + id, JSON.stringify(frames));

    // Update index
    const index = getRecordingsList();
    index.unshift(session);
    // Keep max 20 recordings
    if (index.length > 20) {
      const removed = index.splice(20);
      removed.forEach((r) => localStorage.removeItem(RECORDING_PREFIX + r.id));
    }
    localStorage.setItem(RECORDINGS_INDEX_KEY, JSON.stringify(index));

    return session;
  } catch (e) {
    console.error("Failed to save recording:", e);
    // If quota exceeded, try removing oldest
    try {
      const index = getRecordingsList();
      if (index.length > 0) {
        const oldest = index.pop()!;
        localStorage.removeItem(RECORDING_PREFIX + oldest.id);
        localStorage.setItem(RECORDINGS_INDEX_KEY, JSON.stringify(index));
        // Retry
        localStorage.setItem(RECORDING_PREFIX + id, JSON.stringify(frames));
        index.unshift(session);
        localStorage.setItem(RECORDINGS_INDEX_KEY, JSON.stringify(index));
        return session;
      }
    } catch {
      // give up
    }
    return null;
  }
}

/**
 * Load the frames for a specific recording.
 */
export function loadRecordingFrames(id: string): RecordedFrame[] {
  try {
    const raw = localStorage.getItem(RECORDING_PREFIX + id);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Delete a recording and its frames.
 */
export function deleteRecording(id: string): void {
  localStorage.removeItem(RECORDING_PREFIX + id);
  const index = getRecordingsList().filter((r) => r.id !== id);
  localStorage.setItem(RECORDINGS_INDEX_KEY, JSON.stringify(index));
}

/**
 * Update transcript/translation on a recording session.
 */
export function updateRecordingMeta(
  id: string,
  updates: Partial<Pick<RecordingSession, "transcript" | "translation" | "targetLanguage" | "name">>
): void {
  const index = getRecordingsList();
  const found = index.find((r) => r.id === id);
  if (found) {
    Object.assign(found, updates);
    localStorage.setItem(RECORDINGS_INDEX_KEY, JSON.stringify(index));
  }
}

/**
 * Get estimated storage usage for recordings in bytes.
 */
export function getStorageUsage(): { used: number; recordings: number } {
  const index = getRecordingsList();
  let used = 0;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(RECORDING_PREFIX) || key === RECORDINGS_INDEX_KEY) {
      used += (localStorage.getItem(key) || "").length * 2; // UTF-16
    }
  }
  return { used, recordings: index.length };
}
