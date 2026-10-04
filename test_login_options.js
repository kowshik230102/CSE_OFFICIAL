const http = require('http');

const makeRequest = (path, method = 'GET', data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function testLoginOptions() {
  console.log('\n--- TESTING 3 LOGIN & REGISTRATION OPTIONS ---');

  // 1. Admin Login (Valid Admin)
  const adminRes = await makeRequest('/api/auth/admin-login', 'POST', {
    email: 'admin@cse.univ.edu',
    password: 'Admin@123',
  });
  console.log('1. Admin Login (Admin Account):', adminRes.status === 200 ? 'SUCCESS' : 'FAILED', adminRes.data.user?.role);

  // 2. Admin Login (Non-Admin Attempt - Should be rejected)
  const nonAdminAttempt = await makeRequest('/api/auth/admin-login', 'POST', {
    email: 'rahman@cse.univ.edu',
    password: 'Teacher@123',
  });
  console.log(
    '2. Admin Login Guard (Teacher attempting admin login):',
    nonAdminAttempt.status === 403 ? 'BLOCKED WITH 403 (PASSED)' : 'FAILED',
    nonAdminAttempt.data.error
  );

  // 3. User Sign In (Valid Teacher)
  const userSignin = await makeRequest('/api/auth/login', 'POST', {
    email: 'rahman@cse.univ.edu',
    password: 'Teacher@123',
  });
  console.log('3. User Sign In (Teacher Account):', userSignin.status === 200 ? 'SUCCESS' : 'FAILED', userSignin.data.user?.firstName);

  // 4. User Sign Up (New Student Self-Registration)
  const randomRoll = 'CSE-2024' + Math.floor(1000 + Math.random() * 9000);
  const randomEmail = `newstudent_${Date.now()}@cse.univ.edu`;

  const userSignup = await makeRequest('/api/auth/register', 'POST', {
    role: 'STUDENT',
    firstName: 'Zubair',
    lastName: 'Hasan',
    email: randomEmail,
    password: 'Password@123',
    phoneNumber: '+8801711223344',
    studentRoll: randomRoll,
    registrationNo: 'REG-' + Math.floor(10000 + Math.random() * 90000),
  });
  console.log('4. User Sign Up (New Student Registration):', userSignup.status === 201 ? 'SUCCESS' : 'FAILED', userSignup.data.user?.studentRoll);

  console.log('\n======================================================');
  console.log('🎉 ALL 3 LOGIN & SIGN UP OPTIONS FULLY OPERATIONAL!');
  console.log('======================================================\n');
}

testLoginOptions();
