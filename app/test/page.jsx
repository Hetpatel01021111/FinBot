"use client";

import { useEffect, useState } from 'react';

export default function TestPage() {
  const [config, setConfig] = useState({});
  const [firebaseStatus, setFirebaseStatus] = useState('checking...');

  useEffect(() => {
    // Check environment variables
    const envConfig = {
      clerkKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'Set' : 'Missing',
      firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Missing',
      firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Set' : 'Missing',
      firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
    };
    setConfig(envConfig);

    // Test Firebase initialization
    import('@/lib/firebase').then(({ db, auth, storage }) => {
      if (db && auth && storage) {
        setFirebaseStatus('✅ Firebase initialized successfully');
      } else {
        setFirebaseStatus('❌ Firebase initialization failed');
      }
    }).catch((error) => {
      setFirebaseStatus(`❌ Firebase error: ${error.message}`);
    });
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">FinBox Configuration Test</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="font-medium">{key}:</span>
                <span className={value === 'Set' ? 'text-green-600' : 'text-red-600'}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Firebase Status</h2>
          <p className="text-lg">{firebaseStatus}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Navigation Test</h2>
          <div className="space-y-2">
            <a href="/" className="block text-blue-600 hover:underline">→ Home Page</a>
            <a href="/dashboard" className="block text-blue-600 hover:underline">→ Dashboard</a>
            <a href="/sign-in" className="block text-blue-600 hover:underline">→ Sign In</a>
            <a href="/sign-up" className="block text-blue-600 hover:underline">→ Sign Up</a>
          </div>
        </div>
      </div>
    </div>
  );
}
