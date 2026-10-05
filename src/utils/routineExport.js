/**
 * Academic Routine Export Utility (Word .doc and PDF Print)
 * Department of Computer Science & Engineering, PUST
 */

export function exportRoutineToWord({ title, type, sessionName, semesterName, routineData }) {
  const isClass = type === 'CLASS_ROUTINE';
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let timetableRows = '';
  let contactRows = '';

  if (isClass) {
    // Generate timetable rows for Class Routine
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    const periods = [
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '11:00 AM - 12:00 PM',
      '12:00 PM - 01:00 PM',
      '02:00 PM - 03:00 PM',
      '03:00 PM - 04:00 PM',
      '04:00 PM - 05:00 PM'
    ];

    // Collect all slots
    const allSlots = [];
    const courseMap = {};

    if (Array.isArray(routineData?.sessions)) {
      routineData.sessions.forEach(sess => {
        if (Array.isArray(sess.courses)) {
          sess.courses.forEach(c => {
            courseMap[c.courseCode] = c;
            if (Array.isArray(c.timeSlots)) {
              c.timeSlots.forEach(slot => {
                allSlots.push({
                  ...slot,
                  courseCode: c.courseCode,
                  courseTitle: c.courseTitle,
                  courseType: c.courseType,
                  teacherName: c.teacherName,
                  teacherDept: c.teacherDept,
                  teacherPhone: c.teacherPhone,
                  roomNumber: slot.roomNumber || c.roomNumber,
                  isLab: c.courseType === 'LAB' || (c.courseTitle && c.courseTitle.toLowerCase().includes('lab'))
                });
              });
            }
          });
        }
      });
    }

    // Build Word Timetable HTML
    timetableRows = days.map(day => {
      const daySlots = allSlots.filter(s => s.day === day);
      const cells = periods.map(p => {
        const matches = daySlots.filter(s => s.timeSlot === p);
        if (matches.length === 0) {
          return `<td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: #94a3b8; font-size: 11px;">-</td>`;
        }
        return `<td style="border: 1px solid #cbd5e1; padding: 6px; background-color: #f8fafc; font-size: 11px;">
          ${matches.map(m => `
            <div style="font-weight: bold; color: ${m.isLab ? '#7c3aed' : '#1d4ed8'};">
              ${m.courseCode} ${m.isLab ? '[LAB]' : ''}
            </div>
            <div style="font-size: 10px; color: #334155;">${m.courseTitle}</div>
            <div style="font-size: 10px; color: #475569;">${m.teacherName || ''}</div>
            <div style="font-size: 9px; color: #64748b;">${m.roomNumber ? 'Room: ' + m.roomNumber : ''}</div>
          `).join('<hr style="border:none;border-top:1px dashed #cbd5e1;margin:4px 0;"/>')}
        </td>`;
      }).join('');

      return `<tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; background-color: #f1f5f9; text-align: center; width: 100px;">${day}</td>
        ${cells}
      </tr>`;
    }).join('');

    // Build Teacher Contact Directory Table
    const courses = Object.values(courseMap);
    contactRows = courses.map((c, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${c.courseCode}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${c.courseTitle}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${c.creditHours || 3.0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${c.teacherName || 'TBA'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${c.teacherDept || 'CSE'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; color: #0284c7;">${c.teacherPhone || 'N/A'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${c.roomNumber || 'TBA'}</td>
      </tr>
    `).join('');

  } else {
    // Exam Routine Rows
    const exams = Array.isArray(routineData?.exams) ? routineData.exams : [];
    timetableRows = exams.map((ex, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${ex.serial || (idx + 1)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${ex.date || 'TBA'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${ex.day || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${ex.timeSlot || '10:00 AM - 01:00 PM'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #1e3a8a;">${ex.courseCode}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${ex.courseTitle}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${ex.roomNumber || 'TBA'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${ex.invigilatorName || ex.teacherName || 'Faculty Member'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #0284c7;">${ex.teacherPhone || 'N/A'}</td>
      </tr>
    `).join('');
  }

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title || 'Academic Routine'}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #0f172a; }
        .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
        .title { font-size: 18pt; font-weight: bold; color: #1e3a8a; margin: 0; text-transform: uppercase; }
        .sub { font-size: 12pt; color: #475569; margin: 4px 0; }
        .dept { font-size: 13pt; font-weight: bold; color: #2563eb; }
        .meta { margin: 15px 0; font-size: 11pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-family: Arial, sans-serif; font-size: 10pt; }
        th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #1e3a8a; padding: 8px; text-align: center; font-size: 10pt; }
        td { border: 1px solid #cbd5e1; }
        .sign-table { width: 100%; margin-top: 60px; border: none; }
        .sign-table td { border: none; text-align: center; font-size: 11pt; padding: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Pabna University of Science and Technology</div>
        <div class="dept">Department of Computer Science & Engineering (CSE)</div>
        <div class="sub">Official ${isClass ? 'Academic Class Timetable' : 'Semester Final Examination Routine'}</div>
      </div>

      <div class="meta">
        <table style="border: none; margin: 0; width: 100%;">
          <tr style="border: none;">
            <td style="border: none; font-size: 11pt;"><strong>Routine Title:</strong> ${title}</td>
            <td style="border: none; text-align: right; font-size: 11pt;"><strong>Date Issued:</strong> ${currentDate}</td>
          </tr>
          <tr style="border: none;">
            <td style="border: none; font-size: 11pt;"><strong>Session:</strong> ${sessionName || 'All Assigned'}</td>
            <td style="border: none; text-align: right; font-size: 11pt;"><strong>Semester:</strong> ${semesterName || 'Department-Wide'}</td>
          </tr>
        </table>
      </div>

      ${isClass ? `
        <h3 style="color: #1e3a8a; margin-top: 25px;">Weekly Timetable Schedule</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 100px;">Day</th>
              <th>09:00 - 10:00</th>
              <th>10:00 - 11:00</th>
              <th>11:00 - 12:00</th>
              <th>12:00 - 01:00</th>
              <th>02:00 - 03:00</th>
              <th>03:00 - 04:00</th>
              <th>04:00 - 05:00</th>
            </tr>
          </thead>
          <tbody>
            ${timetableRows}
          </tbody>
        </table>

        <h3 style="color: #1e3a8a; margin-top: 35px;">Course & Faculty Contact Directory</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Course Code</th>
              <th>Course Title</th>
              <th>Credits</th>
              <th>Teacher Name</th>
              <th>Dept</th>
              <th>Phone Number</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            ${contactRows}
          </tbody>
        </table>
      ` : `
        <h3 style="color: #1e3a8a; margin-top: 25px;">Examination Schedule</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">Sl</th>
              <th>Date</th>
              <th>Day</th>
              <th>Time</th>
              <th>Course Code</th>
              <th>Course Title</th>
              <th>Room / Hall</th>
              <th>Invigilator / Teacher</th>
              <th>Contact Number</th>
            </tr>
          </thead>
          <tbody>
            ${timetableRows}
          </tbody>
        </table>
      `}

      <table class="sign-table">
        <tr>
          <td style="width: 45%;">
            <br/><br/>
            _________________________________________<br/>
            <strong>Member Secretary</strong><br/>
            Academic Routine Committee<br/>
            Department of CSE, PUST
          </td>
          <td style="width: 10%;"></td>
          <td style="width: 45%;">
            <br/><br/>
            _________________________________________<br/>
            <strong>Chairman</strong><br/>
            Department of Computer Science & Engineering<br/>
            Pabna University of Science and Technology
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Create downloadable Blob for Microsoft Word (.doc)
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  const sanitizedTitle = (title || 'Academic_Routine').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadLink.download = `${sanitizedTitle}.doc`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
