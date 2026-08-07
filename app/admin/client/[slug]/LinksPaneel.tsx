"use client";

// Rechter zijpaneel "Links": één blik op de bronnen die het overzicht voeden of
// zouden moeten voeden. Elke regel springt naar het scherm waar je hem echt
// beheert; opengeklapt zie je pas of hij gevuld/gekoppeld is (de status wordt
// dan pas opgehaald, niet vooraf voor alle regels tegelijk).

import { useState } from "react";

type Status = { tekst: string; goed: boolean };

type Bron = {
  key: string;
  label: string;
  tab: string | null;
  uitleg: string;
  laadStatus?: (slug: string) => Promise<Status>;
};

function maakBronnen(seoProfile: string, googleConnected: boolean): Bron[] {
  const heeftProfiel = seoProfile.trim().length > 0;
  const heeftTov = /^##.*tone of voice/im.test(seoProfile);
  const googleStatus = async (): Promise<Status> =>
    googleConnected ? { tekst: "gekoppeld", goed: true } : { tekst: "nog niet gekoppeld", goed: false };
  return [
    {
      key: "documenten", label: "Kennisdatabase (documenten)", tab: "documenten",
      uitleg: "Alle gegenereerde en geüploade documenten per pagina.",
      laadStatus: async (slug) => {
        const d = await fetch(`/api/admin/documenten?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
        const n = d?.ok ? Number(d.totaal || 0) : 0;
        return { tekst: n > 0 ? `${n} document${n === 1 ? "" : "en"}` : "nog geen documenten", goed: n > 0 };
      },
    },
    { key: "gsc", label: "Search Console", tab: "resultaten", uitleg: "Klikken, vertoningen en posities uit Google.", laadStatus: googleStatus },
    { key: "ga4", label: "Analytics", tab: "resultaten", uitleg: "Bezoekers en gedrag op de site (zelfde koppeling als Search Console).", laadStatus: googleStatus },
    { key: "ads", label: "Ads-account", tab: "resultaten", uitleg: "Advertentieresultaten, meegenomen via dezelfde koppeling.", laadStatus: googleStatus },
    {
      key: "gmb", label: "Google Mijn Bedrijf", tab: "google-profiel", uitleg: "Vermelding, reviews en profielscan.",
      laadStatus: async (slug) => {
        const d = await fetch(`/api/admin/gmb?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
        const gevuld = !!d?.result;
        const datum = d?.updatedAt ? new Date(d.updatedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "";
        return { tekst: gevuld ? `laatste scan ${datum}`.trim() : "nog geen scan", goed: gevuld };
      },
    },
    {
      key: "profiel", label: "Klantprofiel", tab: "paginas", uitleg: "Positionering en achtergrond van het bedrijf.",
      laadStatus: async () => (heeftProfiel ? { tekst: "ingevuld", goed: true } : { tekst: "nog leeg", goed: false }),
    },
    {
      key: "tone", label: "Tone of voice", tab: "paginas", uitleg: "Schrijfstijl; staat in hetzelfde profielveld als Klantprofiel.",
      laadStatus: async () => (heeftTov ? { tekst: "ingevuld", goed: true } : { tekst: "nog niet gegenereerd", goed: false }),
    },
    {
      key: "concurrenten", label: "Concurrentieanalyse", tab: "klant", uitleg: "De concurrenten waarmee je vergelijkt.",
      laadStatus: async (slug) => {
        const d = await fetch(`/api/admin/competitors?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
        const n = Array.isArray(d?.competitors) ? d.competitors.length : 0;
        return { tekst: n > 0 ? `${n} concurrent${n === 1 ? "" : "en"}` : "nog geen concurrenten", goed: n > 0 };
      },
    },
    {
      key: "structured", label: "Structured data", tab: "klant", uitleg: "De kennisbank onder structured data (organisatie, personen, locaties).",
      laadStatus: async (slug) => {
        const d = await fetch(`/api/admin/schema-knowledge?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
        const n = Array.isArray(d?.entities) ? d.entities.length : 0;
        return { tekst: n > 0 ? `${n} vastgelegd` : "nog leeg", goed: n > 0 };
      },
    },
    { key: "huisstijl", label: "Huisstijl", tab: null, uitleg: "Hiervoor is nog geen scherm; staat als aandachtspunt genoteerd." },
  ];
}

export default function LinksPaneel({ slug, seoProfile, googleConnected, onGaNaar }: { slug: string; seoProfile: string; googleConnected: boolean; onGaNaar: (tab: string) => void }) {
  const bronnen = maakBronnen(seoProfile || "", googleConnected);
  const [open, setOpen] = useState("");
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [laden, setLaden] = useState("");

  async function toggle(b: Bron) {
    const nieuw = open === b.key ? "" : b.key;
    setOpen(nieuw);
    if (nieuw && !status[b.key] && b.laadStatus) {
      setLaden(b.key);
      const s = await b.laadStatus(slug);
      setStatus((v) => ({ ...v, [b.key]: s }));
      setLaden("");
    }
  }

  return (
    <div>
      {bronnen.map((b) => {
        const isOpen = open === b.key;
        const s = status[b.key];
        return (
          <div key={b.key} className="bl-lijst">
            <button type="button" className="strategy-head bl-head" onClick={() => void toggle(b)}>
              <span className="strategy-caret">{isOpen ? "▾" : "▸"}</span>
              <span className="bl-titel">{b.label}</span>
              {s && <span className={"sov-pill " + (s.goed ? "done" : "open")}>{s.tekst}</span>}
            </button>
            {isOpen && (
              <div className="bl-body">
                <div className="muted">{b.uitleg}</div>
                {laden === b.key && <div className="muted">Status ophalen…</div>}
                {b.tab
                  ? <button type="button" className="wp-fase-btn wp-fase-btn-primair" onClick={() => onGaNaar(b.tab as string)}>Openen &rarr;</button>
                  : <div className="muted">Nog geen link naartoe.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
