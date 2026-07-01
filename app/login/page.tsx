"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Kom je hier via een mail-link (?fresh=1), wis dan een eventuele oude
  // klant-sessie, zodat je een schone login krijgt en niet die van een andere klant.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("fresh")) {
      fetch("/api/logout", { method: "POST" }).catch(() => {});
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json();
      if (data.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Inloggen mislukt.");
        setBusy(false);
      }
    } catch {
      setError("Kon niet inloggen. Probeer het opnieuw.");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
        <h1>Pingwin SEO Dashboard</h1>
        <p className="sub">Log in om je maandoverzicht te bekijken.</p>

        <label htmlFor="loginId">Inlognaam</label>
        <input
          id="loginId"
          type="text"
          autoComplete="username"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          required
        />

        <label htmlFor="password">Wachtwoord</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={busy}>
          {busy ? "Bezig..." : "Inloggen"}
        </button>

        {error && <div className="login-error">{error}</div>}
      </form>
    </div>
  );
}
