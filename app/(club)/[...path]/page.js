import ClubPage from '@/components/club/page';
import {notFound} from 'next/navigation';
const routes=['dashboard','papers','community','assignments','results','attempts','study','mistakes','timetable','minigames','groups','friends','chats','leaderboard','profile','settings','challenges','search'];
export default async function Page(props) {
  const params = await props.params;
  if(!routes.includes(params.path[0]))notFound();return <ClubPage path={params.path}/>;
}
