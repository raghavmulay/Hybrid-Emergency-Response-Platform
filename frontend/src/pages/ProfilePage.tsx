// ProfilePage.tsx – corrected implementation using TanStack Query v5 syntax

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import Layout from '../components/Layout';

interface UserInfo {
  email: string;
  role: string;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();

  const { data: user = { email: '', role: '' }, isLoading, isError } = useQuery<UserInfo>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data;
    },
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const changePassword = useMutation({
    mutationFn: async () => {
      await api.post('/auth/change-password', { new_password: password });
    },
    onSuccess: () => {
      alert('Password changed');
      setPassword('');
    },
  });

  const updateEmail = useMutation({
    mutationFn: async () => {
      await api.put('/users/me', { email });
    },
    onSuccess: () => {
      alert('Email updated');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  if (isLoading) return <Layout><p>Loading...</p></Layout>;
  if (isError) return <Layout><p className="text-red-600">Failed to load user.</p></Layout>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <p><strong>Role:</strong> {user.role}</p>
      <div className="mt-4">
        <h2 className="text-xl font-semibold mb-2">Update Email</h2>
        <input
          type="email"
          placeholder="New email"
          className="border p-2 mr-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={() => updateEmail.mutate()}
          className="bg-indigo-600 text-white px-3 py-1 rounded"
        >
          Save
        </button>
      </div>
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Change Password</h2>
        <input
          type="password"
          placeholder="New password"
          className="border p-2 mr-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={() => changePassword.mutate()}
          className="bg-indigo-600 text-white px-3 py-1 rounded"
        >
          Change
        </button>
      </div>
    </Layout>
  );
}
