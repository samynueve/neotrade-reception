import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { putFile } from "@/lib/storage";

/** Photo d'avarie rattachée à un scan déjà synchronisé. Renvoyer la même photo ne crée pas de doublon. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "session_expired" }, { status: 401 });
  const { id } = await params;
  const form = await request.formData().catch(() => null);
  const clientId = String(form?.get("clientId") ?? "");
  const photoId = String(form?.get("photoId") ?? "");
  const file = form?.get("photo");
  if (!/^[0-9a-f-]{36}$/i.test(clientId) || !/^[0-9a-f-]{36}$/i.test(photoId) || !(file instanceof File) || file.type !== "image/jpeg" || file.size > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "bad_format" }, { status: 400 });
  }
  const scan = await prisma.scan.findFirst({ where: { clientId, receptionId: id }, select: { id: true, positionId: true } });
  if (!scan) return NextResponse.json({ error: "not_found" }, { status: 409 });

  const key = `receptions/${id}/avaries/${photoId}.jpg`;
  if (await prisma.photo.findFirst({ where: { storageKey: key }, select: { id: true } })) return NextResponse.json({ ok: true });
  const data = Buffer.from(await file.arrayBuffer());
  await putFile(key, data, "image/jpeg");
  await prisma.photo.create({
    data: { receptionId: id, scanId: scan.id, positionId: scan.positionId, kind: "DOMMAGE", storageKey: key, mimeType: "image/jpeg", sizeBytes: data.length, takenAt: new Date(), userId: user.id },
  });
  return NextResponse.json({ ok: true });
}
