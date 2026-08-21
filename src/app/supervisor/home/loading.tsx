export default function SupervisorHomeLoading() {
  return (
    <div className="min-h-screen bg-[#162032]">
      <div className="max-w-md md:max-w-3xl lg:max-w-4xl mx-auto animate-pulse">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-full" />
            <div>
              <div className="h-4 w-24 bg-white/10 rounded mb-1" />
              <div className="h-3 w-32 bg-white/10 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-9 h-9 bg-white/10 rounded-lg" />
            <div className="w-9 h-9 bg-white/10 rounded-lg" />
          </div>
        </div>

        {/* Project selector */}
        <div className="px-4 md:px-6 pb-3">
          <div className="h-10 bg-white/10 rounded-xl" />
        </div>

        {/* Priority summary cards */}
        <div className="px-4 md:px-6 pb-3">
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3 text-center">
                <div className="h-6 w-8 bg-white/10 rounded mx-auto mb-1" />
                <div className="h-3 w-14 bg-white/10 rounded mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Floor tabs */}
        <div className="px-4 md:px-6 pb-2">
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 w-16 bg-white/10 rounded-lg flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Status filter strip */}
        <div className="px-4 md:px-6 pb-3">
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Activity cards */}
        <div className="px-4 md:px-6 space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="h-4 w-40 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-24 bg-white/10 rounded" />
                </div>
                <div className="h-6 w-20 bg-white/10 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 bg-white/10 rounded" />
                <div className="h-3 w-16 bg-white/10 rounded" />
                <div className="h-3 w-12 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
