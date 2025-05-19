import { PrismaClient } from "@prisma/client";

// Create a more robust Prisma client with error handling and connection management
const prismaClientSingleton = () => {
  console.log('Initializing Prisma client with environment:', process.env.NODE_ENV);
  console.log('Database URL configured:', process.env.DATABASE_URL ? 'Yes' : 'No');
  console.log('Direct URL configured:', process.env.DIRECT_URL ? 'Yes' : 'No');
  
  return new PrismaClient({
    log: ['error', 'warn', 'query'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    // Add connection retry logic
    __internal: {
      engine: {
        connectionTimeout: 10000, // 10 seconds
        retry: {
          maxRetries: 3,
          initialDelay: 500, // 500ms
          maxDelay: 5000, // 5 seconds
        }
      }
    }
  });
};

// Create or reuse the Prisma client instance
export const db = globalThis.prisma || prismaClientSingleton();

// In development, preserve the client across hot reloads
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}

// Add better error handling for database operations with retry logic
export async function safeDbOperation(operation, maxRetries = 3) {
  let lastError;
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // Log the error with retry information
      console.error(`Database operation failed (attempt ${retryCount}/${maxRetries + 1}):`, error);
      
      // If this was the last retry, throw the error
      if (retryCount > maxRetries) {
        console.error('All database retry attempts failed');
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(100 * Math.pow(2, retryCount), 3000);
      console.log(`Retrying database operation in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never happen, but just in case
  throw lastError;
}