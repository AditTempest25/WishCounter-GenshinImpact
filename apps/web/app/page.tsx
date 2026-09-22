import WishDashboard from "../components/WishDashboard";

export default function Home() {
  return (
    <main>
      <header className="hero single">
        <div>
          <div className="eyebrow">Irminsul Wish · POC V1</div>
          <h1>Wish tracking without repeated manual imports.</h1>
          <p>
            Launch Genshin normally through HoYoPlay. When you want to sync, open Wish History once and press Start Sync.
            The helper fetches records directly from HoYoverse; the authkey stays on your PC.
          </p>
        </div>
      </header>

      <WishDashboard />

      <section className="card info">
        <h2>V1 flow</h2>
        <ol>
          <li>Launch Genshin from HoYoPlay normally.</li>
          <li>Open Wish → History once so the WebView cache contains a fresh session.</li>
          <li>Press Start Sync on this web dashboard.</li>
          <li>Irminsul Sync imports new records and exits after synchronization finishes.</li>
        </ol>
      </section>
    </main>
  );
}
