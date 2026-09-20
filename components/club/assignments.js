"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  useData,
  Heading,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  DateText,
} from "./ui";
export default function Assignments() {
  const { data, error } = useData("assignments"),
    [filter, setFilter] = useState("All"),
    [failure, setFailure] = useState("");
  const router = useRouter();
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  const rows = data.filter((a) => filter === "All" || a.status === filter);
  return (
    <>
      <Heading
        title="A little structure. A clear next step."
        eyebrow="TEST PAPERS / ASSIGNMENTS"
        description="Your study-group papers, deadlines and submissions in one place."
      />
      <div className="toolbar">
        <select
          aria-label="Assignment status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All", "Open", "In progress", "Submitted", "Overdue"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Link className="text-link" href="/results">
          All results →
        </Link>
      </div>
      <ErrorBox error={failure} />
      {rows.length ? (
        <div className="subject-grid">
          {rows.map((a) => (
            <section className="card" key={a.id}>
              <div className="section-heading">
                <Badge>{a.subject}</Badge>
                <Badge>{a.status}</Badge>
              </div>
              <h2>{a.title}</h2>
              <Link className="text-link" href={"/groups/" + a.group_id}>
                {a.group_name} ↗
              </Link>
              <p className="muted spaced">
                Due: <DateText value={a.due_at} />
                <br />
                {a.completion_count} students submitted
                {a.average !== null && (
                  <>
                    <br />
                    Group average: {a.average}%
                  </>
                )}
              </p>
              {a.marking_id ? (
                <Link
                  className="button secondary"
                  href={"/results/" + a.marking_id}
                >
                  Review my result →
                </Link>
              ) : (
                <button
                  disabled={a.status === "Overdue"}
                  onClick={async () => {
                    try {
                      const r = await api("attempts", {
                        versionId: a.version_id,
                        assignmentId: a.id,
                      });
                      router.push("/attempts/" + r.id);
                    } catch (e) {
                      setFailure(e.message);
                    }
                  }}
                >
                  {a.status === "In progress"
                    ? "Continue attempt"
                    : "Attempt paper"}{" "}
                  →
                </button>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="Your shared work will be here."
          href="/groups"
          label="Find your study group"
        >
          When a group posts a paper, you can track it here.
        </Empty>
      )}
    </>
  );
}
