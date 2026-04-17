1. Mapping Availability (The 3-Way Intersection) The program maps availability by simultaneously cross-referencing its three main databases: Teachers, Students (classes), and Classrooms
.
Available Slots: A time slot is only considered fully available if the selected teacher, the student class, and the room are all free at the exact same time
. The program visually maps this availability by displaying pure white slots on the scheduling grid
.
Unavailable Slots: If a slot is not pure white, it means at least one of those three entities is already booked. If you attempt to schedule or hover over an unavailable slot, the program will display exactly who is busy (e.g., showing that the teacher is already booked for another class) to prevent double-booking
.
2. The Teacher as the Anchor The entire scheduling workflow is anchored around the individual teacher.
The Workflow: To assign a class, the user must first select a specific teacher (acting as the anchor), and then attach the other variables to them by choosing which student class they will teach and which room they will use
.
The Ripple Effect: You build the timetable by scheduling the teachers one by one
. Because the teacher acts as the foundation for the other databases, once you finish arranging the schedules for all the teachers, the timetables for all the students and all the classrooms are automatically completed at the exact same time
.
3. Changing Variables and Output Logistics When you change the variables in the program—specifically the room assignment—it directly changes the physical movement output for the teacher and students.
Default Room: If you schedule a class in the students' regular homeroom (e.g., room 641), the students remain seated in their room, and the output is that only the teacher must walk to them
.
Changing to a Specialized Room: If you change the room filter to a specialized facility, the movement output changes. For example, if you change the room to a computer lab (room 435) or a football field, the system outputs that both the teacher and the students must leave their regular locations and travel to the new facility
.
4. The Colored Bands and Output Perspectives Once you successfully assign a class to an available slot, the program outputs three colored bands (green, pink, and yellow) inside that time slot
. These bands represent the successful synchronization of the three databases. Hovering over or interacting with these bands outputs the schedule data from three distinct perspectives:
Green Band (Teacher Output): Displays the schedule from the teacher's perspective, showing that the teacher is busy teaching a specific subject to the assigned student class in the designated room
.
Pink Band (Student Output): Displays the schedule from the students' perspective, showing that the student class is busy taking a specific subject with the assigned teacher in that room
.
Yellow Band (Classroom Output): Displays the schedule from the room's perspective, showing that the physical room is occupied for a specific subject, hosted by that teacher for that student class
.

1. Database Synchronization When you schedule a standard class, the program actively cross-references and writes data to all three databases simultaneously. A standard class successfully links one teacher, one student class, and one physical room
. Because these databases are tied together, completing the schedules for all the teachers automatically generates the completed schedules for all the students and classrooms at the exact same time
.
2. Visual Output in the Main Grid The system continuously outputs the status of these three databases onto a main scheduling grid.
Availability: If the teacher, student class, and room are all free in their respective databases, the program outputs a pure white slot, meaning the period can be scheduled
. If any of the three are busy, the slot is blocked, and the program will output an error message detailing exactly who is already booked if you attempt to schedule there
.
The Colored Bands: Once a class is successfully assigned, the program outputs green, pink, and yellow bands in that time slot
. If you hover your mouse over these bands, the program queries all three databases and outputs a unified summary showing the teacher's name, the student class, the room, and the subject
.
3. Individual Database Outputs If you need to view the specific output for just one entity, the program features dedicated "Show" (แสดง) functions that pull isolated data from a single database:
Show Teacher (แสดงครู): Outputs the individual teacher's timetable, detailing the subjects they teach, the student class they are assigned to, and the room they must travel to
.
Show Student (แสดงนักเรียน): Outputs the timetable for a specific student class, showing their subjects, their assigned teacher, and their room
.
Show Classroom (แสดงห้องเรียน): Outputs the schedule for a specific room, displaying which subject, teacher, and student class are currently occupying that physical space
.
4. Database Limitations and Manual Overrides The database is strictly coded to prevent double-booking collisions
. If you need an output that breaks the standard 1:1:1 rule—such as two teachers co-teaching one student class in one room—you must manipulate the database in two distinct steps
.
First, you lock the student database and classroom database together (e.g., mapping class 6/1 to room 111 so the students are waiting in the room)
.
Next, you manually assign each teacher to that slot
. However, to prevent the database from rejecting the input due to a perceived collision, you must slightly alter the data entry, such as typing "มจ 6/1" instead of "6/1" for the class name and adding a physical space to the room number
. This allows the database to accept the entry and output the correct schedules for the co-teachers without triggering the collision safeguards