"use server";

import { db as firestore } from "@/lib/firebase";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getCurrentBudget(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Read budget doc (single current budget per user)
    const budgetRef = firestore.collection("users").doc(userId).collection("budgets").doc("current");
    const budgetSnap = await budgetRef.get();
    const budget = budgetSnap.exists ? { id: budgetSnap.id, ...budgetSnap.data() } : null;

    // Get current month's expenses (filter in JS)
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    // Fetch all transactions under the account and aggregate in JS
    const txSnap = await firestore.collection("users").doc(userId).collection("accounts").doc(accountId).collection("transactions").get();
    let sum = 0;
    txSnap.forEach((d) => {
      const t = d.data();
      const dateVal = t.date instanceof Date ? t.date : new Date(t.date);
      if (
        t.type === "EXPENSE" &&
        dateVal >= startOfMonth &&
        dateVal <= endOfMonth
      ) {
        sum += Number(t.amount || 0);
      }
    });

    return {
      budget: budget ? { ...budget, amount: Number(budget.amount) } : null,
      currentExpenses: sum,
    };
  } catch (error) {
    console.error("Error fetching budget:", error);
    throw error;
  }
}

export async function updateBudget(amount) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Upsert current budget doc
    const budgetRef = firestore.collection("users").doc(userId).collection("budgets").doc("current");
    await budgetRef.set(
      {
        amount: Number(amount),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    revalidatePath("/dashboard");
    return {
      success: true,
      data: { amount: Number(amount) },
    };
  } catch (error) {
    console.error("Error updating budget:", error);
    return { success: false, error: error.message };
  }
}