// Simple script to run the seed function

const { seedTransactions } = require('../actions/seed');

async function runSeed() {
  console.log('Starting database seeding...');
  
  try {
    const result = await seedTransactions();
    
    if (result.success) {
      console.log('✅ Database seeded successfully!');
      console.log(`Created ${result.count} transactions`);
    } else {
      console.error('❌ Seeding failed:', result.error);
    }
  } catch (error) {
    console.error('Failed to seed database:', error);
  }
  
  process.exit(0);
}

runSeed();
