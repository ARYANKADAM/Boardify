 'use client';
 import ReviewsSection from '../components/ReviewsSection';

 export default function LandingPage() {
   return (
     <main className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900/20 to-gray-900 text-gray-100 relative overflow-hidden">
       {/* Animated background elements */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
         <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
       </div>

       <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
         {/* Header */}
         <nav className="flex items-center justify-between mb-20">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
               <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
               </svg>
             </div>
             <span className="text-xl font-bold bg-linear-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Boardify</span>
           </div>
           <div className="flex gap-3">
             <a href="/login" className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Sign In</a>
             <a href="/register" className="px-5 py-2 rounded-lg bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/20 transition-all">Get Started</a>
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
               <span className="bg-linear-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent">Organize work</span>
               <br />
               <span className="text-gray-100">beautifully</span>
             </h1>

             <p className="text-xl text-gray-400 max-w-xl leading-relaxed">
               Flexible boards, real-time collaboration, and powerful permissions. Everything your team needs to stay in sync, wrapped in an elegant dark interface.
             </p>

             <div className="flex flex-col sm:flex-row gap-4 pt-4">
               <a href="/register" className="group inline-flex items-center justify-center px-8 py-4 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-2xl shadow-purple-500/30 transition-all transform hover:scale-105">
                 Start Free Trial
                 <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                 </svg>
               </a>
               <a href="#features" className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 text-gray-200 border border-gray-700/50 backdrop-blur-sm font-medium transition-all">See Features</a>
             </div>
           </section>

           {/* Right: Feature showcase */}
           <aside className="relative">
             <div className="absolute inset-0 bg-linear-to-br from-purple-600/20 to-indigo-600/20 rounded-3xl blur-2xl"></div>
             <div className="relative bg-linear-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                   <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                   </svg>
                 </div>
                 <h3 className="text-2xl font-bold text-white">Powerful Features</h3>
               </div>

               <div className="space-y-4">
                 {[
                   { icon: '⚡', title: 'Real-time Sync', desc: 'WebSocket-powered live updates across all devices' },
                   { icon: '🔐', title: 'Smart Permissions', desc: 'Fine-grained access control with 4 role types' },
                   { icon: '🎯', title: 'Drag & Drop', desc: 'Intuitive task management with smooth interactions' },
                   { icon: '📊', title: 'Activity Tracking', desc: 'Complete audit trail of all team actions' }
                 ].map((feature, i) => (
                   <div key={i} className="group flex items-start gap-4 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/30 hover:border-purple-500/30 transition-all cursor-pointer">
                     <span className="text-2xl shrink-0">{feature.icon}</span>
                     <div>
                       <h4 className="font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">{feature.title}</h4>
                       <p className="text-sm text-gray-400">{feature.desc}</p>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="mt-8 p-4 rounded-xl bg-linear-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20">
                 <p className="text-sm text-gray-300"><span className="font-semibold text-purple-300">Pro tip:</span> Register as different roles to experience how permissions shape your workflow.</p>
               </div>
             </div>
           </aside>
         </div>

         {/* Stats section */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-16 border-y border-gray-800/50">
           {[{ value: '100+', label: 'Teams onboard' }, { value: '99.9%', label: 'Uptime' }, { value: '<100ms', label: 'Real-time sync' }, { value: '4', label: 'Permission roles' }].map((stat, i) => (
             <div key={i} className="text-center">
               <div className="text-3xl md:text-4xl font-bold bg-linear-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent mb-2">{stat.value}</div>
               <div className="text-sm text-gray-500">{stat.label}</div>
             </div>
           ))}
         </div>

         {/* Detailed Features Section */}
         <section id="features" className="py-20">
           <div className="text-center mb-16">
             <h2 className="text-4xl font-bold text-white mb-4">Everything You Need to Succeed</h2>
             <p className="text-xl text-gray-400 max-w-3xl mx-auto">Powerful features designed to streamline your workflow and boost team productivity</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
             {[
               { icon: '⚡', title: 'Real-time Collaboration', desc: 'See changes instantly as your team works together. No more wondering if someone updated the board.', features: ['Live task updates', 'Instant notifications', 'Concurrent editing'] },
               { icon: '🔐', title: 'Advanced Permissions', desc: 'Control who can see and edit what with our flexible role-based access system.', features: ['Owner, Admin, Member, Viewer roles', 'Board-level permissions', 'Granular access control'] },
               { icon: '🎯', title: 'Intuitive Drag & Drop', desc: 'Move tasks between lists with smooth animations and instant visual feedback.', features: ['Smooth animations', 'Multi-task selection', 'Keyboard shortcuts'] },
               { icon: '📊', title: 'Activity Tracking', desc: 'Keep track of everything that happens on your boards with detailed activity logs.', features: ['Complete audit trail', 'User activity history', 'Export capabilities'] },
               { icon: '📱', title: 'Cross-Platform', desc: 'Access your boards from any device with our responsive web interface.', features: ['Mobile optimized', 'Tablet support', 'Desktop experience'] },
               { icon: '🔗', title: 'Integrations', desc: 'Connect with your favorite tools and services to streamline your workflow.', features: ['Calendar sync', 'Google Workspace', 'Microsoft Outlook'] }
             ].map((feature, i) => (
               <div key={i} className="group bg-linear-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/30 rounded-xl p-6 hover:border-purple-500/30 transition-all">
                 <div className="text-4xl mb-4">{feature.icon}</div>
                 <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-purple-300 transition-colors">{feature.title}</h3>
                 <p className="text-gray-400 mb-4">{feature.desc}</p>
                 <ul className="space-y-2">
                   {feature.features.map((item, j) => (
                     <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                       <svg className="w-4 h-4 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
       </div>

       {/* Reviews Section (dynamic) */}
       <ReviewsSection />

       {/* Footer */}
       <footer className="border-t border-gray-800/50 py-8 mt-20 relative z-10">
         <div className="max-w-7xl mx-auto px-6">
           <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-2">
               <div className="w-6 h-6 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg"></div>
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
