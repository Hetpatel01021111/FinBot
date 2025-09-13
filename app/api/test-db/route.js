import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Test Firestore connection
    const db = getAdminFirestore();
    
    // Try to read from a test collection
    const testDoc = await db.collection('test').doc('connection').get();
    
    // Try to write a test document
    await db.collection('test').doc('connection').set({
      timestamp: new Date().toISOString(),
      status: 'connected',
      message: 'Database connection successful'
    });

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      firestore: 'connected'
    });

  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    const db = getAdminFirestore();
    
    // Test creating a sample transaction
    const testTransaction = {
      id: `test_${Date.now()}`,
      amount: 100.50,
      description: 'Test transaction',
      category: 'testing',
      date: new Date().toISOString(),
      userId: 'test_user'
    };

    await db.collection('transactions').add(testTransaction);

    return NextResponse.json({
      success: true,
      message: 'Test transaction created successfully',
      transaction: testTransaction
    });

  } catch (error) {
    console.error('Transaction test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
