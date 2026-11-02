'use client';

interface Option<T extends string | number> { value: T; label: string }

/** A pressed-in segmented control, 48 px tall, radio semantics. */
export function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-paper-edge bg-paper-deep p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-11 flex-1 rounded-lg px-2 text-[0.95rem] transition-colors ${on ? 'bg-paper font-semibold text-ink shadow-[0_1px_2px_rgba(43,26,16,0.18)]' : 'text-ink-soft hover:text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
