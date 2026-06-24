// Gedeelde constante, bruikbaar in zowel Node- als Edge-runtime
// (geen crypto-import, zodat de middleware op de Edge blijft werken).
export const SESSION_COOKIE = "client_session";
