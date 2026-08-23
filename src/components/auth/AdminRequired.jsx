import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabase.js';

function AdminAccessState({ dark, title, copy, action }) {
  return (
    <main className="min-h-[62vh] grid place-items-center px-5 py-14">
      <section className={`w-full max-w-xl rounded-[28px] border p-7 text-center ${
        dark
          ? 'bg-charcoal-900/76 border-gold-500/18 shadow-[0_30px_100px_rgba(0,0,0,0.28)]'
          : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <ShieldAlert size={28} className="mx-auto mb-3 text-gold-400" aria-hidden="true" />
        <h1 className={`font-display text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h1>
        <p className={`mx-auto mt-3 max-w-md text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>{copy}</p>
        {action}
      </section>
    </main>
  );
}

export function AdminRequired({ dark, user, loading, children }) {
  const [allowed, setAllowed] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (loading) return () => { active = false; };
    if (!user || !supabaseConfigured || !supabase) {
      setAllowed(false);
      return () => { active = false; };
    }

    setAllowed(null);
    setError('');
    supabase.rpc('is_platform_admin').then(({ data, error: rpcError }) => {
      if (!active) return;
      if (rpcError) {
        setError('CreatorBridge could not verify administrative access. Please try again.');
        setAllowed(false);
        return;
      }
      setAllowed(data === true);
    });

    return () => { active = false; };
  }, [loading, user?.id]);

  if (loading || (user && allowed === null)) {
    return <AdminAccessState dark={dark} title="Checking admin access" copy="Verifying the locked CreatorBridge administrator roster before loading platform controls." />;
  }

  if (allowed === true) return children;

  if (!user) {
    return (
      <AdminAccessState
        dark={dark}
        title="Administrator sign-in required"
        copy="Sign in with an account listed in the CreatorBridge administrator roster."
        action={(
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'login', role: 'client' } }))}
            className="mt-6 rounded-xl bg-gold-500 px-5 py-3 text-sm font-bold text-charcoal-900 hover:bg-gold-600">
            Sign In
          </button>
        )}
      />
    );
  }

  return (
    <AdminAccessState
      dark={dark}
      title="Access denied"
      copy={error || 'This account is authenticated but is not listed in the CreatorBridge administrator roster.'}
    />
  );
}
