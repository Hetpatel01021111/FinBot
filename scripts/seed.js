// Standalone seed script that uses Prisma client directly
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const { subDays } = require('date-fns');

const prisma = new PrismaClient();

// Categories with their typical amount ranges
const CATEGORIES = {
  INCOME: [
    { name: "salary", range: [5000, 8000] },
    { name: "freelance", range: [1000, 3000] },
    { name: "investments", range: [500, 2000] },
    { name: "other-income", range: [100, 1000] },
  ],
  EXPENSE: [
    { name: "housing", range: [1000, 2000] },
    { name: "transportation", range: [100, 500] },
    { name: "groceries", range: [200, 600] },
    { name: "utilities", range: [100, 300] },
    { name: "entertainment", range: [50, 200] },
    { name: "food", range: [50, 150] },
    { name: "shopping", range: [100, 500] },
    { name: "healthcare", range: [100, 1000] },
    { name: "education", range: [200, 1000] },
    { name: "travel", range: [500, 2000] },
  ],
};

// Helper to generate random amount within a range
function getRandomAmount(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

// Helper to get random category with amount
function getRandomCategory(type) {
  const categories = CATEGORIES[type];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = getRandomAmount(category.range[0], category.range[1]);
  return { category: category.name, amount };
}

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // First, check if we have any users in the system
    const users = await prisma.user.findMany({ take: 1 });
    
    if (users.length === 0) {
      console.error("No users found in the database. Please create a user first.");
      return process.exit(1);
    }
    
    // Use the first user we find
    const userId = users[0].id;
    console.log("Using user ID for seeding:", userId);
    
    // Check if user has any accounts
    let account = await prisma.account.findFirst({
      where: { userId }
    });
    
    // If no account exists, create a default one
    if (!account) {
      console.log("Creating a default account for user");
      account = await prisma.account.create({
        data: {
          id: randomUUID(),
          name: "Default Account",
          type: "CURRENT", // Add the required account type
          balance: 0,
          isDefault: true,
          userId
        }
      });
    }
    
    const accountId = account.id;
    console.log("Using account ID for seeding:", accountId);

    // Generate 90 days of transactions
    const transactions = [];
    let totalBalance = 0;

    for (let i = 90; i >= 0; i--) {
      const date = subDays(new Date(), i);

      // Generate 1-3 transactions per day
      const transactionsPerDay = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < transactionsPerDay; j++) {
        // 40% chance of income, 60% chance of expense
        const type = Math.random() < 0.4 ? "INCOME" : "EXPENSE";
        const { category, amount } = getRandomCategory(type);

        const transaction = {
          id: randomUUID(),
          type,
          amount,
          description: `${type === "INCOME" ? "Received" : "Paid for"} ${category}`,
          date,
          category,
          accountId,
          userId
        };

        transactions.push(transaction);
        totalBalance += type === "INCOME" ? amount : -amount;
      }
    }

    // Create all transactions in the database
    console.log(`Creating ${transactions.length} transactions...`);
    
    // Use createMany for better performance
    await prisma.transaction.createMany({
      data: transactions,
      skipDuplicates: true,
    });

    // Update account balance
    await prisma.account.update({
      where: { id: accountId },
      data: { balance: totalBalance }
    });

    console.log('✅ Database seeded successfully!');
    console.log(`Created ${transactions.length} transactions`);
    console.log(`Updated account balance to $${totalBalance.toFixed(2)}`);
    
    return { success: true, count: transactions.length };
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unhandled error in seed script:", error);
    process.exit(1);
  });
