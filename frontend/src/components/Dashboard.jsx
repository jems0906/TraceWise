import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function Dashboard({ summary }) {
  const priorityLabels = Object.keys(summary.by_priority || {});
  const statusLabels = Object.keys(summary.by_status || {});

  return (
    <section className="card">
      <h2>Coverage Dashboard</h2>
      <div className="kpi-grid">
        <div className="kpi">
          <span>Total Requirements</span>
          <strong>{summary.total_requirements || 0}</strong>
        </div>
        <div className="kpi">
          <span>Trace Coverage</span>
          <strong>{summary.trace_coverage_percent || 0}%</strong>
        </div>
      </div>

      <div className="charts">
        <div className="chart-box">
          <Bar
            data={{
              labels: priorityLabels,
              datasets: [
                {
                  label: "By Priority",
                  data: priorityLabels.map((l) => summary.by_priority[l]),
                  backgroundColor: "#2a9d8f",
                },
              ],
            }}
          />
        </div>
        <div className="chart-box">
          <Doughnut
            data={{
              labels: statusLabels,
              datasets: [
                {
                  label: "By Status",
                  data: statusLabels.map((l) => summary.by_status[l]),
                  backgroundColor: ["#264653", "#e9c46a", "#f4a261", "#e76f51"],
                },
              ],
            }}
          />
        </div>
      </div>
    </section>
  );
}
