import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './firebase/authContext';
import { Navbar } from './components/Navbar';
import { TTSStudio } from './components/TTSStudio';
import { HistoryView } from './components/HistoryView';
import { ByokSettings } from './components/ByokSettings';
import { AccountView } from './components/AccountView';
import { PlansView } from './components/PlansView';
import { IsolationSuite } from './components/IsolationSuite';
import { AuthModal } from './components/AuthModal';
import { IslamicHeader } from './components/IslamicHeader';
import { ShareSection } from './components/ShareSection';
import { SeoSection } from './components/SeoSection';
import {
  getUserBalance,
  getUserSettings,
  getUserGenerations,
} from './services/apiClient';
import { UserBalance, UserSettings, TTSGeneration } from './types/tts';

function MainApp() {
  const { user, loading: authLoading, getIdToken } = useAuth();

  const [activeTab, setActiveTab] = useState<'studio' | 'history' | 'byok' | 'account' | 'plans' | 'isolation'>('studio');
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [generations, setGenerations] = useState<TTSGeneration[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Load user data strictly for the current authenticated Google UID
  const loadUserData = useCallback(async () => {
    if (!user) {
      // Clear all state if user signed out
      setBalance(null);
      setSettings(null);
      setGenerations([]);
      return;
    }
    setIsDataLoading(true);
    try {
      const token = await getIdToken();
      const [balData, settData, gensData] = await Promise.all([
        getUserBalance(token).catch(() => null),
        getUserSettings(token).catch(() => null),
        getUserGenerations(token).catch(() => []),
      ]);

      if (balData) setBalance(balData);
      if (settData) setSettings(settData);
      if (gensData) setGenerations(gensData);
    } catch (err) {
      console.error('Error loading isolated Google user data:', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      setBalance(null);
      setSettings(null);
      setGenerations([]);
    }
  }, [user, loadUserData]);

  const handleGenerationComplete = (newGen: TTSGeneration) => {
    setGenerations((prev) => [newGen, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        balance={balance}
        settings={settings}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Sacred Islamic Header in the early section of the site */}
      <IslamicHeader />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'studio' && (
          <TTSStudio
            balance={balance}
            settings={settings}
            onRefreshBalance={loadUserData}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onNavigateToByok={() => setActiveTab('byok')}
            onGenerationComplete={handleGenerationComplete}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            generations={generations}
            onRefresh={loadUserData}
            onNavigateToStudio={() => setActiveTab('studio')}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'byok' && (
          <ByokSettings
            settings={settings}
            onRefreshSettings={loadUserData}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'account' && (
          <AccountView
            balance={balance}
            settings={settings}
            onRefreshBalance={loadUserData}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onNavigateToByok={() => setActiveTab('byok')}
            onNavigateToPlans={() => setActiveTab('plans')}
          />
        )}

        {activeTab === 'plans' && (
          <PlansView
            settings={settings}
            onNavigateToByok={() => setActiveTab('byok')}
            onNavigateToStudio={() => setActiveTab('studio')}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'isolation' && (
          <IsolationSuite />
        )}
      </main>

      {/* Social Sharing Section */}
      <ShareSection />

      {/* Dedicated SEO Keywords Directory Section */}
      <SeoSection />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <span>© 2026</span>
            <span className="font-bold text-white">النص ☜ صوت | Text ☞ Voice</span>
            <span>—</span>
            <span>جميع الحقوق محفوظة.</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>حساب Google مستقل • 10,000 حرف شهرياً</span>
            <span>•</span>
            <button
              onClick={() => setActiveTab('isolation')}
              className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              فحص العزل الأمني
            </button>
          </div>
        </div>
      </footer>

      {/* Google Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
