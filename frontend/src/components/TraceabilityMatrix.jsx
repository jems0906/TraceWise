export default function TraceabilityMatrix({ matrix }) {
  return (
    <section className="card">
      <h2>Traceability Matrix</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>User Story</th>
              <th>Task</th>
              <th>Test Case</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, idx) => (
              <tr key={`${row.requirement_id}-${idx}`}>
                <td>#{row.requirement_id} {row.requirement_title}</td>
                <td>{row.user_story}</td>
                <td>{row.task}</td>
                <td>{row.test_case}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {matrix.length === 0 && <p>No traceability links captured yet.</p>}
    </section>
  );
}
