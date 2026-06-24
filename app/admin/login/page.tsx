"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        router.replace("/admin");
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
        <h1>Beheer</h1>
        <p className="sub">Adminscherm Pingwin SEO Dashboard.</p>

        <label htmlFor="password">Adminwachtwoord</label>
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
