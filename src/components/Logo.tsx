export function Logo({ className = "", light = true }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="JND">
      <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
        <rect width="40" height="40" rx="9" fill="#087BFF" />
        <path d="M9 12h22M9 20h14M9 28h22" stroke="#F4F6FA" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="29" cy="20" r="2.4" fill="#101827" />
      </svg>
      <span className={`font-display text-xl font-extrabold tracking-[0.25em] ${light ? "text-snow" : "text-navy"}`}>JND</span>
    </span>
  );
}
