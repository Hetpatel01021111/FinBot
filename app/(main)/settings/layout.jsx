"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SettingsLayout({ children }) {
  return (
    <div className="container max-w-7xl py-10">
      <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        Settings
      </h1>
      <p className="text-gray-500 mb-8">
        Manage your FinBox account settings and preferences
      </p>
      
      <div className="mb-8">
        <nav className="flex space-x-2 bg-gray-100 p-1 rounded-md w-[400px]">
          <Link 
            href="/settings/api-token" 
            className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${usePathname() === '/settings/api-token' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            API Token
          </Link>
          <Link 
            href="/settings/profile" 
            className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${usePathname() === '/settings/profile' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Profile
          </Link>
        </nav>
      </div>
      
      {children}
    </div>
  );
}
