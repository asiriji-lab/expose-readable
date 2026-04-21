import React, { useState, useEffect } from 'react';
import type { ScheduleItem, EntityMeta } from '../_types/schedule.types';

interface EditOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<ScheduleItem>) => void;
    initialData?: ScheduleItem | null;
    entityMeta?: EntityMeta | null;
}

export default function EditOverlay({ isOpen, onClose, onSave, initialData, entityMeta }: EditOverlayProps) {
    const teacherCodes = entityMeta?.teacher_codes ?? [];
    const classCodes = entityMeta?.class_codes ?? [];
    const roomCodes = entityMeta?.room_codes ?? [];
    const subjectCodes = Object.keys(entityMeta?.subjects ?? {});

    const [teacher, setTeacher] = useState(teacherCodes[0] ?? '');
    const [classCode, setClassCode] = useState(classCodes[0] ?? '');
    const [room, setRoom] = useState(roomCodes[0] ?? '');
    const [subjectCode, setSubjectCode] = useState(subjectCodes[0] ?? '');

    // Sync to initialData when opened
    useEffect(() => {
        if (!isOpen) return;
        if (initialData) {
            setTeacher(initialData.teacher || teacherCodes[0] || '');
            setClassCode(initialData.classCode || classCodes[0] || '');
            setRoom(initialData.room || roomCodes[0] || '');
            setSubjectCode(initialData.subjectCode || subjectCodes[0] || '');
        } else {
            setTeacher(teacherCodes[0] ?? '');
            setClassCode(classCodes[0] ?? '');
            setRoom(roomCodes[0] ?? '');
            setSubjectCode(subjectCodes[0] ?? '');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    // Derived auto-fill values
    const teacherName = entityMeta?.teacher_meta[teacher]?.name ?? teacher;
    const roomName = entityMeta?.room_meta[room]?.name ?? room;
    const subjectInfo = entityMeta?.subjects[subjectCode];
    const subject = subjectInfo?.name ?? subjectCode;
    const variant = subjectInfo?.variant ?? '_activity';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ teacher, teacherName, classCode, room, roomName, subjectCode, subject, variant });
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-primary px-6 py-4 flex justify-between items-center">
                    <h3 className="text-white text-lg font-bold">
                        {initialData ? 'Edit Slot' : 'New Lesson'}
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

                    {/* Teacher */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground-muted mb-1">Teacher Code</label>
                            <select
                                value={teacher}
                                onChange={e => setTeacher(e.target.value)}
                                className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground bg-surface cursor-pointer"
                            >
                                {teacherCodes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground-muted mb-1">Name</label>
                            <input
                                readOnly
                                value={teacherName}
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-surface-alt text-foreground cursor-default select-none"
                            />
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-medium text-foreground-muted mb-1">Subject</label>
                        <div className="grid grid-cols-2 gap-4">
                            <select
                                value={subjectCode}
                                onChange={e => setSubjectCode(e.target.value)}
                                className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground bg-surface cursor-pointer"
                            >
                                {subjectCodes.map(code => (
                                    <option key={code} value={code}>{code}</option>
                                ))}
                            </select>
                            <input
                                readOnly
                                value={subject}
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-surface-alt text-foreground cursor-default select-none"
                            />
                        </div>
                    </div>

                    {/* Class */}
                    <div>
                        <label className="block text-sm font-medium text-foreground-muted mb-1">Class</label>
                        <select
                            value={classCode}
                            onChange={e => setClassCode(e.target.value)}
                            className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground bg-surface cursor-pointer"
                        >
                            {classCodes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Room */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground-muted mb-1">Room</label>
                            <select
                                value={room}
                                onChange={e => setRoom(e.target.value)}
                                className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground bg-surface cursor-pointer"
                            >
                                {roomCodes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground-muted mb-1">Room Name</label>
                            <input
                                readOnly
                                value={roomName}
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-surface-alt text-foreground cursor-default select-none"
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
