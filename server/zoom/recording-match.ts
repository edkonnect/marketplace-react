/**
 * Recording / transcript match helper
 *
 * Tutors share Zoom rooms, so before attaching a fetched transcript to a session
 * we confirm it belongs to that session's class. The old check only looked for the
 * first 4 letters of the STUDENT's first name, which fails whenever the student joins
 * under a parent's name, a nickname or a device name, or when the name is never spoken.
 *
 * This version checks the student's first and last name AND the parent's name, matching
 * on word starts so small spelling differences still have a chance.
 */

export type TranscriptMatchResult = {
  ok: boolean;
  /** Name keys we looked for (lowercase, normalized) */
  keys: string[];
  /** The first key that was found in the transcript, if any */
  hit: string | null;
  /** True when there were no usable names, so nothing could be verified */
  unverifiable: boolean;
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Turn names into search keys: every word of 3+ letters, cut to its first 4 letters.
 * e.g. "Hitesh Kalidindi" -> ["hite", "kali"], "Raju" -> ["raju"]
 */
export function buildNameKeys(names: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    for (const word of normalize(String(name)).split(" ")) {
      if (word.length < 3) continue;
      keys.add(word.length > 4 ? word.slice(0, 4) : word);
    }
  }
  return Array.from(keys);
}

/**
 * Check whether the transcript mentions any of the given names (as a speaker label
 * or in the spoken text). Words are matched at the start of a word; 3-letter names
 * must match as a whole word so "sam" does not match "sample".
 *
 * Second pass: if no key matched, compare the speaker labels to the FULL name words
 * and accept a shared 3-letter start, so a nickname like "raji" matches "Rajalakshmi".
 */
export function checkTranscriptMatchesSession(
  transcript: string,
  names: Array<string | null | undefined>
): TranscriptMatchResult {
  const keys = buildNameKeys(names);

  if (keys.length === 0) {
    return { ok: true, keys, hit: null, unverifiable: true };
  }

  const haystack = ` ${normalize(transcript)} `;

  for (const key of keys) {
    const found =
      key.length <= 3 ? haystack.includes(` ${key} `) : haystack.includes(` ${key}`);
    if (found) {
      return { ok: true, keys, hit: key, unverifiable: false };
    }
  }

  // Second pass: nicknames/device names. Compare speaker labels to the FULL name words.
  const fullWords = new Set<string>();
  for (const n of names) {
    if (!n) continue;
    for (const w of normalize(String(n)).split(" ")) if (w.length >= 3) fullWords.add(w);
  }
  const prefixLen = (a: string, b: string) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  };
  for (const speaker of listTranscriptSpeakers(transcript, 20)) {
    for (const sw of normalize(speaker).split(" ")) {
      if (sw.length < 3) continue;
      for (const w of Array.from(fullWords)) {
        if (prefixLen(sw, w) >= 3) {
          return { ok: true, keys, hit: "nick:" + sw, unverifiable: false };
        }
      }
    }
  }

  return { ok: false, keys, hit: null, unverifiable: false };
}

/**
 * List the distinct speaker labels in a plain-text transcript ("Name: text" lines).
 * Used only for logging, so a failed match shows who was actually in the recording.
 */
export function listTranscriptSpeakers(transcript: string, max: number = 8): string[] {
  const speakers = new Set<string>();
  for (const line of transcript.split("\n")) {
    const m = line.match(/^([^:]{2,40}):\s/);
    if (m) {
      speakers.add(m[1].trim());
      if (speakers.size >= max) break;
    }
  }
  return Array.from(speakers);
}