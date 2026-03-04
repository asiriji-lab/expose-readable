import React, { useState, useEffect } from 'react';
import { ScheduleItem } from '../_utils/dummyData';

interface EditOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<ScheduleItem>) => void;
    initialData?: ScheduleItem | null;
}

export default function EditOverlay({ isOpen, onClose, onSave, initialData }: EditOverlayProps) {
    const [teacher, setTeacher] = useState('');
    const [teacherName, setTeacherName] = useState('');
    const [classCode, setClassCode] = useState('');
    const [room, setRoom] = useState('');
    const [roomName, setRoomName] = useState('');
    const [subjectCode, setSubjectCode] = useState('');

    useEffect(() => {
        if (isOpen && initialData) {
            setTeacher(initialData.teacher || '');
            setTeacherName(initialData.teacherName || '');
            setClassCode(initialData.classCode || '');
            setRoom(initialData.room || '');
            setRoomName(initialData.roomName || '');
            setSubjectCode(initialData.subjectCode || '');
        } else if (isOpen) {
            // Clear fields if opening for a new/empty slot
            setTeacher('');
            setTeacherName('');
            setClassCode('');
            setRoom('');
            setRoomName('');
            setSubjectCode('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            teacher,
            teacherName,
            classCode,
            room,
            roomName,
            subjectCode,
            // Default variant if not present, or keep existing if managing full object elsewhere
            variant: initialData?.variant || 'green'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-primary px-6 py-4 flex justify-between items-center">
                    <h3 className="text-white text-lg font-bold">Edit Schedule</h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

                    {/* Teacher */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground-muted mb-1">T.Code</label>
                            <input
                                type="text"
                                className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground"
                                value={teacher}
                                onChange={(e) => setTeacher(e.target.value)}
                                placeholder="Ex. 9301"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground-muted mb-1">Name</label>
                            <input
                                type="text"
                                className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground"
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                                placeholder="Ex. Somchai"
                            />
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-medium text-foreground-muted mb-1">Subject Code</label>
                        <input
                            type="text"
                            className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground"
                            value={subjectCode}
                            onChange={(e) => setSubjectCode(e.target.value)}
                            placeholder="Ex. S1001"
                        />
                    </div>

                    {/* Class */}
                    <div>
                        <label className="block text-sm font-medium text-foreground-muted mb-1">Class</label>
                        <input
                            type="text"
                            className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground"
                            value={classCode}
                            onChange={(e) => setClassCode(e.target.value)}
                            placeholder="Ex. 6/15"
                        />
                    </div>

                    {/* Room */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground-muted mb-1">Room Code</label>
                            <input
                                type="text"
                                className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground"
                                value={room}
                                onChange={(e) => setRoom(e.target.value)}
                                placeholder="Ex. 7401"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground-muted mb-1">Room Name</label>
                            <input
                                type="text"
                                className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                placeholder="Ex. Lab 1"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-border-strong rounded text-foreground-muted hover:bg-background text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover text-sm font-bold shadow-sm"
                        >
                            Save Changes
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
