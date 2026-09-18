import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, Volume2, VolumeX, RotateCcw, Copy, Check } from 'lucide-react';
import { ALL_30_GEMINI_VOICES } from '../data/voices';

interface AudioPlayerProps {
  audioUrl: string;
  text?: string;
  voiceName?: string;
  generationId?: string;
  onDownload?: () => void;
}

export function AudioPlayer({
  audioUrl,
  text,
  voiceName,
  generationId,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `gemini-tts-${voiceName || 'voice'}-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = () => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      id={`audio-player-${generationId || 'active'}`}
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md"
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header with info and actions */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          {(() => {
            const voiceObj = ALL_30_GEMINI_VOICES.find((v) => v.id === voiceName);
            if (voiceObj) {
              return (
                <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-indigo-500/50 shadow-sm bg-slate-950">
                  <img
                    src={voiceObj.avatarUrl}
                    alt={voiceObj.arabicTitle}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              );
            }
            return (
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? 'bg-emerald-400 opacity-75' : 'bg-transparent'}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isPlaying ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              </span>
            );
          })()}
          <span className="text-sm font-semibold text-slate-200">
            الصوت: <span className="text-indigo-400 font-mono">{voiceName || 'Gemini'}</span>
          </span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
            WAV 24kHz
          </span>
        </div>

        <div className="flex items-center gap-2">
          {text && (
            <button
              id="copy-text-btn"
              onClick={handleCopyText}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
              title="نسخ النص الأصلي"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ النص'}</span>
            </button>
          )}

          <button
            id="download-wav-btn"
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-xs font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            title="تنزيل الملف الصوتي WAV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تنزيل WAV</span>
          </button>
        </div>
      </div>

      {/* Audio Wave Visualizer Bars */}
      <div className="flex items-center justify-center gap-1 h-10 mb-4 px-2">
        {Array.from({ length: 36 }).map((_, i) => {
          const heightFactor = Math.sin((i / 36) * Math.PI) * 100;
          const randomJitter = isPlaying ? Math.sin((i + currentTime * 8) * 1.5) * 20 : 0;
          const finalHeight = Math.max(15, Math.min(100, heightFactor + randomJitter));
          return (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-75 ${
                isPlaying
                  ? 'bg-gradient-to-t from-indigo-600 to-cyan-400'
                  : 'bg-slate-700/60'
              }`}
              style={{
                height: `${isPlaying ? finalHeight : Math.max(12, heightFactor * 0.4)}%`,
              }}
            />
          );
        })}
      </div>

      {/* Progress & Time */}
      <div className="space-y-1.5 mb-3">
        <input
          id="audio-seek-slider"
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
        />
        <div className="flex justify-between items-center text-xs font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            id="audio-mute-toggle"
            onClick={toggleMute}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            id="audio-rate-cycle"
            onClick={cycleSpeed}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
            title="سرعة التشغيل"
          >
            {playbackRate}x
          </button>
        </div>

        {/* Big Center Play/Pause Button */}
        <button
          id="audio-main-play-btn"
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-transform active:scale-95"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
        </button>

        <div className="flex items-center gap-2">
          <button
            id="audio-restart-btn"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="إعادة التشغيل من البداية"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
