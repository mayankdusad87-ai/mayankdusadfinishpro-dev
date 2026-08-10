'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';

export default function AdminLoginPage() {
  const router = useRouter();
  const { signIn, user, profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'admin' || profile.role === 'management') {
        router.replace('/admin/dashboard');
      }
    }
  }, [loading, user, profile, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const { error: authError } = await signIn(email, password);
    if (authError) {
      setError(authError);
      setSubmitting(false);
      return;
    }
    router.replace('/admin/dashboard');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#162032]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ---- Left Branding Panel (desktop) / Top Banner (mobile) ---- */}
      <div className="relative md:w-[48%] lg:w-[45%] bg-[#162032] overflow-hidden flex flex-col items-center justify-center px-8 py-12 md:py-0 md:min-h-screen">
        {/* Subtle geometric pattern */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-[20%] left-[15%] w-64 h-64 border border-white/40 rounded-full" />
          <div className="absolute bottom-[10%] right-[10%] w-96 h-96 border border-white/30 rounded-full" />
          <div className="absolute top-[60%] left-[60%] w-40 h-40 border border-white/20 rounded-full" />
        </div>

        {/* Gold accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          {/* Logo */}
          <div className="mb-6 md:mb-8">
            <Image
              src="/raghav-realty-logo.png"
              alt="Raghav Realty"
              width={220}
              height={80}
              className="h-16 md:h-20 w-auto brightness-0 invert"
              priority
            />
          </div>

          {/* Divider */}
          <div className="w-12 h-0.5 bg-primary rounded-full mb-6 md:mb-8" />

          {/* App name */}
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Finishing Pro
          </h1>
          <p className="text-sm md:text-base text-gray-400 mt-2 leading-relaxed">
            Construction Finishing Management System
          </p>

          {/* Feature pills — desktop only */}
          <div className="hidden md:flex flex-wrap justify-center gap-2 mt-10">
            {['Real-time Tracking', 'Vendor Scorecard', 'Floor Analytics', 'Photo Documentation'].map(feat => (
              <span key={feat} className="px-3 py-1.5 rounded-full text-[11px] font-medium text-gray-400 border border-gray-700 bg-white/[0.03]">
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom copyright — desktop only */}
        <div className="hidden md:block absolute bottom-6 text-center">
          <p className="text-[11px] text-gray-600">© 2026 Raghav Group. All rights reserved.</p>
        </div>
      </div>

      {/* ---- Right Login Form ---- */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-10 md:py-0">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in to the Head Office Portal</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">Email Address</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">Password</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#162032] hover:bg-[#1e2d45] text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10 cursor-pointer"
            >
              {submitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Sign In
            </button>
          </form>

          {/* Supervisor link */}
          <div className="mt-8 pt-5 border-t border-gray-200 text-center">
            <Link href="/supervisor/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.024 1.194-.14 1.743" />
              </svg>
              Site Supervisor? Login here
            </Link>
          </div>

          {/* Mobile copyright */}
          <p className="md:hidden text-[11px] text-gray-400 text-center mt-8">© 2026 Raghav Group</p>
        </div>
      </div>
    </div>
  );
}
