// components/ui/MessageContainer.jsx
export function MessageContainer({ error, success, copySuccess, onClearMessages, onClearCopySuccess }) {
  if (!error && !success && !copySuccess) return null;

  return (
    <div className="mb-6 max-w-2xl mx-auto">
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-red-200">{error}</p>
            <button onClick={onClearMessages} className="text-red-200 hover:text-white">✕</button>
          </div>
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-green-200">{success}</p>
            <button onClick={onClearMessages} className="text-green-200 hover:text-white">✕</button>
          </div>
        </div>
      )}
      {copySuccess && (
        <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-blue-200">✅ RSS URL copied to clipboard!</p>
            <button onClick={onClearCopySuccess} className="text-blue-200 hover:text-white">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageContainer;
