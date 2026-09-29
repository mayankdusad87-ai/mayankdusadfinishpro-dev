import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { getActivities, createActivity, updateActivity, deleteActivity } from '@/repositories/cost-repo';

export async function GET(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const subcategoryId = req.nextUrl.searchParams.get('subcategoryId');
  if (!subcategoryId) {
    return NextResponse.json({ error: 'subcategoryId required' }, { status: 400 });
  }

  const activities = await getActivities(subcategoryId);
  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { subcategoryId, ...item } = await req.json();
  if (!subcategoryId || !item.name) {
    return NextResponse.json({ error: 'subcategoryId and name required' }, { status: 400 });
  }

  const activity = await createActivity(subcategoryId, item);
  return NextResponse.json({ activity }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { id, ...updates } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const activity = await updateActivity(id, updates);
  return NextResponse.json({ activity });
}

export async function DELETE(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await deleteActivity(id);
  return NextResponse.json({ success: true });
}
