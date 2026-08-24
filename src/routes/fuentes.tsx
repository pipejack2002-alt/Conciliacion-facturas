import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/fuentes")({ component: FuentesPage });

const GROUPS: {
  title: string;
  items: { name: string; use: string; href: string }[];
}[] = [
  {
    title: "Concurso 2676 (CNSC / DIAN)",
    items: [
      {
        name: "Convocatoria DIAN 2676",
        use: "Acuerdo 21 de 2025, anexo, OPEC y avisos oficiales.",
        href: "https://www.cnsc.gov.co/convocatorias/dian-2676",
      },
      {
        name: "ABC oficial del proceso",
        use: "Inscripción, un solo empleo, pruebas, reclamaciones, VA.",
        href: "https://www.cnsc.gov.co/abc-proceso-de-seleccion-dian-2676-de-2025",
      },
      {
        name: "Anexo técnico (PDF)",
        use: "Qué mide cada prueba escrita, escala 0-100, VRM y Valoración de Antecedentes.",
        href: "https://www.cnsc.gov.co/sites/default/files/2025-11/anexo_ps-dian-2676-de-2025.pdf",
      },
      {
        name: "ABC en PDF",
        use: "Misma cartilla de la CNSC, descargable.",
        href: "https://www.cnsc.gov.co/sites/default/files/2025-12/abc_dian-2676-de-2025_diseno.pdf",
      },
      {
        name: "SIMO",
        use: "Inscripción, ficha OPEC, citación y resultados.",
        href: "https://simo.cnsc.gov.co/",
      },
      {
        name: "Comunicado DIAN — Acuerdo 21",
        use: "Apertura del proceso en la página de la entidad.",
        href: "https://www.dian.gov.co/Prensa/Paginas/NG-CNSC-abrio-proceso-de-seleccion-para-proveer-cargos-en-la-DIAN-mediante-el-Acuerdo-21-de-2025.aspx",
      },
    ],
  },
  {
    title: "El cargo (MERF)",
    items: [
      {
        name: "Decreto Ley 927 de 2023",
        use: "Sistema específico de carrera DIAN. Art. 7 planta global; art. 58 MERF (funcionales); art. 59 diccionario (comportamentales).",
        href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=211570",
      },
      {
        name: "Resolución 0067 de 2024 (DIAN)",
        use: "Adopta el Manual Específico de Requisitos y Funciones. Tu ficha FT-TAH sale de aquí.",
        href: "https://www.dian.gov.co/",
      },
    ],
  },
  {
    title: "Normas que caen en la funcional",
    items: [
      {
        name: "Estatuto Tributario",
        use: "Cobro 823-847, mandamiento 826, títulos 828, excepciones 831, prescripción 817-818, cautelares 836-837, recaudo 801, compensación 815, devolución 850, reserva 583, fiscalización 684 y 703-717.",
        href: "https://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario.html",
      },
      {
        name: "Constitución Política",
        use: "Art. 95.9 deber de contribuir; 125 carrera; 209 función administrativa; 338 legalidad tributaria; 363 equidad, eficiencia y progresividad.",
        href: "https://www.secretariasenado.gov.co/senado/basedoc/constitucion_politica_1991.html",
      },
      {
        name: "CPACA — Ley 1437 de 2011",
        use: "Petición, actos, recursos (10 días, art. 76). Términos 15/10/30: Ley 1755 de 2015.",
        href: "https://www.secretariasenado.gov.co/senado/basedoc/ley_1437_2011.html",
      },
      {
        name: "Ley 1755 de 2015",
        use: "Derecho de petición: 15 días general, 10 documentos, 30 consultas. Anónima se tramita si el contenido lo permite.",
        href: "https://www.secretariasenado.gov.co/senado/basedoc/ley_1755_2015.html",
      },
      {
        name: "Ley 594 de 2000",
        use: "Archivo: radicar, TRD, ciclo vital. Nada de USB personal ni expediente en el bolso.",
        href: "https://www.secretariasenado.gov.co/senado/basedoc/ley_0594_2000.html",
      },
      {
        name: "MIPG — Decreto 1499 de 2017",
        use: "Siete dimensiones. Talento humano es el corazón.",
        href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=83433",
      },
      {
        name: "Ley 1066 de 2006",
        use: "Normalización de cartera pública y cobro persuasivo / facilidades.",
        href: "https://www.secretariasenado.gov.co/senado/basedoc/ley_1066_2006.html",
      },
      {
        name: "Ley 1116 de 2006",
        use: "Insolvencia: el cobro coactivo se reorienta; no es condonación.",
        href: "https://www.secretariasenado.gov.co/senado/basedoc/ley_1116_2006.html",
      },
    ],
  },
  {
    title: "Integridad y comportamental",
    items: [
      {
        name: "Ley 2016 de 2020",
        use: "Adopta el Código de Integridad del servicio público: Honestidad, Respeto, Compromiso, Diligencia y Justicia.",
        href: "https://www.secretariasenado.gov.co/senado/basedoc/ley_2016_2020.html",
      },
      {
        name: "Código de Integridad DAFP",
        use: "Lo que hago / lo que no hago de cada valor. Base de la Likert.",
        href: "https://www.funcionpublica.gov.co/web/eva/codigo-integridad",
      },
      {
        name: "Código de ética DIAN (CD-TAH-0002)",
        use: "Aterrizaje en la entidad. La prueba cita la v3 (CG-TAH-0002).",
        href: "https://www.dian.gov.co/dian/entidad/CodigoBuenGobierno/Codigo-de-Etica-Vr1-2021.pdf",
      },
    ],
  },
];

function FuentesPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Marco normativo
        </p>
        <h1 className="font-display text-3xl font-semibold">Fuentes oficiales</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          El cuaderno se arma sobre estos textos, el Anexo técnico del 2676 y la
          ficha de tu empleo. Las preguntas son de entrenamiento: la CNSC
          reserva el cuestionario real (Ley 909 de 2004, art. 31 num. 3).
        </p>
      </header>

      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="font-display text-xl font-semibold">{g.title}</h2>
          <ul className="space-y-2">
            {g.items.map((item) => (
              <li
                key={item.href}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  {item.name}
                </a>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {item.use}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-subtle">
        Si un enlace de la CNSC cambia de carpeta, entra por la convocatoria
        DIAN 2676 y baja el Acuerdo 21 y el Anexo desde allá. El artículo 17
        del Acuerdo fija el carácter (eliminatoria / clasificatoria) y el
        puntaje mínimo de cada prueba; el Anexo describe qué evalúa cada una.
      </p>
    </div>
  );
}
