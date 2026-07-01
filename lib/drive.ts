import { getGoogleAccessToken } from "./google";

// Google Drive-laag: mappenboom uitlezen, submap maken, een .docx uploaden en
// publiek deelbaar maken (iedereen met de link = lezer). Gebruikt de bestaande
// Google-koppeling (refresh-token) met de drive-scope.

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DriveFolder = { id: string; name: string };

async function token(): Promise<string> {
  const t = await getGoogleAccessToken();
  if (!t) throw new Error("Google is niet gekoppeld (of de koppeling mist de Drive-toestemming). Koppel Google opnieuw.");
  return t;
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
  if (!res.ok) throw new Error(`Drive gaf status ${res.status} bij het ophalen van mappen.`);
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

// Uploadt een .docx in een map en maakt hem deelbaar (iedereen met de link = lezer).
// Geeft de deelbare webViewLink terug.
export async function uploadDocx(folderId: string, filename: string, buffer: Buffer): Promise<{ id: string; link: string }> {
  const t = await token();
  const parent = folderId && folderId !== "root" ? folderId : "root";
  const meta = { name: filename, parents: [parent] };
  const boundary = "pingwin-" + Buffer.from(filename).toString("hex").slice(0, 16);
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(pre, "utf8"), buffer, Buffer.from(post, "utf8")]);

  const up = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: body as unknown as BodyInit,
  });
  if (!up.ok) throw new Error(`Upload naar Drive mislukte (status ${up.status}).`);
  const file = await up.json();

  // Deelbaar maken: iedereen met de link mag lezen.
  await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions?supportsAllDrives=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  }).catch(() => { /* link werkt ook zonder als map al gedeeld is */ });

  const link = (file.webViewLink as string) || `https://drive.google.com/file/d/${file.id}/view`;
  return { id: file.id, link };
}
