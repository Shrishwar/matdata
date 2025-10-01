import { useState } from 'react';
import { predictionApi } from '../services/api';

interface PredictNowButtonProps {
  panel: string;
  onResult: (data: any) => void;
}

export default function PredictNowButton({ panel, onResult }: PredictNowButtonProps) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    try {
      setLoading(true);
      const resp = await predictionApi.getCombined(5, panel);
      if (resp.success) onResult(resp.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={loading}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
    >
      {loading ? 'Predicting…' : 'Predict Now'}
    </button>
  );
}


