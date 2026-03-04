'use client';

export interface InboxMessage {
  id: number;
  senderName: string;
  topic: string;
  since: string;
  unread?: boolean;
}

interface InboxOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: InboxMessage[];
}

export default function InboxOverlay({ isOpen, onClose, messages }: InboxOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-[760px] max-w-[94vw] min-h-[620px] rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
        <div className="px-7 py-6 border-b border-gray-200 bg-indigo-600">
          <h3 className="text-5xl font-medium text-white">Inbox</h3>
        </div>

        <div className="p-7">
          <div className="border border-gray-300 bg-white">
            <div className="grid grid-cols-[200px_1fr_100px] border-b border-gray-300 bg-gray-100 text-gray-700 text-sm font-medium">
              <div className="px-4 py-3">Sender’s Name</div>
              <div className="px-4 py-3">Topic</div>
              <div className="px-4 py-3">Since</div>
            </div>

            {messages.map((message) => (
              <div
                key={message.id}
                className={`grid grid-cols-[200px_1fr_100px] border-b border-gray-200 last:border-b-0 text-sm ${message.unread ? 'bg-blue-50/40' : 'bg-white'}`}
              >
                <div className="px-4 py-3 text-gray-800">{message.senderName}</div>
                <div className="px-4 py-3 text-gray-800">{message.topic}</div>
                <div className="px-4 py-3 text-gray-800">{message.since}</div>
              </div>
            ))}

            {messages.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No messages</div>
            )}
          </div>

          <div className="absolute left-0 right-0 bottom-0 px-7 py-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-gray-300 bg-gray-100 px-6 text-base text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
