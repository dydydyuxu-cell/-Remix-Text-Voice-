import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  Send,
  ExternalLink,
  Heart,
} from 'lucide-react';

export function ShareSection() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const shareTitle = 'منصة النص ☜ صوت | Text ☞ Voice لتحويل النص إلى صوت بالذكاء الاصطناعي';
  const shareDescription = 'منصة احترافية لتحويل النصوص العربية والأجنبية إلى أصوات واقعية بالذكاء الاصطناعي مع 10,000 حرف شهرياً لكل حساب!';

  const handleCopy = async (customMessage?: string) => {
    const urlToCopy = currentUrl || (typeof window !== 'undefined' ? window.location.href : '');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlToCopy);
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = urlToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setCopyToastMessage(customMessage || 'تم نسخ رابط الموقع بنجاح ❤️');
      setTimeout(() => {
        setCopied(false);
        setCopyToastMessage(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleSocialShare = async (platform: 'telegram' | 'twitter' | 'facebook' | 'tiktok' | 'instagram' | 'whatsapp') => {
    const url = currentUrl || (typeof window !== 'undefined' ? window.location.href : '');
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(`${shareTitle} - ${shareDescription}`);

    switch (platform) {
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank', 'noopener,noreferrer');
        break;

      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank', 'noopener,noreferrer');
        break;

      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener,noreferrer');
        break;

      case 'whatsapp':
        window.open(`https://api.whatsapp.com/send?text=${encodedText}%0A%0A${encodedUrl}`, '_blank', 'noopener,noreferrer');
        break;

      case 'tiktok':
        // Try Native Share or Copy + Redirect
        if (navigator.share) {
          try {
            await navigator.share({
              title: shareTitle,
              text: shareDescription,
              url: url,
            });
            return;
          } catch (e) {
            // fallback
          }
        }
        await handleCopy('تم نسخ رابط الموقع بنجاح ❤️ (جاهز للصق والمشاركة على TikTok)');
        window.open('https://www.tiktok.com/', '_blank', 'noopener,noreferrer');
        break;

      case 'instagram':
        if (navigator.share) {
          try {
            await navigator.share({
              title: shareTitle,
              text: shareDescription,
              url: url,
            });
            return;
          } catch (e) {
            // fallback
          }
        }
        await handleCopy('تم نسخ رابط الموقع بنجاح ❤️ (جاهز للمشاركة على Instagram)');
        window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
        break;
    }
  };

  return (
    <section id="share-website-section" className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Glow Accent */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="relative text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
            <Share2 className="w-3.5 h-3.5" />
            <span>نشر الفائدة</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            شارك الموقع مع أصدقائك
          </h2>

          <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm font-medium mt-1">
            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 inline" />
            <span>قال النبي ﷺ: الدال على الخير كفاعله ♥️🤲</span>
          </div>
        </div>

        {/* Copy Link Bar */}
        <div className="relative max-w-2xl mx-auto space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500/60 transition-colors">
            <div className="flex-1 px-3.5 py-2.5 font-mono text-xs text-slate-300 select-all truncate text-left sm:text-right" dir="ltr">
              {currentUrl || 'https://...'}
            </div>
            <button
              id="copy-site-link-btn"
              onClick={() => handleCopy()}
              className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.98]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>تم نسخ الرابط!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>نسخ رابط الموقع</span>
                </>
              )}
            </button>
          </div>

          {/* Toast feedback message */}
          {copyToastMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{copyToastMessage}</span>
            </div>
          )}
        </div>

        {/* Social Share Buttons Grid */}
        <div className="space-y-3 pt-2">
          <p className="text-center text-xs text-slate-400 font-semibold">
            أو اختر منصتك المفضلة للمشاركة المباشرة:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 max-w-3xl mx-auto">
            {/* TikTok */}
            <button
              id="share-tiktok-btn"
              onClick={() => handleSocialShare('tiktok')}
              className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 shadow-sm group cursor-pointer"
              title="مشاركة على تيك توك"
            >
              <div className="w-8 h-8 rounded-xl bg-black border border-slate-700 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
                </svg>
              </div>
              <span className="text-xs font-bold">TikTok</span>
            </button>

            {/* Facebook */}
            <button
              id="share-facebook-btn"
              onClick={() => handleSocialShare('facebook')}
              className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 shadow-sm group cursor-pointer"
              title="مشاركة على فيسبوك"
            >
              <div className="w-8 h-8 rounded-xl bg-[#1877F2]/20 border border-[#1877F2]/40 flex items-center justify-center text-[#1877F2] group-hover:scale-110 transition-transform">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <span className="text-xs font-bold">Facebook</span>
            </button>

            {/* WhatsApp */}
            <button
              id="share-whatsapp-btn"
              onClick={() => handleSocialShare('whatsapp')}
              className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 shadow-sm group cursor-pointer"
              title="مشاركة على واتساب"
            >
              <div className="w-8 h-8 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366] group-hover:scale-110 transition-transform">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <span className="text-xs font-bold">WhatsApp</span>
            </button>

            {/* Instagram */}
            <button
              id="share-instagram-btn"
              onClick={() => handleSocialShare('instagram')}
              className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 shadow-sm group cursor-pointer"
              title="مشاركة على انستقرام"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FFDC80] via-[#FD1D1D] to-[#833AB4] p-0.5 group-hover:scale-110 transition-transform">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-pink-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
              </div>
              <span className="text-xs font-bold">Instagram</span>
            </button>

            {/* Telegram */}
            <button
              id="share-telegram-btn"
              onClick={() => handleSocialShare('telegram')}
              className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 shadow-sm group cursor-pointer"
              title="مشاركة على تيليجرام"
            >
              <div className="w-8 h-8 rounded-xl bg-[#2AABEE]/20 border border-[#2AABEE]/40 flex items-center justify-center text-[#2AABEE] group-hover:scale-110 transition-transform">
                <Send className="w-4 h-4 -rotate-45 ml-0.5" />
              </div>
              <span className="text-xs font-bold">Telegram</span>
            </button>

            {/* Twitter / X */}
            <button
              id="share-twitter-btn"
              onClick={() => handleSocialShare('twitter')}
              className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 shadow-sm group cursor-pointer"
              title="مشاركة على تويتر / إكس"
            >
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <span className="text-xs font-bold">Twitter / X</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
