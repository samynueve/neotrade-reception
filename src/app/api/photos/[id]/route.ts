import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getFile } from "@/lib/storage";

/** Sert une photo aux utilisateurs connectés uniquement. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new NextResponse(null, { status: 401 });
  const photo = await prisma.photo.findUnique({ where: { id: (await params).id }, select: { storageKey: true, mimeType: true } });
  const data = photo && (await getFile(photo.storageKey));
  if (!photo || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": photo.mimeType, "Cache-Control": "private, max-age=86400, immutable" },
  });
}
