// Edamam Random Recipe Viewer — No Tailwind, fetches many pages, shows ONE random recipe
// Usage:
// 1) Vite React app; save as src/App.jsx
// 2) .env:
//    VITE_EDAMAM_APP_ID=your_id
//    VITE_EDAMAM_APP_KEY=your_key
//    # Optional only if your Edamam app has Active User tracking enabled
//    VITE_EDAMAM_ACCOUNT_USER=demo-user-1
// 3) npm run dev
//
// Notes:
// - Fetches WITHOUT diet/health filters; you can hardcode them in buildBaseUrl().
// - Uses Edamam v2 pagination via _links.next.href to gather a larger pool, then picks 1 random recipe.
// - For production, proxy via a backend to avoid exposing keys in client JS.

import { useEffect, useMemo, useState } from "react";

const APP_ID = process.env.REACT_APP_EDAMAM_APP_ID;
const APP_KEY = process.env.REACT_APP_EDAMAM_APP_KEY;
const ACCOUNT_USER = process.env.REACT_APP_EDAMAM_ACCOUNT_USER;


function normalizeRecipe(r) {
  if (!r) return null;
  return {
    title: r?.label ?? "Untitled",
    // image: r?.images?.REGULAR?.url || r?.images?.SMALL?.url || r?.image || "",
    image: r?.image || "",
    url: r?.url ?? "#",
    source: r?.source ?? "",
  };
}

export default function App() {
  const [query, setQuery] = useState("salad"); // change default if you want
  const [pool, setPool] = useState([]); // normalized recipes
  const [index, setIndex] = useState(0); // random index into pool
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const current = useMemo(() => (pool.length ? pool[index] : null), [pool, index]);

  async function fetchRandom(q) {
    if (!APP_ID || !APP_KEY) {
      setError("Missing VITE_EDAMAM_APP_ID or VITE_EDAMAM_APP_KEY env vars.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const headers = {};
      if (ACCOUNT_USER) headers["Edamam-Account-User"] = ACCOUNT_USER; // required only if your app enables Active Users

      // Build base URL with only required params + field selection to shrink payload
      const firstUrl = buildBaseUrl(q);

      // Pull multiple pages using _links.next.href (v2 pagination)
      const maxPages = 5; // keep reasonable to avoid quota spikes
      const maxResults = 80; // target pool size
      let page = 0;
      let url = firstUrl;
      let hits = [];

      while (url && page < maxPages && hits.length < maxResults) {
        console.log(url);
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data?.hits)) hits = hits.concat(data.hits);
        url = data?._links?.next?.href || null; // follow server-provided next link
        page += 1;
      }

      const recipes = hits
        .map((h) => normalizeRecipe(h?.recipe))
        .filter(Boolean);

      if (recipes.length === 0) {
        setPool([]);
        setIndex(0);
        setError("No recipes found for that query.");
        return;
      }

      setPool(recipes);
      setIndex(Math.floor(Math.random() * recipes.length));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function buildBaseUrl(q) {
    const url = new URL("https://api.edamam.com/api/recipes/v2");
    url.searchParams.set("type", "public");
    url.searchParams.set("q", q || "");
    url.searchParams.set("app_id", APP_ID);
    url.searchParams.set("app_key", APP_KEY);

    // Optional: project only fields we need to reduce payload
    // url.searchParams.append("field", "label");
    // url.searchParams.append("field", "url");
    // url.searchParams.append("field", "images");
    // url.searchParams.append("field", "source");

    // If you want to hardcode filters later, append them here, e.g.:
    // url.searchParams.append("health", "low-sugar");
    // url.searchParams.append("diet", "high-fiber");

    return url.toString();
  }

  useEffect(() => {
    fetchRandom(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    fetchRandom(query);
  };

  const onShuffle = () => {
    if (!pool.length) return;
    let next = Math.floor(Math.random() * pool.length);
    // try to avoid repeating the same index if pool > 1
    if (pool.length > 1 && next === index) next = (next + 1) % pool.length;
    setIndex(next);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.h1}>Random Recipe</h1>
        <p style={styles.muted}>
          Fetches multiple pages from Edamam, then shows <strong>one random recipe</strong> (image + title + link).
        </p>

        <form onSubmit={onSubmit} style={styles.form}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search term (e.g., salad, chicken, quinoa)"
            style={styles.input}
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
          <button type="button" onClick={onShuffle} style={styles.secondary} disabled={loading || pool.length === 0}>
            New Random
          </button>
          <span style={styles.count} title="Number of recipes in pool">
            {pool.length ? `${pool.length} in pool` : ""}
          </span>
        </form>

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (<h1 style={{textAlign: "center"}}>
            {"Loading ..."}</h1>) : "" }

        {!current && !loading ? (
          <EmptyState />
        ) : current ? (
          <article style={styles.card}>
            <div style={ {margin: "0 auto", display: "block", width: "300px" } }>
            {current.image ? (
              <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open recipe: ${current.title}`}
                >
                  <img src={current.image} alt={current.title} style={styles.img} loading="lazy" />
                </a>
            ) : (
              <div style={{ ...styles.img, ...styles.noImage }}>No image</div>
            )}
            <div style={styles.cardBody}>
              <h2 style={styles.title}>{current.title}</h2>
              <div style={styles.row}>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.linkBtn}
                  aria-label={`Open recipe: ${current.title}`}
                >
                  Open Recipe ↗
                </a>
                {current.source && <span style={styles.source}>{current.source}</span>}
              </div>
            </div>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={styles.empty}>Search for anything, then click <strong>New Random</strong> to shuffle through the pool.</div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f6f7f9", color: "#111", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  container: { maxWidth: 720, margin: "0 auto" },
  h1: { fontSize: 28, fontWeight: 650, margin: 0 },
  muted: { color: "#5b5b5b", marginTop: 6 },
  form: { display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" },
  input: { flex: 1, minWidth: 240, padding: "10px 12px", borderRadius: 10, border: "1px solid #d0d7de", background: "#fff" },
  button: { padding: "10px 14px", borderRadius: 10, border: "1px solid transparent", background: "#2f66f5", color: "#fff", cursor: "pointer" },
  secondary: { padding: "10px 14px", borderRadius: 10, border: "1px solid #d0d7de", background: "#fff", color: "#111", cursor: "pointer" },
  count: { color: "#6b7280", fontSize: 12 },
  error: { marginTop: 12, padding: 12, background: "#fff0f0", border: "1px solid #ffd6d6", borderRadius: 12, color: "#b00020" },
  card: { marginLeft: "auto", marginRight: "auto", marginTop: 20, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  // img: { height: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" },
  noImage: { display: "grid", placeItems: "center", background: "#f0f2f5", color: "#777" },
  cardBody: { padding: 12, margin: "auto" },
  title: { fontSize: 18, lineHeight: 1.35, margin: 0, fontWeight: 650 },
  row: { marginTop: 10, display: "flex", alignItems: "center", gap: 10 },
  linkBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 10, background: "#2f66f5", color: "#fff", textDecoration: "none" },
  source: { color: "#6b7280", fontSize: 12 },
  empty: { marginTop: 24, padding: 24, border: "1px dashed #cbd5e1", borderRadius: 16, background: "#fff", textAlign: "center", color: "#475569" },
};