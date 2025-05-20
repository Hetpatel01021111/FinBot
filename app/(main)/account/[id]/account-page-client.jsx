"use client";

import { motion } from "framer-motion";
import { BarLoader } from "react-spinners";
import { Suspense, useEffect, useState } from "react";
import { TransactionTable } from "../_components/transaction-table";
import { AccountChart } from "../_components/account-chart";
import { useRouter } from "next/navigation";

export default function AccountPageClient({ account, transactions }) {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Validate the data to prevent client-side errors
    if (!account || typeof account !== 'object') {
      setError('Account data is invalid');
      return;
    }

    if (!Array.isArray(transactions)) {
      setError('Transactions data is invalid');
      return;
    }

    // Data is valid, mark as loaded
    setIsLoaded(true);
  }, [account, transactions]);

  // Handle error state
  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Error Loading Account</h2>
        <p className="mb-4">{error}</p>
        <button 
          onClick={() => router.push('/dashboard')} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Show loading state while validating data
  if (!isLoaded) {
    return (
      <div className="p-8 text-center">
        <BarLoader width={"50%"} color="#9333ea" className="mx-auto" />
        <p className="mt-4 text-gray-500">Loading account data...</p>
      </div>
    );
  }

  // Safe access to properties with fallbacks
  const accountName = account.name || 'Account';
  const accountType = account.type ? (account.type.charAt(0) + account.type.slice(1).toLowerCase()) : 'Account';
  const accountBalance = typeof account.balance === 'number' ? account.balance : 0;
  const transactionCount = account._count?.transactions || 0;

  return (
    <div className="space-y-8 px-5">
      <div className="flex gap-4 items-end justify-between">
        <div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent capitalize">
            {accountName}
          </h1>
          <p className="text-gray-500">
            {accountType}{" "}
            Account
          </p>
        </div>

        <div className="text-right pb-2">
          <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ${accountBalance.toFixed(2)}
          </div>
          <p className="text-sm text-gray-500">
            {transactionCount} Transactions
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <div className="rounded-xl overflow-hidden shadow-md bg-gradient-to-br from-white to-blue-50">
          <AccountChart transactions={transactions} />
        </div>
      </Suspense>

      {/* Transactions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
        {transactions.length > 0 ? (
          <TransactionTable transactions={transactions} />
        ) : (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No transactions found for this account.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
