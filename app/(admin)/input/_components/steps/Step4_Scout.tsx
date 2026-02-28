import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faPen, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import FileDropzone from '../file-upload/FileDropzone';
import CsvEditor from '../CsvEditor';
import { SCOUT_VALIDATION_RULES } from '../validationUtils';
import { useCsvStep } from '../hooks/useCsvStep';

/**
 * Step 4: Scout Data Upload
 * 
 * Handles uploading and validation of scout activity data.
 * Uses useCsvStep hook for shared logic.
 */
import { StepProps } from '../../_types';

export function Step4_Scout({ data, onChange, errors }: StepProps) {
    const {
        isEditing,
        setIsEditing,
        validationErrors,
        isValidating,
        handleSave,
        handleRemove
    } = useCsvStep({
        file: data.scoutFile,
        onFileChange: (file) => onChange('scoutFile', file),
        validationRules: SCOUT_VALIDATION_RULES,
        catchAllRule: { required: false, pattern: /^[TE]\d{3}$/, message: "Must be a valid Teacher ID (e.g., T001)" }
    });

    if (isEditing && data.scoutFile) {
        return (
            <CsvEditor
                file={data.scoutFile}
                onClose={() => setIsEditing(false)}
                onSave={handleSave}
                validationRules={SCOUT_VALIDATION_RULES}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-black">Scout Activities</h3>
                    <p className="text-sm text-gray-400">Upload the scout activity data file</p>
                </div>
                <a href="/example_csv/example_scout.csv" download className="text-sm text-blue-600 hover:underline flex items-center gap-2">
                    <FontAwesomeIcon icon={faDownload} />
                    example_scout.csv
                </a>
            </div>

            {data.scoutFile ? (
                <div className="flex flex-col gap-2">
                    <div className={`flex items-center justify-between p-4 border rounded-xl ${validationErrors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${validationErrors.length > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                <FontAwesomeIcon icon={validationErrors.length > 0 ? faExclamationTriangle : faDownload} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">{data.scoutFile.name}</p>
                                <p className="text-xs text-gray-500">{(data.scoutFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit CSV"
                            >
                                <FontAwesomeIcon icon={faPen} />
                            </button>
                            <button
                                onClick={handleRemove}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="Remove file"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {isValidating && (
                        <p className="text-sm text-gray-500 animate-pulse">Validating file...</p>
                    )}

                    {!isValidating && validationErrors.length > 0 && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                            <h4 className="text-sm font-medium text-red-800 mb-2">Validation Errors Found:</h4>
                            <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                                {validationErrors.map((err, index) => (
                                    <li key={index}>{err}</li>
                                ))}
                                {validationErrors.length >= 10 && (
                                    <li className="italic text-xs mt-2">...and more errors. Please check the file.</li>
                                )}
                            </ul>
                            <p className="text-xs text-red-500 mt-3">
                                Please edit the file to fix these issues.
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <FileDropzone
                    onFileSelect={(file) => onChange('scoutFile', file)}
                    title="Upload Scout Data"
                />
            )}
        </div>
    )
}