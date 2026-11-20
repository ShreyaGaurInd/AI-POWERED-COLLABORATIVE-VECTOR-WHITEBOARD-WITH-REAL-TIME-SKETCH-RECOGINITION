import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PenTool, 
  Wand2, 
  Users, 
  Presentation, 
  ShieldCheck
} from 'lucide-react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950">
      {/* Top Bar Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Left Hero Brand Panel (Canva Creative & Inviting Vibe) */}
      <div className="lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Soft background light blooms */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-400/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner flex items-center justify-center">
              <PenTool className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight">CollabBoard</span>
              <span className="ml-2.5 px-2.5 py-0.5 text-xs font-bold uppercase bg-white/25 text-white rounded-full tracking-wide">
                Smart Canvas
              </span>
            </div>
          </div>

          <div className="mt-12 lg:mt-16 max-w-lg">
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Create, brainstorm, and bring ideas to life together.
            </h1>
            <p className="mt-4 text-lg text-purple-100 font-normal leading-relaxed">
              An infinite workspace built for educators, students, and creative teams to think and sketch in real-time.
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid (User-Friendly, No Tech Jargon) */}
        <div className="mt-12 relative z-10 grid grid-cols-2 gap-4 pt-8 border-t border-white/20">
          <div className="flex items-start gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-sm">
            <div className="p-2 bg-amber-400/20 text-amber-300 rounded-xl">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Smart Shapes</div>
              <div className="text-xs text-purple-100">Draw rough sketches, get crisp vector diagrams</div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-sm">
            <div className="p-2 bg-emerald-400/20 text-emerald-300 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Real-time Teamwork</div>
              <div className="text-xs text-purple-100">See live cursors and draw with anyone anywhere</div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-sm">
            <div className="p-2 bg-cyan-400/20 text-cyan-300 rounded-xl">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Teaching Mode</div>
              <div className="text-xs text-purple-100">Clean fullscreen view with an active laser pointer</div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-sm">
            <div className="p-2 bg-pink-400/20 text-pink-300 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Private & Protected</div>
              <div className="text-xs text-purple-100">Lock boards with passwords & verified emails</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Auth Form Section */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {isLogin
                ? 'Sign in to access your whiteboards, folders, and team projects.'
                : 'Join free today. Fast, private, and simple to use.'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 p-8 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none">
            {isLogin ? (
              <LoginForm
                onSuccess={handleSuccess}
                onSwitchToRegister={() => setIsLogin(false)}
              />
            ) : (
              <RegisterForm
                onSuccess={handleSuccess}
                onSwitchToLogin={() => setIsLogin(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
