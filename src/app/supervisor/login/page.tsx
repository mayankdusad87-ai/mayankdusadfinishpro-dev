'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SupervisorLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push('/supervisor/home');
    }, 800);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Banner */}
      <div className="bg-navy-dark relative overflow-hidden px-6 pt-12 pb-10 flex flex-col items-center text-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-px h-full bg-white/20" />
          <div className="absolute top-0 right-1/3 w-px h-full bg-white/20" />
          <div className="absolute top-1/4 left-0 w-full h-px bg-white/20" />
        </div>

        {/* Logo */}
        <div className="relative z-10 mb-4">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
            <path d="M40 12L12 42V72H68V42L40 12Z" fill="#1B2A4A" stroke="white" strokeWidth="2" />
            <path d="M24 72V50H38V72" fill="white" opacity="0.3" />
            <path d="M46 50H60V64H46V50Z" fill="#3B82F6" opacity="0.4" />
            <ellipse cx="40" cy="16" rx="18" ry="10" fill="#E67E22" />
            <rect x="34" y="8" width="12" height="5" rx="2.5" fill="#E67E22" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white relative z-10">
          FINISHING<br /><span className="text-primary">PRO</span>
        </h1>

        {/* Hazard stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-repeating-stripe" />
      </div>

      {/* Login Form */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 relative z-10 px-6 pt-8 pb-6">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Site Supervisor</h2>
        <p className="text-sm text-gray-500 text-center mt-1 mb-8">Track progress. Ensure quality. Deliver on time.</p>

        <form onSubmit={handleSubmit} className="space-y-5 max-w-sm mx-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter mobile number"
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-lg rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-3 shadow-lg shadow-primary/30"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            )}
            SEND OTP
          </button>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-[#E67E22] w-5 h-5 mt-0.5"
            />
            <div>
              <div className="text-sm font-semibold text-gray-900">Remember this device</div>
              <div className="text-xs text-gray-500">Skip login on this device for 30 days</div>
            </div>
          </label>
        </form>

        {/* Bottom features */}
        <div className="grid grid-cols-4 gap-2 mt-10 pt-6 border-t border-gray-200 max-w-sm mx-auto">
          {[
            { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>, label: 'Secure', color: 'text-gray-600' },
            { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, label: 'Real-time', color: 'text-blue-500' },
            { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>, label: 'Track Progress', color: 'text-green-500' },
            { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>, label: 'Build Better', color: 'text-primary' },
          ].map((feat, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div className={feat.color}>{feat.icon}</div>
              <span className="text-[11px] font-semibold text-gray-700 mt-1">{feat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white py-4 text-center">
        <Link href="/login" className="text-sm text-gray-500 hover:text-primary transition-colors">
          Admin Portal Login
        </Link>
      </div>

      <style jsx>{`
        .bg-repeating-stripe {
          background: repeating-linear-gradient(
            -45deg,
            #E67E22,
            #E67E22 8px,
            #1B2A4A 8px,
            #1B2A4A 16px
          );
        }
      `}</style>
    </div>
  );
}
