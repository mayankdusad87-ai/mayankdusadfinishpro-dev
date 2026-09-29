import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { getFullProjectCostData } from '@/repositories/cost-repo';

export async function GET(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const data = await getFullProjectCostData(projectId);
  return NextResponse.json(data);
}
