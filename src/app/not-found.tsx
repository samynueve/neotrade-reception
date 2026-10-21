import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold">{t.notFound.title}</h1>
      <Link href="/" className="btn-primary w-full">
        {t.notFound.back}
      </Link>
    </main>
  );
}
