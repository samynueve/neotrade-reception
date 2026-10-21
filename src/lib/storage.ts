import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Stockage des fichiers (photos des documents et des colis).
 * - Supabase Storage si SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définis (production) ;
 * - sinon dossier local UPLOAD_DIR (défaut ./uploads), pour le développement.
 * Les fichiers ne sont jamais publics : ils sont servis par /api/photos/[id] après contrôle de la session.
 */
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "reception";
const LOCAL_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/i;

function check(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`Clé de fichier invalide : ${key}`);
}

/** Crée le bucket privé s'il manque (évite une étape manuelle dans Supabase). */
async function createBucket(): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  return res.ok || res.status === 409 || /already exists/i.test(await res.text());
}

export async function putFile(key: string, data: Buffer, contentType: string): Promise<void> {
  check(key);
  if (SUPABASE_URL && SUPABASE_KEY) {
    const upload = () =>
      fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": contentType, "x-upsert": "true" },
        body: new Uint8Array(data),
      });
    let res = await upload();
    if (!res.ok) {
      const text = await res.text();
      // Premier envoi : le bucket n'existe pas encore → création (privé), puis nouvel essai
      if (/bucket not found/i.test(text) && (await createBucket())) res = await upload();
      else throw new Error(`Envoi du fichier impossible (${res.status}) : ${text}`);
      if (!res.ok) throw new Error(`Envoi du fichier impossible (${res.status}) : ${await res.text()}`);
    }
    return;
  }
  const file = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

export async function getFile(key: string): Promise<Buffer | null> {
  check(key);
  if (SUPABASE_URL && SUPABASE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${key}`, {
      headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`Lecture du fichier impossible (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  try {
    return await readFile(path.join(LOCAL_DIR, key));
  } catch {
    return null;
  }
}
