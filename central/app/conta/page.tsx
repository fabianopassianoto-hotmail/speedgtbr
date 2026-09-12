import {AuthScreen} from "@/components/auth-screen";
import {authConfig} from "@/lib/auth-provider";
export const dynamic="force-dynamic";
export default function Account(){return <AuthScreen configured={Boolean(authConfig())} account/>}
