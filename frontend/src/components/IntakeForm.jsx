import { useState } from "react";

const priorities = ["Low", "Medium", "High", "Critical"];

export default function IntakeForm({ onSubmit, canWrite }) {
  const [stakeholder, setStakeholder] = useState("Business Team");
  const [priority, setPriority] = useState("Medium");
  const [rawInput, setRawInput] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!rawInput.trim()) return;

    await onSubmit({ stakeholder, priority, raw_input: rawInput });
    setRawInput("");
  };

  return (
    <section className="card">
      <h2>Stakeholder Requirement Intake</h2>
      <p className="muted">Capture stakeholder language, then let the backend turn it into structured requirement artifacts.</p>
      <form className="stack" onSubmit={submit}>
        <label>
          Stakeholder
          <input value={stakeholder} onChange={(e) => setStakeholder(e.target.value)} />
        </label>

        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label>
          Raw Business Need
          <textarea
            rows={6}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Example: We need a single dashboard for monthly compliance reporting with role-based access."
          />
        </label>

        <button type="submit" disabled={!canWrite}>Analyze And Create Requirement</button>
      </form>
    </section>
  );
}
