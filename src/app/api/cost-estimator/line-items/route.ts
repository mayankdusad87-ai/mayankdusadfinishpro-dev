import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { getLineItems, createLineItem, updateLineItem, deleteLineItem } from '@/repositories/cost-repo';

export async function GET(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const categoryId = req.nextUrl.searchParams.get('categoryId');
  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId required' }, { status: 400 });
  }

  const lineItems = await getLineItems(categoryId);
  return NextResponse.json({ lineItems });
}

export async function POST(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { categoryId, ...item } = await req.json();
  if (!categoryId || !item.name) {
    return NextResponse.json({ error: 'categoryId and name required' }, { status: 400 });
  }

  const lineItem = await createLineItem(categoryId, item);
  return NextResponse.json({ lineItem }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { id, ...updates } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const lineItem = await updateLineItem(id, updates);
  return NextResponse.json({ lineItem });
}

export async function DELETE(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await deleteLineItem(id);
  return NextResponse.json({ success: true });
}
