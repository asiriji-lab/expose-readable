'use client';

import { ArrowLeft } from 'lucide-react';
import { ScheduleItem } from '@/app/(admin)/schedule/_utils/dummyData';

interface TeacherSlotInfoOverlayProps {
  isOpen: boolean;
  day: string;
  slot: number;
  item: ScheduleItem | null;
  onClose: () => void;
}

export default function TeacherSlotInfoOverlay({ isOpen, day, slot, item, onClose }: TeacherSlotInfoOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-[360px] max-w-[92vw] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="bg-indigo-600 px-5 py-4">
          <h3 className="text-2xl font-medium text-white">Slot {slot} : {day}</h3>
        </div>

        <div className="px-5 pt-5 pb-24 bg-gray-50 min-h-[360px]">
          <h4 className="text-xl font-semibold text-gray-900 mb-5">Slots Info</h4>

          <div className="space-y-3">
            <div className="grid grid-cols-[82px_1fr] items-center gap-3">
              <label className="text-base text-gray-500 text-right">Subject</label>
              <input
                readOnly
                value={item?.subjectCode || ''}
                className="h-11 w-full rounded border border-gray-300 bg-gray-100 px-3 text-base text-gray-700"
              />
            </div>

            <div className="grid grid-cols-[82px_1fr] items-center gap-3">
              <label className="text-base text-gray-500 text-right">Class</label>
              <input
                readOnly
                value={item?.classCode || ''}
                className="h-11 w-full rounded border border-gray-300 bg-gray-100 px-3 text-base text-gray-700"
              />
            </div>

            <div className="grid grid-cols-[82px_1fr] items-center gap-3">
              <label className="text-base text-gray-500 text-right">Room</label>
              <input
                readOnly
                value={item?.room || ''}
                className="h-11 w-full rounded border border-gray-300 bg-gray-100 px-3 text-base text-gray-700"
              />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-300 bg-gray-100 px-3 text-sm text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
