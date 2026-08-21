"use client";

import { useEffect, useState } from "react";
import { OrgDataForm, type OrgFormData } from "../../../admin/client/[slug]/OrgDataPanel";
import { plaatsingsZin } from "../../../../lib/structured-taak";

// De sitebouwer-kant van de bedrijfsgegevens: altijd alleen-lezen (deze link
// kan nooit iets wijzigen), met de bedrijfsgegevens plus de kant-en-klare
// site-brede JSON-LD eronder. Bedoeld om in één keer te delen met een
// developer of sitebouwer die de structured data gaat verwerken.
export default function OrgDevShareClient({ token }: { token: string }) {
  const [data, setData] = useState<OrgFormData | null>(null);
  const [locked, setLocked] = useState(false);
  const [clientName, setClientName] = useState("");
  const [sitewideJsonld, setSitewideJsonld] = useState("");
  const [plugin, setPlugin] = useState("");
  const [gekoppeld, setGekoppeld] = useState(false);
  const [anchorId, setAnchorId] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let off = false;
    fetch(`/api/share/org-dev?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        if (d.ok) {
          setData(d.data); setLocked(!!d.locked); setClientName(d.clientName || "");
          setSitewideJsonld(d.sitewideJsonld || ""); setPlugin(d.plugin || ""); setGekoppeld(!!d.gekoppeld); setAnchorId(d.anchorId || "");
        }
        else setErr(d.error || "Deze link is niet (meer) geldig.");
      })
      .catch(() => { if (!off) setErr("De pagina kon niet geladen worden."); });
    return () => { off = true; };
  }, [token]);

  async function copyJsonld() {
    if (!sitewideJsonld) return;
    try { await navigator.clipboard.writeText(sitewideJsonld); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* handmatig selecteren */ }
  }

  return (
    <div className="org-share-page">
      <div className="org-share-inner">
        <div className="org-share-brand">Pingwin Online Marketing</div>
        <h1>Structured data{clientName ? ` van ${clientName}` : ""}</h1>

        <div className="org-share-intro">
          <p>
            Dit overzicht is voor de sitebouwer/developer. Het bevat de bedrijfsgegevens die de basis
            vormen voor de <strong>structured data</strong> van de site (onzichtbare, gestructureerde
            informatie in de code die Google en AI-assistenten vertelt wie dit bedrijf is) en, als die
            al gegenereerd is, de kant-en-klare code voor het site-brede identiteitsblok.
          </p>
          <p>
            Deze pagina is alleen-lezen: er kan hier niets gewijzigd worden. Vragen of iets klopt niet
            meer? Neem contact op met Pingwin.
          </p>
          {!locked && (
            <p className="org-share-note">
              Let op: deze gegevens zijn nog niet definitief bevestigd door de klant. Ze kunnen nog
              wijzigen; controleer bij Pingwin of ze al vastgezet zijn voordat je ze verwerkt.
            </p>
          )}
        </div>

        {err && <div className="org-share-error">{err}</div>}
        {data && (
          <>
            <OrgDataForm data={data} onChange={() => {}} disabled />
            <div className="org-sitewide org-devshare-sitewide">
              <div className="org-sitewide-head"><strong>Site-brede structured data (JSON-LD)</strong></div>
              {sitewideJsonld ? (
                <>
                  <button type="button" className="btn btn-klein" onClick={copyJsonld}>{copied ? "✓ gekopieerd" : "Kopieer JSON"}</button>
                  <pre className="sch-json-pre org-devshare-json">{sitewideJsonld}</pre>
                  {/* Exact dezelfde zin als in de taak en de mail; zie
                      lib/structured-taak.ts. Hier stond een eigen versie, en die
                      plakte het label van de plugin-detectie letterlijk in de
                      zin ("Aanvullend op handmatig/onbekend"). */}
                  <p className="org-share-note org-devshare-note">
                    {plaatsingsZin({ pluginLabel: plugin, gekoppeld, anchorId }, { markdown: false })}
                    {" "}Voor behandel-, dienst- of productpagina&rsquo;s komt er per pagina nog een aanvullend blok;
                    dat levert Pingwin apart aan zodra die pagina klaar is.
                  </p>
                </>
              ) : (
                <p className="muted org-devshare-note">
                  Nog niet gegenereerd, of er ontbreekt nog een domein of bedrijfsnaam. Vraag Pingwin
                  om het site-brede schema te genereren.
                </p>
              )}
            </div>
          </>
        )}
        {!data && !err && <div className="muted">Laden…</div>}
      </div>
    </div>
  );
}
