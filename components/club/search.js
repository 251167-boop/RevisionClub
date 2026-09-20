"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, Heading, Loading, Empty, Badge } from "./ui";

export default function Search() {
  const params = useSearchParams(),
    initial = params.get("q") || "",
    [query, setQuery] = useState(initial),
    { data, error } = useData(
      initial.trim().length >= 2 ? `search?q=${encodeURIComponent(initial)}` : null,
    );
  return (
    <>
      <Heading
        eyebrow="SEARCH / EVERYTHING IN ONE PLACE"
        title="Find your next step."
        description="Search papers, subjects, groups, assignments and students."
      />
      <form className="card search-page" action="/search">
        <label>
          Search Revision Club
          <input
            autoFocus
            name="q"
            type="search"
            minLength={2}
            required
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try a topic, paper, group or username…"
          />
        </label>
        <button>Search →</button>
      </form>
      {error ? <p role="alert">{error}</p> : initial.length < 2 ? (
        <Empty title="What are you looking for?">Enter at least two characters.</Empty>
      ) : !data ? (
        <Loading />
      ) : data.length ? (
        <section className="card spaced" aria-live="polite">
          <h2>{data.length} result{data.length === 1 ? "" : "s"}</h2>
          {data.map((item, index) => (
            <Link className="search-result" href={item.href} key={`${item.type}-${item.title}-${index}`}>
              <Badge>{item.type}</Badge>
              <span><b>{item.title}</b><small>{item.detail}</small></span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </section>
      ) : (
        <Empty title="No matching results.">Try a broader word or a subject name.</Empty>
      )}
    </>
  );
}
