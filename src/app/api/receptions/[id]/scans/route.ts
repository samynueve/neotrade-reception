import { NextResponse } from "next/server";
import { syncBodySchema } from "@/lib/scan/ops";
import { applyOps, scanState, SyncError } from "@/lib/scan/sync";
import { getCurrentUser } from "@/lib/session";

/** Synchronisation des scans faits sur un téléphone (éventuellement hors ligne). Renvoie l'état à jour. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "session_expired" }, { status: 401 });
  const { id } = await params;

  const parsed = syncBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_scans" }, { status: 400 });

  try {
    await applyOps(id, user.id, parsed.data.ops);
    return NextResponse.json(await scanState(id));
  } catch (error) {
    if (error instanceof SyncError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

/** État courant (rafraîchissement quand plusieurs téléphones scannent le même camion). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "session_expired" }, { status: 401 });
  return NextResponse.json(await scanState((await params).id));
}
