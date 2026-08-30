import { db } from "../db/index.js";
import { budgetActions, budgetUndoPointers, categories } from "../db/schema.js";
import { eq, and, gt, lt, desc, asc, sql } from "drizzle-orm";
import { AppError } from "../middleware/error-handler.js";
import { setAssigned, moveMoney, getAssignedByCategory } from "./budget.service.js";

export interface RecentMove {
  id: number;
  type: "assign" | "move";
  month: string;
  categoryName: string | null;
  fromCategoryName: string | null;
  toCategoryName: string | null;
  previousAssigned: number | null;
  newAssigned: number | null;
  amount: number | null;
  createdAt: string;
}

async function getPointer(userId: number): Promise<number | null> {
  const [row] = await db
    .select({ actionId: budgetUndoPointers.actionId })
    .from(budgetUndoPointers)
    .where(eq(budgetUndoPointers.userId, userId));
  return row?.actionId ?? null;
}

async function setPointer(userId: number, actionId: number | null) {
  await db
    .insert(budgetUndoPointers)
    .values({ userId, actionId })
    .onConflictDoUpdate({ target: budgetUndoPointers.userId, set: { actionId } });
}

/** Discard any actions past the current pointer — a new action clears the redo branch */
async function pruneRedoBranch(userId: number) {
  const pointer = await getPointer(userId);
  await db
    .delete(budgetActions)
    .where(and(eq(budgetActions.userId, userId), gt(budgetActions.id, pointer ?? 0)));
}

export async function assignWithHistory(userId: number, categoryId: number, month: string, newAmount: number) {
  const previousAssigned = (await getAssignedByCategory(userId, month)).get(categoryId) ?? 0;
  const result = await setAssigned(userId, categoryId, month, newAmount);

  await pruneRedoBranch(userId);
  const [action] = await db
    .insert(budgetActions)
    .values({ userId, type: "assign", month, categoryId, previousAssigned, newAssigned: newAmount })
    .returning();
  await setPointer(userId, action.id);

  return result;
}

export async function moveWithHistory(
  userId: number,
  month: string,
  fromCategoryId: number | null,
  toCategoryId: number | null,
  amount: number,
) {
  const result = await moveMoney(userId, month, fromCategoryId, toCategoryId, amount);

  await pruneRedoBranch(userId);
  const [action] = await db
    .insert(budgetActions)
    .values({ userId, type: "move", month, fromCategoryId, toCategoryId, amount })
    .returning();
  await setPointer(userId, action.id);

  return result;
}

export async function undo(userId: number) {
  const pointer = await getPointer(userId);
  if (pointer == null) throw new AppError(400, "Nada que deshacer");

  const [action] = await db.select().from(budgetActions).where(eq(budgetActions.id, pointer));
  if (!action) throw new AppError(400, "Nada que deshacer");

  if (action.type === "assign") {
    await setAssigned(userId, action.categoryId!, action.month, action.previousAssigned ?? 0);
  } else {
    await moveMoney(userId, action.month, action.toCategoryId, action.fromCategoryId, action.amount!);
  }

  const [prev] = await db
    .select({ id: budgetActions.id })
    .from(budgetActions)
    .where(and(eq(budgetActions.userId, userId), lt(budgetActions.id, pointer)))
    .orderBy(desc(budgetActions.id))
    .limit(1);
  await setPointer(userId, prev?.id ?? null);

  return { month: action.month };
}

export async function redo(userId: number) {
  const pointer = await getPointer(userId);

  const [action] = await db
    .select()
    .from(budgetActions)
    .where(and(eq(budgetActions.userId, userId), gt(budgetActions.id, pointer ?? 0)))
    .orderBy(asc(budgetActions.id))
    .limit(1);
  if (!action) throw new AppError(400, "Nada que rehacer");

  if (action.type === "assign") {
    await setAssigned(userId, action.categoryId!, action.month, action.newAssigned ?? 0);
  } else {
    await moveMoney(userId, action.month, action.fromCategoryId, action.toCategoryId, action.amount!);
  }

  await setPointer(userId, action.id);
  return { month: action.month };
}

export async function getRecentMoves(userId: number, limit: number): Promise<RecentMove[]> {
  const pointer = await getPointer(userId);

  const catName = categories.name;
  const rows = await db
    .select({
      id: budgetActions.id,
      type: budgetActions.type,
      month: budgetActions.month,
      previousAssigned: budgetActions.previousAssigned,
      newAssigned: budgetActions.newAssigned,
      amount: budgetActions.amount,
      createdAt: budgetActions.createdAt,
      categoryName: sql<string | null>`(select ${catName} from ${categories} where ${categories.id} = ${budgetActions.categoryId})`,
      fromCategoryName: sql<string | null>`(select ${catName} from ${categories} where ${categories.id} = ${budgetActions.fromCategoryId})`,
      toCategoryName: sql<string | null>`(select ${catName} from ${categories} where ${categories.id} = ${budgetActions.toCategoryId})`,
    })
    .from(budgetActions)
    .where(and(eq(budgetActions.userId, userId), lt(budgetActions.id, (pointer ?? 0) + 1)))
    .orderBy(desc(budgetActions.id))
    .limit(limit);

  return rows;
}
