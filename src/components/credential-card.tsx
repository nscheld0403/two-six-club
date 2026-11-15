"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, KeyIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** Shows a sign-in code once, with copy + save-to-file helpers. */
export function CredentialCard({ code, name }: { code: string; name?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const text = `Sign-in code${name ? ` for ${name}` : ""}\n\n${code}\n\nKeep this private. Anyone with this code can sign in as you.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sign-in-code.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-accent/40 bg-charcoal p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-eyebrow text-ash">
        <KeyIcon size={14} className="text-accent" /> Your sign-in code
      </div>
      <output
        aria-label="Sign-in code"
        className="block select-all break-all rounded-button bg-matte px-4 py-4 text-center font-mono text-[19px] font-semibold tracking-[0.06em] text-chalk"
      >
        {code}
      </output>
      <div className="flex gap-2">
        <Button variant={copied ? "soft" : "inverse"} size="sm" className="flex-1" onClick={copy}>
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          {copied ? "Copied" : "Copy code"}
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={download}>
          Save as file
        </Button>
      </div>
      <p className="m-0 text-[13px] leading-relaxed text-mist">
        This is the only time it&apos;s shown. Save it in your password manager or notes. You&apos;ll stay signed
        in on this device. If you lose the code, ask the coach to reset it.
      </p>
    </div>
  );
}
