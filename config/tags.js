// config/tags.js 

const OU_COURSES = [
    // Core Computer Science Courses
    'CS 1323 - Intro to Computer Programming',
    'CS 2334 - Programming Structures',
    'CS 2413 - Data Structures',
    'CS 3203 - Software Engineering',
    'CS 3113 - Operating Systems',
    'CS 3823 - Algorithms',
    'CS 4013 - Artificial Intelligence',
    'CS 4273 - Capstone Design Project', // Capstone project is perfect for portfolio
    
    // Core Aerospace & Mechanical Engineering Courses
    'AME 2113 - Statics',
    'AME 2303 - Materials, Design & Manufacturing Processes',
    'AME 3353 - Design of Mechanical Components',
    'AME 4163 - Principles of Engineering Design',
    'AME 4273 - Aerospace Systems Design I',
    'AME 4373 - Aerospace Systems Design II',
    'AME 4553 - Design Practicum',

    // Core Chemical Engineering Courses
    'CH E 2033 - Chemical Engineering Fundamentals',
    'CH E 4253 - Process Design & Safety',
    'CH E 4273 - Advanced Process Design',
    'CH E 4262 - Chemical Engineering Design Lab', // Labs often have projects

    // Core Civil Engineering Courses
    'CE 2113 - Statics and Dynamics',
    'CE 3113 - Structural Analysis',
    'CE 4503 - Civil Engineering Design', // Capstone project
    
    // Core Electrical & Computer Engineering Courses
    'ECE 2214 - Digital Design',
    'ECE 3223 - Microprocessor System Design',
    'ECE 3773 - Circuits Laboratory',
    'ECE 4773 - Laboratory (Special Projects)', // Special projects course is ideal

    // General Engineering Courses (often project-based)
    'ENGR 1413 - Engineering Thinking and Design',
    'ENGR 2002 - Professional Development',
];

const PROJECT_CATEGORIES = [
    'Class Project',
    'Research Project',
    'Personal Project',
    'Senior Design / Capstone',
    'Competition / Hackathon',
    'Open Source Contribution',
    'Internship Project',
    'Art & Design',
    'Engineering & Technology',
    'Science & Research',
    'Other'
];

const PROJECT_YEARS = [
    '2024', '2025', '2026', '2027', '2028',
    '2023', '2022', '2021', '2020'
];

const PROJECT_TYPES = [
    'Code / Software',
    'Report / Essay',
    'Presentation / Slides',
    'Research Paper',
    'Art / Design Portfolio',
    'Multimedia (Video, Audio)',
    'Hardware / Physical Prototype',
    'Thesis / Dissertation',
    'Other'
];

const ALL_DEPARTMENTS = [
    'Aerospace & Mechanical Engineering',
    'Chemical Engineering',
    'Civil Engineering',
    'Computer Science',
    'Electrical & Computer Engineering',
    'Other'
];

module.exports = {
    courses: OU_COURSES,
    categories: PROJECT_CATEGORIES,
    years: PROJECT_YEARS,
    types: PROJECT_TYPES,
    departments: ALL_DEPARTMENTS,
};
