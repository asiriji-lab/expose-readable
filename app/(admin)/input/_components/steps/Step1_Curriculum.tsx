'use client';

import { ScheduleFormData } from '../../_types';

interface Props {
  data: ScheduleFormData;
  onChange: <K extends keyof ScheduleFormData>(field: K, value: ScheduleFormData[K]) => void;
  errors: { [key: string]: string };
}

export function Step1_Curriculum({ data, onChange, errors }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Step 1 — Curriculum</h2>
        <p className="mt-1 text-sm text-gray-500">
          Provide basic schedule information and upload the curriculum CSV file.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Schedule Name
          </label>
          <input
            type="text"
            value={data.scheduleName}
            onChange={(e) => onChange('scheduleName', e.target.value)}
            placeholder="e.g. Semester 1/2567"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.scheduleName && (
            <p className="text-red-500 text-xs mt-1">{errors.scheduleName}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Academic Year
            </label>
            <input
              type="text"
              value={data.year}
              onChange={(e) => onChange('year', e.target.value)}
              placeholder="e.g. 2567"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.year && (
              <p className="text-red-500 text-xs mt-1">{errors.year}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Semester
            </label>
            <select
              value={data.semester}
              onChange={(e) => onChange('semester', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select semester</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
            {errors.semester && (
              <p className="text-red-500 text-xs mt-1">{errors.semester}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Curriculum File <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => onChange('curriculumFile', e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {data.curriculumFile && (
            <p className="text-green-600 text-xs mt-1">Selected: {data.curriculumFile.name}</p>
          )}
          {errors.curriculumFile && (
            <p className="text-red-500 text-xs mt-1">{errors.curriculumFile}</p>
          )}
        </div>
      </div>
    </div>
  );
}
