import { describe, it, expect, vi } from 'vitest';
import { CURRICULUM_VALIDATION_RULES, validateFile } from '../validationUtils';

// Mock File API
class MockFile {
    name: string;
    body: string;
    type: string;

    constructor(body: string[], name: string, options: { type: string }) {
        this.body = body[0];
        this.name = name;
        this.type = options.type;
    }
}

// Global File polyfill if needed, but jsdom usually handles it.
// However, reading the file content in validationUtils uses FileReader or PapaParse.
// We might need to mock FileReader or PapaParse depending on how deep we want to test.
// validationUtils uses Papa.parse for CSV and FileReader for Excel.
// Let's mock PapaParse and XLSX for easier testing without dealing with binary file creation in tests.

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Mocking the modules
vi.mock('papaparse', () => {
    return {
        default: {
            parse: vi.fn()
        }
    };
});

vi.mock('xlsx', () => {
    return {
        read: vi.fn(),
        utils: {
            sheet_to_json: vi.fn()
        }
    };
});


describe('Validation Utils', () => {
    describe('validateFile (CSV)', () => {
        it('should return valid for a correct CSV', async () => {
            const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });

            // Mock Papa.parse implementation
            (Papa.parse as any).mockImplementation((file: any, config: any) => {
                // Simulate successful parse
                config.complete({
                    data: [
                        ['Subject ID', 'Name', 'Periods', 'Teacher', 'Block', 'Class', 'Room', 'Unused', 'Fixed'], // Header
                        ['ท21101', 'Thai', '3', 'T001', '1', '[1]', '123', '', 'MON_1'], // Valid Row
                        ['ม.1', '', '', '', '', '', '', '', ''], // Grade Header (ignored)
                    ]
                });
            });

            const result = await validateFile(mockFile, CURRICULUM_VALIDATION_RULES);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should return errors for invalid CSV data', async () => {
            const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });

            (Papa.parse as any).mockImplementation((file: any, config: any) => {
                config.complete({
                    data: [
                        ['Subject ID', 'Name', 'Periods', 'Teacher', 'Block', 'Class', 'Room', 'Unused', 'Fixed'],
                        ['INVALID_ID', 'Thai', 'NaN', 'BAD_TEACHER', '99', 'bad_class', '123', '', 'BAD_FIXED'], // Invalid Row
                    ]
                });
            });

            const result = await validateFile(mockFile, CURRICULUM_VALIDATION_RULES);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            // Check specific error messages exist implicitly
            const errorString = result.errors.join(' ');
            expect(errorString).toContain('Subject ID');
            expect(errorString).toContain('Periods');
            expect(errorString).toContain('Teacher');
        });

        it('should ignore Grade Headers', async () => {
            const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });

            (Papa.parse as any).mockImplementation((file: any, config: any) => {
                config.complete({
                    data: [
                        ['Subject ID', 'Name', 'Periods', 'Teacher', 'Block', 'Class', 'Room', 'Unused', 'Fixed'],
                        ['ม.1', 'Skipped', 'Skipped', 'Skipped', 'Skipped', 'Skipped', 'Skipped', '', ''],
                    ]
                });
            });

            const result = await validateFile(mockFile, CURRICULUM_VALIDATION_RULES);
            expect(result.isValid).toBe(true);
        });

        describe('Relaxed Regex & Cross-Column Logic', () => {
            const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });

            it('should allow teacher arrays without quotes', async () => {
                (Papa.parse as any).mockImplementation((file: any, config: any) => {
                    config.complete({
                        data: [
                            ['Subject ID', 'Name', 'Periods', 'Teacher', 'Block', 'Class', 'Room', 'Unused', 'Fixed'],
                            ['ท21101', 'Thai', '3', '[T001, T002]', '1', '[1]', '123', '', 'MON_1'],
                        ]
                    });
                });
                const result = await validateFile(mockFile, CURRICULUM_VALIDATION_RULES);
                expect(result.isValid).toBe(true);
            });

            it('should error if subject_name is missing when subject_id is present', async () => {
                (Papa.parse as any).mockImplementation((file: any, config: any) => {
                    config.complete({
                        data: [
                            ['Subject ID', 'Name', 'Periods', 'Teacher', 'Block', 'Class', 'Room', 'Unused', 'Fixed'],
                            ['ท21101', '', '3', 'T001', '1', '[1]', '123', '', 'MON_1'],
                        ]
                    });
                });
                const result = await validateFile(mockFile, CURRICULUM_VALIDATION_RULES);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain('Subject name is required');
            });

            it('should error if TEAM constraint is used without teacher array', async () => {
                (Papa.parse as any).mockImplementation((file: any, config: any) => {
                    config.complete({
                        data: [
                            ['Subject ID', 'Name', 'Periods', 'Teacher', 'Block', 'Class', 'Constraint', 'Room', 'Fixed'],
                            ['ท21101', 'Thai', '3', 'T001', '1', '[1]', 'type=TEAM', '123', 'MON_1'],
                        ]
                    });
                });
                const result = await validateFile(mockFile, CURRICULUM_VALIDATION_RULES);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain('TEAM constraints require an array');
            });

            it('should allow student class arrays with quotes and spaces', async () => {
                (Papa.parse as any).mockImplementation((file: any, config: any) => {
                    config.complete({
                        data: [
                            ['Subject ID', 'Name', 'Periods', 'Teacher', 'Block', 'Class', 'Room', 'Unused', 'Fixed'],
                            ['ว21101', 'Science', '3', 'T003', '2', "['1', '2']", 'A316', '', ''],
                        ]
                    });
                });
                const result = await validateFile(mockFile, CURRICULUM_VALIDATION_RULES);
                expect(result.isValid).toBe(true);
            });

            it('should allow block patterns with spaces', async () => {
                (Papa.parse as any).mockImplementation((file: any, config: any) => {
                    config.complete({
                        data: [
                            ['Subject ID', 'Name', 'Periods', 'Teacher', 'Block', 'Class', 'Room', 'Unused', 'Fixed'],
                            ['อ21101', 'English', '3', 'T004', '2 - 1', '[1]', '', '', ''],
                        ]
                    });
                });
                const result = await validateFile(mockFile, CURRICULUM_VALIDATION_RULES);
                expect(result.isValid).toBe(true);
            });
        });


    });
});
