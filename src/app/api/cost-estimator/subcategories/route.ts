import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory } from '@/repositories/cost-repo';

export async function GET(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const categoryId = req.nextUrl.searchParams.get('categoryId');
  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId required' }, { status: 400 });
  }

  const subcategories = await getSubcategories(categoryId);
  return NextResponse.json({ subcategories });
}

export async function POST(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { categoryId, name, sortOrder } = await req.json();
  if (!categoryId || !name) {
    return NextResponse.json({ error: 'categoryId and name required' }, { status: 400 });
  }

  const subcategory = await createSubcategory(categoryId, name, sortOrder);
  return NextResponse.json({ subcategory }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { id, name, sort_order } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const subcategory = await updateSubcategory(id, { name, sort_order });
  return NextResponse.json({ subcategory });
}

export async function DELETE(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await deleteSubcategory(id);
  return NextResponse.json({ success: true });
}
