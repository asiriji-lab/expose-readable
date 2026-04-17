import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const rawState = payload._rawState || {};
        const config = payload.config || {
            academic_year: "2026",
            semester: 1,
            columns: [
                { key: "day", label: "Day", type: "text" },
                { key: "1", label: "1", time: "08.30-09.20" },
                { key: "2", label: "2", time: "09.25-10.15" },
                { key: "3", label: "3", time: "10.20-11.10" },
                { key: "4", label: "4", time: "11.10-12.00" },
                { key: "5", label: "5", time: "12.00-12.50" },
                { key: "6", label: "6", time: "12.50-13.40" },
                { key: "7", label: "7", time: "13.40-14.30" },
                { key: "8", label: "8", time: "14.30-15.20" },
                { key: "9", label: "9", time: "15.20-16.10" },
                { key: "10", label: "10", time: "16.10-17.00" },
                { key: "11", label: "11", time: "17.00-17.50" },
                { key: "12", label: "12", time: "17.50-18.40" }
            ]
        };

        // Initialize maps to group the data
        const teachersMap = new Map();
        const studentsMap = new Map();
        const roomsMap = new Map();

        // Helper to format days
        const formatDay = (day: string) => {
            const dayMap: Record<string, string> = {
                'Monday': 'MON', 'Tuesday': 'TUE', 'Wednesday': 'WED',
                'Thursday': 'THU', 'Friday': 'FRI', 'Saturday': 'SAT', 'Sunday': 'SUN'
            };
            return dayMap[day] || day.substring(0, 3).toUpperCase();
        };

        // Iterate through rawState to build the grouping maps
        // rawState structure: { "Monday": { "1": ScheduleItem, "2": ScheduleItem }, "Tuesday": {...} }
        for (const [day, slots] of Object.entries(rawState)) {
            const shortDay = formatDay(day);
            const slotEntries = Object.entries(slots as Record<string, any>);

            for (const [slotStr, item] of slotEntries) {
                if (!item) continue;

                // --- TEACHERS ---
                if (item.teacher) {
                    if (!teachersMap.has(item.teacher)) {
                        teachersMap.set(item.teacher, {
                            id: `T${item.teacher}`,
                            name: item.teacherName || item.teacher,
                            department: "General", // Dummy default
                            rowsMap: new Map() // temporary map for rows: day -> { day, 1: {...}, 2: {...} }
                        });
                    }
                    const tData = teachersMap.get(item.teacher);
                    if (!tData.rowsMap.has(shortDay)) tData.rowsMap.set(shortDay, { day: shortDay });
                    const todayRow = tData.rowsMap.get(shortDay);
                    todayRow[slotStr] = {
                        subject: item.subject || "Unknown",
                        class: item.classCode || "Unknown",
                        room: item.room || "Unknown"
                    };
                }

                // --- STUDENTS (Grouped by Class) ---
                if (item.classCode) {
                    const studentGroupId = `S${item.classCode.replace('/', '')}`;
                    if (!studentsMap.has(item.classCode)) {
                        studentsMap.set(item.classCode, {
                            id: studentGroupId,
                            name: `Student Group ${item.classCode}`,
                            class_group: item.classCode,
                            rowsMap: new Map()
                        });
                    }
                    const sData = studentsMap.get(item.classCode);
                    if (!sData.rowsMap.has(shortDay)) sData.rowsMap.set(shortDay, { day: shortDay });
                    const todayRow = sData.rowsMap.get(shortDay);
                    todayRow[slotStr] = {
                        subject: item.subject || "Unknown",
                        teacher: item.teacherName || item.teacher || "Unknown",
                        room: item.room || "Unknown"
                    };
                }

                // --- ROOMS ---
                if (item.room) {
                    const roomIdText = `R${item.room}`;
                    if (!roomsMap.has(item.room)) {
                        roomsMap.set(item.room, {
                            id: roomIdText,
                            name: item.roomName || item.room,
                            rowsMap: new Map()
                        });
                    }
                    const rData = roomsMap.get(item.room);
                    if (!rData.rowsMap.has(shortDay)) rData.rowsMap.set(shortDay, { day: shortDay });
                    const todayRow = rData.rowsMap.get(shortDay);
                    todayRow[slotStr] = {
                        subject: item.subject || "Unknown",
                        teacher: item.teacherName || item.teacher || "Unknown",
                        class: item.classCode || "Unknown"
                    };
                }
            }
        }

        // Helper to fill empty slots with nulls based on config columns
        const formatRows = (rowsMap: Map<string, any>) => {
            const formattedRows = [];
            for (const [day, rowData] of rowsMap.entries()) {
                const orderedRow: any = { day: rowData.day };

                // Keep only time columns
                const cols = config.columns.filter((c: any) => c.key !== 'day');

                for (const col of cols) {
                    orderedRow[`slot_${col.key}`] = rowData[col.key] || null;
                }

                formattedRows.push(orderedRow);
            }
            return formattedRows;
        };

        // Transform Maps back to Arrays
        const teachers = Array.from(teachersMap.values()).map(t => ({
            id: t.id, name: t.name, department: t.department, rows: formatRows(t.rowsMap)
        }));

        const students = Array.from(studentsMap.values()).map(s => ({
            id: s.id, name: s.name, class_group: s.class_group, rows: formatRows(s.rowsMap)
        }));

        const rooms = Array.from(roomsMap.values()).map(r => ({
            id: r.id, name: r.name, rows: formatRows(r.rowsMap)
        }));

        const exportSchema = {
            config,
            teachers,
            students,
            rooms
        };

        // Post-process the JSON string to ensure "day" appears first
        // by removing the "slot_" prefix from our strictly ordered keys.
        let jsonStr = JSON.stringify(exportSchema, null, 2);
        jsonStr = jsonStr.replace(/"slot_([^"]+)":/g, '"$1":');

        return new NextResponse(jsonStr, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="schedule.json"',
            },
        });

    } catch (error) {
        console.error('Error generating export JSON:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
