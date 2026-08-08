'use client';

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-20 h-20' : size === 'md' ? 'w-12 h-12' : 'w-8 h-8';
  return (
    <div className={`${dims} relative flex-shrink-0`}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 10L15 45V90H85V45L50 10Z" fill="#162032" stroke="#C8922A" strokeWidth="3" />
        <path d="M30 90V55H45V90" fill="#C8922A" />
        <path d="M55 55H75V70H55V55Z" fill="#3B82F6" opacity="0.6" />
        <path d="M20 30L50 5L80 30" stroke="#C8922A" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="50" cy="8" rx="12" ry="6" fill="#C8922A" />
        <rect x="44" y="2" width="12" height="4" rx="2" fill="#C8922A" />
      </svg>
    </div>
  );
}
