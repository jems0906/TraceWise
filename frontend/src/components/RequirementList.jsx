export default function RequirementList({ requirements, selectedId, onSelect }) {
  return (
    <section className="card">
      <h2>Requirements</h2>
      <div className="list">
        {requirements.map((req) => (
          <button
            key={req.id}
            className={`list-item ${selectedId === req.id ? "active" : ""}`}
            onClick={() => onSelect(req.id)}
          >
            <span className="list-title">#{req.id} {req.title}</span>
            <span className="badge">{req.priority}</span>
          </button>
        ))}
        {requirements.length === 0 && <p>No requirements yet.</p>}
      </div>
    </section>
  );
}
