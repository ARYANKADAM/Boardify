"use client";

import { useEffect, useRef, useState } from "react";

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    title: "",
    quote: "",
    rating: 5,
    avatar: "",
  });

  const sliderRef = useRef(null);

  // -----------------------------
  // FETCH TESTIMONIALS
  // -----------------------------
  const fetchTestimonials = async () => {
    try {
      const res = await fetch("/api/testimonials");

      if (!res.ok) {
        throw new Error("Failed to fetch testimonials");
      }

      const data = await res.json();

      setTestimonials(data.testimonials || []);
    } catch (error) {
      console.error("Testimonials error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();
  }, []);

  // -----------------------------
  // FORM HANDLER
  // -----------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // -----------------------------
  // ADD TESTIMONIAL
  // -----------------------------
  const handleAddTestimonial = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.quote.trim()) {
      alert("Please enter your name and testimonial.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          title: form.title.trim(),
          quote: form.quote.trim(),
          rating: Number(form.rating),
          avatar: form.avatar.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add testimonial");
      }

      // Add newly created testimonial immediately
      setTestimonials((prev) => [data.testimonial, ...prev]);

      // Reset form
      setForm({
        name: "",
        title: "",
        quote: "",
        rating: 5,
        avatar: "",
      });

      setShowModal(false);
    } catch (error) {
      console.error("Add testimonial error:", error);
      alert(error.message || "Failed to add testimonial.");
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------
  // SCROLL
  // -----------------------------
  const scrollTestimonials = (direction) => {
    if (!sliderRef.current) return;

    sliderRef.current.scrollBy({
      left: direction === "left" ? -360 : 360,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-10 relative">
      <div className="max-w-6xl mx-auto px-6">

        {/* -------------------------------- */}
        {/* HEADER */}
        {/* -------------------------------- */}
        <div className="flex flex-col items-center mb-10">

          <h2 className="text-center text-3xl md:text-4xl font-bold text-white">
            Testimonials
          </h2>

          <p className="text-gray-500 text-sm mt-2">
            What people say about Boardify
          </p>

          {/* Small Add Testimonial Button */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="
              mt-5
              px-4
              py-2
              rounded-full
              text-xs
              font-medium
              text-purple-200
              bg-purple-500/10
              border
              border-purple-500/30
              hover:bg-purple-500/20
              hover:border-purple-400/50
              transition-all
            "
          >
            + Add Testimonial
          </button>

        </div>

        {/* -------------------------------- */}
        {/* TESTIMONIAL SLIDER */}
        {/* -------------------------------- */}
        {loading ? (
          <div className="text-center text-gray-500 text-sm">
            Loading testimonials...
          </div>
        ) : testimonials.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-10">
            No testimonials yet. Be the first to add one!
          </div>
        ) : (
          <div className="relative max-w-5xl mx-auto">

            {/* LEFT ARROW */}
            {testimonials.length > 3 && (
              <button
                type="button"
                onClick={() => scrollTestimonials("left")}
                aria-label="Previous testimonials"
                className="
                  absolute
                  left-[-18px]
                  top-1/2
                  -translate-y-1/2
                  z-20
                  w-8
                  h-8
                  rounded-full
                  bg-[#151c2d]
                  border
                  border-white/10
                  text-gray-300
                  flex
                  items-center
                  justify-center
                  hover:bg-purple-600
                  hover:text-white
                  hover:border-purple-500
                  transition-all
                "
              >
                ←
              </button>
            )}

            {/* RIGHT ARROW */}
            {testimonials.length > 3 && (
              <button
                type="button"
                onClick={() => scrollTestimonials("right")}
                aria-label="Next testimonials"
                className="
                  absolute
                  right-[-18px]
                  top-1/2
                  -translate-y-1/2
                  z-20
                  w-8
                  h-8
                  rounded-full
                  bg-[#151c2d]
                  border
                  border-white/10
                  text-gray-300
                  flex
                  items-center
                  justify-center
                  hover:bg-purple-600
                  hover:text-white
                  hover:border-purple-500
                  transition-all
                "
              >
                →
              </button>
            )}

            {/* CARDS */}
            <div
              ref={sliderRef}
              className="
                flex
                gap-4
                overflow-x-auto
                scroll-smooth
                px-2
                pb-
                snap-x
                snap-mandatory
                [&::-webkit-scrollbar]:hidden
                [-ms-overflow-style:none]
                [scrollbar-width:none]
              "
            >
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial._id}
                  className="
                    flex-none
                    w-[280px]
                    sm:w-[300px]
                    md:w-[310px]
                    snap-center
                  "
                >
                  <TestimonialCard testimonial={testimonial} />
                </div>
              ))}
            </div>

          </div>
        )}

      </div>

      {/* -------------------------------- */}
      {/* ADD TESTIMONIAL MODAL */}
      {/* -------------------------------- */}
      {showModal && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-black/60
            backdrop-blur-sm
            px-4
          "
          onClick={() => setShowModal(false)}
        >
          <div
            className="
              w-full
              max-w-md
              rounded-2xl
              border
              border-white/10
              bg-[#111727]
              shadow-2xl
              shadow-purple-950/40
              p-6
            "
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">

              <div>
                <h3 className="text-lg font-semibold text-white">
                  Add Testimonial
                </h3>

                <p className="text-xs text-gray-500 mt-1">
                  Share your experience with Boardify
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="
                  w-8
                  h-8
                  rounded-full
                  bg-white/5
                  border
                  border-white/10
                  text-gray-400
                  hover:text-white
                  hover:bg-white/10
                  transition
                "
              >
                ×
              </button>

            </div>

            {/* FORM */}
            <form
              onSubmit={handleAddTestimonial}
              className="space-y-4"
            >

              {/* Name */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Aryan Kadam"
                  className="
                    w-full
                    px-3
                    py-2.5
                    rounded-lg
                    bg-[#0b1020]
                    border
                    border-white/10
                    text-sm
                    text-white
                    placeholder:text-gray-600
                    outline-none
                    focus:border-purple-500/60
                  "
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Role / Title
                </label>

                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Product Designer"
                  className="
                    w-full
                    px-3
                    py-2.5
                    rounded-lg
                    bg-[#0b1020]
                    border
                    border-white/10
                    text-sm
                    text-white
                    placeholder:text-gray-600
                    outline-none
                    focus:border-purple-500/60
                  "
                />
              </div>

              {/* Testimonial */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Testimonial
                </label>

                <textarea
                  name="quote"
                  value={form.quote}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Boardify has made managing our team much easier..."
                  className="
                    w-full
                    px-3
                    py-2.5
                    rounded-lg
                    bg-[#0b1020]
                    border
                    border-white/10
                    text-sm
                    text-white
                    placeholder:text-gray-600
                    outline-none
                    resize-none
                    focus:border-purple-500/60
                  "
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Rating
                </label>

                <select
                  name="rating"
                  value={form.rating}
                  onChange={handleChange}
                  className="
                    w-full
                    px-3
                    py-2.5
                    rounded-lg
                    bg-[#0b1020]
                    border
                    border-white/10
                    text-sm
                    text-white
                    outline-none
                    focus:border-purple-500/60
                  "
                >
                  <option value="5">★★★★★ 5</option>
                  <option value="4">★★★★☆ 4</option>
                  <option value="3">★★★☆☆ 3</option>
                  <option value="2">★★☆☆☆ 2</option>
                  <option value="1">★☆☆☆☆ 1</option>
                </select>
              </div>

              {/* Avatar */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Avatar URL <span className="text-gray-600">(optional)</span>
                </label>

                <input
                  type="text"
                  name="avatar"
                  value={form.avatar}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="
                    w-full
                    px-3
                    py-2.5
                    rounded-lg
                    bg-[#0b1020]
                    border
                    border-white/10
                    text-sm
                    text-white
                    placeholder:text-gray-600
                    outline-none
                    focus:border-purple-500/60
                  "
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="
                    flex-1
                    py-2.5
                    rounded-lg
                    bg-white/5
                    border
                    border-white/10
                    text-sm
                    text-gray-300
                    hover:bg-white/10
                    transition
                  "
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="
                    flex-1
                    py-2.5
                    rounded-lg
                    bg-gradient-to-r
                    from-purple-500
                    to-indigo-600
                    text-white
                    text-sm
                    font-semibold
                    hover:from-purple-400
                    hover:to-indigo-500
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                    transition
                  "
                >
                  {submitting ? "Adding..." : "Add Testimonial"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </section>
  );
}


// ========================================
// TESTIMONIAL CARD
// ========================================

function TestimonialCard({ testimonial }) {
  const {
    name,
    title,
    quote,
    rating = 5,
    avatar,
  } = testimonial;

  const firstLetter =
    name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <div
      className="
        h-[150px]
        rounded-xl
        border
        border-white/[0.08]
        bg-[#111727]
        px-5
        py-4
        flex
        flex-col
        justify-between
        overflow-hidden
        hover:border-purple-500/30
        transition-all
        duration-300
      "
    >

      {/* Quote */}
      <p className="text-gray-300 text-xs leading-relaxed line-clamp-2">
        "{quote}"
      </p>

      {/* User */}
      <div className="flex items-center gap-3">

        {avatar ? (
          <img
            src={avatar}
            alt={name || "User"}
            className="
              w-9
              h-9
              rounded-full
              object-cover
              border
              border-white/20
            "
          />
        ) : (
          <div
            className="
              w-9
              h-9
              rounded-full
              bg-gradient-to-br
              from-purple-500
              to-indigo-600
              flex
              items-center
              justify-center
              text-white
              text-xs
              font-semibold
            "
          >
            {firstLetter}
          </div>
        )}

        <div className="min-w-0 flex-1">

          <p className="text-white text-xs font-semibold truncate">
            {name || "Anonymous"}
          </p>

          {title && (
            <p className="text-purple-400 text-[10px] truncate">
              {title}
            </p>
          )}

          <div className="flex gap-[1px] mt-0.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={index}
                className={`text-[10px] ${
                  index < rating
                    ? "text-yellow-400"
                    : "text-gray-600"
                }`}
              >
                ★
              </span>
            ))}
          </div>

        </div>
      </div>

    </div>
  );
}