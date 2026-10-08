import { cn } from "@/lib/utils";

export function GemFlowMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground", className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" className="size-6" fill="none">
        <path d="M16 4 26 11.5 22 25H10L6 11.5 16 4Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m6 11.5 10 4.25 10-4.25M16 4v11.75M10 25l6-9.25L22 25" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
