// Remove "use client" - this is now a Server Component

import { Suspense } from "react";
import { getAccountWithTransactions } from "@/actions/account";
import { BarLoader } from "react-spinners";
import { TransactionTable } from "../_components/transaction-table";
import { notFound } from "next/navigation";
import { AccountChart } from "../_components/account-chart";
import AccountPageClient from "./account-page-client";

export default async function AccountPage({ params }) {
  // Get the account ID from params
  const id = params.id;
  
  // Fetch account data on the server
  const accountData = await getAccountWithTransactions(id);

  if (!accountData) {
    notFound();
  }

  const { transactions, ...account } = accountData;
  
  // Return the client component with the data
  return <AccountPageClient account={account} transactions={transactions} />;
}