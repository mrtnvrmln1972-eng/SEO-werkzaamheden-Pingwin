import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionValue } from "../lib/auth";

export default function Home() {
  const value = cookies().get(SESSION_COOKIE)?.value;
  const slug = verifySessionValue(value);
  redirect(slug ? "/dashboard" : "/login");
}
