import React from 'react';
import { LogIn, LogOut, User } from 'lucide-react';

interface HeaderProps {
  isSignedIn: boolean;
  user?: {
    name?: string;
    email?: string;
    photoURL?: string;
  } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSignedIn,
  user,
  onSignIn,
  onSignOut,
}) => {
  return (
    <header className="w-full bg-gray-900/80 backdrop-blur-sm border-b border-gray-800/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                E-ink Dither
              </h1>
              <p className="text-xs text-gray-400">
                Optimize images for e-ink displays
              </p>
            </div>
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {isSignedIn && user ? (
              <div className="flex items-center gap-3">
                {/* User Info */}
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-200">
                    {user.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>

                {/* User Avatar */}
                <div className="relative group">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.name || 'User'}
                      className="w-10 h-10 rounded-full border-2 border-gray-700 group-hover:border-gray-600 transition-colors"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-gray-700 group-hover:border-gray-600 transition-colors">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" />
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={onSignOut}
                  className="
                    flex items-center gap-2 px-4 py-2 rounded-lg
                    bg-gray-800 hover:bg-gray-700
                    border border-gray-700 hover:border-gray-600
                    text-gray-300 hover:text-white
                    text-sm font-medium
                    transition-all duration-200
                    hover:scale-[1.02] active:scale-[0.98]
                  "
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="
                  flex items-center gap-2 px-5 py-2.5 rounded-lg
                  bg-white hover:bg-gray-100
                  text-gray-900 font-medium text-sm
                  transition-all duration-200
                  hover:scale-[1.02] active:scale-[0.98]
                  shadow-lg hover:shadow-xl
                "
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
