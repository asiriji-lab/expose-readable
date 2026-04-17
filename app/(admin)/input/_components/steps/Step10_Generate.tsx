"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const MOCK_MESSAGES = [
  { threshold: 0, text: "Initializing generation engine..." },
  { threshold: 20, text: "Analyzing curriculum constraints..." },
  { threshold: 40, text: "Optimizing teacher schedules..." },
  { threshold: 60, text: "Assigning rooms and resources..." },
  { threshold: 80, text: "Verifying student conflicts..." },
  { threshold: 95, text: "Finalizing schedule..." }
];

import { ScheduleFormData } from '../../_types';
import { submitScheduleJob, getJobStatus } from '@/api/schedule';

export function Step10_Generate({
  data,
  onGenerate,
  completedSteps
}: {
  data: ScheduleFormData;
  onGenerate: () => Promise<boolean>;
  completedSteps: number[];
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");

  const handleGenerate = async () => {
    // Validate that we have the absolutely required files
    if (!data.curriculumFile || !data.roomFile) {
      setStatus("Error: Curriculum and Room files are required.");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setStatus("Submitting data to backend...");

    try {
      // 1. Submit the job
      const res = await submitScheduleJob({
        curriculum: data.curriculumFile,
        room: data.roomFile,
        elective: data.electiveFile || undefined,
        teacher: data.teacherFile || undefined,
        period: data.periodFile || undefined,
        student: data.studentFile || undefined,
        preplace: data.constraintFile || undefined, // Preplace maps to constraint
        scout: data.scoutFile || undefined,
        jobName: data.scheduleName || 'Generated Schedule',
        academicYear: data.year ? String(data.year) : undefined,
        semester: data.semester === '1' || data.semester === '2' ? Number(data.semester) as 1|2 : undefined,
      });

      const jobId = res.job_id;
      if (!jobId) throw new Error("No job ID received");

      // 2. Poll for status
      let isDone = false;
      while (!isDone) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await getJobStatus(jobId);
        
        const prog = statusRes.progress || 0;
        setProgress(prog);

        const currentMessage = MOCK_MESSAGES.slice().reverse().find(m => prog >= m.threshold);
        if (currentMessage) {
          setStatus(currentMessage.text);
        }

        if (statusRes.status === 'completed') {
          isDone = true;
          setProgress(100);
          setStatus("Schedule generated successfully!");
        } else if (statusRes.status === 'failed') {
          throw new Error(statusRes.error || "Generation failed on server");
        }
      }

      // 3. Redirect with Job ID!
      setTimeout(() => {
        setIsGenerating(false);
        router.push(`/schedule?job_id=${encodeURIComponent(jobId)}`);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message || 'Unknown error occurred'}`);
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-black">
        Generate Schedule
      </h2>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            All data has been collected. Click the button below to generate your schedule.
          </p>

          {isGenerating && (
            <div className="space-y-3 max-w-md mx-auto">
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
                <div
                  className="bg-primary h-full transition-all duration-100 ease-linear relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute top-0 left-0 bottom-0 right-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 font-medium">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`
              px-8 py-3 rounded-lg font-medium text-white
              transition-all duration-200
              ${isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90 active:scale-95 shadow-md hover:shadow-lg'
              }
            `}
          >
            {isGenerating ? 'Generating...' : 'Generate Schedule'}
          </button>
        </div>

        {/* Summary of collected data */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-black mb-4">Data Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Curriculum:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(1) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Teachers:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(2) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Electives:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(3) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Scout Activities:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(4) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Periods:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(5) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Students:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(6) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Rooms:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(7) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Constraints:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(8) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Related Files:</span>
              <span className="font-medium text-black">
                {completedSteps.includes(9) ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
