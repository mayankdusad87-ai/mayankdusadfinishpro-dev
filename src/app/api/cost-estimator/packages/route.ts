import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { getPackages, createPackage, updatePackage, deletePackage } from '@/repositories/cost-repo';

export async function GET(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const packages = await getPackages(projectId);
  return NextResponse.json({ packages });
}

export async function POST(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { projectId, name, sortOrder } = await req.json();
  if (!projectId || !name) {
    return NextResponse.json({ error: 'projectId and name required' }, { status: 400 });
  }

  const pkg = await createPackage(projectId, name, sortOrder);
  return NextResponse.json({ package: pkg }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { id, name, sort_order } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const pkg = await updatePackage(id, { name, sort_order });
  return NextResponse.json({ package: pkg });
}

export async function DELETE(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await deletePackage(id);
  return NextResponse.json({ success: true });
}
