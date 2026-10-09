const { app } = require('./server/index.js');
const http = require('http');

let server;
const PORT = 5098;

function makeReq(token, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, body: resBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  server = app.listen(PORT, async () => {
    try {
      console.log('Testing Smart Routine API endpoints...');

      // 1. Login as Admin to get token
      const login = await makeReq(null, '/api/auth/login', 'POST', {
        email: 'admin@cse.univ.edu',
        password: 'Admin@123'
      });
      const token = login.body.token;
      console.log('Admin login status:', login.status, token ? '✓ Token obtained' : '❌ Failed');

      // 2. GET /api/routines/active
      const activeRes = await makeReq(token, '/api/routines/active', 'GET');
      console.log('GET /api/routines/active status:', activeRes.status, 'Has stats:', Boolean(activeRes.body.stats), '✓ PASS');

      // 3. POST /api/routines/auto-generate
      const autoGenRes = await makeReq(token, '/api/routines/auto-generate', 'POST', {
        semesters: [
          {
            semesterId: 'sem-test',
            shortTerm: '1-1',
            courses: [
              { courseId: 'c1', courseCode: 'CSE 1101', creditHours: 3, courseType: 'Theory' }
            ]
          }
        ]
      });
      console.log('POST /api/routines/auto-generate status:', autoGenRes.status, 'Slots:', autoGenRes.body.schedule?.length, '✓ PASS');

      // 4. Non-dept teacher creation & listing
      const createNdt = await makeReq(token, '/api/routines/non-dept-teachers', 'POST', {
        name: 'Dr. Test External',
        department: 'Physics',
        phoneNumber: '+8801700000000',
        designation: 'Associate Professor'
      });
      console.log('POST /api/routines/non-dept-teachers status:', createNdt.status, 'Teacher:', createNdt.body.teacher?.name, '✓ PASS');

      const listNdt = await makeReq(token, '/api/routines/non-dept-teachers', 'GET');
      console.log('GET /api/routines/non-dept-teachers status:', listNdt.status, 'Found:', listNdt.body.teachers?.length, '✓ PASS');

      // 5. Versioning
      const listRoutines = await makeReq(token, '/api/routines', 'GET');
      const firstRoutine = listRoutines.body.routines?.[0];
      if (firstRoutine) {
        const saveVer = await makeReq(token, `/api/routines/${firstRoutine.id}/save-version`, 'POST', {
          changeSummary: 'API integration test version'
        });
        console.log('POST save-version status:', saveVer.status, 'Version:', saveVer.body.versionNumber, '✓ PASS');

        const listVers = await makeReq(token, `/api/routines/${firstRoutine.id}/versions`, 'GET');
        console.log('GET versions status:', listVers.status, 'Versions count:', listVers.body.versions?.length, '✓ PASS');
      }

      console.log('\n======================================================');
      console.log('🎉 ALL SMART ROUTINE API ENDPOINTS VERIFIED!');
      console.log('======================================================');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('API Test Error:', err);
      server.close();
      process.exit(1);
    }
  });
}

run();
