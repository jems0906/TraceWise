import { useEffect, useState } from "react";

export default function RequirementDetail({
  requirement,
  canWrite,
  onClarify,
  clarification,
  duplicateIds,
  onDuplicateCheck,
  onSave,
  onAddTrace,
  traceLinks,
  versions,
}) {
  const [edit, setEdit] = useState(null);
  const [trace, setTrace] = useState({ user_story: "", task: "", test_case: "" });

  useEffect(() => {
    setEdit(requirement ? { ...requirement, change_note: "Updated from UI" } : null);
  }, [requirement]);

  if (!requirement || !edit) {
    return (
      <section className="card">
        <h2>Requirement Details</h2>
        <p>Select a requirement to inspect and manage traceability.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Requirement Details</h2>
      <div className="stack">
        <label>
          Title
          <input value={edit.title} disabled={!canWrite} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
        </label>
        <label>
          Business Requirement
          <textarea
            rows={3}
            value={edit.business_requirement}
            disabled={!canWrite}
            onChange={(e) => setEdit({ ...edit, business_requirement: e.target.value })}
          />
        </label>
        <label>
          Functional Requirement
          <textarea
            rows={3}
            value={edit.functional_requirement}
            disabled={!canWrite}
            onChange={(e) => setEdit({ ...edit, functional_requirement: e.target.value })}
          />
        </label>
        <label>
          Non-Functional Requirement
          <textarea
            rows={3}
            value={edit.non_functional_requirement}
            disabled={!canWrite}
            onChange={(e) => setEdit({ ...edit, non_functional_requirement: e.target.value })}
          />
        </label>
        <label>
          User Story
          <textarea
            rows={3}
            value={edit.user_story}
            disabled={!canWrite}
            onChange={(e) => setEdit({ ...edit, user_story: e.target.value })}
          />
        </label>

        <button onClick={() => onSave(requirement.id, edit)} disabled={!canWrite}>Save And Version</button>

        <div className="toolbar">
          <button onClick={() => onClarify(requirement.id)} disabled={!canWrite}>AI Clarification</button>
          <button onClick={() => onDuplicateCheck(requirement.id)}>Find Duplicates</button>
        </div>

        {clarification && (
          <div className="panel">
            <h3>Clarification</h3>
            <p>Missing: {clarification.missing_information.join(" | ") || "None"}</p>
            <p>Questions: {clarification.clarification_questions.join(" | ")}</p>
            <p>Ambiguity: {clarification.ambiguity_flags.join(" | ") || "None"}</p>
            <p>Risks: {clarification.potential_risks.join(" | ") || "None"}</p>
          </div>
        )}

        <div className="panel">
          <h3>Potential Duplicates</h3>
          <p>{duplicateIds.length ? duplicateIds.join(", ") : "No duplicates found"}</p>
        </div>

        <div className="panel">
          <h3>Add Trace Link</h3>
          <label>
            User Story
            <input value={trace.user_story} disabled={!canWrite} onChange={(e) => setTrace({ ...trace, user_story: e.target.value })} />
          </label>
          <label>
            Task
            <input value={trace.task} disabled={!canWrite} onChange={(e) => setTrace({ ...trace, task: e.target.value })} />
          </label>
          <label>
            Test Case
            <input value={trace.test_case} disabled={!canWrite} onChange={(e) => setTrace({ ...trace, test_case: e.target.value })} />
          </label>
          <button
            disabled={!canWrite}
            onClick={async () => {
              await onAddTrace(requirement.id, trace);
              setTrace({ user_story: "", task: "", test_case: "" });
            }}
          >
            Add Link
          </button>
        </div>

        <div className="panel">
          <h3>Trace Links</h3>
          {traceLinks.map((t) => (
            <p key={t.id}>{t.user_story} {"->"} {t.task} {"->"} {t.test_case} ({t.created_by || "system"})</p>
          ))}
          {traceLinks.length === 0 && <p>No trace links yet.</p>}
        </div>

        <div className="panel">
          <h3>Version History</h3>
          {versions.map((v) => (
            <p key={`${v.version}-${v.created_at}`}>v{v.version}: {v.change_note} ({v.created_by || "system"})</p>
          ))}
          {versions.length === 0 && <p>No version records found.</p>}
        </div>
      </div>
    </section>
  );
}
