import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getLocale } from "@/i18n/server";
import { analyzeExtraction } from "@/lib/cmr/analyze";
import { contextChecks } from "@/lib/cmr/context";
import { extractDocuments, ExtractionError, type DocumentImage } from "@/lib/cmr/extract";
import { getCurrentUser } from "@/lib/session";
import { putFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60; // maximum du forfait gratuit Vercel ; la lecture prend en général 20 à 40 s

const MAX_FILES = 8;
const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Reçoit les photos de la CMR (et du Fahrauftrag), les lit et renvoie la réception pré-remplie à relire. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "session_expired" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("photos") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "no_photos" }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: "too_many_photos" }, { status: 400 });
  for (const f of files) {
    if (!TYPES.includes(f.type as (typeof TYPES)[number])) return NextResponse.json({ error: "bad_format" }, { status: 400 });
    if (f.size > MAX_BYTES) return NextResponse.json({ error: "too_heavy" }, { status: 400 });
  }

  const images: DocumentImage[] = await Promise.all(
    files.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()), mediaType: f.type as DocumentImage["mediaType"] })),
  );

  // Les photos sont conservées : elles seront rattachées à la réception à sa création
  const importId = randomUUID();
  await Promise.all(images.map((img, i) => putFile(`imports/${importId}/${i}.jpg`, img.data, img.mediaType)));

  try {
    const extraction = await extractDocuments(images, await getLocale());
    await putFile(`imports/${importId}/lecture.json`, Buffer.from(JSON.stringify(extraction)), "application/json");
    const { draft, checks } = analyzeExtraction(extraction);
    const ctx = await contextChecks(draft);
    return NextResponse.json({ importId, photoCount: images.length, draft, checks: [...ctx.checks, ...checks], duplicateOf: ctx.duplicateOf });
  } catch (error) {
    if (error instanceof ExtractionError) return NextResponse.json({ error: error.code }, { status: 502 });
    console.error("Lecture CMR", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
