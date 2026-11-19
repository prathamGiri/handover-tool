"use client";

import { useState } from "react";
import { IconCopy, IconWhatsApp } from "./icons";

export function InviteShare({ teamName, path }: { teamName: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}${path}`;

  const message = () =>
    `Join *${teamName}* on Handover to share progress on your projects:\n${link()}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invite link:", link());
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          window.open(`https://wa.me/?text=${encodeURIComponent(message())}`, "_blank", "noopener");
        }}
        className="btn bg-[#25D366] text-white"
      >
        <IconWhatsApp className="h-5 w-5" /> WhatsApp
      </a>
      <button type="button" onClick={copy} className="btn-secondary">
        <IconCopy className="h-5 w-5" /> {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
