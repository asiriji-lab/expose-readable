import { useState, useEffect } from 'react';
import { validateFile, ColumnRule } from '../validationUtils';

interface UseCsvStepProps {
    file: File | null;
    onFileChange: (file: File | null) => void;
    validationRules: Record<number, ColumnRule>;
    catchAllRule?: ColumnRule;
}

export function useCsvStep({ file, onFileChange, validationRules, catchAllRule }: UseCsvStepProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isValidating, setIsValidating] = useState(false);

    // Validate file whenever it changes (if it exists)
    useEffect(() => {
        if (file) {
            handleFileValidation(file);
        } else {
            setValidationErrors([]);
        }
    }, [file]);

    const handleFileValidation = async (fileToValidate: File) => {
        setIsValidating(true);
        try {
            const result = await validateFile(fileToValidate, validationRules, catchAllRule);
            setValidationErrors(result.errors);
        } catch (error) {
            console.error("Validation failed:", error);
            setValidationErrors(["Failed to validate file"]);
        } finally {
            setIsValidating(false);
        }
    };

    const handleSave = (newFile: File) => {
        onFileChange(newFile);
        // The useEffect will trigger re-validation automatically
    };

    const handleRemove = () => {
        onFileChange(null);
    };

    return {
        isEditing,
        setIsEditing,
        validationErrors,
        isValidating,
        handleSave,
        handleRemove
    };
}
