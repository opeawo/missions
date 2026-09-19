"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export function AccountMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn-icon btn-secondary"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="flex flex-col gap-1.5">
          <span className="block h-px w-3.5 bg-current" />
          <span className="block h-px w-3.5 bg-current" />
          <span className="block h-px w-3.5 bg-current" />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-56 border border-border bg-background py-2"
        >
          <p className="text-label px-4 py-2 text-muted-foreground">{name}</p>
          <Link
            role="menuitem"
            href="/me"
            className="block px-4 py-2.5 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <form action={signOut}>
            <button role="menuitem" className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted" type="submit">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
