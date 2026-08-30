import { db } from "../db/index.js";
import { categoryGroups, categories, categoryBudgets, categoryTargets, transactions } from "../db/schema.js";
import { eq, and, sql, lt, lte, gte } from "drizzle-orm";
import { AppError } from "../middleware/error-handler.js";

export type PlanCategoryStatus = "none" | "underfunded" | "funded" | "overfunded";

export interface PlanCategory {
  id: number;
  groupId: number;
  name: string;
  sortOrder: number;
  assigned: number;
  activity: number;
  carryover: number;
  available: number;
  target: number | null;
  status: PlanCategoryStatus;
  fullySpent: boolean;
}

export interface PlanGroup {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  categories: PlanCategory[];
}

export interface PlanResponse {
  month: string;
  readyToAssign: number;
  groups: PlanGroup[];
}

function monthEndDate(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

/** Net signed activity for a category/month: +income, -expense */
const activityExpr = sql<number>`sum(case when ${transactions.type} = 'income' then ${transactions.amount} when ${transactions.type} = 'expense' then -${transactions.amount} else 0 end)`;

async function getActivityByCategory(userId: number, month: string): Promise<Map<number, number>> {
  const monthStart = `${month}-01`;
  const monthEnd = monthEndDate(month);
  const rows = await db
    .select({ categoryId: transactions.categoryId, total: activityExpr })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
      ),
    )
    .groupBy(transactions.categoryId);

  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.categoryId != null) map.set(row.categoryId, row.total ?? 0);
  }
  return map;
}

export async function getAssignedByCategory(userId: number, month: string): Promise<Map<number, number>> {
  const rows = await db
    .select({ categoryId: categoryBudgets.categoryId, assigned: categoryBudgets.assigned })
    .from(categoryBudgets)
    .where(and(eq(categoryBudgets.userId, userId), eq(categoryBudgets.month, month)));

  const map = new Map<number, number>();
  for (const row of rows) map.set(row.categoryId, row.assigned);
  return map;
}

/** Sum of (assigned - activity) for every month strictly before `month`, per category */
async function getCarryoverByCategory(userId: number, month: string): Promise<Map<number, number>> {
  const monthStart = `${month}-01`;

  const assignedRows = await db
    .select({ categoryId: categoryBudgets.categoryId, total: sql<number>`sum(${categoryBudgets.assigned})` })
    .from(categoryBudgets)
    .where(and(eq(categoryBudgets.userId, userId), lt(categoryBudgets.month, month)))
    .groupBy(categoryBudgets.categoryId);

  const activityRows = await db
    .select({ categoryId: transactions.categoryId, total: activityExpr })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), lt(transactions.date, monthStart)))
    .groupBy(transactions.categoryId);

  const map = new Map<number, number>();
  for (const row of assignedRows) {
    map.set(row.categoryId, (map.get(row.categoryId) ?? 0) + (row.total ?? 0));
  }
  for (const row of activityRows) {
    if (row.categoryId != null) {
      map.set(row.categoryId, (map.get(row.categoryId) ?? 0) + (row.total ?? 0));
    }
  }
  return map;
}

export async function getReadyToAssign(userId: number, month: string): Promise<number> {
  const monthEnd = monthEndDate(month);

  const [incomeRow] = await db
    .select({ total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "income"), lte(transactions.date, monthEnd)));

  const [assignedRow] = await db
    .select({ total: sql<number>`sum(${categoryBudgets.assigned})` })
    .from(categoryBudgets)
    .where(and(eq(categoryBudgets.userId, userId), lte(categoryBudgets.month, month)));

  return (incomeRow?.total ?? 0) - (assignedRow?.total ?? 0);
}

async function getTargetsByCategory(userId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({ categoryId: categoryTargets.categoryId, targetAmount: categoryTargets.targetAmount })
    .from(categoryTargets)
    .where(eq(categoryTargets.userId, userId));

  const map = new Map<number, number>();
  for (const row of rows) map.set(row.categoryId, row.targetAmount);
  return map;
}

function computeStatus(assigned: number, target: number | null): PlanCategoryStatus {
  if (target == null) return "none";
  if (assigned < target) return "underfunded";
  if (assigned > target) return "overfunded";
  return "funded";
}

export async function getPlan(userId: number, month: string): Promise<PlanResponse> {
  const groups = await db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.userId, userId))
    .orderBy(categoryGroups.sortOrder, categoryGroups.name);

  const cats = await db.select().from(categories).orderBy(categories.sortOrder, categories.name);

  const [assigned, activity, carryover, targets, readyToAssign] = await Promise.all([
    getAssignedByCategory(userId, month),
    getActivityByCategory(userId, month),
    getCarryoverByCategory(userId, month),
    getTargetsByCategory(userId),
    getReadyToAssign(userId, month),
  ]);

  const planGroups: PlanGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    sortOrder: g.sortOrder,
    categories: cats
      .filter((c) => c.groupId === g.id)
      .map((c) => {
        const a = assigned.get(c.id) ?? 0;
        const act = activity.get(c.id) ?? 0;
        const prev = carryover.get(c.id) ?? 0;
        const target = targets.get(c.id) ?? null;
        return {
          id: c.id,
          groupId: c.groupId,
          name: c.name,
          sortOrder: c.sortOrder,
          assigned: a,
          activity: act,
          carryover: prev,
          available: prev + a + act,
          target,
          status: computeStatus(a, target),
          fullySpent: a > 0 && act <= -a,
        };
      }),
  }));

  return { month, readyToAssign, groups: planGroups };
}

export async function setTarget(userId: number, categoryId: number, amount: number | null) {
  await assertCategoryOwnership(userId, categoryId);

  if (amount == null) {
    await db.delete(categoryTargets).where(and(eq(categoryTargets.userId, userId), eq(categoryTargets.categoryId, categoryId)));
    return { target: null };
  }

  await db
    .insert(categoryTargets)
    .values({ userId, categoryId, targetAmount: amount })
    .onConflictDoUpdate({
      target: [categoryTargets.categoryId],
      set: { targetAmount: amount },
    });
  return { target: amount };
}

async function assertCategoryOwnership(userId: number, categoryId: number) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(and(eq(categories.id, categoryId), eq(categoryGroups.userId, userId)));
  if (!row) throw new AppError(404, "Categoría no encontrada");
}

export async function setAssigned(userId: number, categoryId: number, month: string, amount: number) {
  await assertCategoryOwnership(userId, categoryId);

  await db
    .insert(categoryBudgets)
    .values({ userId, categoryId, month, assigned: amount })
    .onConflictDoUpdate({
      target: [categoryBudgets.userId, categoryBudgets.categoryId, categoryBudgets.month],
      set: { assigned: amount },
    });

  const plan = await getPlan(userId, month);
  const category = plan.groups.flatMap((g) => g.categories).find((c) => c.id === categoryId)!;
  return { readyToAssign: plan.readyToAssign, category };
}

export async function moveMoney(
  userId: number,
  month: string,
  fromCategoryId: number | null,
  toCategoryId: number | null,
  amount: number,
) {
  if (fromCategoryId != null) {
    await assertCategoryOwnership(userId, fromCategoryId);
  }
  if (toCategoryId != null) {
    await assertCategoryOwnership(userId, toCategoryId);
  }

  const assigned = await getAssignedByCategory(userId, month);

  db.transaction((tx) => {
    if (fromCategoryId != null) {
      const current = assigned.get(fromCategoryId) ?? 0;
      tx
        .insert(categoryBudgets)
        .values({ userId, categoryId: fromCategoryId, month, assigned: current - amount })
        .onConflictDoUpdate({
          target: [categoryBudgets.userId, categoryBudgets.categoryId, categoryBudgets.month],
          set: { assigned: current - amount },
        })
        .run();
    }
    if (toCategoryId != null) {
      const current = assigned.get(toCategoryId) ?? 0;
      tx
        .insert(categoryBudgets)
        .values({ userId, categoryId: toCategoryId, month, assigned: current + amount })
        .onConflictDoUpdate({
          target: [categoryBudgets.userId, categoryBudgets.categoryId, categoryBudgets.month],
          set: { assigned: current + amount },
        })
        .run();
    }
  });

  const readyToAssign = await getReadyToAssign(userId, month);
  return { readyToAssign };
}
