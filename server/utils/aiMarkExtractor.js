const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');

// Calculate Continuous Assessment: Best 2 of 3 CTs (/10 each) + Attendance (/10) = 30 marks
function calculateCA(ct1, ct2, ct3, attendance) {
  const parseNum = (v) => {
    if (v === '' || v === null || v === undefined || isNaN(v)) return null;
    const n = parseFloat(v);
    return Math.min(10.0, Math.max(0.0, Math.round(n * 10) / 10));
  };

  const c1 = parseNum(ct1);
  const c2 = parseNum(ct2);
  const c3 = parseNum(ct3);
  const att = parseNum(attendance);

  const cts = [c1, c2, c3].filter((x) => x !== null).sort((a, b) => b - a);
  let best2 = 0;
  if (cts.length >= 2) best2 = cts[0] + cts[1];
  else if (cts.length === 1) best2 = cts[0];

  const attScore = att !== null ? att : 0;
  const hasMarks = cts.length > 0 || att !== null;
  const total = hasMarks ? Math.round((best2 + attScore) * 10) / 10 : null;

  let grade = '—';
  if (total !== null) {
    if (total >= 24.0) grade = 'A+';
    else if (total >= 22.5) grade = 'A';
    else if (total >= 21.0) grade = 'A-';
    else if (total >= 19.5) grade = 'B+';
    else if (total >= 18.0) grade = 'B';
    else if (total >= 16.5) grade = 'B-';
    else if (total >= 15.0) grade = 'C+';
    else if (total >= 13.5) grade = 'C';
    else if (total >= 12.0) grade = 'D';
    else grade = 'F';
  }

  return {
    c1,
    c2,
    c3,
    att,
    best2: Math.round(best2 * 10) / 10,
    totalCA: total,
    grade,
  };
}

/**
 * Extract plain text from PDF buffer
 */
async function extractTextFromPDF(buffer) {
  try {
    const pdfModule = require('pdf-parse');
    if (pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: buffer });
      if (typeof parser.load === 'function') await parser.load();
      if (typeof parser.getText === 'function') {
        const res = await parser.getText();
        if (res) return typeof res === 'string' ? res : res.text || '';
      }
    } else if (typeof pdfModule === 'function') {
      const data = await pdfModule(buffer);
      if (data && data.text) return data.text;
    }
  } catch (err) {
    console.warn('[AI Extractor] PDFParse primary parsing note:', err.message);
  }

  // Robust fallback: extract text streams from PDF raw representation
  try {
    const raw = buffer.toString('binary');
    const chunks = [];
    const textRegex = /\(([^)]+)\)\s*Tj/g;
    let match;
    while ((match = textRegex.exec(raw)) !== null) {
      chunks.push(match[1]);
    }
    if (chunks.length > 0) {
      return chunks.join(' ');
    }
    // ASCII clean fallback
    return buffer.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, ' ');
  } catch (fallbackErr) {
    return buffer.toString('utf8');
  }
}

/**
 * Detect column keys from an object based on regex heuristics
 */
function identifyColumns(keys) {
  let rollKey = null;
  let nameKey = null;
  let ct1Key = null;
  let ct2Key = null;
  let ct3Key = null;
  let attKey = null;
  let remarkKey = null;
  let genericMarksKey = null;

  for (const k of keys) {
    const lower = k.toLowerCase().replace(/[\s_-]+/g, '');
    if (!rollKey && /roll|studentroll|studentid|reg|registration/.test(lower)) {
      rollKey = k;
    } else if (!nameKey && /name|studentname/.test(lower)) {
      nameKey = k;
    } else if (!ct1Key && /ct1|test1|classtest1|quiz1/.test(lower)) {
      ct1Key = k;
    } else if (!ct2Key && /ct2|test2|classtest2|quiz2/.test(lower)) {
      ct2Key = k;
    } else if (!ct3Key && /ct3|test3|classtest3|quiz3/.test(lower)) {
      ct3Key = k;
    } else if (!attKey && /att|attendance|presence/.test(lower)) {
      attKey = k;
    } else if (!remarkKey && /remark|comment|note/.test(lower)) {
      remarkKey = k;
    } else if (!genericMarksKey && /mark|score|obtained/.test(lower)) {
      genericMarksKey = k;
    }
  }

  return { rollKey, nameKey, ct1Key, ct2Key, ct3Key, attKey, remarkKey, genericMarksKey };
}

/**
 * Intelligent Multi-Format Assessment Mark Extractor
 * Accepts buffer, filename, mimetype, or raw text and maps to enrolled students.
 */
async function extractMarksFromFile({ buffer, fileName, mimeType, rawText, enrolledStudents }) {
  let fileType = 'TEXT';
  let extractedRows = []; // Array of { roll, ct1, ct2, ct3, attendance, remarks, name }

  const lowerName = (fileName || '').toLowerCase();

  // 1. EXCEL SPREADSHEETS (.xlsx, .xls)
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
    fileType = 'EXCEL';
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawJson = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (rawJson.length > 0) {
      const keys = Object.keys(rawJson[0]);
      const cols = identifyColumns(keys);

      for (const row of rawJson) {
        const rollVal = cols.rollKey ? String(row[cols.rollKey] || '').trim() : '';
        const nameVal = cols.nameKey ? String(row[cols.nameKey] || '').trim() : '';

        // If specific CT columns were found
        let ct1Val = cols.ct1Key ? row[cols.ct1Key] : '';
        let ct2Val = cols.ct2Key ? row[cols.ct2Key] : '';
        let ct3Val = cols.ct3Key ? row[cols.ct3Key] : '';
        let attVal = cols.attKey ? row[cols.attKey] : '';
        let remarkVal = cols.remarkKey ? String(row[cols.remarkKey] || '') : '';

        // If only generic marks column existed
        if (cols.genericMarksKey && !cols.ct1Key && ct1Val === '') {
          ct1Val = row[cols.genericMarksKey];
        }

        extractedRows.push({
          roll: rollVal,
          name: nameVal,
          ct1: ct1Val,
          ct2: ct2Val,
          ct3: ct3Val,
          attendance: attVal,
          remarks: remarkVal,
        });
      }
    }
  }

  // 2. PDF DOCUMENTS (.pdf)
  else if (lowerName.endsWith('.pdf') || mimeType?.includes('pdf')) {
    fileType = 'PDF';
    const pdfText = await extractTextFromPDF(buffer);
    const lines = pdfText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    for (const line of lines) {
      // Look for numbers on the line
      const tokens = line.split(/[\s,;|]+/);
      // Try to find roll pattern (e.g. CSE-20230101, 20230101, or starting letters)
      let foundRoll = '';
      const numbers = [];
      const wordParts = [];

      for (const token of tokens) {
        if (/^(CSE[-_]?)?\d{4,10}$/i.test(token) || /^[A-Z]{2,4}[-_]?\d{3,8}$/i.test(token)) {
          foundRoll = token.toUpperCase();
        } else if (!isNaN(parseFloat(token)) && isFinite(token)) {
          numbers.push(parseFloat(token));
        } else if (token.length > 1) {
          wordParts.push(token);
        }
      }

      if (foundRoll || numbers.length >= 1) {
        let ct1 = '', ct2 = '', ct3 = '', att = '';
        if (numbers.length >= 4) {
          ct1 = numbers[0];
          ct2 = numbers[1];
          ct3 = numbers[2];
          att = numbers[3];
        } else if (numbers.length === 3) {
          ct1 = numbers[0];
          ct2 = numbers[1];
          ct3 = numbers[2];
        } else if (numbers.length === 2) {
          ct1 = numbers[0];
          ct2 = numbers[1];
        } else if (numbers.length === 1) {
          ct1 = numbers[0];
        }

        extractedRows.push({
          roll: foundRoll,
          name: wordParts.slice(0, 3).join(' '),
          ct1,
          ct2,
          ct3,
          attendance: att,
          remarks: wordParts.slice(3).join(' '),
        });
      }
    }
  }

  // 3. CSV / TSV / RAW TEXT
  else {
    fileType = lowerName.endsWith('.csv') ? 'CSV' : 'TEXT';
    const content = buffer ? buffer.toString('utf8') : (rawText || '');

    let parsedSuccessfully = false;

    // Try CSV column parse if content has commas
    if (content.includes(',')) {
      try {
        const records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });

        if (records && records.length > 0) {
          const keys = Object.keys(records[0]);
          const cols = identifyColumns(keys);

          if (cols.rollKey || cols.ct1Key || cols.genericMarksKey) {
            for (const row of records) {
              extractedRows.push({
                roll: cols.rollKey ? String(row[cols.rollKey] || '').trim() : '',
                name: cols.nameKey ? String(row[cols.nameKey] || '').trim() : '',
                ct1: cols.ct1Key ? row[cols.ct1Key] : (cols.genericMarksKey ? row[cols.genericMarksKey] : ''),
                ct2: cols.ct2Key ? row[cols.ct2Key] : '',
                ct3: cols.ct3Key ? row[cols.ct3Key] : '',
                attendance: cols.attKey ? row[cols.attKey] : '',
                remarks: cols.remarkKey ? String(row[cols.remarkKey] || '') : '',
              });
            }
            parsedSuccessfully = true;
          }
        }
      } catch (e) {
        // Will fallback to token parsing
      }
    }

    // Tokenized line-by-line parsing for plain text, space-separated, TSV, or unstructured rows
    if (!parsedSuccessfully || extractedRows.length === 0) {
      const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      for (const line of lines) {
        if (/^(roll|student|id|#)/i.test(line) && /ct|mark|test|att/i.test(line)) continue;

        const tokens = line.split(/[\t,;| ]+/).filter((t) => t.length > 0);
        let foundRoll = '';
        const numbers = [];
        const words = [];

        for (const token of tokens) {
          if (/^(CSE[-_]?)?\d{4,10}$/i.test(token) || /^[A-Z]{2,4}[-_]?\d{3,8}$/i.test(token)) {
            foundRoll = token.toUpperCase();
          } else if (!isNaN(parseFloat(token)) && isFinite(token)) {
            numbers.push(parseFloat(token));
          } else if (token.length > 1) {
            words.push(token);
          }
        }

        if (foundRoll || numbers.length >= 1) {
          let ct1 = '', ct2 = '', ct3 = '', att = '';
          if (numbers.length >= 4) {
            ct1 = numbers[0];
            ct2 = numbers[1];
            ct3 = numbers[2];
            att = numbers[3];
          } else if (numbers.length === 3) {
            ct1 = numbers[0];
            ct2 = numbers[1];
            ct3 = numbers[2];
          } else if (numbers.length === 2) {
            ct1 = numbers[0];
            ct2 = numbers[1];
          } else if (numbers.length === 1) {
            ct1 = numbers[0];
          }

          extractedRows.push({
            roll: foundRoll,
            name: words.slice(0, 2).join(' '),
            ct1,
            ct2,
            ct3,
            attendance: att,
            remarks: words.slice(2).join(' '),
          });
        }
      }
    }
  }

  // =========================================================================
  // MATCH WITH ENROLLED STUDENTS & COMPUTE CONTINUOUS ASSESSMENT
  // =========================================================================
  const matched = [];
  const unmatched = [];
  const usedStudentIds = new Set();

  for (const row of extractedRows) {
    const rawRoll = (row.roll || '').toUpperCase().trim();
    const rawName = (row.name || '').toLowerCase().trim();

    // 1. Match student in enrolled roster
    const student = (enrolledStudents || []).find((s) => {
      if (usedStudentIds.has(s.student_id)) return false;
      const sRoll = (s.student_roll || '').toUpperCase().trim();
      const sName = (s.student_name || '').toLowerCase().trim();

      // Exact roll match
      if (rawRoll && sRoll === rawRoll) return true;
      // Partial roll match (e.g. 20230101 vs CSE-20230101)
      if (rawRoll && (sRoll.endsWith(rawRoll) || rawRoll.endsWith(sRoll))) return true;
      // Name match if roll matched nothing
      if (!rawRoll && rawName && (sName.includes(rawName) || rawName.includes(sName))) return true;

      return false;
    });

    if (student) {
      usedStudentIds.add(student.student_id);
      const ca = calculateCA(row.ct1, row.ct2, row.ct3, row.attendance);

      matched.push({
        studentId: student.student_id,
        studentRoll: student.student_roll,
        studentName: student.student_name,
        ct1: ca.c1 !== null ? ca.c1 : (row.ct1 !== '' ? row.ct1 : ''),
        ct2: ca.c2 !== null ? ca.c2 : (row.ct2 !== '' ? row.ct2 : ''),
        ct3: ca.c3 !== null ? ca.c3 : (row.ct3 !== '' ? row.ct3 : ''),
        attendance: ca.att !== null ? ca.att : (row.attendance !== '' ? row.attendance : ''),
        remarks: row.remarks || '',
        best2: ca.best2,
        totalCA: ca.totalCA,
        grade: ca.grade,
        matchConfidence: 'HIGH',
      });
    } else if (rawRoll || rawName) {
      unmatched.push({
        rawRoll: row.roll,
        rawName: row.name,
        ct1: row.ct1,
        ct2: row.ct2,
        ct3: row.ct3,
        attendance: row.attendance,
      });
    }
  }

  // Also calculate class standing / rank for matched students
  const validForRank = matched.filter((s) => s.totalCA !== null);
  validForRank.sort((a, b) => b.totalCA - a.totalCA);
  validForRank.forEach((s, idx) => {
    s.position = idx + 1;
  });

  return {
    success: true,
    fileType,
    fileName: fileName || 'Uploaded Document',
    matchedCount: matched.length,
    totalEnrolled: (enrolledStudents || []).length,
    results: matched,
    unmatched,
  };
}

module.exports = {
  extractMarksFromFile,
  calculateCA,
};
