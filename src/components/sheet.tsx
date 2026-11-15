"use client";

import { useEffect, useRef } from "react";

/** Bottom sheet on phones, centred dialog on larger screens. Uses native <dialog>. */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="mx-auto mb-0 mt-auto w-full max-w-[480px] rounded-t-hero border border-line bg-charcoal p-0 text-chalk backdrop:bg-black/70 sm:mb-auto sm:rounded-hero"
    >
      <div className="flex flex-col gap-4 px-5 pb-8 pt-3">
        <div className="mx-auto h-1 w-10 rounded-full bg-edge sm:hidden" aria-hidden="true" />
        {children}
      </div>
    </dialog>
  );
}
