import {AuthScreen} from "@/components/auth-screen";
import {authConfig} from "@/lib/auth-provider";
export const dynamic="force-dynamic";
export default function Login(){return <AuthScreen configured={Boolean(authConfig())}/>}
