"use client";
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

function Stars({ n = 5 }) {
  return (
    <div className="flex gap-1 mb-2">
      {Array.from({ length: n }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.173c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.921-.755 1.688-1.539 1.118l-3.38-2.455a1 1 0 00-1.176 0l-3.38 2.455c-.784.57-1.839-.197-1.539-1.118l1.286-3.966a1 1 0 00-.364-1.118L2.05 9.393c-.783-.57-.38-1.81.588-1.81h4.173a1 1 0 00.95-.69L9.05 2.927z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/reviews');
        const data = await res.json();
        if (!mounted) return;
        setReviews(data.reviews || []);
      } catch (e) {
        console.error('Failed to load reviews', e);
      } finally {
        setLoading(false);
      }
    })();

    // show toast prompt if user logged in and not prompted this session
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      // set isLoggedIn after mount to keep SSR/client render consistent
      setIsLoggedIn(Boolean(token));
      const prompted = sessionStorage.getItem('reviews_prompted');
      if (token && !prompted) {
        setToastVisible(true);
        sessionStorage.setItem('reviews_prompted', '1');
        setTimeout(() => setToastVisible(false), 8000);
      }
    } catch (e) {}

    return () => { mounted = false; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      // Include name/email for anonymous users; fetchWithAuth will attach token if present
      const body = { rating, comment };
      if (!isLoggedIn) {
        if (name) body.name = name;
        if (email) body.email = email;
      }

      const res = await fetchWithAuth('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setReviews(prev => [data.review, ...prev]);
      setShowModal(false);
      setComment('');
      setRating(5);
      setName('');
      setEmail('');
    } catch (err) {
      alert(err.message || 'Failed to add review');
    }
  }

  return (
    <section id="reviews" className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-white">Loved by Teams Worldwide</h2>
        <p className="text-gray-400 mt-2">See what our users have to say about their experience with Boardify</p>
      </div>

      <div className="relative">
        <div className="overflow-x-auto no-scrollbar py-6 scroll-smooth" aria-label="User reviews carousel">
          <div className="flex gap-6 snap-x snap-mandatory" style={{ minWidth: 'max-content' }}>
            {loading ? (
              <div className="text-gray-400">Loading reviews…</div>
            ) : (
              reviews.map((r) => (
                <div key={r._id} className="min-w-[320px] max-w-[34rem] snap-start bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
                  <Stars />
                  <p className="italic text-gray-300 mb-6">"{r.comment}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold">
                      {r.userId && r.userId.name ? r.userId.name.split(' ').map(n => n[0]).slice(0,2).join('') : (r.name ? r.name[0] : 'U')}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{r.name}</div>
                      <div className="text-sm text-gray-400">{r.userId && r.userId.avatar ? 'Has avatar' : ''}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add review floating toast/button */}
        {toastVisible && (
          <div className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-700 to-indigo-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <div>Enjoying Boardify?</div>
            <button onClick={() => { setShowModal(true); setToastVisible(false); }} className="bg-white text-purple-700 px-3 py-1 rounded-md font-medium">Add Review</button>
          </div>
        )}

        {/* Add Review button for logged-in users */}
        <div className="mt-4 text-right">
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium">Add Review</button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-3">Add your review</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm text-gray-300">Rating</label>
                <select value={rating} onChange={e => setRating(Number(e.target.value))} className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-lg">
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} stars</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-300">Comment</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} required maxLength={500} className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg h-28 text-sm text-gray-100"></textarea>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-purple-600 text-white">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
