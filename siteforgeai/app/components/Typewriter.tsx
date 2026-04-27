"use client";

import { useEffect, useState } from "react";

const WORDS = [
  "Portfolio websites",
  "landing pages",
  "bussiness websites",
  "event websites",
  "resume / cv websites",
] as const;

const TYPING_MS = 80;
const PAUSE_AT_WORD_MS = 2000;
const DELETE_MS = 45;

export function Typewriter() {
  const [wordIndex, setWordIndex] = useState(0);
  const [display, setDisplay] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = WORDS[wordIndex];
    let t: ReturnType<typeof setTimeout>;

    if (!deleting) {
      if (display.length < full.length) {
        t = setTimeout(() => {
          setDisplay(full.slice(0, display.length + 1));
        }, TYPING_MS);
      } else {
        t = setTimeout(() => setDeleting(true), PAUSE_AT_WORD_MS);
      }
    } else {
      if (display.length > 0) {
        t = setTimeout(() => {
          setDisplay((d) => d.slice(0, -1));
        }, DELETE_MS);
      } else {
        t = setTimeout(() => {
          setDeleting(false);
          setWordIndex((i) => (i + 1) % WORDS.length);
        }, 0);
      }
    }

    return () => clearTimeout(t);
  }, [display, deleting, wordIndex]);

  return (
    <span
      className="inline-flex min-h-[1.2em] items-baseline"
      style={{
        background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {display}
      <span className="sf-typing-cursor" aria-hidden />
    </span>
  );
}
