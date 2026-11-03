'use client';

interface Option<T extends string | number> { value: T; label: string }

/** A pressed-in segmented control, 48 px tall, radio semantics. */
export function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-card-purple p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-11 flex-1 rounded-lg px-2 text-[0.95rem] transition-colors ${on ? 'bg-white font-semibold text-brand-pink shadow-sm' : 'text-brand-purple hover:text-brand-pink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
