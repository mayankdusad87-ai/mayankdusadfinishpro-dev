'use client';

interface PhotoPromptModalProps {
  onConfirm: (withPhoto: boolean) => void;
  onCancel: () => void;
}

export default function PhotoPromptModal({ onConfirm, onCancel }: PhotoPromptModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl mx-6 p-5 shadow-xl w-full max-w-xs md:max-w-sm">
        <h3 className="text-base font-bold text-gray-900 mb-1">Photo Required</h3>
        <p className="text-sm text-gray-500 mb-5">A photo is mandatory to mark this activity as completed.</p>
        <div className="space-y-2">
          <button
            onClick={() => onConfirm(true)}
            className="w-full py-2.5 bg-primary text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
            Add Photo & Complete
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
