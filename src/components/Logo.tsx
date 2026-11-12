export function Logo({ className = "", light = true }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="JND">
      <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
        <rect width="40" height="40" rx="9" fill="#087BFF" />
        <path d="M11 27.5c1.4 1.6 3.2 2.5 5.4 2.5 3.7 0 5.6-2.3 5.6-6.3V10h-4v13.6c0 1.9-.7 2.8-2.1 2.8-1 0-1.9-.5-2.6-1.4L11 27.5Z" fill="#F4F6FA" />
        <path d="M25 10h4v20h-4z" fill="#F4F6FA" opacity=".55" />
      </svg>
      <span className={`font-display text-xl font-extrabold tracking-[0.25em] ${light ? "text-snow" : "text-navy"}`}>JND</span>
    </span>
  );
}
