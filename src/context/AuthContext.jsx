import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const DEMO_USERS = [
  { label: 'Chairman (Dr. Abdur Rahim, Dept Chair)', email: 'chair.cse_pust@gmail.com', password: '12345678', role: 'TEACHER', isChair: true },
  { label: 'Admin (Master Control)', email: 'admin@cse.univ.edu', password: 'Admin@123', role: 'ADMIN' },
  { label: 'Office Staff (Academic Data)', email: 'office@cse.univ.edu', password: 'Office@123', role: 'OFFICE_STAFF' },
  { label: 'Teacher (Dr. M. Rahman)', email: 'rahman@cse.univ.edu', password: 'Teacher@123', role: 'TEACHER' },
  { label: 'Teacher (Dr. S. Fatima)', email: 'fatima@cse.univ.edu', password: 'Teacher@123', role: 'TEACHER' },
  { label: 'Student (Tanvir - Roll: 20230101)', email: 'student1@cse.univ.edu', password: 'Student@123', role: 'STUDENT' },
  { label: 'Student (Nusrat - Roll: 20230102)', email: 'student2@cse.univ.edu', password: 'Student@123', role: 'STUDENT' },
];


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('cse_token') || null);
  const [loading, setLoading] = useState(true);

  // Fetch current user if token exists
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Token invalid');
        })
        .then((data) => {
          setUser(data.user);
          setLoading(false);
        })
        .catch(() => {
          logout();
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  // Standard User Login (Students, Teachers, Office Staff)
  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('cse_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  // Dedicated Admin Login (Strictly verifies ADMIN role)
  const adminLogin = async (email, password) => {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Admin verification failed');
    }

    localStorage.setItem('cse_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  // User Sign Up (Students & Faculty)
  const register = async (formData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('cse_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const quickLogin = async (email, password) => {
    try {
      setLoading(true);
      await login(email, password);
    } catch (e) {
      console.error('Quick login failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('cse_token');
    setToken(null);
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to change password');
    }
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        adminLogin,
        register,
        logout,
        quickLogin,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
