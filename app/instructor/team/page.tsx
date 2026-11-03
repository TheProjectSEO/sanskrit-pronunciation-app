'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, PageTitle, Spinner } from '@/components/admin/ui';
import { isSuperAdmin, ROLE_LABEL } from '@/lib/roles';

interface Member { id: string; email: string; name: string | null; first_name: string | null; last_name: string | null; role: string; last_login_at: string | null }

export default function TeamPage() {
  const { data: session } = useSession();
  const canEdit = isSuperAdmin(session?.user?.role);
  const [team, setTeam] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => fetch('/api/admin/team').then((r) => (r.ok ? r.json() : { team: [] })).then((d) => setTeam(d.team)).catch(() => setTeam([]));
  useEffect(() => { load(); }, []);

  const add = async () => {
    setMsg(null);
    const r = await fetch('/api/admin/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMsg({ ok: true, text: `${email} is now ${ROLE_LABEL[role]}.` }); setEmail(''); load(); }
    else setMsg({ ok: false, text: d.error || 'Could not add.' });
  };
  const change = async (id: string, newRole: string) => {
    setMsg(null);
    const r = await fetch('/api/admin/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: id, role: newRole }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setMsg({ ok: false, text: d.error || 'Could not change.' });
    load();
  };

  return (
    <>
      <PageTitle title="Team" sub="Everyone who signs up is a User. Admins manage mantras, user submissions and deities. Super admins can also add and remove admins and other super admins. Changes apply within five minutes." />
      {canEdit && (
        <Card className="mb-5">
          <h2 className="mb-3 font-bold text-brand-purple">Add an admin</h2>
          <p className="mb-3 text-sm text-text-secondary">The person must have signed up first.</p>
          <div className="flex flex-wrap gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className="min-h-11 min-w-56 flex-1 rounded-xl border border-line-strong px-3 focus:border-brand-pink focus:outline-none" />
            <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'super_admin')} className="min-h-11 rounded-xl border border-line-strong px-3 text-brand-purple">
              <option value="admin">Admin</option>
              <option value="super_admin">Super admin</option>
            </select>
            <button type="button" disabled={!email.includes('@')} onClick={add} className="min-h-11 rounded-xl bg-brand-pink px-5 font-medium text-white hover:bg-brand-pink-hover disabled:opacity-50">Add</button>
          </div>
        </Card>
      )}
      {msg && <p role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>{msg.text}</p>}
      {!team ? <Spinner /> : (
        <Card className="p-0 md:p-0">
          <ul className="divide-y divide-line">
            {team.map((m) => {
              const me = m.id === session?.user?.id;
              const role = m.role === 'instructor' ? 'admin' : m.role;
              return (
                <li key={m.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-brand-purple">{m.name || [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}{me ? ' (you)' : ''}</span>
                    <span className="text-sm break-all text-text-secondary">{m.email}</span>
                  </span>
                  {canEdit && !me ? (
                    <select value={role} onChange={(e) => change(m.id, e.target.value)} aria-label={`Role for ${m.email}`} className="min-h-10 w-full rounded-xl border border-line-strong px-3 text-sm text-brand-purple sm:w-auto">
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super admin</option>
                      <option value="user">Remove (back to User)</option>
                    </select>
                  ) : (
                    <span className="self-start rounded-full bg-card-purple px-3 py-1 text-sm text-brand-purple">{ROLE_LABEL[m.role] ?? m.role}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
