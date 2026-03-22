import { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, UserMinus } from 'lucide-react';
import { dashboardAPI } from '../services/api';

export default function EmailSubscribe() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error | unsubscribed
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('subscribe'); // subscribe | unsubscribe

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    try {
      if (mode === 'subscribe') {
        await dashboardAPI.subscribe(email);
        setStatus('success');
        setMessage('Subscribed! You\'ll receive critical meter alerts.');
      } else {
        await dashboardAPI.unsubscribe(email);
        setStatus('unsubscribed');
        setMessage('Unsubscribed. You will no longer receive alert emails.');
      }
      setEmail('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (mode === 'subscribe' && (detail?.includes?.('already') || err.response?.status === 409)) {
        setStatus('success');
        setMessage('Already subscribed — you\'re all set!');
      } else if (mode === 'unsubscribe' && err.response?.status === 404) {
        setStatus('error');
        setMessage('This email is not in our subscriber list.');
      } else {
        setStatus('error');
        setMessage(mode === 'subscribe' ? 'Could not subscribe. Please try again.' : 'Could not unsubscribe. Please try again.');
      }
    }
  }

  return (
    <div data-tour="email-subscribe">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            placeholder={mode === 'subscribe' ? 'Enter your email for alerts' : 'Enter email to unsubscribe'}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className={`px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${
            mode === 'subscribe'
              ? 'bg-[#0071E3] hover:bg-[#0077ED]'
              : 'bg-gray-600 hover:bg-gray-700'
          }`}
        >
          {status === 'loading'
            ? (mode === 'subscribe' ? 'Subscribing...' : 'Removing...')
            : (mode === 'subscribe' ? 'Subscribe' : 'Unsubscribe')
          }
        </button>
      </form>

      {status === 'success' && (
        <div className="flex items-center gap-1.5 mt-2 text-green-600 text-xs">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{message}</span>
        </div>
      )}
      {status === 'unsubscribed' && (
        <div className="flex items-center gap-1.5 mt-2 text-gray-600 text-xs">
          <UserMinus className="w-3.5 h-3.5" />
          <span>{message}</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-1.5 mt-2 text-red-500 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{message}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setMode(mode === 'subscribe' ? 'unsubscribe' : 'subscribe'); setStatus('idle'); setEmail(''); }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
        >
          {mode === 'subscribe' ? 'Want to opt out? Unsubscribe here' : '← Back to subscribe'}
        </button>
        <span className="text-[10px] text-gray-300">
          Issues? <a href="mailto:vishwakumaresh@gmail.com" className="text-gray-400 hover:text-[#0071E3] transition-colors">vishwakumaresh@gmail.com</a>
        </span>
      </div>
    </div>
  );
}
