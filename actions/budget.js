"use server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// Lazy initialization of Firestore
let db;
function getDb() {
  if (!db) {
    db = getAdminFirestore();
  }
  return db;
}

export async function getCurrentBudget(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    // Read budget doc (single current budget per user)
    const budgetRef = db.collection("users").doc(userId).collection("budgets").doc("current");
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
    const txSnap = await db.collection("users")
      .doc(userId)
      .collection("accounts")
      .doc(accountId)
      .collection("transactions")
      .get();
    let sum = 0;
    txSnap.forEach((d) => {
      const t = d.data();
      // Handle Firestore Timestamps properly
      let dateVal;
      if (t.date && typeof t.date.toDate === 'function') {
        dateVal = t.date.toDate(); // Firestore Timestamp
      } else if (t.date instanceof Date) {
        dateVal = t.date; // JavaScript Date
      } else {
        dateVal = new Date(t.date); // String date
      }
      
      if (
        t.type === "EXPENSE" &&
        dateVal >= startOfMonth &&
        dateVal <= endOfMonth
      ) {
        sum += Number(t.amount || 0);
      }
    });

    // Serialize budget data to handle Firestore Timestamps
    const serializedBudget = budget ? {
      ...budget,
      amount: Number(budget.amount),
      // Convert any Firestore Timestamps to ISO strings
      updatedAt: budget.updatedAt && typeof budget.updatedAt.toDate === 'function' 
        ? budget.updatedAt.toDate().toISOString() 
        : budget.updatedAt instanceof Date 
        ? budget.updatedAt.toISOString()
        : budget.updatedAt,
      createdAt: budget.createdAt && typeof budget.createdAt.toDate === 'function'
        ? budget.createdAt.toDate().toISOString()
        : budget.createdAt instanceof Date
        ? budget.createdAt.toISOString()
        : budget.createdAt
    } : null;

    return {
      budget: serializedBudget,
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

    const db = getDb();
    // Update or create the budget
    const budgetRef = db.collection("users").doc(userId).collection("budgets").doc("current");
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