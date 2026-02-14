'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AudioControls from './components/AudioControls';

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'logo' | 'ready' | 'exit'>(
    'intro',
  );

  useEffect(() => {
    const toLogo = setTimeout(() => setPhase('logo'), 700);
    const toReady = setTimeout(() => setPhase('ready'), 1400);
    return () => {
      clearTimeout(toLogo);
      clearTimeout(toReady);
    };
  }, []);

  function handleEnter() {
    setPhase('exit');
    setTimeout(() => router.push('/reportes'), 650);
  }

  return (
    <main
      className={`intro-root relative min-h-screen overflow-hidden ${
        phase === 'intro' ? 'intro-init' : ''
      } ${phase === 'logo' || phase === 'ready' ? 'intro-open' : ''} ${
        phase === 'exit' ? 'intro-exit' : ''
      }`}
    >
      <AudioControls src="/audio/songintro1.mp3" loop autoPlay />
      <div className="absolute inset-0">
        <img
          alt="Nube"
          className="intro-cloud cloud-left absolute left-[6%] top-[6%] w-[180px] opacity-95 sm:w-[240px] lg:w-[320px]"
          src="/nubes/nube2.png"
        />
        <img
          alt="Nube"
          className="intro-cloud cloud-left absolute left-[22%] top-[14%] w-[260px] opacity-95 sm:w-[320px] lg:w-[420px]"
          src="/nubes/nube1.png"
        />
        <img
          alt="Nube"
          className="intro-cloud cloud-right absolute right-[8%] top-[8%] w-[230px] opacity-95 sm:w-[300px] lg:w-[380px]"
          src="/nubes/nube3.png"
        />
        <img
          alt="Nube"
          className="intro-cloud cloud-left absolute left-[14%] top-[36%] w-[240px] opacity-90 sm:w-[300px] lg:w-[360px]"
          src="/nubes/nube4.png"
        />
        <img
          alt="Nube"
          className="intro-cloud cloud-right absolute right-[14%] top-[42%] w-[240px] opacity-90 sm:w-[300px] lg:w-[360px]"
          src="/nubes/nube1.png"
        />
        <img
          alt="Nube"
          className="intro-cloud cloud-left absolute left-[30%] top-[56%] w-[240px] opacity-90 sm:w-[300px] lg:w-[360px]"
          src="/nubes/nube3.png"
        />
        <img
          alt="Nube"
          className="intro-cloud cloud-right absolute right-[18%] top-[64%] w-[260px] opacity-90 sm:w-[320px] lg:w-[400px]"
          src="/nubes/nube2.png"
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 text-center">
        <div className="flex flex-col items-center gap-6">
          <img
            alt="Bachejoa Map"
            className={`intro-logo w-60 max-w-[70vw] object-contain drop-shadow-[0_20px_30px_rgba(15,23,42,0.25)] sm:w-72 lg:w-80 ${
              phase === 'logo' || phase === 'ready' || phase === 'exit'
                ? 'intro-logo-show'
                : ''
            } ${phase === 'exit' ? 'intro-logo-exit' : ''}`}
            src="/logo.png"
          />

          <button
            className={`intro-button rounded-full border-2 border-white/80 bg-white/30 px-8 py-3 text-lg font-semibold text-slate-800 shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/60 ${
              phase === 'ready' ? 'intro-button-show' : ''
            } ${phase === 'exit' ? 'intro-button-hide' : ''}`}
            onClick={handleEnter}
            type="button"
          >
            Ingresar
          </button>
          <div className="flex flex-col items-center gap-1 text-xs text-slate-700/80">
            <span>pwd</span>
            <span>by</span>
            <img
              alt="642"
              className="h-10 w-auto object-contain"
              src="/642logo.png"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
