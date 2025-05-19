import { PrismaClient } from "@prisma/client";

// Create a more robust Prisma client with error handling
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'pretty',
  });
};

// Create or reuse the Prisma client instance
export const db = globalThis.prisma || prismaClientSingleton();

// In development, preserve the client across hot reloads
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}

// Add better error handling for database operations
export async function safeDbOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
}