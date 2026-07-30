import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackgroundLeaves, Leaf } from '../components/Botanical';
import { Header } from '../components/Header';
import { submitEntry } from '../api';

const WORD_LIMIT = 300;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function countWords(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export default function Submit() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [intro, setIntro] = useState('');
  const [funFact, setFunFact] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const words = countWords(intro);
  const overLimit = words > WORD_LIMIT;

  function handlePhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('Please choose a JPG or PNG image.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('That photo is larger than 5MB. Please choose a smaller file.');
      return;
    }
    // Validate dimensions client-side (at least 100x100px).
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.width < 100 || img.height < 100) {
        setPhotoError(`This image is only ${img.width}×${img.height}px. Please use one at least 100×100px.`);
        URL.revokeObjectURL(url);
        return;
      }
      setPhoto(file);
      setPreview(url);
    };
    img.onerror = () => {
      setPhotoError("We couldn't read that image. Please try another file.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim() || !intro.trim() || !photo) {
      setError('Please fill in your name, personal email, introduction and upload a photo.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    const form = new FormData();
    form.append('full_name', fullName.trim());
    form.append('email', email.trim());
    form.append('intro', intro.trim());
    form.append('fun_fact', funFact.trim());
    form.append('photo', photo);

    setSubmitting(true);
    try {
      const res = await submitEntry(form);
      setDone(res.name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <Confirmation name={done} />;

  return (
    <div className="relative min-h-screen">
      <BackgroundLeaves />
      <Header
        eyebrow="New Joiner Portal"
        title="We're so glad you're here 🌱"
        subtitle="Tell your new NParks colleagues a little about yourself. Your introduction will be shared in a warm welcome email once HR has had a quick look."
        right={
          <Link to="/" className="gp-btn-secondary bg-white/10 text-cream hover:bg-white/20">
            ← Home
          </Link>
        }
      />

      <main className="mx-auto max-w-2xl px-5 py-10">
        <form onSubmit={handleSubmit} className="gp-card animate-fade-up space-y-6 p-6 sm:p-8">
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}

          <div className="rounded-xl bg-sage-light/80 px-4 py-3 text-sm text-forest-dark/80">
            <strong>Already submitted before?</strong> Enter the <strong>same personal email address</strong> you used
            before and send the form again — as long as HR hasn't approved your entry yet, your new submission replaces
            the old one.
          </div>

          <div>
            <label className="gp-label" htmlFor="fullName">
              <Leaf className="h-4 w-4 text-forest" /> Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="fullName"
              className="gp-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Amara Tan"
              required
            />
          </div>

          <div>
            <label className="gp-label" htmlFor="email">
              <Leaf className="h-4 w-4 text-forest" /> Personal email address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="gp-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. yourname@gmail.com"
              required
            />
            <p className="mt-1.5 text-xs text-forest/60">
              We use this only to find your submission if you need to edit it later — it won't be shared in the welcome
              email or shown to your colleagues.
            </p>
          </div>

          <div>
            <label className="gp-label">
              <Leaf className="h-4 w-4 text-forest" /> Profile photo <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-sage bg-sage-light">
                {preview ? (
                  <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
                ) : (
                  <Leaf className="h-9 w-9 text-forest/40" />
                )}
              </div>
              <div>
                <button type="button" className="gp-btn-secondary" onClick={() => fileRef.current?.click()}>
                  {preview ? 'Change photo' : 'Upload photo'}
                </button>
                <p className="mt-1.5 text-xs text-forest/60">JPG or PNG, up to 5MB. Your whole photo is shown as a rectangle — a clear, upright photo works best.</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0])}
              />
            </div>
            {photoError && <p className="mt-2 text-sm font-semibold text-red-700">{photoError}</p>}
          </div>

          <div>
            <label className="gp-label" htmlFor="intro">
              <Leaf className="h-4 w-4 text-forest" /> Personal introduction <span className="text-red-500">*</span>
            </label>
            <textarea
              id="intro"
              className="gp-input min-h-[140px] resize-y"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Share a short paragraph introducing yourself to your NParks colleagues — your background, what you're excited about, anything you'd love people to know."
              required
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className={overLimit ? 'font-bold text-amber-700' : 'text-forest/60'}>
                {words} / {WORD_LIMIT} words · {intro.length} characters
              </span>
              {overLimit && (
                <span className="font-bold text-amber-700">
                  ⚠️ That's a little long — please try to keep it under {WORD_LIMIT} words.
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="gp-label" htmlFor="funFact">
              <Leaf className="h-4 w-4 text-forest" /> Fun fact <span className="text-forest/40">(optional)</span>
            </label>
            <input
              id="funFact"
              className="gp-input"
              value={funFact}
              onChange={(e) => setFunFact(e.target.value)}
              placeholder="One fun fact about yourself 🌼"
            />
          </div>

          <div className="rounded-xl bg-sage-light/70 px-4 py-3 text-xs text-forest-dark/70">
            Job title, division and start date are added by HR — you don't need to fill those in here.
          </div>

          <button type="submit" className="gp-btn-primary w-full text-lg" disabled={submitting}>
            {submitting ? 'Sending your introduction…' : 'Send my introduction 🌿'}
          </button>
        </form>
      </main>
    </div>
  );
}

function Confirmation({ name }: { name: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <BackgroundLeaves />
      <div className="gp-card animate-fade-up mx-5 max-w-lg p-8 text-center sm:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-forest">
          <Leaf className="h-10 w-10 text-cream animate-sway" />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold text-forest">Thanks for sharing, {name}! 🌱</h1>
        <p className="mt-3 text-forest-dark/80">
          Your introduction has been sent to the team. Welcome to NParks — we're so glad you're here.
          Keep an eye on your inbox for a warm welcome from your new colleagues.
        </p>
        <p className="mt-4 text-sm font-semibold text-forest/70">Growing together, one green space at a time. 🌳</p>
        <Link to="/" className="gp-btn-primary mt-8">
          Back to home
        </Link>
      </div>
    </div>
  );
}
