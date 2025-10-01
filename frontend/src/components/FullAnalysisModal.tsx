import { useState } from 'react';
import { predictionApi } from '../services/api';

interface FullAnalysisModalProps {
  panel: string;
}

export default function FullAnalysisModal({ panel }: FullAnalysisModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const runFull = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/predictions/full?panel=${encodeURIComponent(panel)}`, {
        method: 'POST'
      });
      const json = await resp.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); runFull(); }}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Full Analysis
      </button>
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-4xl rounded shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">Full Analysis ({panel})</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500">✕</button>
            </div>
            {loading ? (
              <div className="py-12 text-center">Running pipeline…</div>
            ) : data ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">Top Picks</h3>
                  <ul className="list-disc list-inside text-sm">
                    {data.top.map((t: any, i: number) => (
                      <li key={i}>{String(t.number).padStart(2, '0')} — {Math.round(t.confidence)}%</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Provenance</h3>
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(data.provenance, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-600">No data</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


