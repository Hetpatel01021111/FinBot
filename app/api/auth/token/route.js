import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function generateToken(userId) {
  // Dynamic import to prevent build-time initialization
  const { getAdminAuth } = await import('@/lib/firebase-admin');
  return await getAdminAuth().createCustomToken(userId);
}

export async function POST(request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const token = await generateToken(userId);
    
    return NextResponse.json({ token });
    
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
