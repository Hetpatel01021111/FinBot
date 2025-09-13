import { inngest } from "./client";
import { db as firestore } from "@/lib/firebase";
import { Timestamp } from 'firebase-admin/firestore';
import EmailTemplate from "@/emails/template";
import { sendEmail } from "@/actions/send-email";

// 1. Recurring Transaction Processing with Throttling
export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10, // Process 10 transactions
      period: "1m", // per minute
      key: "event.data.userId", // Throttle per user
    },
  },
  { event: "transaction.recurring.process" },
  async ({ event, step }) => {
    // Validate event data
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { error: "Missing required event data" };
    }

    await step.run("process-transaction", async () => {
      const { userId, transactionId } = event.data;

      // Find the recurring transaction across all of the user's accounts
      const accountsSnap = await firestore.collection("users").doc(userId).collection("accounts").get();
      let transaction = null;
      let account = null;
      let transactionRef = null;

      for (const accountDoc of accountsSnap.docs) {
        const tempRef = firestore.collection("users").doc(userId).collection("accounts").doc(accountDoc.id).collection("transactions").doc(transactionId);
        const transactionSnap = await tempRef.get();
        if (transactionSnap.exists) {
          transaction = transactionSnap.data();
          transactionRef = tempRef;
          account = { id: accountDoc.id, ...accountDoc.data() };
          break;
        }
      }

      if (!transaction || !account || !isTransactionDue(transaction)) return;

      // Create new transaction and update account balance in a batch
      const batch = firestore.batch();

      // 1. Create new transaction from the recurring one
      const newTransactionRef = firestore.collection("users").doc(userId).collection("accounts").doc(account.id).collection("transactions").doc();
      batch.set(newTransactionRef, {
        type: transaction.type,
        amount: transaction.amount,
        description: `${transaction.description} (Recurring)`,
        date: Timestamp.now(),
        category: transaction.category,
        userId: userId,
        accountId: account.id,
        isRecurring: false,
      });

      // 2. Update account balance
      const balanceChange = transaction.type === "EXPENSE" ? -transaction.amount : transaction.amount;
      const accountRef = firestore.collection("users").doc(userId).collection("accounts").doc(account.id);
      batch.update(accountRef, { balance: (account.balance || 0) + balanceChange });

      // 3. Update the original recurring transaction's dates
      batch.update(transactionRef, {
        lastProcessed: Timestamp.now(),
        nextRecurringDate: calculateNextRecurringDate(
          new Date(),
          transaction.recurringInterval
        ),
      });

      await batch.commit();
    });
  }
);

// Trigger recurring transactions with batching
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions", // Unique ID,
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" }, // Daily at midnight
  async ({ step }) => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        // This is inefficient in Firestore. A better schema would be a top-level collection for recurring transactions.
        // For now, we query all transactions and filter.
        const transactionsCol = firestore.collectionGroup('transactions');
        const q = transactionsCol.where('isRecurring', '==', true).where('nextRecurringDate', '<=', Timestamp.now());
        const querySnapshot = await q.get();
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    );

    // Send event for each recurring transaction in batches
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));

      // Send events directly using inngest.send()
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

// 2. Monthly Report Generation
async function generateFinancialInsights(stats, month) {
  // Check for Gemini API key
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("Missing GEMINI_API_KEY environment variable in generateFinancialInsights");
    return ["Unable to generate insights due to missing API key"];
  }

  // Prompt for financial insights
  const prompt = `
    You are a financial advisor assistant. Analyze financial data and provide concise, actionable insights.
    
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.

    Financial Data for ${month}:
    - Total Income: $${stats.totalIncome}
    - Total Expenses: $${stats.totalExpenses}
    - Net Income: $${stats.totalIncome - stats.totalExpenses}
    - Expense Categories: ${Object.entries(stats.byCategory)
      .map(([category, amount]) => `${category}: $${amount}`)
      .join(", ")}

    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try {
    // Prepare request payload for Gemini
    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500
      }
    };
    
    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return ["Unable to generate insights due to API error"];
    }
    
    const data = await response.json();
    
    // Check if response has the expected structure
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error("Invalid response structure from Gemini API", data);
      return ["Unable to generate insights due to invalid API response"];
    }
    
    // Extract text from Gemini response
    const text = data.candidates[0].content.parts
      .filter(part => part.text)
      .map(part => part.text)
      .join("\n");
    
    // Clean the text and extract JSON
    const jsonMatch = text.match(/\[\s*".*"\s*,\s*".*"\s*,\s*".*"\s*\]/s);
    if (!jsonMatch) {
      console.error("No JSON array found in response", text);
      return ["Unable to parse insights from API response"];
    }
    
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Error parsing JSON insights:", error);
      return ["Unable to parse insights from API response"];
    }
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}

export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
  },
  { cron: "0 0 1 * *" }, // First day of each month
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      const usersSnapshot = await firestore.collection("users").get();
      const usersData = [];
      for (const userDoc of usersSnapshot.docs) {
        const accountsSnapshot = await firestore.collection("users").doc(userDoc.id).collection("accounts").get();
        usersData.push({
          id: userDoc.id,
          ...userDoc.data(),
          accounts: accountsSnapshot.docs.map(accDoc => ({ id: accDoc.id, ...accDoc.data() }))
        });
      }
      return usersData;
    });

    for (const user of users) {
      await step.run(`generate-report-${user.id}`, async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const stats = await getMonthlyStats(user.id, lastMonth);
        const monthName = lastMonth.toLocaleString("default", {
          month: "long",
        });

        // Generate AI insights
        const insights = await generateFinancialInsights(stats, monthName);

        await sendEmail({
          to: user.email,
          subject: `Your Monthly Financial Report - ${monthName}`,
          react: EmailTemplate({
            userName: user.name,
            type: "monthly-report",
            data: {
              stats,
              month: monthName,
              insights,
            },
          }),
        });
      });
    }

    return { processed: users.length };
  }
);

// 3. Budget Alerts with Event Batching
export const checkBudgetAlerts = inngest.createFunction(
  { name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" }, // Every 6 hours
  async ({ step }) => {
    const budgets = await step.run("fetch-budgets", async () => {
      const budgetsSnapshot = await firestore.collectionGroup('budgets').get();
      const budgetsData = [];
      for (const budgetDoc of budgetsSnapshot.docs) {
        const userId = budgetDoc.ref.parent.parent.id;
        const userSnapshot = await firestore.collection("users").doc(userId).get();
        if (!userSnapshot.exists) continue;

        const accountsQuery = firestore.collection("users").doc(userId).collection("accounts").where("isDefault", "==", true);
        const defaultAccountsSnapshot = await accountsQuery.get();
        
        budgetsData.push({
          id: budgetDoc.id,
          ...budgetDoc.data(),
          userId,
          user: {
            ...userSnapshot.data(),
            accounts: defaultAccountsSnapshot.docs.map(accDoc => ({ id: accDoc.id, ...accDoc.data() }))
          }
        });
      }
      return budgetsData;
    });

    for (const budget of budgets) {
      const defaultAccount = budget.user.accounts[0];
      if (!defaultAccount) continue; // Skip if no default account

      await step.run(`check-budget-${budget.id}`, async () => {
        const startDate = new Date();
        startDate.setDate(1); // Start of current month

        // Calculate total expenses for the default account only
        const transactionsQuery = firestore.collection("users").doc(budget.userId).collection("accounts").doc(defaultAccount.id).collection("transactions")
          .where("type", "==", "EXPENSE")
          .where("date", ">=", Timestamp.fromDate(startDate));
        const expensesSnapshot = await transactionsQuery.get();
        const totalExpenses = expensesSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
        const budgetAmount = budget.amount;
        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        // Check if we should send an alert
        if (
          percentageUsed >= 80 && // Default threshold of 80%
          (!budget.lastAlertSent ||
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) {
          await sendEmail({
            to: budget.user.email,
            subject: `Budget Alert for ${defaultAccount.name}`,
            react: EmailTemplate({
              userName: budget.user.name,
              type: "budget-alert",
              data: {
                percentageUsed,
                budgetAmount: parseInt(budgetAmount).toFixed(1),
                totalExpenses: parseInt(totalExpenses).toFixed(1),
                accountName: defaultAccount.name,
              },
            }),
          });

          // Update last alert sent
          const budgetRef = firestore.collection("users").doc(budget.userId).collection("budgets").doc(budget.id);
          await budgetRef.update({ lastAlertSent: Timestamp.now() });
        }
      });
    }
  }
);

function isNewMonth(lastAlertDate, currentDate) {
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

// Utility functions
function isTransactionDue(transaction) {
  // If no lastProcessed date, transaction is due
  if (!transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  // Compare with nextDue date
  return nextDue <= today;
}

function calculateNextRecurringDate(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

async function getMonthlyStats(userId, month) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactionsQuery = firestore.collectionGroup('transactions')
    .where('userId', '==', userId)
    .where('date', '>=', Timestamp.fromDate(startDate))
    .where('date', '<=', Timestamp.fromDate(endDate));
  const transactionsSnapshot = await transactionsQuery.get();
  const transactions = transactionsSnapshot.docs.map(doc => doc.data());

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount;
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    {
      totalExpenses: 0,
      totalIncome: 0,
      byCategory: {},
      transactionCount: transactions.length,
    }
  );
}