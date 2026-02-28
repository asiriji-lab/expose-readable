import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload } from '@fortawesome/free-solid-svg-icons';

interface FileDropzoneProps {
    onFileSelect?: (file: File) => void;
    title?: string;
    subtitle?: string;
}

export default function FileDropzone({
    onFileSelect,
    title = "Upload Data",
    subtitle = "Drag and drop your CSV file here, or click to browse"
}: FileDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (onFileSelect) onFileSelect(file);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (onFileSelect) onFileSelect(file);
        }
    };

    return (
        <div
            className={`
                border-2 border-dashed rounded-xl p-10 
                flex flex-col items-center justify-center 
                cursor-pointer transition-colors duration-200
                ${isDragging ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
            />

            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4 text-blue-600">
                <FontAwesomeIcon icon={faUpload} className="text-xl" />
            </div>

            <h4 className="text-sm font-semibold text-gray-900 mb-1">{title}</h4>
            <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
    );
}
