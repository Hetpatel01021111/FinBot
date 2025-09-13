// Server Component
import { getAccountWithTransactions } from "@/actions/account";
import { notFound } from "next/navigation";
import AccountPageClient from "./account-page-client";

// This function ensures all data is properly serialized for client components
function serializeData(data) {
  return JSON.parse(JSON.stringify(data));
}

export default async function AccountPage({ params }) {
  try {
    // Get the account ID from params (await required in Next.js 15)
    const { id } = await params;
    
    if (!id) {
      console.error("Missing account ID in params");
      notFound();
    }
    
    console.log("Fetching account data for ID:", id);
    
    // Fetch account data on the server
    const accountData = await getAccountWithTransactions(id).catch(error => {
      console.error("Error fetching account data:", error);
      return null;
    });

    if (!accountData) {
      console.error("No account data found for ID:", id);
      notFound();
    }

    // Extract and serialize the data to prevent hydration errors
    const { transactions = [], ...account } = accountData;
    const serializedAccount = serializeData(account);
    const serializedTransactions = serializeData(transactions);
    
    console.log("Successfully fetched account data");
    
    // Return the client component with the serialized data
    return (
      <AccountPageClient 
        account={serializedAccount} 
        transactions={serializedTransactions} 
      />
    );
  } catch (error) {
    console.error("Unhandled error in account page:", error);
    notFound();
  }
}