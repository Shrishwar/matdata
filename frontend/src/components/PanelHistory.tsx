import { useEffect, useState } from 'react';

interface PanelHistoryProps {
  panel: string;
}

export default function PanelHistory({ panel }: PanelHistoryProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/history?panel=${encodeURIComponent(panel)}&limit=100`);
      const data = await resp.json();
      setItems(Array.isArray(data) ? data : (data.history || []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [panel]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">History — {panel}</h3>
        <button className="text-sm text-blue-600" onClick={load}>Refresh</button>
      </div>
      {loading ? (
        <div className="py-8 text-center">Loading…</div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Open</th>
                <th className="px-3 py-2 text-left">Middle</th>
                <th className="px-3 py-2 text-left">Close</th>
                <th className="px-3 py-2 text-left">Double</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.drawId} className="border-t">
                  <td className="px-3 py-2">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{r.open3 || r.open3d}</td>
                  <td className="px-3 py-2">{r.middle}</td>
                  <td className="px-3 py-2">{r.close3 || r.close3d}</td>
                  <td className="px-3 py-2">{r.double}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


