import React from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';

interface AutocorrelationData {
  x: number[];
  y: number[];
}

interface TrendData {
  smoothedSeries: number[];
}

interface MarkovData {
  steadyStateProbs: number[];
}

interface AnalysisChartsProps {
  autocorrelation?: AutocorrelationData;
  trend?: TrendData;
  markov?: MarkovData;
}

const AnalysisCharts: React.FC<AnalysisChartsProps> = ({ autocorrelation, trend, markov }) => {
  const autocorrelationChartData = autocorrelation ? {
    labels: autocorrelation.x.map(x => x.toString()),
    datasets: [
      {
        label: 'Autocorrelation',
        data: autocorrelation.y,
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
      },
    ],
  } : null;

  const trendChartData = trend ? {
    labels: trend.smoothedSeries.slice(-50).map((_, i) => i.toString()),
    datasets: [
      {
        label: 'Smoothed Trend',
        data: trend.smoothedSeries.slice(-50),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
    ],
  } : null;

  const markovChartData = markov ? {
    labels: markov.steadyStateProbs.map((_, i) => i.toString()),
    datasets: [
      {
        label: 'Steady State Probabilities',
        data: markov.steadyStateProbs,
        backgroundColor: 'rgba(245, 101, 101, 0.7)',
        borderColor: 'rgba(245, 101, 101, 1)',
        borderWidth: 1,
      },
    ],
  } : null;

  return (
    <div className="space-y-6">
      {autocorrelationChartData && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Autocorrelation Analysis</h3>
          <Line
            data={autocorrelationChartData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Autocorrelation Function' },
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Correlation' } },
                x: { title: { display: true, text: 'Lag' } },
              },
            }}
          />
        </div>
      )}

      {trendChartData && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Trend Analysis</h3>
          <Line
            data={trendChartData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Exponential Smoothing Trend' },
              },
              scales: {
                y: { title: { display: true, text: 'Value' } },
                x: { title: { display: true, text: 'Time' } },
              },
            }}
          />
        </div>
      )}

      {markovChartData && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Markov Chain Steady State</h3>
          <Bar
            data={markovChartData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Steady State Probabilities' },
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Probability' } },
                x: { title: { display: true, text: 'Number' } },
              },
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AnalysisCharts;
