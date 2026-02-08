'use client';

import { useEffect, useRef, useState } from 'react';

type AudioControlsProps = {
  src: string;
  loop?: boolean;
  autoPlay?: boolean;
  className?: string;
};

const VOLUME_KEY = 'bachejoa_volume';
const MUTE_KEY = 'bachejoa_muted';

export default function AudioControls({
  src,
  loop = false,
  autoPlay = true,
  className,
}: AudioControlsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const storedMuted = window.localStorage.getItem(MUTE_KEY);
    const storedVolume = window.localStorage.getItem(VOLUME_KEY);
    if (storedMuted) setMuted(storedMuted === '1');
    if (storedVolume) {
      const parsed = Number(storedVolume);
      if (Number.isFinite(parsed)) {
        setVolume(Math.min(1, Math.max(0, parsed)));
      }
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = muted;
    audioRef.current.volume = volume;
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  }, [muted, volume]);

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

  const changeVolume = (delta: number) => {
    setVolume((prev) => {
      const next = Math.min(1, Math.max(0, Number((prev + delta).toFixed(2))));
      return next;
    });
  };

  return (
    <div
      className={
        className ??
        'absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full border-2 border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm'
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
        className="rounded-full bg-white px-2 py-1 shadow-sm"
        onClick={() => setMuted((prev) => !prev)}
        type="button"
      >
        {muted ? 'Activar' : 'Silenciar'}
      </button>
      <button
        className="rounded-full bg-white px-2 py-1 shadow-sm"
        onClick={() => changeVolume(-0.1)}
        type="button"
      >
        -
      </button>
      <button
        className="rounded-full bg-white px-2 py-1 shadow-sm"
        onClick={() => changeVolume(0.1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
