"use server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { getAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Lazy initialization of Firestore
let db;
function getDb() {
  if (!db) {
    db = getAdminFirestore();
  }
  return db;
}

// Serializer to handle Firestore Timestamps and other complex objects
const serializeDecimal = (obj) => {
  const serialized = { ...obj };
  
  // Convert Firestore Timestamps to ISO strings
  if (serialized.date && typeof serialized.date.toDate === 'function') {
    serialized.date = serialized.date.toDate().toISOString();
  } else if (serialized.date instanceof Date) {
    serialized.date = serialized.date.toISOString();
  }
  
  if (serialized.createdAt && typeof serialized.createdAt.toDate === 'function') {
    serialized.createdAt = serialized.createdAt.toDate().toISOString();
  } else if (serialized.createdAt instanceof Date) {
    serialized.createdAt = serialized.createdAt.toISOString();
  }
  
  if (serialized.nextRecurringDate && typeof serialized.nextRecurringDate.toDate === 'function') {
    serialized.nextRecurringDate = serialized.nextRecurringDate.toDate().toISOString();
  } else if (serialized.nextRecurringDate instanceof Date) {
    serialized.nextRecurringDate = serialized.nextRecurringDate.toISOString();
  }
  
  return serialized;
};

export async function getAccountWithTransactions(accountId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Get account
  const db = getDb();
  const accountRef = db.collection("users").doc(userId).collection("accounts").doc(accountId);
  const accountSnap = await accountRef.get();
  if (!accountSnap.exists) return null;

  const account = { id: accountSnap.id, ...accountSnap.data() };

  // Get transactions ordered by date desc
  const txSnap = await accountRef.collection("transactions").orderBy("date", "desc").get();
  const transactions = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    ...serializeDecimal(account),
    transactions: transactions.map(serializeDecimal),
    _count: { transactions: transactions.length },
  };
}

export async function bulkDeleteTransactions(transactionIds) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return { success: true };
    }

    // Strategy: iterate through user's accounts, try to find each transaction by id
    const accountsSnap = await db.collection("users").doc(userId).collection("accounts").get();

    const accountBalanceChanges = {}; // { [accountId]: number }
    const batch = db.batch();

    for (const accDoc of accountsSnap.docs) {
      const accId = accDoc.id;
      for (const txId of transactionIds) {
        const txRef = firestore.collection("users").doc(userId).collection("accounts").doc(accId).collection("transactions").doc(txId);
        const txSnap = await txRef.get();
        if (txSnap.exists) {
          const tx = txSnap.data();
          const change = tx.type === "EXPENSE" ? tx.amount : -tx.amount;
          accountBalanceChanges[accId] = (accountBalanceChanges[accId] || 0) + change;
          batch.delete(txRef);
        }
      }
    }

    // Update account balances
    for (const [accountId, balanceChange] of Object.entries(accountBalanceChanges)) {
      const accountRef = db.collection("users").doc(userId).collection("accounts").doc(accountId);
      const accountSnap = await accountRef.get();
      if (accountSnap.exists) {
        const current = accountSnap.data();
        const nextBalance = (current.balance || 0) - balanceChange; // reverse since change defined as expense:+ amount
        batch.update(accountRef, { balance: nextBalance });
      }
    }

    await batch.commit();

    revalidatePath("/dashboard");
    revalidatePath("/account/[id]");

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateDefaultAccount(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Unset all current defaults
    const accountsRef = firestore.collection("users").doc(userId).collection("accounts");
    const accountsSnap = await accountsRef.get();

    const batch = db.batch();
    accountsSnap.forEach((docSnap) => {
      const ref = accountsRef.doc(docSnap.id);
      const isTarget = docSnap.id === accountId;
      batch.update(ref, { isDefault: isTarget });
    });

    await batch.commit();

    revalidatePath("/dashboard");
    return { success: true, data: { id: accountId, isDefault: true } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}