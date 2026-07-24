'use client';

import AuditLogTable from '@/components/admin/AuditLogTable';
import { auditLog } from '@/lib/mock-data';

export default function AuditLogPage() {
  return <AuditLogTable entries={auditLog} />;
}
