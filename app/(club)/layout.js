import {verifyAuth} from '@/lib/auth';
import {redirect} from 'next/navigation';
import Shell from '@/components/club/shell';
export default async function Layout({children}){const {user}=await verifyAuth();if(!user)redirect('/signIn?mode=login');return <Shell user={user}>{children}</Shell>;}
