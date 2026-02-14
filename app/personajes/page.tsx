const personajes = [
  {
    name: '🏛️ El Presi',
    role: 'Autoridad principal',
    image: '/personajes/presi.svg',
    text:
      'El Presi esta enterado de todo... o al menos eso dice. Aqui llegan los reportes, se revisan, se analizan y se prometen soluciones. Siempre habla de coordinacion, planeacion y seguimiento. Mientras tanto, la ciudad sigue reportando.',
  },
  {
    name: '🚓 El Poli',
    role: 'Seguridad y orden',
    image: '/personajes/poli.svg',
    text:
      'El Poli patrulla las calles donde aparecen los reportes. Ve lo que pasa, levanta nota y trata de que nadie salga volando en un bacheson. No arregla... pero si sabe donde estan. Y creeme, los ha visto todos.',
  },
  {
    name: '🩺 El Doc',
    role: 'Evaluador de riesgos',
    image: '/personajes/pdoc_thumb.svg',
    text:
      'El Doc mide el impacto en la salud urbana. Suspension tronada, llantas dañadas, estres ciudadano... todo entra en su diagnostico. No receta medicinas, receta evidencia. Si el Doc aparece, es porque el problema ya dolio.',
  },
  {
    name: '🛠️ La Maña',
    role: 'Soluciones “alternativas”',
    image: '/personajes/mana.svg',
    text: 'No es oficial... pero ahi esta.',
  },
  {
    name: '💧 El del Agua',
    role: 'Infraestructura hidráulica',
    image: '/personajes/pagua_thumb.svg',
    text:
      'El del Agua sabe que muchos problemas vienen desde abajo. Fugas, humedad, tuberias dañadas... lo que no se ve tambien rompe la calle. Cuando un reporte tiene que ver con agua, el entra a revisar que esta pasando bajo tierra.',
  },
  {
    name: '🧹 El de los Servicios',
    role: 'Imagen urbana y mantenimiento',
    image: '/personajes/pservicios_thumb.svg',
    text:
      'El de los Servicios observa el dia a dia de la ciudad. Calles, limpieza, desgaste, lo cotidiano que tambien afecta como vivimos los espacios. Porque una ciudad funcional tambien necesita mantenimiento constante.',
  },
  {
    name: '🚧 El de la Obra',
    role: 'Ejecución y reparación',
    image: '/personajes/pobras_thumb.svg',
    text:
      'El de la Obra es quien entra cuando toca arreglar. Maquinaria, material, intervencion directa. Convierte el reporte en trabajo real. Aqui es donde el mapa deja de ser señalamiento y se vuelve accion.',
  },
  {
    name: '📐 El de Infraestructura',
    role: 'Planeación técnica',
    image: '/personajes/pinfraestructura_thumb.svg',
    text:
      'El de Infraestructura ve la ciudad completa, no solo el bache. Analiza como se construye, como se desgasta y como deberia mantenerse mejor. Porque arreglar hoy esta bien, pero planear evita repetir mañana.',
  },
];

export default function PersonajesPage() {
  return (
    <main className="reportes-root min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="reportes-header space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <img
              alt="Bachejoa Map"
              className="h-10 w-auto"
              src="/logo.png"
            />
            <a
              className="rounded-full border border-white/60 bg-white/60 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              href="/map"
            >
              Volver al mapa
            </a>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Personajes de Bachejoa
            </p>
            <h1 className="text-3xl font-[var(--font-display)] text-slate-900">
              Conoce a quienes “se encargan” de tus reportes 👀
            </h1>
          </div>
          <p className="max-w-2xl text-sm text-slate-600">
            En Bachejoa Map, cada reporte llega a un personaje distinto. Todos son
            ficticios, pero… curiosamente se parecen a la realidad.
          </p>
          <p className="text-xs text-slate-500">
            Los personajes son representaciones satíricas con fines informativos y
            humorísticos.
          </p>
        </header>

        <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {personajes.map((item, index) => (
            <article
              key={item.name}
              className="reportes-card overflow-hidden rounded-3xl bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="relative h-48 overflow-hidden bg-sky-100 px-6 py-4">
                <img
                  alt={item.name}
                  className="h-full w-full object-contain object-bottom"
                  src={item.image}
                />
              </div>
              <div className="space-y-2 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">{item.name}</h2>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {item.role}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{item.text}</p>
              </div>
            </article>
          ))}
        </section>

      </div>
    </main>
  );
}
