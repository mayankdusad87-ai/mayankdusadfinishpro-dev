'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { parseExcelToConfig, saveActivityConfig, getActivityConfig, ActivityConfig } from '@/lib/activity-config-store';

export default function ExcelUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<ActivityConfig>(() => getActivityConfig());
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      setPreviewRows(rows.slice(0, 5));

      const parsed = parseExcelToConfig(rows);
      saveActivityConfig(parsed);
      setConfig(parsed);
      setUploading(false);
    };
    reader.readAsArrayBuffer(file);
  }

  function clearConfig() {
    const empty: ActivityConfig = { stages: [], subStages: {}, activities: {} };
    saveActivityConfig(empty);
    setConfig(empty);
    setPreviewRows([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const hasData = config.stages.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Upload Activity Master</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload an Excel file with columns: <span className="font-medium">Stage</span>, <span className="font-medium">Sub Stage</span>, <span className="font-medium">Activity</span>
          </p>
        </div>
        {hasData && (
          <button
            onClick={clearConfig}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Clear Data
          </button>
        )}
      </div>

      {/* Upload area */}
      <label className="block cursor-pointer mb-5">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          className="hidden"
        />
        <div className={`flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-xl transition-colors ${
          uploading ? 'border-primary bg-orange-50' : 'border-gray-300 hover:border-primary hover:bg-orange-50/30'
        }`}>
          {uploading ? (
            <svg className="w-8 h-8 text-primary animate-spin mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          )}
          <span className="text-sm font-medium text-gray-700">
            {fileName || 'Click to upload Excel / CSV file'}
          </span>
          <span className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv</span>
        </div>
      </label>

      {/* Preview rows */}
      {previewRows.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Preview (first 5 rows)</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {Object.keys(previewRows[0]).map(key => (
                      <th key={key} className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Parsed summary */}
      {hasData && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-sm font-semibold text-green-800">Configuration Loaded</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-gray-900">{config.stages.length}</div>
              <div className="text-xs text-gray-500">Stages</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-gray-900">
                {Object.values(config.subStages).reduce((sum, arr) => sum + arr.length, 0)}
              </div>
              <div className="text-xs text-gray-500">Sub Stages</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-gray-900">
                {Object.values(config.activities).reduce((sum, arr) => sum + arr.length, 0)}
              </div>
              <div className="text-xs text-gray-500">Activities</div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {config.stages.map(stage => (
              <div key={stage} className="text-sm">
                <span className="font-medium text-gray-800">{stage}</span>
                <span className="text-gray-400 ml-2">
                  ({config.subStages[stage]?.length || 0} sub stages)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
