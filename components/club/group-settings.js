"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ActionForm, ErrorBox } from "./ui";
import rules from "@/lib/club/rules.cjs";
export default function GroupSettings({ group, userId, reload }) {
  const router = useRouter(),
    [subjects, setSubjects] = useState(group.subjects),
    [error, setError] = useState("");
  const owner = group.role === "Owner",
    admin = group.role !== "Member";
  async function act(body, leave = false) {
    setError("");
    try {
      await api("action", { ...body, groupId: group.id });
      if (leave) router.push("/groups");
      else reload();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="card">
      <h2>Group settings</h2>
      <ErrorBox error={error} />
      {admin && (
        <ActionForm
          onSubmit={async (b) => {
            await api("action", {
              action: "groupSettings",
              groupId: group.id,
              ...b,
              subjects,
            });
            reload();
          }}
        >
          <label>
            Group name
            <input
              name="name"
              defaultValue={group.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={group.description}
              maxLength={1000}
            />
          </label>
          <label>Allowed subjects</label>
          <div className="chips">
            {rules.SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                className={"chip " + (subjects.includes(s) ? "selected" : "")}
                onClick={() =>
                  setSubjects((xs) =>
                    xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s],
                  )
                }
              >
                {s}
              </button>
            ))}
          </div>
          <button className="secondary spaced">Save group settings</button>
        </ActionForm>
      )}
      {admin && (
        <div className="spaced">
          <h3>Manage members</h3>
          {group.members
            .filter((m) => m.id !== userId && m.role !== "Owner")
            .map((m) => (
              <div className="list-row" key={m.id}>
                <span>
                  {m.username} · {m.role}
                </span>
                <button
                  className="secondary"
                  disabled={!owner && m.role === "Admin"}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${m.username} from this group? Their existing submissions will be retained.`,
                      )
                    )
                      act({ action: "groupRemoveMember", userId: m.id });
                  }}
                >
                  Remove member
                </button>
              </div>
            ))}
        </div>
      )}
      {owner && (
        <details className="spaced">
          <summary>Ownership & deletion</summary>
          <ActionForm
            onSubmit={async (b) => {
              if (
                !window.confirm(
                  "Transfer ownership? You will remain an admin, and the new owner will control the group.",
                )
              )
                return;
              await api("action", {
                action: "groupTransfer",
                groupId: group.id,
                userId: +b.userId,
              });
              reload();
            }}
          >
            <label>
              New owner
              <select name="userId" required>
                <option value="">Choose a member</option>
                {group.members
                  .filter((m) => m.id !== userId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.username}
                    </option>
                  ))}
              </select>
            </label>
            <button className="secondary">Transfer ownership</button>
          </ActionForm>
          <p className="small muted spaced">
            Deleting closes the group and invalidates its invite. Learning
            records are retained for score history.
          </p>
          <button
            className="secondary"
            onClick={() => {
              if (
                window.confirm(
                  "Delete this group? Members will lose access to its shared workspace.",
                )
              )
                act({ action: "groupDelete", confirm: true }, true);
            }}
          >
            Delete group
          </button>
        </details>
      )}
      {!owner && (
        <button
          className="secondary spaced"
          onClick={() => {
            if (window.confirm("Leave this study group?"))
              act({ action: "groupLeave" }, true);
          }}
        >
          Leave group
        </button>
      )}
    </section>
  );
}
