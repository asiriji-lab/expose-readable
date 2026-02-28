import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faPen, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import FileDropzone from '../file-upload/FileDropzone';
import CsvEditor from '../CsvEditor';
import { CURRICULUM_VALIDATION_RULES, validateFile, ColumnRule } from '../validationUtils';

import { StepProps } from '../../_types';

export function Step1_Curriculum({ data, onChange, errors }: StepProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isValidating, setIsValidating] = useState(false);

    // Validate file whenever it changes (if it exists)
    useEffect(() => {
        if (data.curriculumFile) {
            handleFileValidation(data.curriculumFile);
        } else {
            setValidationErrors([]);
        }
    }, [data.curriculumFile]);

    const handleFileValidation = async (file: File) => {
        setIsValidating(true);
        try {
            const result = await validateFile(file, CURRICULUM_VALIDATION_RULES);
            setValidationErrors(result.errors);
        } catch (error) {
            console.error("Validation failed:", error);
            setValidationErrors(["Failed to validate file"]);
        } finally {
            setIsValidating(false);
        }
    };

    if (isEditing && data.curriculumFile) {
        return (
            <CsvEditor
                file={data.curriculumFile}
                onClose={() => setIsEditing(false)}
                onSave={(newFile) => {
                    onChange('curriculumFile', newFile);
                    // Validation will be triggered by useEffect
                }}
                validationRules={CURRICULUM_VALIDATION_RULES}
            />
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <h2 className="text-2xl font-semibold text-black">Schedule information</h2>

            {/* Top Row: Schedule Name, Year, Semester */}
            <div className="grid grid-cols-3 gap-6">
                {/* Schedule Name Input */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Schedule name</label>
                    <input
                        type="text"
                        value={data.scheduleName || ''}
                        onChange={(e) => onChange('scheduleName', e.target.value)}
                        className="w-full h-12 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Enter schedule name"
                    />
                    {errors.scheduleName && <span className="text-red-500 text-sm">{errors.scheduleName}</span>}
                </div>

                {/* Year Input */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Year</label>
                    <input
                        type="number"
                        value={data.year || ''}
                        onChange={(e) => onChange('year', e.target.value)}
                        className="w-full h-12 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Enter year"
                    />
                    {errors.year && <span className="text-red-500 text-sm">{errors.year}</span>}
                </div>

                {/* Semester Dropdown */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Semester</label>
                    <input
                        type="text"
                        value={data.semester || ''}
                        onChange={(e) => onChange('semester', e.target.value)}
                        className="w-full h-12 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Enter semester"
                    />
                    {errors.semester && <span className="text-red-500 text-sm">{errors.semester}</span>}
                </div>
            </div>

            {/* Curriculum Section */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-black">Curriculum</h3>
                        <p className="text-sm text-gray-400">Upload the curriculum data file</p>
                    </div>
                    <a href="/example_csv/example_curriculum.csv" download className="text-sm text-blue-600 hover:underline flex items-center gap-2">
                        <FontAwesomeIcon icon={faDownload} />
                        example_curriculum.csv
                    </a>
                </div>

                {data.curriculumFile ? (
                    <div className="flex flex-col gap-2">
                        <div className={`flex items-center justify-between p-4 border rounded-xl ${validationErrors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${validationErrors.length > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                    <FontAwesomeIcon icon={validationErrors.length > 0 ? faExclamationTriangle : faDownload} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{data.curriculumFile.name}</p>
                                    <p className="text-xs text-gray-500">{(data.curriculumFile.size / 1024).toFixed(1)} KB</p>
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
                                    onClick={() => onChange('curriculumFile', null)}
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
                        onFileSelect={(file) => onChange('curriculumFile', file)}
                        title="Upload Curriculum Data"
                    />
                )}
            </div>
        </div>
    )
}