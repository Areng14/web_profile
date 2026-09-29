"use client";

import { useState } from "react";

// Copies text to the clipboard and briefly confirms it
export default function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the text is still visible to copy by hand
    }
  };

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
