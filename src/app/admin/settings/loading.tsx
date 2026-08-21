export default function SettingsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="h-8 w-32 bg-gray-200 rounded-lg" />

      {/* Settings sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="h-5 w-40 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-64 bg-gray-100 rounded mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-8 w-24 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
