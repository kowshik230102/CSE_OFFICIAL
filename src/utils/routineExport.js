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
          <td style="width: 45%; text-align: center;">
            <br/><br/><br/>
            _________________________________________<br/>
            <strong>Member Secretary</strong><br/>
            Academic Routine Committee<br/>
            Department of CSE, PUST
          </td>
          <td style="width: 10%;"></td>
          <td style="width: 45%; text-align: center;">
            <br/><br/><br/>
            _________________________________________<br/>
            <strong>Chairman</strong><br/>
            Department of Computer Science and Engineering<br/>
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

/**
 * Official PUST Class Routine Word Exporter (5-day structure matching media sample)
 */
export function exportOfficialRoutineToWord({
  title,
  academicYear,
  effectiveFrom,
  semesters = [],
  schedule = [],
  teacherWorkloadMap = {}
}) {
  const effectiveDate = effectiveFrom || '15.07.2024';
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];
  const periods = [
    { id: 'p1', label: '1st (9:00-10:00)' },
    { id: 'p2', label: '2nd (10:00-11:00)' },
    { id: 'p3', label: '3rd (11:00-12:00)' },
    { id: 'p4', label: '4th (12:00-01:00)' },
    { id: 'break', label: 'BREAK (01:00-02:00)', isBreak: true },
    { id: 'p5', label: '5th (02:00-03:00)' },
    { id: 'p6', label: '6th (03:00-04:00)' },
    { id: 'p7', label: '7th (04:00-05:00)' }
  ];

  const getCovered = (startId, span = 1) => {
    const pIdx = periods.findIndex(p => p.id === startId);
    if (pIdx === -1) return null;
    const res = [];
    for (let i = 0; i < span; i++) {
      const idx = pIdx + i;
      if (idx >= periods.length) return null;
      if (periods[idx].isBreak) return null;
      res.push(periods[idx].id);
    }
    return res;
  };

  let timetableHtmlRows = '';

  days.forEach(day => {
    if (semesters.length === 0) {
      timetableHtmlRows += `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center; background-color: #f1f5f9;">${day}</td>
          <td colspan="9" style="border: 1px solid #000; padding: 6px; text-align: center; color: #64748b;">No semesters added</td>
        </tr>
      `;
      return;
    }

    semesters.forEach((sem, semIdx) => {
      let cellsHtml = '';

      periods.forEach(period => {
        if (period.isBreak) {
          if (semIdx === 0) {
            cellsHtml += `
              <td rowspan="${semesters.length}" style="border: 1px solid #000; padding: 4px; text-align: center; vertical-align: middle; background-color: #fef3c7; font-weight: bold; font-size: 8.5pt;">
                BREAK<br/>(01:00-02:00)
              </td>
            `;
          }
          return;
        }

        const slotStarting = schedule.find(s => s.day === day && s.semesterId === sem.semesterId && s.periodId === period.id);
        const slotCoveringEarlier = schedule.find(s => s.day === day && s.semesterId === sem.semesterId && s.periodId !== period.id && (s.coveredPeriods || getCovered(s.periodId, s.span || 1) || []).includes(period.id));

        if (slotCoveringEarlier) {
          return;
        }

        if (slotStarting) {
          const span = slotStarting.span || 1;
          const teacherDisplay = slotStarting.teacherShortCode || slotStarting.teacherName || 'TBA';
          cellsHtml += `
            <td colspan="${span}" style="border: 1px solid #000; padding: 6px; text-align: center; vertical-align: middle; background-color: #f8fafc;">
              <div style="font-weight: bold; font-size: 9.5pt; color: #0f172a;">${slotStarting.courseCode}</div>
              <div style="font-size: 8.5pt; color: #1e3a8a; font-weight: bold;">${teacherDisplay}</div>
              <div style="font-size: 8pt; color: #475569;">${slotStarting.room || '501'}</div>
            </td>
          `;
        } else {
          cellsHtml += `
            <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #cbd5e1; font-size: 8pt;">-</td>
          `;
        }
      });

      timetableHtmlRows += `
        <tr>
          ${semIdx === 0 ? `<td rowspan="${semesters.length}" style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center; vertical-align: middle; background-color: #f1f5f9;">${day}</td>` : ''}
          <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; background-color: #e0e7ff; color: #312e81;">${sem.shortTerm || sem.termCode}</td>
          ${cellsHtml}
        </tr>
      `;
    });
  });

  const teachersList = Object.values(teacherWorkloadMap || {});
  const teacherRows = teachersList.map(wl => `
    <tr>
      <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${wl.teacherName}</td>
      <td style="border: 1px solid #000; padding: 5px;">${wl.designation || 'Faculty Member'}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${wl.department || 'CSE'}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${wl.shortCode || '—'}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${wl.weeklyHours || 0} hrs/week</td>
      <td style="border: 1px solid #000; padding: 5px;">${(wl.courses || []).map(c => `${c.courseCode} (${c.termCode})`).join(', ') || 'None'}</td>
    </tr>
  `).join('');

  const wordHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title || 'Class Routine'}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 15px; color: #000000; }
        .inst-header { text-align: center; margin-bottom: 12px; }
        .inst-dept { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 0; }
        .inst-univ { font-size: 10pt; margin: 2px 0; }
        .inst-title { font-size: 11pt; font-weight: bold; margin: 3px 0; }
        .inst-sub { font-size: 9.5pt; font-style: italic; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8.5pt; }
        th { border: 1px solid #000; padding: 4px; background-color: #0f172a; color: #ffffff; text-align: center; font-size: 8pt; font-weight: bold; }
        td { border: 1px solid #000; }
        .sign-table { width: 100%; margin-top: 40px; border: none; }
        .sign-table td { border: none; text-align: center; font-size: 9.5pt; padding: 8px; }
      </style>
    </head>
    <body>
      <div class="inst-header">
        <h2 class="inst-dept">Department of Computer Science & Engineering</h2>
        <div class="inst-univ">Pabna University of Science and Technology, Pabna-6300</div>
        <div class="inst-title">CLASS ROUTINE: ${title || 'Official Academic Schedule'}, Academic Year: ${academicYear || ''}</div>
        <div class="inst-sub">Effective from: ${effectiveDate}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 75px;">Day</th>
            <th style="width: 45px;">Sem.</th>
            <th>1st (9:00-10:00)</th>
            <th>2nd (10:00-11:00)</th>
            <th>3rd (11:00-12:00)</th>
            <th>4th (12:00-01:00)</th>
            <th style="background-color: #334155;">BREAK (01:00-02:00)</th>
            <th>5th (02:00-03:00)</th>
            <th>6th (03:00-04:00)</th>
            <th>7th (04:00-05:00)</th>
          </tr>
        </thead>
        <tbody>
          ${timetableHtmlRows}
        </tbody>
      </table>

      ${teachersList.length > 0 ? `
        <h4 style="margin: 20px 0 5px 0; font-size: 9.5pt; font-weight: bold;">List of Course Teachers & Weekly Class Load</h4>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Teacher's Name</th>
              <th style="text-align: left;">Designation</th>
              <th>Department</th>
              <th>Teacher Code</th>
              <th>Weekly Load</th>
              <th style="text-align: left;">Assigned Courses</th>
            </tr>
          </thead>
          <tbody>
            ${teacherRows}
          </tbody>
        </table>
      ` : ''}

      <table class="sign-table">
        <tr>
          <td style="width: 45%; text-align: center;">
            <br/><br/><br/>
            _________________________________________<br/>
            <strong>Member Secretary</strong><br/>
            Academic Routine Committee<br/>
            Department of CSE, PUST
          </td>
          <td style="width: 10%;"></td>
          <td style="width: 45%; text-align: center;">
            <br/><br/><br/>
            _________________________________________<br/>
            <strong>Chairman</strong><br/>
            Department of Computer Science and Engineering<br/>
            Pabna University of Science and Technology
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', wordHtml], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  const sanitizedTitle = (title || 'Class_Routine').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadLink.download = `${sanitizedTitle}_PUST.doc`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
