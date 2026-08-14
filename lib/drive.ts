import { getDriveAccessToken } from "./google";
import { driveIdFromUrl } from "./drive-id";
import { kanDirectGelezen, tekstUitLokaalBestand } from "./bestand-tekst";

// Google Drive-laag: mappenboom uitlezen, submap maken, een .docx uploaden en
// publiek deelbaar maken (iedereen met de link = lezer). Gebruikt de LOSSE
// Drive-koppeling (provider 'google_drive'); bewust gescheiden van de
// Search Console/Analytics-koppeling zodat data koppelen nooit iemands Drive
// openzet.

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type DriveFolder = { id: string; name: string };

async function token(): Promise<string> {
  const t = await getDriveAccessToken();
  if (!t) throw new Error("Google Drive is niet gekoppeld. Koppel hem in Beheer → Instellingen (dit staat los van de Search Console-koppeling).");
  return t;
}

// Vertaalt een Drive-foutantwoord naar een begrijpelijke, actiegerichte melding.
async function driveErr(res: Response, actie: string): Promise<string> {
  let reason = "", message = "";
  try {
    const j = await res.json();
    reason = j?.error?.errors?.[0]?.reason || j?.error?.status || "";
    message = j?.error?.message || "";
  } catch { /* geen json */ }
  if (res.status === 403 && /accessNotConfigured|SERVICE_DISABLED|has not been used/i.test(reason + message)) {
    return "De Google Drive API staat nog niet aan in je Google Cloud-project. Zet hem aan (console.cloud.google.com, Drive API, Enable) en probeer opnieuw.";
  }
  if (res.status === 403 && /insufficient|scope/i.test(reason + message)) {
    return "De Drive-koppeling mist de juiste toestemming. Koppel Google Drive opnieuw via Beheer → Google-koppelingen.";
  }
  if (res.status === 401) return "De Google Drive-koppeling is verlopen of ingetrokken. Koppel hem opnieuw via Beheer → Google-koppelingen (knop 'Drive koppelen').";
  return `Drive gaf status ${res.status} bij ${actie}${message ? `: ${message}` : ""}${reason ? ` [${reason}]` : ""}.`;
}

// Submappen van een parent ("root" = mijn Drive-hoofdmap). Alfabetisch.
export async function listFolders(parentId: string): Promise<DriveFolder[]> {
  const t = await token();
  const parent = parentId && parentId !== "root" ? parentId : "root";
  const q = `'${parent}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const p = new URLSearchParams({
    q,
    fields: "files(id,name)",
    orderBy: "name",
    pageSize: "200",
    spaces: "drive",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${p.toString()}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) throw new Error(await driveErr(res, "het ophalen van mappen"));
  const j = await res.json();
  return Array.isArray(j.files) ? j.files.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })) : [];
}

// Naam van één map (voor breadcrumb / opslag).
export async function folderName(folderId: string): Promise<string> {
  if (!folderId || folderId === "root") return "Mijn Drive";
  const t = await token();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) return "";
  const j = await res.json();
  return (j.name as string) || "";
}

// De echte bestandsnaam van een Drive-document, uit een geplakte link of losse
// id. Gebruikt in keuzelijsten (het doorzet- en mailvenster) zodat een knop als
// "Copy" of "Copy-doc" wordt wat hij hoort te zijn: de titel van het bestand dat
// je meestuurt, niet een generiek woord waaraan niet te zien is óf, en zo ja
// welk, verschil er met een andere regel in dezelfde lijst is.
export async function fileName(idOrUrl: string): Promise<string> {
  const id = driveIdFromUrl(idOrUrl);
  if (!id) return "";
  try {
    const t = await token();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return "";
    const j = await res.json();
    return (j.name as string) || "";
  } catch { return ""; }
}

// ── Documentinhoud lezen (Google Doc/Sheet/Slides) ──
// Haalt een Drive-file-id uit een geplakte URL of losse id. Ondersteunt de
// gangbare Google-linkvormen (/d/<id>/, ?id=<id>) plus een kale id.
export { driveIdFromUrl } from "./drive-id";

// Google-Doc-HTML naar tekst waarin een kop een kop blijft: h1/h2/h3 worden
// markdown-koppen, de rest wordt gewone regels. Bewust klein gehouden; we willen
// geen HTML-bibliotheek voor het enige dat ertoe doet, namelijk het kopniveau.
export function htmlNaarTekstMetKoppen(html: string): string {
  const ontsnap = (s: string) => s
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  const zonderTags = (s: string) => ontsnap(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  const kern = (html || "")
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
  const regels: string[] = [];
  const blok = /<(h[1-6]|p|li|td|div)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blok.exec(kern))) {
    const tag = m[1].toLowerCase();
    const tekst = zonderTags(m[2]);
    if (!tekst) continue;
    const niveau = /^h([1-6])$/.exec(tag);
    if (niveau) regels.push(`${"#".repeat(Math.min(Number(niveau[1]), 3))} ${tekst}`);
    else if (tag === "li") regels.push(`- ${tekst}`);
    else regels.push(tekst);
  }
  return regels.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Leest de tekstinhoud van een gekoppeld Google-document (Doc/Sheet/Slides) uit,
// zodat de bird's eye-agent de afgesproken strategie (navigatie, zoekwoorden,
// werkdocument) echt kan raadplegen in plaats van alleen de link te zien.
// Begrensd tot ~12k tekens zodat de context niet ontploft.
export async function readDriveDoc(
  idOrUrl: string, maxChars = 12000, opts: { metKoppen?: boolean } = {},
): Promise<{ ok: boolean; name?: string; text?: string; error?: string }> {
  const id = driveIdFromUrl(idOrUrl);
  if (!id) return { ok: false, error: "Geen geldige Google Drive-link of document-id herkend." };
  let t: string;
  try { t = await token(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const auth = { Authorization: `Bearer ${t}` };
  // Metadata (naam + type) bepaalt hoe we exporteren.
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType&supportsAllDrives=true`, { headers: auth });
  if (!metaRes.ok) return { ok: false, error: await driveErr(metaRes, "het openen van het document") };
  const meta = await metaRes.json();
  const mime = String(meta.mimeType || "");
  const name = String(meta.name || "");
  const exportMap: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  };
  // Met koppen: een Google Doc als HTML ophalen en de kopniveaus als markdown
  // terugzetten. Nodig omdat een kop in een document opmáák is, geen tekst: in de
  // platte-tekstversie is "Wat kenmerkt een strandtuin?" niet te onderscheiden van
  // een gewone zin. Daardoor kon de koppencontrole de teksten in een aangeleverd
  // document niet terugvinden, ook al stonden ze er gewoon in.
  const alsHtml = !!opts.metKoppen && mime === "application/vnd.google-apps.document";
  let text = "";
  if (alsHtml) {
    const ex = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text%2Fhtml&supportsAllDrives=true`, { headers: auth });
    if (!ex.ok) return { ok: false, error: await driveErr(ex, "het uitlezen van het document") };
    text = htmlNaarTekstMetKoppen(await ex.text());
  } else if (exportMap[mime]) {
    const ex = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exportMap[mime])}&supportsAllDrives=true`, { headers: auth });
    if (!ex.ok) return { ok: false, error: await driveErr(ex, "het uitlezen van het document") };
    text = await ex.text();
  } else if (/^text\/|^application\/json/.test(mime)) {
    const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: auth });
    if (!dl.ok) return { ok: false, error: await driveErr(dl, "het downloaden van het document") };
    text = await dl.text();
  } else if (kanDirectGelezen(name) || mime === DOCX_MIME || mime === XLSX_MIME) {
    // Een Word- of Excel-bestand in Drive is gewoon een zipbestand: we halen hem
    // op en lezen hem hier uit. Dat was eerder niet zo, en dan kreeg je "dit
    // bestandstype kan ik niet als tekst lezen" terwijl het document er wél was;
    // precies de situatie waarin het dashboard beweert dat er niets ligt.
    const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: auth });
    if (!dl.ok) return { ok: false, error: await driveErr(dl, "het downloaden van het document") };
    const buffer = Buffer.from(await dl.arrayBuffer());
    const naam = kanDirectGelezen(name) ? name : mime === DOCX_MIME ? `${name || "document"}.docx` : `${name || "document"}.xlsx`;
    text = await tekstUitLokaalBestand(naam, buffer).catch(() => "");
    if (!text.trim()) return { ok: false, error: "Het bestand kon opgehaald worden, maar er kwam geen leesbare tekst uit." };
  } else {
    return { ok: false, error: `Dit bestandstype (${mime || "onbekend"}) kan ik niet als tekst lezen. Alleen Google Docs, Sheets en Slides.` };
  }
  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const truncated = text.length > maxChars;
  return { ok: true, name, text: truncated ? text.slice(0, maxChars) + "\n\n[…document afgekapt…]" : text };
}

export async function createFolder(parentId: string, name: string): Promise<DriveFolder> {
  const t = await token();
  const body = { name, mimeType: FOLDER_MIME, parents: [parentId && parentId !== "root" ? parentId : "root"] };
  const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name", {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Kon de map niet aanmaken (status ${res.status}).`);
  const j = await res.json();
  return { id: j.id, name: j.name };
}

// Maakt een bestand deelbaar: iedereen met de link mag lezen. Betrouwbaar (met
// één herkansing). Geeft terug of het gelukt is.
async function shareAnyone(t: string, fileId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
      if (res.ok) return true;
    } catch { /* opnieuw proberen */ }
  }
  return false;
}

// Uploadt een .docx in een map en maakt hem deelbaar (iedereen met de link = lezer).
// Geeft de deelbare webViewLink terug + waar het echt is beland (account + map).
export async function uploadDocx(folderId: string, filename: string, buffer: Buffer): Promise<{ id: string; link: string; shared: boolean; owner: string; folder: string; isDoc: boolean; note: string }> {
  const t = await token();
  const parent = folderId && folderId !== "root" ? folderId : "root";
  const meta = { name: filename, parents: [parent] };
  const bytes = new Uint8Array(buffer); // exact-passende, schone kopie

  // Resumable upload: eerst metadata (start de sessie), dan de ruwe bytes in één
  // PUT. Zo gaat het binaire bestand NIET door een multipart-blok (dat leverde
  // een corrupt .docx op) maar één-op-één naar Drive.
  const initRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": DOCX_MIME,
      "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify(meta),
  });
  if (!initRes.ok) throw new Error(await driveErr(initRes, "het starten van de upload"));
  const uploadUrl = initRes.headers.get("location") || initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("Geen upload-URL van Drive ontvangen.");

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": DOCX_MIME },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(await driveErr(putRes, "het uploaden van de inhoud"));
  const file = await putRes.json();

  // Het Word-bestand blijft staan zoals het is.
  //
  // Hier werd het .docx eerder omgezet naar een Google Doc. Dat leek handig (opent
  // in de browser), maar die omzetting plet de opmaak: de omslag, de afgeronde
  // kaders, de kleurvlakken en de status-pillen overleven het niet. Maarten kreeg
  // daardoor altijd een kaal document te zien en nooit het echte bestand.
  //
  // Drive laat een .docx gewoon zien in de voorvertoning, en de klant of de
  // sitebouwer kan het openen in Word, de tekst aanpassen en overnemen. Nooit
  // meer omzetten dus.
  const finalId = file.id as string;
  const isDoc = false;
  const note = "";

  const shared = await shareAnyone(t, finalId);

  // Schone deel-link ZONDER ouid/rtpof: die parameters forceren het eigenaar-account
  // en breken "Kan bestand niet openen" als je met een ander account bent ingelogd.
  //
  // Altijd de Docs-link, ook voor een .docx. Google Docs opent een Word-bestand
  // rechtstreeks in de bewerkmodus, met de huisstijl-opmaak erin; de oude
  // drive.google.com/file/.../view-link gaf alleen een kijkscherm waar je nog een
  // keer op "Openen met" moest klikken voor je iets kon nalezen of aanpassen.
  // Het bestand blijft een .docx; Docs converteert het niet, hij opent het.
  const link = `https://docs.google.com/document/d/${finalId}/edit?usp=sharing`;

  // Verifieer waar het bestand echt staat: eigenaar (welk Google-account) + map.
  let owner = "", folder = "";
  try {
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${finalId}?fields=owners(emailAddress),parents&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${t}` } });
    if (metaRes.ok) {
      const m = await metaRes.json();
      owner = m?.owners?.[0]?.emailAddress || "";
      const realParent = Array.isArray(m?.parents) ? m.parents[0] : "";
      if (realParent) folder = await folderName(realParent).catch(() => "");
    }
  } catch { /* verificatie is extra, niet kritisch */ }

  return { id: finalId, link, shared, owner, folder, isDoc, note };
}

// Upload MÉT omzetting naar een Google Doc, puur om de TEKST eruit te kunnen
// lezen. Bedoeld voor aangeleverde bestanden waarvan we de inhoud nodig hebben
// maar de opmaak niet: een pdf van de klant (Drive doet de tekstherkenning) of
// een .docx. Het origineel gaat hier dus wél door de omzetting, en dat mag,
// want dit bestand is een LEESKOPIE. Wil je het origineel bewaren zoals het is,
// gebruik dan uploadDocx; die zet bewust niets om.
export async function uploadEnConverteer(folderId: string, filename: string, buffer: Buffer, sourceMime: string): Promise<{ id: string; link: string }> {
  const t = await token();
  const parent = folderId && folderId !== "root" ? folderId : "root";
  const bytes = new Uint8Array(buffer);
  const initRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": sourceMime,
      "X-Upload-Content-Length": String(bytes.length),
    },
    // mimeType op het doelformaat = Drive converteert bij het opslaan.
    body: JSON.stringify({ name: filename, parents: [parent], mimeType: "application/vnd.google-apps.document" }),
  });
  if (!initRes.ok) throw new Error(await driveErr(initRes, "het starten van de upload"));
  const uploadUrl = initRes.headers.get("location") || initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("Geen upload-URL van Drive ontvangen.");
  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": sourceMime }, body: bytes });
  if (!putRes.ok) throw new Error(await driveErr(putRes, "het uploaden van de inhoud"));
  const file = await putRes.json();
  const id = file.id as string;
  await shareAnyone(t, id).catch(() => false);
  return { id, link: `https://docs.google.com/document/d/${id}/edit?usp=sharing` };
}

// Kale bestands-upload (bijv. een .json met JSON-LD die letterlijk gekopieerd moet
// kunnen worden): zelfde resumable upload als uploadDocx, maar ZONDER omzetting
// naar Google-formaat, zodat de inhoud byte-voor-byte intact blijft.
// Binaire upload van een aangeleverd bestand, ZONDER omzetting: een screenshot,
// een pdf, een zip, wat er ook in de dropzone valt. uploadDocx zet het mime-type
// vast op Word en uploadPlainFile werkt alleen op tekst, dus voor "leg dit bestand
// neer zoals het is" was er nog geen weg.
export async function uploadBestand(folderId: string, filename: string, buffer: Buffer, mimeType: string): Promise<{ id: string; link: string; shared: boolean }> {
  const t = await token();
  const parent = folderId && folderId !== "root" ? folderId : "root";
  const bytes = new Uint8Array(buffer);
  const mime = mimeType || "application/octet-stream";
  const initRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mime,
      "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify({ name: filename, parents: [parent] }),
  });
  if (!initRes.ok) throw new Error(await driveErr(initRes, "het starten van de upload"));
  const uploadUrl = initRes.headers.get("location") || initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("Geen upload-URL van Drive ontvangen.");
  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: bytes });
  if (!putRes.ok) throw new Error(await driveErr(putRes, "het uploaden van de inhoud"));
  const file = await putRes.json();
  const shared = await shareAnyone(t, file.id).catch(() => false);
  return { id: file.id as string, link: `https://drive.google.com/file/d/${file.id}/view?usp=sharing`, shared };
}

export async function uploadPlainFile(folderId: string, filename: string, content: string, mimeType = "application/json"): Promise<{ id: string; link: string; shared: boolean }> {
  const t = await token();
  const parent = folderId && folderId !== "root" ? folderId : "root";
  const bytes = new TextEncoder().encode(content);
  const initRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify({ name: filename, parents: [parent] }),
  });
  if (!initRes.ok) throw new Error(await driveErr(initRes, "het starten van de upload"));
  const uploadUrl = initRes.headers.get("location") || initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("Geen upload-URL van Drive ontvangen.");
  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: bytes });
  if (!putRes.ok) throw new Error(await driveErr(putRes, "het uploaden van de inhoud"));
  const file = await putRes.json();
  const shared = await shareAnyone(t, file.id);
  return { id: file.id, link: `https://drive.google.com/file/d/${file.id}/view?usp=sharing`, shared };
}
