const bcrypt = require('bcryptjs');
const { db } = require('../db/schema');

const PUST_CSE_URL = 'https://pust.ac.bd/academic/departments/dept_teachers/D01';

// In-memory sync status tracking
let lastSyncInfo = {
  lastSyncedAt: null,
  status: 'IDLE',
  totalSynced: 0,
  sourceUrl: PUST_CSE_URL,
  error: null
};

/**
 * Fetch and parse all official CSE faculty members from PUST
 */
async function fetchPustCseTeachers() {
  const response = await fetch(PUST_CSE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PUST CSE faculty page: HTTP ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Split HTML into teacher card chunks
  const cardChunks = html.split(/<div class=["']col-md-4\s+to_profile["']/i);
  if (cardChunks.length <= 1) {
    throw new Error('No faculty member cards could be identified in the external HTML payload.');
  }

  const teachersMap = new Map();

  for (let i = 1; i < cardChunks.length; i++) {
    const chunk = cardChunks[i];

    // 1. Profile ID
    const profileMatch = chunk.match(/dept_teachers_profile\/(\d+)/i);
    if (!profileMatch) continue;
    const profileId = profileMatch[1];

    // 2. Name & Designation
    let name = 'Faculty Member';
    let designation = 'Teacher';

    const h4Match = chunk.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    if (h4Match) {
      const h4Content = h4Match[1];
      // PUST has <span>Associate Professor</a></span> where </a> closes prematurely
      const spanMatch = h4Content.match(/<span[^>]*>([\s\S]*?)(?:<\/span>|<\/a>)/i);
      if (spanMatch) {
        designation = spanMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      }

      // Name is before <br> or <span
      const rawName = h4Content.replace(/<a[^>]*>/i, '').split(/<br\s*\/?>|<span/i)[0];
      if (rawName && rawName.trim()) {
        name = rawName.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      }
    }

    // 3. Photo URL
    let photoUrl = null;
    const imgMatch = chunk.match(/<div class=["']front["'][\s\S]*?<img[^>]*src=["']([^"']+)["']/i)
      || chunk.match(/<img[^>]*src=["'](https:\/\/pust\.ac\.bd\/includes\/images\/teachers\/[^"']+)["']/i);
    if (imgMatch) {
      photoUrl = imgMatch[1];
      if (photoUrl.startsWith('/')) {
        photoUrl = 'https://pust.ac.bd' + photoUrl;
      }
    }

    // 4. Contact Details (Emails & Phones)
    const emails = [...chunk.matchAll(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)].map(m => m[1]);
    const officeEmail = emails.find(e => e.includes('pust.ac.bd')) || emails[0] || `teacher.${profileId}@pust.ac.bd`;
    const personalEmail = emails.find(e => !e.includes('pust.ac.bd')) || null;

    const phones = [...chunk.matchAll(/(?:\+88\d{11}|\d{11}|\d{4}-\d{5})/g)].map(m => m[0]);
    const officePhone = phones.find(p => p.startsWith('+8802') || p.includes('0731')) || '+8802588844876';
    const personalPhone = phones.find(p => p.startsWith('+8801') || p.startsWith('01')) || null;

    // 5. Qualification & Research Area
    let qualification = '';
    const qualMatch = chunk.match(/Qualification:<\/b>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    if (qualMatch) {
      qualification = qualMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    let researchArea = '';
    const researchMatch = chunk.match(/Research Area:<\/b>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    if (researchMatch) {
      researchArea = researchMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    // 6. Publications Count
    let publicationsCount = 0;
    const pubMatch = chunk.match(/Total Publications:[\s\S]*?>(\d+)<\/span>/i);
    if (pubMatch) {
      publicationsCount = parseInt(pubMatch[1], 10) || 0;
    }

    // 7. On Leave Status
    const onLeave = designation.toLowerCase().includes('leave') ? 1 : 0;

    const teacherData = {
      profileId,
      name,
      designation,
      departmentCode: 'CSE',
      departmentName: 'Department of Computer Science and Engineering',
      photoUrl,
      officeEmail,
      personalEmail,
      officePhone,
      personalPhone,
      qualification,
      researchArea,
      publicationsCount,
      onLeave,
      profileUrl: `https://pust.ac.bd/academic/departments/dept_teachers/dept_teachers_profile/${profileId}`
    };

    // Keep unique by profileId (Chairman card might appear twice on page: top glance + grid)
    if (!teachersMap.has(profileId) || designation.toLowerCase().includes('chair')) {
      teachersMap.set(profileId, teacherData);
    }
  }

  return Array.from(teachersMap.values());
}

/**
 * Synchronize external PUST CSE faculty into local SQLite database
 */
async function syncPustTeachersToDatabase() {
  try {
    const liveTeachers = await fetchPustCseTeachers();
    if (!liveTeachers || liveTeachers.length === 0) {
      throw new Error('Fetched 0 faculty members from external source.');
    }

    const defaultPassHash = bcrypt.hashSync('Teacher@123', 8);

    const checkTeacherByProfile = db.prepare('SELECT * FROM teachers WHERE profile_id = ?');
    const checkTeacherByEmail = db.prepare(`
      SELECT t.*, u.id as user_id, u.email
      FROM teachers t
      JOIN users u ON u.id = t.user_id
      WHERE u.email = ? OR t.personal_email = ?
    `);

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
      VALUES (?, ?, ?, 'TEACHER', 'ACTIVE', ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        phone_number = COALESCE(excluded.phone_number, users.phone_number),
        status = 'ACTIVE'
    `);

    const insertTeacher = db.prepare(`
      INSERT INTO teachers (
        id, user_id, designation, department_code, room_number,
        qualification, research_area, publications_count, photo_url,
        office_phone, personal_email, personal_phone, on_leave, bio, profile_id
      ) VALUES (?, ?, ?, 'CSE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        designation = excluded.designation,
        qualification = COALESCE(excluded.qualification, teachers.qualification),
        research_area = COALESCE(excluded.research_area, teachers.research_area),
        publications_count = excluded.publications_count,
        photo_url = COALESCE(excluded.photo_url, teachers.photo_url),
        office_phone = excluded.office_phone,
        personal_email = excluded.personal_email,
        personal_phone = excluded.personal_phone,
        on_leave = excluded.on_leave,
        profile_id = excluded.profile_id
    `);

    const updateTeacherByProfile = db.prepare(`
      UPDATE teachers SET
        designation = ?,
        qualification = COALESCE(?, qualification),
        research_area = COALESCE(?, research_area),
        publications_count = ?,
        photo_url = COALESCE(?, photo_url),
        office_phone = ?,
        personal_email = ?,
        personal_phone = ?,
        on_leave = ?,
        profile_id = ?
      WHERE profile_id = ?
    `);

    const syncTx = db.transaction(() => {
      const liveProfileIds = new Set(liveTeachers.map(t => t.profileId));

      for (const t of liveTeachers) {
        // Split name into first and last name
        const nameParts = t.name.split(' ');
        const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

        // Check if existing by profile_id
        const existingByProfile = checkTeacherByProfile.get(t.profileId);
        if (existingByProfile) {
          updateTeacherByProfile.run(
            t.designation,
            t.qualification,
            t.researchArea,
            t.publicationsCount,
            t.photoUrl,
            t.officePhone,
            t.personalEmail,
            t.personalPhone,
            t.onLeave,
            t.profileId,
            t.profileId
          );

          // Update user name and phone
          db.prepare(`
            UPDATE users SET first_name = ?, last_name = ?, phone_number = COALESCE(?, phone_number), status = 'ACTIVE'
            WHERE id = ?
          `).run(firstName, lastName, t.personalPhone || t.officePhone, existingByProfile.user_id);
          continue;
        }

        // Check if existing by email
        const existingByEmail = checkTeacherByEmail.get(t.officeEmail, t.personalEmail);
        if (existingByEmail) {
          db.prepare(`
            UPDATE teachers SET
              designation = ?,
              qualification = COALESCE(?, qualification),
              research_area = COALESCE(?, research_area),
              publications_count = ?,
              photo_url = COALESCE(?, photo_url),
              office_phone = ?,
              personal_email = ?,
              personal_phone = ?,
              on_leave = ?,
              profile_id = ?
            WHERE id = ?
          `).run(
            t.designation,
            t.qualification,
            t.researchArea,
            t.publicationsCount,
            t.photoUrl,
            t.officePhone,
            t.personalEmail,
            t.personalPhone,
            t.onLeave,
            t.profileId,
            existingByEmail.id
          );

          db.prepare(`
            UPDATE users SET first_name = ?, last_name = ?, phone_number = COALESCE(?, phone_number), status = 'ACTIVE'
            WHERE id = ?
          `).run(firstName, lastName, t.personalPhone || t.officePhone, existingByEmail.user_id);
          continue;
        }

        // If completely new teacher: insert user + teacher
        const newUserId = `u-t-${t.profileId}`;
        const newTeacherId = `t-${t.profileId}`;

        insertUser.run(
          newUserId,
          t.officeEmail,
          defaultPassHash,
          firstName,
          lastName,
          t.personalPhone || t.officePhone
        );

        const createdUser = db.prepare('SELECT id FROM users WHERE email = ?').get(t.officeEmail);
        const actualUserId = createdUser ? createdUser.id : newUserId;

        insertTeacher.run(
          newTeacherId,
          actualUserId,
          t.designation,
          'Academic Bldg 3, CSE Dept',
          t.qualification,
          t.researchArea,
          t.publicationsCount,
          t.photoUrl,
          t.officePhone,
          t.personalEmail,
          t.personalPhone,
          t.onLeave,
          `Faculty Member, Department of Computer Science & Engineering, PUST. Research focus: ${t.researchArea || 'Computer Science'}.`,
          t.profileId
        );
      }

      // Reconcile Removals: Teachers who had a profile_id but are no longer in the external list
      const allSyncedTeachers = db.prepare('SELECT id, profile_id, user_id FROM teachers WHERE profile_id IS NOT NULL').all();
      for (const st of allSyncedTeachers) {
        if (!liveProfileIds.has(st.profile_id)) {
          // Soft-delete / tombstone: mark as on_leave / inactive without breaking foreign keys!
          db.prepare('UPDATE teachers SET on_leave = 1 WHERE id = ?').run(st.id);
          db.prepare("UPDATE users SET status = 'SUSPENDED' WHERE id = ?").run(st.user_id);
        }
      }
    });

    syncTx();

    lastSyncInfo = {
      lastSyncedAt: new Date().toISOString(),
      status: 'SUCCESS',
      totalSynced: liveTeachers.length,
      sourceUrl: PUST_CSE_URL,
      error: null
    };

    return {
      success: true,
      totalSynced: liveTeachers.length,
      lastSyncedAt: lastSyncInfo.lastSyncedAt,
      teachers: liveTeachers
    };
  } catch (err) {
    lastSyncInfo = {
      ...lastSyncInfo,
      status: 'ERROR',
      error: err.message
    };
    throw err;
  }
}

/**
 * Get current sync metadata
 */
function getSyncStatus() {
  return { ...lastSyncInfo };
}

/**
 * Schedule periodic synchronization (default every 12 hours)
 */
function schedulePeriodicSync(intervalHours = 12) {
  const ms = intervalHours * 60 * 60 * 1000;
  setInterval(() => {
    syncPustTeachersToDatabase()
      .then(res => console.log(`[PUST Teacher Sync] Automated background sync completed: ${res.totalSynced} faculty members.`))
      .catch(err => console.error('[PUST Teacher Sync] Automated background sync warning:', err.message));
  }, ms);
}

module.exports = {
  fetchPustCseTeachers,
  syncPustTeachersToDatabase,
  getSyncStatus,
  schedulePeriodicSync,
  PUST_CSE_URL
};
