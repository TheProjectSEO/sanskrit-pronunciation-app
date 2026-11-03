import type { ReactNode } from 'react';

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand-purple md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-text-secondary">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[15px] border border-line bg-white p-4 md:p-5 ${className}`}>{children}</div>;
}

const STATUS: Record<string, string> = {
  published: 'bg-success-bg text-success',
  draft: 'bg-card-purple text-brand-purple',
  submitted: 'bg-warning-bg text-warning',
  private: 'bg-card-blue text-brand-purple',
  rejected: 'bg-danger-bg text-danger',
};
const STATUS_LABEL: Record<string, string> = { published: 'Published', draft: 'Draft', submitted: 'Submitted', private: 'Private (user)', rejected: 'Rejected' };

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[status] ?? 'bg-card-purple text-brand-purple'}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Spinner() {
  return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-pink" /></div>;
}
