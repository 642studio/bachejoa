'use client';

import { useEffect, useRef, useState } from 'react';

type AudioControlsProps = {
  src: string;
  loop?: boolean;
  autoPlay?: boolean;
  className?: string;
};

const MUTE_KEY = 'bachejoa_muted';

export default function AudioControls({
  src,
  loop = false,
  autoPlay = true,
  className,
}: AudioControlsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const storedMuted = window.localStorage.getItem(MUTE_KEY);
    if (storedMuted) setMuted(storedMuted === '1');
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = muted;
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  }, [muted]);

  useEffect(() => {
    if (!audioRef.current || !autoPlay) return;
    const audio = audioRef.current;
    const tryPlay = () => {
      audio.play().catch(() => {});
    };
    tryPlay();
    const handler = () => tryPlay();
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, [autoPlay, src]);

  return (
    <div
      className={
        className ??
        'absolute top-6 left-6 z-20 flex items-center gap-2 rounded-full border-2 border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm'
      }
    >
      <audio
        ref={audioRef}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        src={src}
      />
      <button
        className="rounded-full bg-white px-3 py-1 shadow-sm"
        onClick={() => setMuted((prev) => !prev)}
        type="button"
      >
        {muted ? 'Activar audio' : 'Silenciar'}
      </button>
    </div>
  );
}
