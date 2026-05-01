'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Character = {
  id: string;
  name: string;
  role: string;
  image: string;
  perk: string;
  speed: number;
  control: number;
  bonus: number;
  intro: string;
};

type Obstacle = {
  id: number;
  lane: number;
  y: number;
  label: string;
  kind: 'jump' | 'slide' | 'lane';
  tone: 'warn' | 'danger';
};

type Coin = {
  id: number;
  lane: number;
  y: number;
};

const LANES = [-1, 0, 1] as const;
const PLAYER_Y_MIN = 79;
const PLAYER_Y_MAX = 93;

const CHARACTERS: Character[] = [
  {
    id: 'presi',
    name: 'El Presi',
    role: 'Gestión urbana',
    image: '/personajes/presi-icon.png',
    perk: '+10% dinero',
    speed: 78,
    control: 72,
    bonus: 90,
    intro:
      'Bienvenido a la carrera urbana. Tu misión: avanzar lo más posible mientras esquivas el caos de la ciudad.',
  },
  {
    id: 'poli',
    name: 'El Poli',
    role: 'Orden vial',
    image: '/personajes/poli.svg',
    perk: 'Control alto',
    speed: 70,
    control: 88,
    bonus: 65,
    intro: 'Patrulla los carriles y responde rápido en cambios de tráfico.',
  },
  {
    id: 'doc',
    name: 'El Doc',
    role: 'Riesgo urbano',
    image: '/personajes/pdoc_thumb.svg',
    perk: '+5% score',
    speed: 73,
    control: 76,
    bonus: 84,
    intro: 'Analiza el terreno y convierte cada metro en mejor puntuación.',
  },
  {
    id: 'mana',
    name: 'La Maña',
    role: 'Soluciones express',
    image: '/personajes/mana.svg',
    perk: 'Inicio +20 monedas',
    speed: 80,
    control: 68,
    bonus: 88,
    intro: 'Improvisa, acelera y aprovecha cada oportunidad en la pista.',
  },
  {
    id: 'agua',
    name: 'El del Agua',
    role: 'Infraestructura',
    image: '/personajes/pagua_thumb.svg',
    perk: 'Flujo constante',
    speed: 69,
    control: 85,
    bonus: 74,
    intro: 'Especialista en fugas; mantiene ritmo estable ante obstáculos.',
  },
  {
    id: 'obras',
    name: 'El de la Obra',
    role: 'Maquinaria',
    image: '/personajes/pobras_thumb.svg',
    perk: 'Poder de avance',
    speed: 86,
    control: 64,
    bonus: 79,
    intro: 'Empuja fuerte en zonas pesadas y abre camino donde nadie puede.',
  },
];

const OBSTACLE_POOL = [
  { label: '🕳️ Bache', kind: 'jump' as const, tone: 'warn' as const },
  { label: '💧 Fuga de agua', kind: 'jump' as const, tone: 'warn' as const },
  {
    label: '🚧 Señalización caída',
    kind: 'slide' as const,
    tone: 'warn' as const,
  },
  {
    label: '🚦 Semáforo caído',
    kind: 'slide' as const,
    tone: 'danger' as const,
  },
  {
    label: '🚌 Camión urbano',
    kind: 'lane' as const,
    tone: 'danger' as const,
  },
  { label: '🚛 Pipa de agua', kind: 'lane' as const, tone: 'danger' as const },
  {
    label: '🏗️ Maquinaria',
    kind: 'lane' as const,
    tone: 'danger' as const,
  },
];

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-blue-500"
          style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export default function MinijuegoPage() {
  const [phase, setPhase] = useState<'splash' | 'select' | 'playing' | 'gameover'>('splash');
  const [selectedCharacterId, setSelectedCharacterId] = useState(CHARACTERS[0].id);
  const [lane, setLane] = useState(1);
  const [isJumping, setIsJumping] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [distance, setDistance] = useState(0);
  const [score, setScore] = useState(0);
  const [money, setMoney] = useState(0);

  const laneRef = useRef(1);
  const jumpRef = useRef(false);
  const slideRef = useRef(false);
  const elapsedRef = useRef(0);
  const obstacleIdRef = useRef(1);
  const coinIdRef = useRef(1);
  const timeFromObstacleRef = useRef(0);
  const timeFromCoinRef = useRef(0);
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    laneRef.current = lane;
  }, [lane]);

  useEffect(() => {
    jumpRef.current = isJumping;
  }, [isJumping]);

  useEffect(() => {
    slideRef.current = isSliding;
  }, [isSliding]);

  const selectedCharacter = useMemo(
    () => CHARACTERS.find((item) => item.id === selectedCharacterId) ?? CHARACTERS[0],
    [selectedCharacterId],
  );

  const laneToLeft = (laneValue: number) => {
    if (laneValue === 0) return '50%';
    if (laneValue === -1) return '26%';
    return '74%';
  };

  const resetRun = useCallback(() => {
    setLane(1);
    laneRef.current = 1;
    setIsJumping(false);
    setIsSliding(false);
    jumpRef.current = false;
    slideRef.current = false;
    setObstacles([]);
    setCoins([]);
    setDistance(0);
    setScore(0);
    setMoney(selectedCharacter.id === 'mana' ? 20 : 0);
    elapsedRef.current = 0;
    timeFromObstacleRef.current = 0;
    timeFromCoinRef.current = 0;
  }, [selectedCharacter.id]);

  const startRun = useCallback(() => {
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    resetRun();
    setPhase('playing');
  }, [resetRun]);

  const moveLeft = useCallback(() => {
    setLane((prev) => Math.max(0, prev - 1));
  }, []);

  const moveRight = useCallback(() => {
    setLane((prev) => Math.min(2, prev + 1));
  }, []);

  const jump = useCallback(() => {
    if (jumpRef.current || slideRef.current || phase !== 'playing') return;
    setIsJumping(true);
    jumpRef.current = true;
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(() => {
      setIsJumping(false);
      jumpRef.current = false;
    }, 620);
  }, [phase]);

  const slide = useCallback(() => {
    if (slideRef.current || jumpRef.current || phase !== 'playing') return;
    setIsSliding(true);
    slideRef.current = true;
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    slideTimerRef.current = setTimeout(() => {
      setIsSliding(false);
      slideRef.current = false;
    }, 560);
  }, [phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== 'playing') return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        moveLeft();
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        moveRight();
      }
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w' || event.key === ' ') {
        event.preventDefault();
        jump();
      }
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        event.preventDefault();
        slide();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jump, moveLeft, moveRight, slide, phase]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const tickMs = 50;
    const interval = setInterval(() => {
      const dt = tickMs / 1000;
      elapsedRef.current += dt;
      timeFromObstacleRef.current += tickMs;
      timeFromCoinRef.current += tickMs;

      const difficulty = Math.min(1.1 + elapsedRef.current / 24, 2.8);
      const speed = 28 * difficulty;
      const currentLane = laneRef.current;
      const scoreBoost = selectedCharacter.id === 'doc' ? 1.05 : 1;
      const cashBoost = selectedCharacter.id === 'presi' ? 1.1 : 1;

      setDistance((prev) => {
        const next = prev + dt * (11 + difficulty * 5);
        setScore(Math.floor(next * 10 * scoreBoost));
        setMoney((current) => {
          const passive = dt * (0.7 + difficulty * 0.25) * cashBoost;
          return current + passive;
        });
        return next;
      });

      setCoins((prevCoins) => {
        let updatedCoins = prevCoins.map((coin) => ({
          ...coin,
          y: coin.y + dt * speed * 1.15,
        }));

        let collected = 0;
        updatedCoins = updatedCoins.filter((coin) => {
          const isCollect =
            coin.lane === currentLane && coin.y > PLAYER_Y_MIN && coin.y < PLAYER_Y_MAX;
          if (isCollect) {
            collected += 1;
            return false;
          }
          return coin.y < 106;
        });

        if (collected > 0) {
          setScore((prevScore) => prevScore + collected * 35);
          setMoney((prevMoney) => prevMoney + collected * 6);
        }

        const coinSpawnRate = Math.max(310, 680 - elapsedRef.current * 26);
        if (timeFromCoinRef.current >= coinSpawnRate) {
          timeFromCoinRef.current = 0;
          updatedCoins.push({
            id: coinIdRef.current++,
            lane: Math.floor(Math.random() * 3),
            y: -8,
          });
        }

        return updatedCoins;
      });

      setObstacles((prevObstacles) => {
        const moved = prevObstacles
          .map((obstacle) => ({
            ...obstacle,
            y: obstacle.y + dt * speed,
          }))
          .filter((obstacle) => obstacle.y < 110);

        const crash = moved.some((obstacle) => {
          const inZone = obstacle.y > PLAYER_Y_MIN && obstacle.y < PLAYER_Y_MAX;
          if (!inZone || obstacle.lane !== currentLane) return false;

          if (obstacle.kind === 'jump') return !jumpRef.current;
          if (obstacle.kind === 'slide') return !slideRef.current;
          return true;
        });

        if (crash) {
          setPhase('gameover');
          return moved;
        }

        const obstacleSpawnRate = Math.max(320, 920 - elapsedRef.current * 30);
        if (timeFromObstacleRef.current >= obstacleSpawnRate) {
          timeFromObstacleRef.current = 0;
          const nextType = OBSTACLE_POOL[Math.floor(Math.random() * OBSTACLE_POOL.length)];
          const blockLane = Math.floor(Math.random() * 3);

          moved.push({
            id: obstacleIdRef.current++,
            lane: blockLane,
            y: -14,
            label: nextType.label,
            kind: nextType.kind,
            tone: nextType.tone,
          });
        }

        return moved;
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [phase, selectedCharacter.id]);

  useEffect(() => {
    return () => {
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    };
  }, []);

  if (phase === 'splash') {
    return (
      <main className="runner-splash relative min-h-screen overflow-hidden">
        <div className="absolute inset-0">
          <img
            alt="Nube"
            className="absolute left-[4%] top-[10%] w-[170px] opacity-95 sm:w-[220px] lg:w-[280px]"
            src="/nubes/nube2.png"
          />
          <img
            alt="Nube"
            className="absolute left-[22%] top-[16%] w-[230px] opacity-95 sm:w-[300px] lg:w-[360px]"
            src="/nubes/nube1.png"
          />
          <img
            alt="Nube"
            className="absolute right-[10%] top-[12%] w-[220px] opacity-95 sm:w-[290px] lg:w-[360px]"
            src="/nubes/nube3.png"
          />
          <img
            alt="Nube"
            className="absolute left-[12%] top-[44%] w-[210px] opacity-90 sm:w-[280px] lg:w-[340px]"
            src="/nubes/nube4.png"
          />
          <img
            alt="Nube"
            className="absolute right-[16%] top-[58%] w-[240px] opacity-90 sm:w-[300px] lg:w-[360px]"
            src="/nubes/nube1.png"
          />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div className="text-center">
            <img
              alt="Bachejoa"
              className="mx-auto w-[230px] max-w-[80vw] sm:w-[280px]"
              src="/logo.png"
            />
            <p className="mt-3 text-lg font-semibold text-slate-800">Runner Edition</p>
            <button
              className="mt-8 rounded-full border border-white/80 bg-sky-300/70 px-10 py-3 text-base font-semibold text-slate-900 shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-sky-200"
              onClick={() => setPhase('select')}
              type="button"
            >
              Comenzar
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'select') {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] sm:p-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <img alt="Bachejoa" className="h-20 w-auto" src="/logo.png" />
            <div className="flex gap-3">
              <a
                className="rounded-2xl bg-blue-500 px-7 py-3 text-sm font-semibold text-white"
                href="/reportes"
              >
                Reportes
              </a>
              <a
                className="rounded-2xl bg-blue-500 px-7 py-3 text-sm font-semibold text-white"
                href="/personajes"
              >
                Personajes
              </a>
            </div>
          </header>

          <section className="mt-6 rounded-3xl bg-sky-300/70 p-4 sm:p-6">
            <div className="grid items-end gap-4 md:grid-cols-[1fr_220px]">
              <div>
                <h1 className="text-3xl font-[var(--font-display)] text-slate-900">El Presi</h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-700 sm:text-base">
                  {selectedCharacter.intro}
                </p>
                <p className="mt-2 text-sm font-semibold text-blue-900">
                  Corredor actual: {selectedCharacter.name} · Bonus: {selectedCharacter.perk}
                </p>
              </div>
              <img
                alt="El Presi"
                className="mx-auto h-[220px] w-auto object-contain"
                src="/personajes/presi-full-icon.png"
              />
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-4xl font-[var(--font-display)] text-slate-900">Escoge a tu corredor</h2>
              <button
                className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-900"
                onClick={startRun}
                type="button"
              >
                Iniciar carrera
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {CHARACTERS.map((character) => (
                <button
                  key={character.id}
                  className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                    selectedCharacterId === character.id
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedCharacterId(character.id)}
                  type="button"
                >
                  <div className="mb-3 h-32 overflow-hidden rounded-xl bg-sky-100">
                    <img
                      alt={character.name}
                      className="h-full w-full object-contain p-2"
                      src={character.image}
                    />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{character.name}</h3>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{character.role}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">{character.perk}</p>
                  <div className="mt-3 space-y-2">
                    <StatBar label="Velocidad" value={character.speed} />
                    <StatBar label="Control" value={character.control} />
                    <StatBar label="Bonus" value={character.bonus} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="runner-root min-h-screen px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="runner-card rounded-3xl px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-200">Bachejoa Runner</p>
              <h1 className="text-2xl font-[var(--font-display)] text-white sm:text-3xl">
                Carrera contra el bacheson
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90"
                onClick={() => setPhase('select')}
                type="button"
              >
                Cambiar personaje
              </button>
              <a
                className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90"
                href="/reportes"
              >
                Volver a reportes
              </a>
            </div>
          </div>
        </header>

        <div className="runner-card relative overflow-hidden rounded-3xl p-3 sm:p-4">
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
            <div className="rounded-xl bg-slate-900/55 px-3 py-2">
              <p className="text-sky-200/80">Distancia</p>
              <p className="font-bold text-white">{Math.floor(distance)} m</p>
            </div>
            <div className="rounded-xl bg-slate-900/55 px-3 py-2">
              <p className="text-sky-200/80">Puntuación</p>
              <p className="font-bold text-white">{score.toLocaleString('es-MX')}</p>
            </div>
            <div className="rounded-xl bg-slate-900/55 px-3 py-2">
              <p className="text-sky-200/80">Dinero</p>
              <p className="font-bold text-amber-300">${Math.floor(money).toLocaleString('es-MX')}</p>
            </div>
          </div>

          <div className="runner-track relative h-[70vh] min-h-[500px] overflow-hidden rounded-[28px] border border-white/20">
            <div className="runner-lane-lines" />
            {LANES.map((laneValue) => (
              <div
                key={laneValue}
                className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-white/20"
                style={{ left: laneToLeft(laneValue) }}
              />
            ))}

            {coins.map((coin) => (
              <div
                key={coin.id}
                className="absolute z-20 h-9 w-9 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-300 text-center text-lg shadow-[0_0_20px_rgba(251,191,36,0.6)]"
                style={{ left: laneToLeft(LANES[coin.lane]), top: `${coin.y}%` }}
              >
                💰
              </div>
            ))}

            {obstacles.map((obstacle) => (
              <div
                key={obstacle.id}
                className={`absolute z-20 w-[30%] min-w-[120px] max-w-[180px] -translate-x-1/2 rounded-2xl border px-3 py-2 text-center text-xs font-semibold shadow-xl ${
                  obstacle.tone === 'danger'
                    ? 'border-red-300/70 bg-red-500/80 text-white'
                    : 'border-amber-200/70 bg-amber-400/85 text-slate-900'
                }`}
                style={{ left: laneToLeft(LANES[obstacle.lane]), top: `${obstacle.y}%` }}
              >
                {obstacle.label}
              </div>
            ))}

            <div
              className={`absolute bottom-[7%] z-30 w-[18%] min-w-[84px] max-w-[140px] -translate-x-1/2 rounded-2xl border border-cyan-200/70 bg-cyan-300/90 p-2 text-center text-xs font-bold text-slate-900 shadow-[0_10px_28px_rgba(103,232,249,0.45)] transition-all duration-150 ${
                isJumping ? 'runner-player-jump' : ''
              } ${isSliding ? 'runner-player-slide' : ''}`}
              style={{ left: laneToLeft(LANES[lane]) }}
            >
              <img
                alt={selectedCharacter.name}
                className="mx-auto h-10 w-10 rounded-lg bg-white/85 object-contain p-1"
                src={selectedCharacter.image}
              />
              <p className="truncate">{selectedCharacter.name}</p>
            </div>

            {phase === 'gameover' && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4">
                <div className="w-full max-w-sm rounded-3xl border border-white/25 bg-slate-900/85 p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.25em] text-rose-200">Fin de carrera</p>
                  <h3 className="mt-2 text-xl font-[var(--font-display)] text-white">Te atrapó el caos vial</h3>
                  <p className="mt-3 text-sm text-sky-100/90">Distancia: {Math.floor(distance)} m</p>
                  <p className="text-sm text-sky-100/90">Puntuación final: {score.toLocaleString('es-MX')}</p>
                  <p className="text-sm font-semibold text-amber-300">
                    Dinero ganado: ${Math.floor(money).toLocaleString('es-MX')}
                  </p>

                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-900"
                      onClick={startRun}
                      type="button"
                    >
                      Jugar de nuevo
                    </button>
                    <button
                      className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white"
                      onClick={() => setPhase('select')}
                      type="button"
                    >
                      Cambiar corredor
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 sm:mx-auto sm:max-w-md">
            <button
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-semibold"
              onClick={moveLeft}
              type="button"
            >
              ←
            </button>
            <button
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-semibold"
              onClick={jump}
              type="button"
            >
              ↑
            </button>
            <button
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-semibold"
              onClick={slide}
              type="button"
            >
              ↓
            </button>
            <button
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-semibold"
              onClick={moveRight}
              type="button"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
