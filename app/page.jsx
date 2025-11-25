export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-gray-100 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        {/* Header */}
        <nav className="flex items-center justify-between mb-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Boardify</span>
          </div>
          <div className="flex gap-3">
            <a href="/login" className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Sign In</a>
            <a href="/register" className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/20 transition-all">Get Started</a>
          </div>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          {/* Left: Hero text */}
          <section className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full backdrop-blur-sm">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-purple-300">Project Management Reimagined</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight">
              <span className="bg-gradient-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent">
                Organize work
              </span>
              <br />
              <span className="text-gray-100">beautifully</span>
            </h1>

            <p className="text-xl text-gray-400 max-w-xl leading-relaxed">
              Flexible boards, real-time collaboration, and powerful permissions. Everything your team needs to stay in sync, wrapped in an elegant dark interface.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a 
                href="/register" 
                className="group inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-2xl shadow-purple-500/30 transition-all transform hover:scale-105"
              >
                Start Free Trial
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a 
                href="#features" 
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 text-gray-200 border border-gray-700/50 backdrop-blur-sm font-medium transition-all"
              >
                See Features
              </a>
            </div>

            <div className="flex items-center gap-6 pt-4 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-400">No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-400">Free for small teams</span>
              </div>
            </div>
          </section>

          {/* Right: Feature showcase */}
          <aside className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-indigo-600/20 rounded-3xl blur-2xl"></div>
            <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">Powerful Features</h3>
              </div>

              <div className="space-y-4">
                {[
                  { icon: "⚡", title: "Real-time Sync", desc: "WebSocket-powered live updates across all devices" },
                  { icon: "🔐", title: "Smart Permissions", desc: "Fine-grained access control with 4 role types" },
                  { icon: "🎯", title: "Drag & Drop", desc: "Intuitive task management with smooth interactions" },
                  { icon: "📊", title: "Activity Tracking", desc: "Complete audit trail of all team actions" }
                ].map((feature, i) => (
                  <div 
                    key={i}
                    className="group flex items-start gap-4 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/30 hover:border-purple-500/30 transition-all cursor-pointer"
                  >
                    <span className="text-2xl flex-shrink-0">{feature.icon}</span>
                    <div>
                      <h4 className="font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">{feature.title}</h4>
                      <p className="text-sm text-gray-400">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-purple-300">Pro tip:</span> Register as different roles to experience how permissions shape your workflow.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* Stats section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-16 border-y border-gray-800/50">
          {[
            { value: "100+", label: "Teams onboard" },
            { value: "99.9%", label: "Uptime" },
            { value: "<100ms", label: "Real-time sync" },
            { value: "4", label: "Permission roles" }
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Detailed Features Section */}
        <section id="features" className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Everything You Need to Succeed</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Powerful features designed to streamline your workflow and boost team productivity
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {[
              {
                icon: "⚡",
                title: "Real-time Collaboration",
                desc: "See changes instantly as your team works together. No more wondering if someone updated the board.",
                features: ["Live task updates", "Instant notifications", "Concurrent editing"]
              },
              {
                icon: "🔐",
                title: "Advanced Permissions",
                desc: "Control who can see and edit what with our flexible role-based access system.",
                features: ["Owner, Admin, Member, Viewer roles", "Board-level permissions", "Granular access control"]
              },
              {
                icon: "🎯",
                title: "Intuitive Drag & Drop",
                desc: "Move tasks between lists with smooth animations and instant visual feedback.",
                features: ["Smooth animations", "Multi-task selection", "Keyboard shortcuts"]
              },
              {
                icon: "📊",
                title: "Activity Tracking",
                desc: "Keep track of everything that happens on your boards with detailed activity logs.",
                features: ["Complete audit trail", "User activity history", "Export capabilities"]
              },
              {
                icon: "📱",
                title: "Cross-Platform",
                desc: "Access your boards from any device with our responsive web interface.",
                features: ["Mobile optimized", "Tablet support", "Desktop experience"]
              },
              {
                icon: "🔗",
                title: "Integrations",
                desc: "Connect with your favorite tools and services to streamline your workflow.",
                features: ["Calendar sync", "Google Workspace", "Microsoft Outlook"]
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/30 rounded-xl p-6 hover:border-purple-500/30 transition-all"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-purple-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-400 mb-4">{feature.desc}</p>
                <ul className="space-y-2">
                  {feature.features.map((item, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 bg-gradient-to-r from-purple-900/10 to-indigo-900/10 rounded-3xl border border-gray-800/30">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Get started in minutes with our simple 3-step process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Create Your Account",
                desc: "Sign up with your email and choose your role. We support multiple user types from viewers to owners.",
                icon: "👤"
              },
              {
                step: "2",
                title: "Set Up Your Board",
                desc: "Create your first board, add lists, and invite your team members with appropriate permissions.",
                icon: "📋"
              },
              {
                step: "3",
                title: "Start Collaborating",
                desc: "Add tasks, assign them to team members, and watch your productivity soar with real-time updates.",
                icon: "🚀"
              }
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Loved by Teams Worldwide</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              See what our users have to say about their experience with Boardify
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                quote: "Boardify transformed how our team collaborates. The real-time updates and intuitive interface made project management effortless.",
                author: "Sarah Chen",
                role: "Product Manager",
                company: "TechCorp",
                avatar: "SC"
              },
              {
                quote: "The permission system is exactly what we needed. Different roles work perfectly for our diverse team structure.",
                author: "Marcus Johnson",
                role: "Team Lead",
                company: "StartupXYZ",
                avatar: "MJ"
              },
              {
                quote: "Finally, a tool that doesn't get in the way. Clean design, powerful features, and it just works.",
                author: "Emily Rodriguez",
                role: "Designer",
                company: "CreativeStudio",
                avatar: "ER"
              }
            ].map((testimonial, i) => (
              <div key={i} className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/30 rounded-xl p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="text-gray-300 mb-6 italic">
                  "{testimonial.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{testimonial.author}</div>
                    <div className="text-sm text-gray-400">{testimonial.role} at {testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Got questions? We've got answers.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {[
              {
                question: "Is Boardify free to use?",
                answer: "Yes! Boardify is completely free for small teams. We offer premium features for larger organizations, but the core functionality remains free."
              },
              {
                question: "How many team members can I add?",
                answer: "You can add unlimited team members to your boards. The only limitation is based on your plan type for advanced features."
              },
              {
                question: "Can I export my data?",
                answer: "Absolutely. You can export your boards, tasks, and activity logs in various formats including JSON, CSV, and PDF."
              },
              {
                question: "Is my data secure?",
                answer: "Security is our top priority. All data is encrypted in transit and at rest. We use industry-standard security practices and regular security audits."
              },
              {
                question: "Can I integrate with other tools?",
                answer: "Yes! Boardify integrates with popular tools like Google Calendar, Microsoft Outlook, Slack, and many more through our API."
              },
              {
                question: "What browsers are supported?",
                answer: "Boardify works on all modern browsers including Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated for the best experience."
              }
            ].map((faq, i) => (
              <div key={i} className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-3">{faq.question}</h3>
                <p className="text-gray-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="text-center bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-3xl border border-gray-700/30 p-12">
            <h2 className="text-4xl font-bold text-white mb-4">Ready to Transform Your Workflow?</h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Join thousands of teams already using Boardify to streamline their project management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-2xl shadow-purple-500/30 transition-all transform hover:scale-105"
              >
                Start Your Free Trial
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 text-gray-200 border border-gray-700/50 backdrop-blur-sm font-medium transition-all"
              >
                Sign In to Existing Account
              </a>
            </div>
            <p className="text-sm text-gray-500 mt-6">
              No credit card required • Free for small teams • 14-day trial for premium features
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8 mt-20 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg"></div>
              <span className="text-sm text-gray-400">© {new Date().getFullYear()} Boardify — Built for focused collaboration</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-purple-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-purple-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-purple-400 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}