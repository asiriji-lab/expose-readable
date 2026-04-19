'use client';

import { ScheduleFormData } from '../../_types';

interface Props {
  data: ScheduleFormData;
  onChange: <K extends keyof ScheduleFormData>(field: K, value: ScheduleFormData[K]) => void;
  errors: { [key: string]: string };
}

export function Step9_RelatedFiles({ data, onChange, errors }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Step 9 — Related Files</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload any additional related files needed for schedule generation.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Related File
        </label>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => onChange('relatedFile', e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {data.relatedFile && (
          <p className="text-green-600 text-xs mt-1">Selected: {data.relatedFile.name}</p>
        )}
        {errors.relatedFile && (
          <p className="text-red-500 text-xs mt-1">{errors.relatedFile}</p>
        )}
      </div>
    </div>
  );
}
