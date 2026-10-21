import "server-only";
import { clientAdmin } from "@/lib/supabase/server";
import type { PortStockage } from "./demo";

/** Bucket privé du PCloud simulé : lu et écrit seulement côté serveur, par la clé secrète. */
export const BUCKET_PCLOUD = "pcloud-demo";

let bucketPret: Promise<void> | null = null;

/** Crée le bucket s'il manque (il n'est pas créé par une migration : le schéma storage appartient au service Storage). */
export function assurerBucket(): Promise<void> {
  bucketPret ??= (async () => {
    const db = clientAdmin();
    const { data } = await db.storage.getBucket(BUCKET_PCLOUD);
    if (data) return;
    const { error } = await db.storage.createBucket(BUCKET_PCLOUD, { public: false, fileSizeLimit: "4MB" });
    if (error && !/already exists/i.test(error.message)) throw new Error(`PCloud simulé : ${error.message}`);
  })().catch((e) => {
    bucketPret = null;
    throw e;
  });
  return bucketPret;
}

/** Port de stockage du PCloud simulé sur Supabase Storage (section 13.4, J5). */
export const stockageSupabase: PortStockage = {
  async televerser(cle, contenu) {
    await assurerBucket();
    const { error } = await clientAdmin().storage.from(BUCKET_PCLOUD).upload(cle, contenu, { upsert: false, contentType: contenu.type || undefined });
    if (error && !/already exists|Duplicate/i.test(error.message)) throw new Error(`PCloud simulé : ${error.message}`);
  },
  async lister(prefixe) {
    await assurerBucket();
    const { data, error } = await clientAdmin().storage.from(BUCKET_PCLOUD).list(prefixe, { limit: 1000 });
    if (error) throw new Error(`PCloud simulé : ${error.message}`);
    return (data ?? []).filter((o) => o.id !== null).map((o) => o.name);
  },
  async lienSigne(cle) {
    const { data } = await clientAdmin().storage.from(BUCKET_PCLOUD).createSignedUrl(cle, 300);
    return data?.signedUrl ?? null;
  },
};
