'use client'
import { useState } from 'react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, avatar })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Registration failed');
      return;
    }
    window.location.href = '/login';
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <form className="bg-white p-8 rounded shadow w-80" onSubmit={handleRegister}>
        <h2 className="text-2xl font-bold mb-6">Register</h2>
        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full mb-4 p-2 border rounded" required />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full mb-4 p-2 border rounded" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full mb-4 p-2 border rounded" required />
        <input type="text" placeholder="Avatar URL (optional)" value={avatar} onChange={e => setAvatar(e.target.value)} className="w-full mb-4 p-2 border rounded" />
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Register</button>
        <div className="mt-4 text-center">
          <a href="/login" className="text-blue-600 hover:underline">Already have an account? Login</a>
        </div>
      </form>
    </div>
  );
}
