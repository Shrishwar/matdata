import React from 'react';

interface PredictionTableItem {
  number: string;
  frequency: number;
  transitionProb: number;
  mlProb: number;
  trendWeight: number;
  monteOccur: number;
  finalScore: number;
  confidence: number;
}

interface PredictionTableProps {
  data: PredictionTableItem[];
}

const PredictionTable: React.FC<PredictionTableProps> = ({ data }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Ensemble Prediction Table</h3>
      <p className="text-sm text-gray-500 mb-4">
        Combined scores from all analysis methods
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transition</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ML Prob</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Monte Carlo</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Final Score</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.number} className="border-t">
                <td className="px-4 py-2 text-sm font-medium">{item.number}</td>
                <td className="px-4 py-2 text-sm">{item.frequency.toFixed(3)}</td>
                <td className="px-4 py-2 text-sm">{item.transitionProb.toFixed(3)}</td>
                <td className="px-4 py-2 text-sm">{item.mlProb.toFixed(3)}</td>
                <td className="px-4 py-2 text-sm">{item.trendWeight}</td>
                <td className="px-4 py-2 text-sm">{item.monteOccur.toFixed(1)}%</td>
                <td className="px-4 py-2 text-sm">{item.finalScore.toFixed(3)}</td>
                <td className="px-4 py-2 text-sm">{item.confidence.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PredictionTable;
