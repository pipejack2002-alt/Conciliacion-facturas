import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db.ts";
import type { HistoryEntry } from "./history-store.ts";

interface FetchHistoryPayload {
  userId: string;
}

interface SaveHistoryPayload {
  userId: string;
  userEmail?: string;
  entry: HistoryEntry;
}

interface DeleteHistoryPayload {
  id: string;
  userId: string;
}

interface ClearHistoryPayload {
  userId: string;
}

/**
 * Obtiene el historial de conciliaciones de la base de datos (Neon/PGLite)
 * aislado estrictamente por el identificador del usuario activo.
 */
export const getUserHistoryServerFn = createServerFn({ method: "POST" })
  .validator((d: FetchHistoryPayload) => d)
  .handler(async ({ data }) => {
    const { userId } = data;
    if (!userId || !userId.trim()) return [];

    try {
      const sql = await getSql();
      const normalizedUserId = userId.trim().toLowerCase();

      const rows = await sql<{
        id: string;
        user_id: string;
        user_email: string | null;
        company_nit: string | null;
        company_name: string | null;
        period_label: string | null;
        dian_name: string | null;
        mov_name: string | null;
        entry_timestamp: number | string;
        totals: any;
        result: any;
        reviews: any;
      }>`
        SELECT id, user_id, user_email, company_nit, company_name, period_label,
               dian_name, mov_name, entry_timestamp, totals, result, reviews
        FROM historial_conciliaciones
        WHERE user_id = ${normalizedUserId}
        ORDER BY entry_timestamp DESC
        LIMIT 50
      `;

      return rows.map((r) => ({
        id: r.id,
        timestamp: Number(r.entry_timestamp),
        company: {
          nit: r.company_nit || "",
          nombre: r.company_name || "",
        },
        periodLabel: r.period_label || "",
        dianName: r.dian_name || "",
        movName: r.mov_name || "",
        totals: r.totals,
        result: r.result,
        reviews: r.reviews || undefined,
      })) as HistoryEntry[];
    } catch (err) {
      console.error("[history-server] Error al consultar historial en la nube:", err);
      return [];
    }
  });

/**
 * Guarda o actualiza una sesión de conciliación en la nube para el usuario actual.
 */
export const saveUserHistoryServerFn = createServerFn({ method: "POST" })
  .validator((d: SaveHistoryPayload) => d)
  .handler(async ({ data }) => {
    const { userId, userEmail, entry } = data;
    if (!userId || !userId.trim()) {
      return { success: false, error: "userId requerido" };
    }

    try {
      const sql = await getSql();
      const normalizedUserId = userId.trim().toLowerCase();
      const totalsJson = JSON.stringify(entry.totals);
      const resultJson = JSON.stringify(entry.result);
      const reviewsJson = entry.reviews ? JSON.stringify(entry.reviews) : null;

      await sql`
        INSERT INTO historial_conciliaciones (
          id, user_id, user_email, company_nit, company_name, period_label,
          dian_name, mov_name, entry_timestamp, totals, result, reviews, updated_at
        ) VALUES (
          ${entry.id},
          ${normalizedUserId},
          ${userEmail || null},
          ${entry.company.nit || null},
          ${entry.company.nombre || null},
          ${entry.periodLabel || null},
          ${entry.dianName || null},
          ${entry.movName || null},
          ${entry.timestamp},
          ${totalsJson}::jsonb,
          ${resultJson}::jsonb,
          ${reviewsJson}::jsonb,
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          company_nit = EXCLUDED.company_nit,
          company_name = EXCLUDED.company_name,
          period_label = EXCLUDED.period_label,
          dian_name = EXCLUDED.dian_name,
          mov_name = EXCLUDED.mov_name,
          entry_timestamp = EXCLUDED.entry_timestamp,
          totals = EXCLUDED.totals,
          result = EXCLUDED.result,
          reviews = EXCLUDED.reviews,
          updated_at = now()
      `;

      return { success: true };
    } catch (err: any) {
      console.error("[history-server] Error al persistir sesión en la nube:", err);
      return { success: false, error: err?.message || "Error al guardar en BD" };
    }
  });

/**
 * Elimina una sesión del historial en la nube por su ID y usuario.
 */
export const deleteUserHistoryServerFn = createServerFn({ method: "POST" })
  .validator((d: DeleteHistoryPayload) => d)
  .handler(async ({ data }) => {
    const { id, userId } = data;
    if (!id || !userId) return { success: false };

    try {
      const sql = await getSql();
      const normalizedUserId = userId.trim().toLowerCase();

      await sql`
        DELETE FROM historial_conciliaciones
        WHERE id = ${id} AND user_id = ${normalizedUserId}
      `;
      return { success: true };
    } catch (err: any) {
      console.error("[history-server] Error al eliminar sesión de la nube:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * Elimina todo el historial del usuario en la nube.
 */
export const clearUserHistoryServerFn = createServerFn({ method: "POST" })
  .validator((d: ClearHistoryPayload) => d)
  .handler(async ({ data }) => {
    const { userId } = data;
    if (!userId) return { success: false };

    try {
      const sql = await getSql();
      const normalizedUserId = userId.trim().toLowerCase();

      await sql`
        DELETE FROM historial_conciliaciones
        WHERE user_id = ${normalizedUserId}
      `;
      return { success: true };
    } catch (err: any) {
      console.error("[history-server] Error al vaciar historial en la nube:", err);
      return { success: false, error: err?.message };
    }
  });
