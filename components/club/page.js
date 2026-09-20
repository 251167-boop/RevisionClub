"use client";
import { Dashboard, Results, Study, Mistakes, Profile } from "./progress";
import { Library, CreatePaper, PaperDetail, Attempt } from "./papers";
import Assignments from "./assignments";
import { Groups, Friends, Leaderboard, Challenges } from "./social";
import { Timetable } from "./practice";
import Games from "./games";
import Search from "./search";
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
    default:
      return null;
  }
}
