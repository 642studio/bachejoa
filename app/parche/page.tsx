type PatchSection = {
  title: string;
  icon?: string;
  items?: string[];
  text?: string[];
};

const patchSections: PatchSection[] = [
  {
    title: 'Mapa completamente mejorado',
    icon: '🗺️',
    items: [
      'Ahora puedes filtrar los reportes por: tipo de problema, categoría y estado del reporte.',
      'Puedes limpiar filtros y explorar mejor la ciudad.',
      'Se corrigieron casos donde algunos reportes no aparecían.',
      'Mejor experiencia en celular.',
    ],
  },
  {
    title: 'Nuevas categorías de reportes',
    icon: '🧭',
    items: [
      '💡 Luminarias dañadas',
      '💧 Problemas de agua',
      '🕳️ Drenaje',
      '🗑️ Basura acumulada',
      'Bachejoa ahora refleja más de lo que vive la ciudad.',
    ],
  },
  {
    title: 'Llegaron las cuentas de usuario',
    icon: '👤',
    items: [
      'Dar seguimiento a tus reportes.',
      'Agregar fotos después de reportar.',
      'Construir tu historial ciudadano.',
      'Próximamente subir de nivel y obtener reconocimientos.',
      'Los usuarios sin cuenta tienen un límite de reportes para evitar abuso del sistema.',
    ],
  },
  {
    title: 'Fotos en los reportes',
    icon: '📸',
    items: [
      'Añadir imágenes directamente al reporte.',
      'Validar visualmente los casos.',
      'Convertir reportes en verificados por la comunidad.',
    ],
  },
  {
    title: 'Estadísticas más completas',
    icon: '📊',
    items: [
      'Totales por categoría.',
      'Nuevas métricas de actividad.',
      'Mejor lectura del comportamiento urbano.',
    ],
  },
  {
    title: 'Se amplía el universo de personajes',
    icon: '🧑‍💼',
    items: [
      'El del Agua',
      'El de Servicios',
      'El de la Obra',
      'El de Infraestructura',
      'Porque los problemas de una ciudad no vienen de un solo lugar.',
    ],
  },
  {
    title: 'Página de cuenta (nuevo)',
    icon: '🧾',
    items: [
      'Fecha de ingreso.',
      'Número de reportes.',
      'Historial.',
      'Base del futuro sistema de medallas.',
    ],
  },
  {
    title: 'Muchas mejoras invisibles (pero importantes)',
    icon: '⚙️',
    items: [
      'Correcciones internas de funcionamiento.',
      'Ajustes de rendimiento.',
      'Mejor organización de la información.',
      'Preparación para siguientes funciones.',
    ],
  },
  {
    title: 'Mensaje final',
    icon: '🏗️',
    text: [
      'Bachejoa sigue en desarrollo activo.',
      'No es una app terminada.',
      'Es una herramienta viva que crece conforme la ciudad la usa.',
      'Lo que hoy ves es solo la base de algo más grande.',
    ],
  },
];

export default function ParchePage() {
  return (
    <main className="reportes-root min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="reportes-header">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <a
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg"
              href="/map"
            >
              Volver al mapa
            </a>
            <img alt="Bachejoa Map" className="h-10 w-auto" src="/logo.png" />
            <a
              className="rounded-full border border-white/60 bg-white/60 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              href="/stats"
            >
              Ver estadísticas
            </a>
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Notas de parche
            </p>
            <h1 className="mt-2 text-3xl font-[var(--font-display)] text-slate-900">
              🔧 Versión 1.2 — Bachejoa evoluciona
            </h1>
            <p className="mx-auto mt-3 max-w-3xl text-sm text-slate-600">
              Bachejoa deja de ser solo un mapa de baches. Se convierte en una
              plataforma ciudadana para registrar y entender problemas urbanos.
            </p>
          </div>
        </header>

        <section className="mt-10 grid gap-6">
          {patchSections.map((section, index) => (
            <article
              key={section.title}
              className="reportes-card rounded-[28px] bg-white/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <h2 className="text-xl font-semibold text-slate-900">
                {section.icon ? `${section.icon} ` : ''}
                {section.title}
              </h2>

              {section.items ? (
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {section.items.map((item) => (
                    <li key={item} className="leading-relaxed">
                      • {item}
                    </li>
                  ))}
                </ul>
              ) : null}

              {section.text ? (
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {section.text.map((paragraph) => (
                    <p key={paragraph} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
