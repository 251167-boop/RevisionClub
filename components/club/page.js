"use client";
import { Dashboard, Results, Study, Mistakes, Profile } from "./progress";
import { Library, CreatePaper, PaperDetail, Attempt } from "./papers";
import Assignments from "./assignments";
import { Groups, Friends, Leaderboard, Challenges } from "./social";
import { Timetable } from "./practice";
import Games from "./games";
import Search from "./search";
import { Heading } from "./ui";
function UnderConstruction({ area = "This page" }) {
  return (
    <>
      <Heading
        eyebrow="COMING SOON"
        title="A little more growing to do."
        description={`${area} is under construction. Your existing work is safe, and this space will appear here when it is ready.`}
      />
      <section className="card under-construction" role="status">
        <span aria-hidden="true">✦</span>
        <div>
          <h2>We’re shaping this part of Revision Club.</h2>
          <p className="muted">
            Please use the available study and profile pages in the meantime.
          </p>
        </div>
      </section>
    </>
  );
}
export default function ClubPage({ path }) {
  const [route, id] = path;
  switch (route) {
    case "dashboard":
      return <Dashboard />;
    case "papers":
      return id === "create" ? (
        <CreatePaper />
      ) : id ? (
        <PaperDetail id={id} />
      ) : (
        <Library />
      );
    case "community":
      return <Library community />;
    case "attempts":
      return <Attempt id={id} />;
    case "results":
      return <Results id={id} />;
    case "study":
      return <Study />;
    case "mistakes":
      return <Mistakes />;
    case "profile":
      return <Profile />;
    case "settings":
      return <Profile settings />;
    case "groups":
      return <Groups id={id} />;
    case "assignments":
      return <Assignments />;
    case "friends":
      return <Friends />;
    case "chats":
      return <Friends chatId={id} />;
    case "leaderboard":
      return <Leaderboard />;
    case "challenges":
      return <Challenges />;
    case "timetable":
      return <Timetable />;
    case "minigames":
      return <Games />;
    case "search":
      return <Search />;
    case "progress":
      return <UnderConstruction area="The dedicated Progress page" />;
    default:
      return <UnderConstruction />;
  }
}
