
// Helper to generate a random integer between min and max (inclusive)
export const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 1. T.code (4 digits)
export const generateTeacherCode = () => {
    return getRandomInt(1000, 9999).toString();
};

// 2. T.name (Thai first and last name)
const thaiFirstNames = [
    "สมชาย", "วิไลวรรณ", "กิตติ", "นภา", "สุดา", "ประวิทย์", "มานะ", "วารี", "อนันต์", "จินตนา"
];
const thaiLastNames = [
    "ใจดี", "รักเรียน", "มีสุข", "เจริญพร", "มั่นคง", "ทองดี", "สุขสันต์", "วิเศษ", "รุ่งเรือง", "ปัญญา"
];

export const generateTeacherName = () => {
    const first = thaiFirstNames[getRandomInt(0, thaiFirstNames.length - 1)];
    const last = thaiLastNames[getRandomInt(0, thaiLastNames.length - 1)];
    return `${first} ${last}`;
};

// 3. Class (x/y)
// x: 1-12, y: 1-15
export const generateClassCode = () => {
    const x = getRandomInt(1, 12);
    const y = getRandomInt(1, 15);
    return `${x}/${y}`;
};

// 4. Room (xyzz)
// x: Building (1-9), y: Floor (1-9), zz: Room num (01-20)
// Room Name: British curriculum subjects
const subjects = [
    "Mathematics", "Science", "History", "Geography", "English", "Art", "Music", "PE", "Physics", "Chemistry", "Biology", "Computing"
];

export const generateRoomCode = () => {
    const x = getRandomInt(1, 9);
    const y = getRandomInt(1, 9);
    const zz = getRandomInt(1, 20).toString().padStart(2, '0');
    return `${x}${y}${zz}`;
};

export const generateRoomName = () => {
    return subjects[getRandomInt(0, subjects.length - 1)];
};

// 5. Subject Code (x + 5 digits)
// x: One char (usually derived from subject, but here random or fixed for simplicity/variety)
const subjectPrefixes = ['S', 'M', 'E', 'H', 'G', 'A', 'P', 'C', 'B'];

export const generateSubjectCode = () => {
    const prefix = subjectPrefixes[getRandomInt(0, subjectPrefixes.length - 1)];
    const digits = getRandomInt(10000, 99999);
    return `${prefix}${digits}`;
};

export interface ScheduleItem {
    teacher: string;
    teacherName: string;
    classCode: string;
    room: string;
    roomName: string;
    subjectCode: string;
    variant: 'red' | 'green';
}

export const generateScheduleItem = (): ScheduleItem => {
    return {
        teacher: generateTeacherCode(),
        teacherName: generateTeacherName(),
        classCode: generateClassCode(),
        room: generateRoomCode(),
        roomName: generateRoomName(),
        subjectCode: generateSubjectCode(),
        variant: Math.random() > 0.5 ? 'red' : 'green',
    };
};
