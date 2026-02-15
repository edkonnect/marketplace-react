import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

interface PaymentStatusChartProps {
  data: {
    completed: number;
    pending: number;
    failed: number;
  };
}

export function PaymentStatusChart({ data }: PaymentStatusChartProps) {
  const chartData = {
    labels: ['Paid', 'Pending', 'Failed'],
    datasets: [
      {
        data: [data.completed, data.pending, data.failed],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(234, 179, 8)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${label}: ${value} (${percentage}%)`;
          }
        },
      },
    },
    cutout: '60%',
  };

  return (
    <div className="h-[300px]">
      <Doughnut data={chartData} options={options} />
    </div>
  );
}
