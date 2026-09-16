import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import Layout from '../components/Layout';

interface UserInfo {
  id: number;
  email: string;
  role: string;
  is_active?: boolean;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: user, isLoading, isError } = useQuery<UserInfo>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data;
    },
  });

  const updateEmail = useMutation({
    mutationFn: async () => {
      await api.put('/users/me', { email: newEmail });
    },
    onSuccess: () => {
      setSuccessMsg('Email updated successfully!');
      setErrorMsg('');
      setNewEmail('');
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Email updated');
      }
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => {
      setErrorMsg('Failed to update email.');
    },
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      await api.post('/auth/change-password', { new_password: newPassword });
    },
    onSuccess: () => {
      setSuccessMsg('Password changed successfully!');
      setErrorMsg('');
      setNewPassword('');
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Password changed');
      }
    },
    onError: () => {
      setErrorMsg('Failed to change password.');
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-3">⏳</p>
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  if (isError || !user) {
    return (
      <Layout>
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 text-red-700 rounded-xl p-4">
          Failed to load profile.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>

        {successMsg && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-300 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 text-sm">
            ✅ {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
            ❌ {errorMsg}
          </div>
        )}

        {/* Info card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-semibold text-gray-900 dark:text-white">{user.email}</p>
            </div>
            <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
              Role: {user.role}
            </span>
          </div>
          {user.is_active !== undefined && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Account Status</p>
              <p className={`text-sm font-semibold ${user.is_active ? 'text-green-600' : 'text-red-500'}`}>
                {user.is_active ? '● Active' : '● Inactive'}
              </p>
            </div>
          )}
        </div>

        {/* Update Email */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
          <h2 className="font-semibold text-gray-800 dark:text-white">Update Email</h2>
          <input
            type="email"
            placeholder="New email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => updateEmail.mutate()}
            disabled={!newEmail || updateEmail.isPending}
            aria-label="Save"
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {updateEmail.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
          <h2 className="font-semibold text-gray-800 dark:text-white">Change Password</h2>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => changePassword.mutate()}
            disabled={!newPassword || changePassword.isPending}
            aria-label="Change"
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {changePassword.isPending ? 'Changing…' : 'Change'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
