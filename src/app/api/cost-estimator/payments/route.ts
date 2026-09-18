import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { getPaymentsByProject, createPayment, deletePayment } from '@/repositories/cost-repo';

export async function GET(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const payments = await getPaymentsByProject(projectId);
  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const { categoryId, cost_type, amount, payment_date, note } = await req.json();
  if (!categoryId || !cost_type || !amount) {
    return NextResponse.json({ error: 'categoryId, cost_type, and amount required' }, { status: 400 });
  }

  const payment = await createPayment(categoryId, {
    cost_type,
    amount,
    payment_date: payment_date || new Date().toISOString().split('T')[0],
    note,
    created_by: result.userId,
  });
  return NextResponse.json({ payment }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const result = await verifyAdmin(req, ['admin']);
  if (result.error) return result.error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await deletePayment(id);
  return NextResponse.json({ success: true });
}
