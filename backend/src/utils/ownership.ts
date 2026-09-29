import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { payslips, profiles } from "../db/schema.js";

// Las tablas hijas de una nómina (notas, etiquetas, conceptos) no tienen
// `user_id` propio: la propiedad se comprueba a través de payslip → profile.
export async function userOwnsPayslip(userId: number, payslipId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: payslips.id })
    .from(payslips)
    .innerJoin(profiles, eq(payslips.profileId, profiles.id))
    .where(and(eq(payslips.id, payslipId), eq(profiles.userId, userId)));
  return !!row;
}
