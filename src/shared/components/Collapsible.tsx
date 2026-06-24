"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

interface CollapsibleProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: string;
  trailing?: ReactNode;
  defaultOpen?: boolean;
  variant?: "default" | "inline";
  className?: string;
  children: ReactNode;
}

export default function Collapsible({
  title,
  subtitle,
  icon,
  trailing,
  defaultOpen = false,
  variant = "default",
  className,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  const wrapperClasses = cn(
    variant === "default"
      ? "rounded-lg border border-black/5 dark:border-white/5 bg-surface"
      : "rounded-md border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]",
    className
  );

  const headerRowClasses = cn(
    "flex items-center gap-3",
    variant === "default" ? "p-4" : "p-3",
    "hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors",
    open && "border-b border-black/5 dark:border-white/5"
  );

  return (
    <div className={wrapperClasses}>
      <div className={headerRowClasses}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center gap-3 flex-1 min-w-0 text-left -m-1 p-1 rounded"
        >
          <span
            className="material-symbols-outlined text-text-muted text-[20px] shrink-0"
            aria-hidden="true"
          >
            {open ? "expand_more" : "chevron_right"}
          </span>
          {icon && (
            <span
              className="material-symbols-outlined text-text-muted text-[18px] shrink-0"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-main truncate">{title}</div>
            {subtitle && <div className="text-xs text-text-muted truncate">{subtitle}</div>}
          </div>
        </button>
        {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
      </div>
      {open && <div className={variant === "default" ? "p-4" : "p-3"}>{children}</div>}
    </div>
  );
}
