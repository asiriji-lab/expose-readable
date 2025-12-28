import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faPen, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import FileDropzone from '../file-upload/FileDropzone';
import CsvEditor from '../CsvEditor';
import { STUDENT_VALIDATION_RULES, validateFile } from '../validationUtils';

export function Step6_Student({ data, onChange, errors }: { data: any; onChange: (field: string, value: any) => void; errors: { [key: string]: string } }) {
    const [isEditing, setIsEditing] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isValidating, setIsValidating] = useState(false);

    // Validate file whenever it changes (if it exists)
    useEffect(() => {
        if (data.studentFile) {
            handleFileValidation(data.studentFile);
        } else {
            setValidationErrors([]);
        }
    }, [data.studentFile]);

    const handleFileValidation = async (file: File) => {
        setIsValidating(true);
        try {
            const result = await validateFile(file, STUDENT_VALIDATION_RULES);
            setValidationErrors(result.errors);
        } catch (error) {
            console.error("Validation failed:", error);
            setValidationErrors(["Failed to validate file"]);
        } finally {
            setIsValidating(false);
        }
    };

    if (isEditing && data.studentFile) {
        return (
            <CsvEditor
                file={data.studentFile}
                onClose={() => setIsEditing(false)}
                onSave={(newFile) => {
                    onChange('studentFile', newFile);
                }}
                validationRules={STUDENT_VALIDATION_RULES}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-black">Student</h3>
                    <p className="text-sm text-gray-400">Upload the student data file</p>
                </div>
                <a href="/example_csv/example_student.csv" download className="text-sm text-primary hover:underline flex items-center gap-2">
                    <FontAwesomeIcon icon={faDownload} />
                    example_student.csv
                </a>
            </div>

            {data.studentFile ? (
                <div className="flex flex-col gap-2">
                    <div className={`flex items-center justify-between p-4 border rounded-xl ${validationErrors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${validationErrors.length > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                <FontAwesomeIcon icon={validationErrors.length > 0 ? faExclamationTriangle : faDownload} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">{data.studentFile.name}</p>
                                <p className="text-xs text-gray-500">{(data.studentFile.size / 1024).toFixed(1)} KB</p>
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
                                onClick={() => onChange('studentFile', null)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="Remove file"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Validation Errors Display */}
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
                    onFileSelect={(file) => onChange('studentFile', file)}
                    title="Upload Student Data"
                />
            )}
        </div>
    )
}