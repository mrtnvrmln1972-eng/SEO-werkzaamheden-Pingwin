#!/usr/bin/env python3
"""Vult groeiplan-template.html met base64-beelden en SVG-iconen."""
import base64

def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()

ICONS = {
  "IC_USER":   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
  "IC_DOC":    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>',
  "IC_CAL":    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>',
  "IC_EURO":   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 6.5A7 7 0 0 0 7.5 9M17 17.5A7 7 0 0 1 7.5 15M5 10.5h8M5 13.5h8"/></svg>',
  "IC_CLICK":  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v3M4.2 4.2l2.1 2.1M3 9h3"/><path d="M10 10l9 3.5-4 1.5-1.5 4z"/></svg>',
  "IC_TARGET": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  "IC_CHART":  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16"/><path d="M6 16v-4M11 16V8M16 16v-6M21 16V5"/></svg>',
  "IC_ROCKET": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M12 15l-3-3c1-4 4-8 10-9-.5 6-5 9-7 12z"/><circle cx="14.5" cy="9.5" r="1.4"/></svg>',
  "IC_CHECK":  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  "IC_CURSOR": '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l7 18 2.5-7.5L22 11z"/></svg>',
  "IC_DB":     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5V18.5c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
}

html = open("groeiplan-template.html", encoding="utf-8").read()
html = html.replace("{{LOGO}}", b64("/root/.claude/skills/pingwin-huisstijl/assets/Zzz_Pingwin_Logo.jpg", "image/jpeg"))
html = html.replace("{{HERO}}", b64("tudor-hero-small.jpg", "image/jpeg"))
html = html.replace("{{MAARTEN}}", b64("maarten.jpg", "image/jpeg"))
html = html.replace("{{SCREENSHOT}}", b64("pdfimg-p2-0.png", "image/png"))
for k, v in ICONS.items():
    html = html.replace("{{" + k + "}}", v)
assert "{{" not in html, "placeholder niet vervangen"
open("Google-Ads-Groeiplan-Tudor-Kozijnen.html", "w", encoding="utf-8").write(html)
print("HTML gegenereerd")
