import { useState } from 'react';
import MessageMap, { type MapMessage } from './MessageMap';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: MapMessage | null;
}

export default function LocationModal({ isOpen, onClose, message }: LocationModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !message || message.latitude === undefined || message.longitude === undefined) {
    return null;
  }

  const handleCopy = () => {
    const text = `${message.latitude}, ${message.longitude}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗺️</span>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Emergency Location View
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pinpointed coordinates from sender
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Interactive Map */}
        <div className="p-4 flex-1">
          <MessageMap messages={[message]} selectedMessageId={message.id} height="360px" />
        </div>

        {/* Details Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200">
                📍 {message.latitude.toFixed(6)}, {message.longitude.toFixed(6)}
              </span>
              <button
                onClick={handleCopy}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            {message.address && (
              <p className="text-xs text-gray-500 dark:text-gray-400">🏠 {message.address}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://maps.google.com/?q=${message.latitude},${message.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              Google Maps ↗
            </a>
            <button
              onClick={onClose}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
