import type { ActivityRow } from '@/types/database.types';
import { getAllFilteredActivities } from '@/repositories/activity-repo';
import { formatDate, todayISO } from '@/lib/utils';

export type ExportFilters = {
  floor?: string;
  stage?: string;
  stageGate?: string;
  vendor?: string;
  status?: string;
};

export async function exportToExcel(
  projectId: string,
  projectName: string,
  filters: ExportFilters,
): Promise<{ count: number }> {
  const [XLSX, rows] = await Promise.all([
    import('xlsx'),
    getAllFilteredActivities(projectId, filters),
  ]);

  const wsData = [
    ['Floor', 'Flat No.', 'Config', 'Stage', 'Stage Gate', 'Activity', 'Vendor', 'Exp. Start', 'Exp. End', 'Rev. Start', 'Rev. End', 'Act. Start', 'Act. End', 'Status', 'Delay Days', 'Delay Reason', 'Remarks'],
    ...rows.map(r => [
      r.floor, r.flat_number, r.configuration || '', r.stage, r.stage_gate || '', r.activity,
      r.vendor || '', formatDate(r.expected_start), formatDate(r.expected_end),
      formatDate(r.revised_start), formatDate(r.revised_end),
      formatDate(r.actual_start), formatDate(r.actual_end),
      r.status, r.delay_days || 0, r.delay_reason || '', r.remarks || '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Activities');
  XLSX.writeFile(wb, `${projectName}_Activities_${todayISO()}.xlsx`);

  return { count: rows.length };
}

export async function exportToPDF(
  projectId: string,
  projectName: string,
  filters: ExportFilters,
): Promise<{ count: number }> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const rows = await getAllFilteredActivities(projectId, filters);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(`${projectName} — Activity Report`, 14, 15);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [['Floor', 'Flat', 'Stage', 'Stage Gate', 'Activity', 'Vendor', 'Exp Start', 'Exp End', 'Rev Start', 'Rev End', 'Status', 'Delay']],
    body: rows.map(r => [
      String(r.floor ?? ''), String(r.flat_number ?? ''), String(r.stage ?? ''), String(r.stage_gate || ''), String(r.activity ?? ''),
      String(r.vendor || ''), formatDate(r.expected_start), formatDate(r.expected_end),
      formatDate(r.revised_start), formatDate(r.revised_end),
      String(r.status ?? ''), (r.delay_days ?? 0) > 0 ? `${r.delay_days}d` : '',
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [230, 126, 34], fontSize: 7 },
  });

  doc.save(`${projectName}_Activities_${todayISO()}.pdf`);

  return { count: rows.length };
}
