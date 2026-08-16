import React from "react";
import Testimonials from "@/components/Testimonials";

/**
 * =====================================================================
 * DECORATIVE COMPONENTS
 * =====================================================================
 */

const PurpleAtmosphere = () => (
  <div
    className="
      absolute
      top-0
      left-1/2
      -translate-x-1/2
      -translate-y-1/2
      w-[700px]
      sm:w-[900px]
      lg:w-[1000px]
      h-[450px]
      sm:h-[550px]
      lg:h-[600px]
      bg-purple-900/30
      blur-[100px]
      lg:blur-[120px]
      rounded-full
      pointer-events-none
      z-0
    "
  />
);

const LeftGlow = () => (
  <div
    className="
      absolute
      top-[400px]
      -left-[250px]
      sm:-left-[300px]
      w-[450px]
      sm:w-[600px]
      h-[450px]
      sm:h-[600px]
      bg-purple-900/20
      blur-[100px]
      lg:blur-[120px]
      rounded-full
      pointer-events-none
      z-0
    "
  />
);

const RightGlow = () => (
  <div
    className="
      absolute
      top-[600px]
      -right-[250px]
      sm:-right-[300px]
      w-[450px]
      sm:w-[600px]
      h-[450px]
      sm:h-[600px]
      bg-indigo-950/30
      blur-[100px]
      lg:blur-[120px]
      rounded-full
      pointer-events-none
      z-0
    "
  />
);

/**
 * =====================================================================
 * FEATURE CARD
 * =====================================================================
 */

const FeatureCard = ({
  icon,
  title,
  description,
  imagePlaceholderText,
}) => (
  <div
    className="
      bg-[#111727]/60
      border
      border-white/[0.06]
      rounded-2xl
      p-5
      sm:p-6
      flex
      flex-col
      hover:border-purple-500/20
      transition-all
      duration-300
      group
    "
  >
    <div
      className="
        w-10
        h-10
        rounded-xl
        bg-purple-500/10
        border
        border-purple-500/20
        flex
        items-center
        justify-center
        text-purple-400
        text-xl
        mb-5
      "
    >
      {icon}
    </div>

    <h3 className="text-lg font-semibold text-white mb-2">
      {title}
    </h3>

    <p className="text-sm text-gray-400 leading-relaxed mb-6 flex-grow">
      {description}
    </p>

    {/* Feature Image */}
    <div
      className="
        relative
        h-28
        sm:h-32
        rounded-xl
        overflow-hidden
        bg-[#0c1220]
        border
        border-white/[0.05]
      "
    >
      {/*
        Add your feature image here:

        <img
          src="YOUR_FEATURE_IMAGE_PATH"
          alt={title}
          className="
            absolute
            inset-0
            w-full
            h-full
            object-cover
            object-top
            opacity-80
            group-hover:opacity-100
            transition-opacity
          "
        />
      */}

      <div
        className="
          absolute
          inset-0
          flex
          items-center
          justify-center
          text-xs
          text-gray-700
          italic
          px-4
          text-center
        "
      >
        {imagePlaceholderText || "[ Feature Screenshot / Graphic Here ]"}
      </div>

      <div
        className="
          absolute
          inset-0
          bg-gradient-to-t
          from-[#0c1220]
          via-transparent
          to-transparent
        "
      />
    </div>
  </div>
);

/**
 * =====================================================================
 * MAIN LANDING PAGE
 * =====================================================================
 */

const BoardifyLandingPage = () => {
  return (
    <div
      className="
        min-h-screen
        w-full
        bg-[#0b1020]
        text-gray-100
        font-sans
        relative
        overflow-x-hidden
      "
    >
      {/* Background */}
      <PurpleAtmosphere />
      <LeftGlow />
      <RightGlow />

      <div className="relative z-10 w-full">
        {/* ============================================================
            NAVBAR
        ============================================================ */}

        <nav
          className="
            w-full
            border-b
            border-white/[0.06]
            bg-[#0b1020]/80
            backdrop-blur-sm
            sticky
            top-0
            z-50
          "
        >
          <div
            className="
              max-w-7xl
              mx-auto
              px-4
              sm:px-6
              lg:px-8
              h-16
              flex
              items-center
              justify-between
            "
          >
            {/* Logo */}
            <a href="#" className="flex items-center gap-2 shrink-0">
              <div
                className="
                  w-8
                  h-8
                  rounded-lg
                  bg-gradient-to-br
                  from-purple-500
                  to-indigo-600
                  flex
                  items-center
                  justify-center
                  shadow-lg
                  shadow-purple-950/50
                "
              >
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a3 3 0 006 0M9 5a3 3 0 013-3 3 3 0 013 3"
                  />
                </svg>
              </div>

              <span className="text-lg font-bold text-white tracking-tight">
                Boardify
              </span>
            </a>

            {/* Navigation */}
            <div className="flex items-center gap-3 sm:gap-5 md:gap-7 text-sm">
              <a
                href="/login"
                className="
                  text-gray-300
                  hover:text-white
                  transition-colors
                "
              >
                Log In
              </a>

              <a
                href="/register"
                className="
                  px-4
                  sm:px-5
                  py-2
                  rounded-full
                  bg-gradient-to-r
                  from-purple-500
                  to-indigo-600
                  text-white
                  font-semibold
                  text-xs
                  shadow-lg
                  shadow-purple-950/40
                  hover:from-purple-400
                  hover:to-indigo-500
                  transition-all
                  hover:-translate-y-0.5
                  whitespace-nowrap
                "
              >
                Get Started Free
              </a>
            </div>
          </div>
        </nav>

        {/* ============================================================
            HERO SECTION
        ============================================================ */}

        <header
          className="
            relative
            pt-12
            sm:pt-16
            md:pt-20
            pb-16
            sm:pb-20
            overflow-hidden
          "
        >
          {/* Hero Glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="
                absolute
                top-[-120px]
                sm:top-[-180px]
                left-1/2
                -translate-x-1/2
                w-[500px]
                sm:w-[700px]
                md:w-[850px]
                h-[350px]
                sm:h-[450px]
                md:h-[500px]
                bg-purple-700/25
                blur-[100px]
                md:blur-[140px]
                rounded-full
              "
            />
          </div>

          <div className="relative w-full flex flex-col items-center">
            {/* ========================================================
                BOARD SCREENSHOT
            ======================================================== */}

            <div
              className="
                relative
                w-full
                max-w-4xl
                mx-auto
                px-4
                sm:px-6
                md:px-0
                flex
                justify-center
              "
            >
              {/* Glow */}
              <div
                className="
                  absolute
                  -inset-5
                  sm:-inset-8
                  md:-inset-10
                  bg-purple-600/20
                  blur-[60px]
                  sm:blur-[80px]
                  md:blur-[90px]
                  rounded-full
                  pointer-events-none
                "
              />

              {/* Screenshot Frame */}
              <div
                className="
                  relative
                  w-full
                  max-w-[900px]
                  h-[190px]
                  xs:h-[210px]
                  sm:h-[260px]
                  md:h-[320px]
                  lg:h-[350px]
                  rounded-xl
                  sm:rounded-2xl
                  overflow-hidden
                  border
                  border-purple-300/20
                  bg-[#111727]
                  shadow-2xl
                  shadow-purple-950/30
                "
              >
                <img
                  src="/images/board-preview.png"
                  alt="Boardify workspace"
                  className="
                    absolute
                    inset-0
                    w-full
                    h-full
                    object-cover
                    object-top
                    opacity-75
                  "
                />

                {/* Dark overlay */}
                <div
                  className="
                    absolute
                    inset-0
                    bg-gradient-to-b
                    from-transparent
                    via-[#0c1220]/10
                    to-[#0b1020]
                  "
                />

                {/* Bottom fade */}
                <div
                  className="
                    absolute
                    left-0
                    right-0
                    bottom-0
                    h-[80px]
                    sm:h-[110px]
                    md:h-[150px]
                    bg-gradient-to-t
                    from-[#0b1020]
                    via-[#0b1020]/75
                    to-transparent
                  "
                />
              </div>
            </div>

            {/* ========================================================
                HERO CONTENT
            ======================================================== */}

            <div
              className="
                relative
                z-20
                w-full
                flex
                flex-col
                items-center
                text-center
                -mt-[35px]
                sm:-mt-[50px]
                md:-mt-[65px]
                px-4
              "
            >
              <h1
                className="
                  w-full
                  max-w-[1100px]
                  mx-auto
                  text-center
                  text-white
                  font-extrabold
                  tracking-[-0.045em]
                  leading-[0.95]
                  drop-shadow-[0_5px_20px_rgba(0,0,0,0.9)]
                "
              >
                <span
                  className="
                    block
                    text-[38px]
                    leading-[1]
                    sm:text-[48px]
                    md:text-[64px]
                    lg:text-[72px]
                    xl:text-[84px]
                  "
                >
                  Transform Chaos into Clarity
                </span>

                <span
                  className="
                    block
                    mt-2
                    text-[38px]
                    leading-[1]
                    sm:text-[48px]
                    md:text-[64px]
                    lg:text-[72px]
                    xl:text-[84px]
                  "
                >
                  Mastering Every Task
                </span>
              </h1>

              {/* CTA Buttons */}
              <div
                className="
                  flex
                  flex-col
                  sm:flex-row
                  items-center
                  justify-center
                  gap-3
                  sm:gap-4
                  mt-7
                  sm:mt-8
                  w-full
                  px-4
                "
              >
                <a
                  href="/register"
                  className="
                    w-full
                    sm:w-auto
                    px-7
                    sm:px-8
                    py-3
                    sm:py-3.5
                    rounded-full
                    bg-gradient-to-r
                    from-purple-500
                    to-indigo-600
                    text-white
                    font-semibold
                    text-sm
                    sm:text-base
                    shadow-xl
                    shadow-purple-950/60
                    hover:from-purple-400
                    hover:to-indigo-500
                    transition-all
                    hover:-translate-y-1
                    text-center
                  "
                >
                  Get Your Board Free →
                </a>

                <a
                  href="#"
                  className="
                    w-full
                    sm:w-auto
                    px-7
                    sm:px-8
                    py-3
                    sm:py-3.5
                    rounded-full
                    bg-white/[0.04]
                    border
                    border-white/[0.12]
                    text-white
                    font-medium
                    text-sm
                    sm:text-base
                    hover:bg-white/[0.08]
                    transition-all
                    text-center
                  "
                >
                  Watch Demo
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* ============================================================
            FEATURE / CALENDAR SECTION
        ============================================================ */}

        <section className="py-12 sm:py-16 md:py-20 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="
                grid
                grid-cols-1
                md:grid-cols-12
                gap-8
                md:gap-10
                items-center
              "
            >
              {/* Text */}
              <div
                className="
                  md:col-span-4
                  max-w-lg
                  md:max-w-sm
                  mx-auto
                  md:mx-0
                  text-center
                  md:text-left
                "
              >
                <div
                  className="
                    w-10
                    h-10
                    rounded-xl
                    bg-purple-500/10
                    border
                    border-purple-500/20
                    flex
                    items-center
                    justify-center
                    text-purple-400
                    text-xl
                    mb-5
                    sm:mb-6
                    mx-auto
                    md:mx-0
                  "
                >
                  ▦
                </div>

                <h2
                  className="
                    text-2xl
                    sm:text-3xl
                    font-bold
                    tracking-tight
                    text-white
                    mb-4
                    leading-tight
                  "
                >
                  Stay in Sync, Everywhere.
                </h2>

                <p
                  className="
                    text-sm
                    sm:text-base
                    text-gray-400
                    leading-relaxed
                  "
                >
                  Connect your tasks with your calendar and keep your
                  schedule automatically in sync. Plan deadlines, meetings,
                  and tasks together without switching between apps.
                </p>
              </div>

              {/* Screenshot */}
              <div className="md:col-span-8 relative">
                <div
                  className="
                    absolute
                    inset-5
                    sm:inset-10
                    bg-purple-600/10
                    blur-[60px]
                    sm:blur-[80px]
                    rounded-full
                    z-0
                    pointer-events-none
                  "
                />

                <div
                  className="
                    relative
                    rounded-xl
                    sm:rounded-2xl
                    border
                    border-purple-300/10
                    bg-[#111727]/70
                    p-1
                    shadow-xl
                    shadow-purple-950/10
                    overflow-hidden
                    z-10
                  "
                >
                  <div
                    className="
                      rounded-lg
                      sm:rounded-xl
                      overflow-hidden
                      border
                      border-white/[0.05]
                      aspect-[16/10]
                      bg-[#0c1220]
                      relative
                    "
                  >
                    <img
                      src="/images/board-details.png"
                      alt="Boardify calendar integration"
                      className="
                        w-full
                        h-full
                        object-cover
                        object-top
                        opacity-90
                      "
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            TESTIMONIALS
        ============================================================ */}

        <Testimonials />

        {/* ============================================================
            BOTTOM CTA
        ============================================================ */}

        <section className="py-16 sm:py-20 md:py-24 relative">
          <div
            className="
              absolute
              inset-0
              bg-gradient-to-b
              from-purple-950/10
              to-transparent
              blur-[100px]
              md:blur-[120px]
              pointer-events-none
              z-0
            "
          />

          <div
            className="
              max-w-4xl
              mx-auto
              px-4
              sm:px-6
              lg:px-8
              text-center
              relative
              z-10
            "
          >
            <h2
              className="
                text-3xl
                sm:text-4xl
                md:text-5xl
                font-extrabold
                tracking-[-0.03em]
                text-white
                leading-tight
                mb-5
                max-w-3xl
                mx-auto
              "
            >
              Ready to Supercharge Your Workflow?
            </h2>

            <p
              className="
                text-sm
                sm:text-base
                text-gray-400
                leading-relaxed
                mb-8
                sm:mb-10
                max-w-xl
                mx-auto
              "
            >
              Join thousands of teams who trust Boardify. No credit card
              required to start.
            </p>

            <a
              href="/register"
              className="
                inline-flex
                px-8
                sm:px-10
                py-3.5
                sm:py-4
                rounded-full
                bg-gradient-to-r
                from-purple-500
                to-indigo-600
                text-white
                font-semibold
                text-sm
                sm:text-base
                shadow-xl
                shadow-purple-950/70
                hover:from-purple-400
                hover:to-indigo-500
                transition-all
                hover:-translate-y-1
              "
            >
              Get Started Free
            </a>
          </div>
        </section>

        {/* ============================================================
            FOOTER
        ============================================================ */}

        <footer
          className="
            w-full
            border-t
            border-white/[0.06]
            bg-[#0b1020]
          "
        >
          <div
            className="
              max-w-7xl
              mx-auto
              px-4
              sm:px-6
              lg:px-8
              py-6
              flex
              flex-col
              sm:flex-row
              items-center
              justify-center
              sm:justify-between
              gap-3
              text-xs
              text-gray-600
              text-center
              sm:text-left
            "
          >
            <p>
              &copy; {new Date().getFullYear()} Boardify Inc. All rights
              reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default BoardifyLandingPage;