import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { submitScheduleJob } from '../../../../lib/api/scheduleApi';
import { useJobStatus } from '../../../../lib/hooks/useJobStatus';

interface UploadModalProps {
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

const REQUIRED_FILES = ['curriculum', 'room'] as const;
const OPTIONAL_FILES = ['teacher', 'period', 'elective', 'preplace', 'student', 'scout'] as const;
type FileKey = typeof REQUIRED_FILES[number] | typeof OPTIONAL_FILES[number];

const FILE_LABELS: Record<FileKey, string> = {
  curriculum: 'Curriculum CSV',
  room:       'Room CSV',
  teacher:    'Teacher CSV',
  period:     'Period CSV',
  elective:   'Elective CSV',
  preplace:   'Pre-placement CSV',
  student:    'Student CSV',
  scout:      'Scout CSV',
};

export default function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const { job, error: pollError } = useJobStatus(jobId, 1000);

  const handleFile = (key: FileKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(prev => ({ ...prev, [key]: e.target.files?.[0] ?? undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.curriculum || !files.room) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await submitScheduleJob({
        curriculum: files.curriculum,
        room:       files.room,
        teacher:    files.teacher,
        period:     files.period,
        elective:   files.elective,
        preplace:   files.preplace,
        student:    files.student,
        scout:      files.scout,
      });
      setJobId(res.job_id);
    } catch (err) {
      setSubmitError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (job?.status === 'completed') {
      onSuccess(job.job_id);
    }
  }, [job?.status, job?.job_id, onSuccess]);

  const isPolling = !!jobId && job?.status !== 'completed' && job?.status !== 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface w-full max-w-lg rounded-xl p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Generate New Schedule</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-alt rounded"><X className="w-5 h-5"/></button>
        </div>

        {submitError || pollError || job?.status === 'failed' ? (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {submitError || pollError || job?.error || 'Generation failed'}
          </div>
        ) : null}

        {isPolling ? (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="font-medium animate-pulse">Running Genetic Algorithm...</p>
            <p className="text-sm text-foreground-muted capitalize">Status: {job?.status.replace('_', ' ')}</p>
            {job?.progress_details && (
              <p className="text-xs text-foreground-muted mt-2">
                Gen {job.progress_details.generation} / {job.progress_details.max_generations}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-xs text-foreground-muted mb-1">* Required</p>

            {REQUIRED_FILES.map(key => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">{FILE_LABELS[key]} *</label>
                <input
                  type="file" accept=".csv" required
                  onChange={handleFile(key)}
                  className="w-full text-sm border border-border rounded-lg p-2.5 bg-background"
                />
              </div>
            ))}

            <div className="border-t border-border pt-3">
              <p className="text-xs text-foreground-muted mb-2">Optional files</p>
              {OPTIONAL_FILES.map(key => (
                <div key={key} className="mb-3">
                  <label className="block text-sm font-medium mb-1">{FILE_LABELS[key]}</label>
                  <input
                    type="file" accept=".csv"
                    onChange={handleFile(key)}
                    className="w-full text-sm border border-border rounded-lg p-2.5 bg-background"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={!files.curriculum || !files.room || isSubmitting}
              className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 disabled:opacity-50 mt-2"
            >
              {isSubmitting ? 'Starting Engine...' : 'Generate Schedule'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
