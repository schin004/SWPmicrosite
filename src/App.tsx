import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { BackgroundLeaves, Leaf } from './components/Botanical';
import { Header } from './components/Header';
import Submit from './pages/Submit';
import Amend from './pages/Amend';
import Admin from './pages/Admin';

function Landing() {
  return (
    <div className="relative min-h-screen">
      <BackgroundLeaves />
      <Header
        eyebrow="National Parks Board · Singapore"
        title={<>Welcome to <span className="text-sage">GreenPass</span> 🌿</>}
        subtitle="Our warm welcome for every new member of the NParks family — growing together, one green space at a time."
      />
      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-12 sm:grid-cols-2">
        <div className="gp-card flex flex-col p-7">
          <Leaf className="h-10 w-10 text-forest" />
          <h2 className="mt-4 text-2xl font-extrabold text-forest">I'm a new joiner</h2>
          <p className="mt-2 flex-1 text-forest-dark/70">
            Share a little about yourself so we can introduce you to your new colleagues. It only takes a couple of minutes.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/submit" className="gp-btn-primary">Start my introduction →</Link>
            <Link to="/amend" className="gp-btn-secondary">Amend my introduction</Link>
          </div>
        </div>
        <Link to="/admin" className="gp-card group flex flex-col p-7 transition hover:-translate-y-1 hover:shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-forest text-cream">HR</div>
          <h2 className="mt-4 text-2xl font-extrabold text-forest">HR admin dashboard</h2>
          <p className="mt-2 flex-1 text-forest-dark/70">
            Review submissions, verify content with AI assistance, add job details, and generate the welcome eDM.
          </p>
          <span className="mt-4 font-bold text-forest group-hover:underline">Open dashboard →</span>
        </Link>
      </main>
      <footer className="pb-10 text-center text-sm text-forest/50">
        GreenPass · A friendlier welcome for the NParks family 🌳
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/amend" element={<Amend />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
