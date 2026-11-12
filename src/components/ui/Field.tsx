type Base = { label: string; name: string; hint?: string; className?: string };

export function Field({ label, name, hint, className, ...rest }: Base & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      <input name={name} className="input" {...rest} />
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, name, hint, className, rows = 4, ...rest }: Base & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      <textarea name={name} rows={rows} className="input" {...rest} />
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Select({
  label,
  name,
  hint,
  options,
  className,
  ...rest
}: Base & { options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      <select name={name} className="input" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, name, hint, defaultChecked, value }: { label: string; name: string; hint?: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-silver-300 accent-electric" />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="hint block">{hint}</span>}
      </span>
    </label>
  );
}
