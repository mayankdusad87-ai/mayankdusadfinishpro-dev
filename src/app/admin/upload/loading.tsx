export default function UploadLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="h-8 w-36 bg-gray-200 rounded-lg" />

      {/* Upload zone */}
      <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-3 w-36 bg-gray-100 rounded" />
      </div>

      {/* Previous uploads table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="h-5 w-36 bg-gray-200 rounded m-5 mb-3" />
        <div className="h-10 bg-gray-50 border-b border-gray-100" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50">
            <div className="h-4 w-40 bg-gray-200 rounded flex-1" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
