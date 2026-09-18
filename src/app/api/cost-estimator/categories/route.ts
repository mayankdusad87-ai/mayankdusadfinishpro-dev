import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/repositories/cost-repo';

export async function GET(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const packageId = req.nextUrl.searchParams.get('packageId');
  if (!packageId) {
    return NextResponse.json({ error: 'packageId required' }, { status: 400 });
  }

  const categories = await getCategories(packageId);
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { packageId, name, sortOrder } = await req.json();
  if (!packageId || !name) {
    return NextResponse.json({ error: 'packageId and name required' }, { status: 400 });
  }

  const category = await createCategory(packageId, name, sortOrder);
  return NextResponse.json({ category }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { id, name, sort_order } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const category = await updateCategory(id, { name, sort_order });
  return NextResponse.json({ category });
}

export async function DELETE(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await deleteCategory(id);
  return NextResponse.json({ success: true });
}
