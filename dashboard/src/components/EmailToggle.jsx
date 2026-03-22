import { useState, useEffect } from 'react';
import { Mail, BellOff } from 'lucide-react';
import { dashboardAPI } from '../services/api';

export default function EmailToggle() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.getEmailStatus()
      .then((res) => setEnabled(res.data.enabled))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggle() {
    const next = !enabled;
    setLoading(true);
    try {
      const res = await dashboardAPI.setEmailEnabled(next);
      setEnabled(res.data.enabled);
    } catch {
      // revert on failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
        enabled
          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
      } disabled:opacity-50`}
      title={enabled ? 'Click to pause email alerts' : 'Click to resume email alerts'}
    >
      {enabled ? <Mail className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
      <span>{loading ? '...' : enabled ? 'Emails On' : 'Emails Off'}</span>
    </button>
  );
}
