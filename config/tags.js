const OU_COURSES = [
  // Keep existing courses as they are
  'CS 1323 - Intro to Computer Programming',
  'CS 2334 - Programming Structures',
  'CS 2413 - Data Structures',
  'CS 3203 - Software Engineering',
  'CS 3113 - Operating Systems',
  'CS 3823 - Algorithms',
  'CS 4013 - Artificial Intelligence',
  'CS 4273 - Capstone Design Project',
  'AME 2113 - Statics',
  'AME 2303 - Materials, Design & Manufacturing Processes',
  'AME 3353 - Design of Mechanical Components',
  'AME 4163 - Principles of Engineering Design',
  'AME 4273 - Aerospace Systems Design I',
  'AME 4373 - Aerospace Systems Design II',
  'AME 4553 - Design Practicum',
  'CH E 2033 - Chemical Engineering Fundamentals',
  'CH E 4253 - Process Design & Safety',
  'CH E 4273 - Advanced Process Design',
  'CH E 4262 - Chemical Engineering Design Lab',
  'CE 2113 - Statics and Dynamics',
  'CE 3113 - Structural Analysis',
  'CE 4503 - Civil Engineering Design',
  'ECE 2214 - Digital Design',
  'ECE 3223 - Microprocessor System Design',
  'ECE 3773 - Circuits Laboratory',
  'ECE 4773 - Laboratory (Special Projects)',
  'ENGR 1413 - Engineering Thinking and Design',
  'ENGR 2002 - Professional Development',
];

const PROJECT_CATEGORIES = [
  'Research',
  'Design',
  'Outreach',
  'Class Project',
  'Senior Design / Capstone',
  'Competition / Hackathon',
  'Personal Project',
  'Other'
];

const PROJECT_YEARS = [
  '2024', '2025', '2026', '2027', '2028',
  '2023', '2022', '2021', '2020'
];

const PROJECT_TYPES = [
  'Engineering',
  'Art',
  'Software',
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

const TOOLS = [
  'AutoCAD',
  'SolidWorks',
  'MATLAB',
  'Python',
  'JavaScript',
  'C++',
  'Adobe Photoshop',
  'Adobe Illustrator',
  'Blender',
  'Other'
];

module.exports = {
  courses: OU_COURSES,
  categories: PROJECT_CATEGORIES,
  years: PROJECT_YEARS,
  types: PROJECT_TYPES,
  departments: ALL_DEPARTMENTS,
  tools: TOOLS
};