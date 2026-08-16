// 'use client';

// import { useState, useEffect, useCallback, useRef } from 'react';
// import { db } from '../lib/firebaseClient';
// import {
//   ref,
//   query,
//   orderByChild,
//   startAt,
//   onChildAdded,
//   off,
// } from 'firebase/database';

// export default function BoardAnalytics({ boardId }) {
//   const [analytics, setAnalytics] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   // Prevent multiple analytics requests if several events arrive quickly
//   const refreshTimeoutRef = useRef(null);

//   /**
//    * Fetch analytics from API
//    */
//   const fetchAnalytics = useCallback(async () => {
//     if (!boardId) return;

//     try {
//       const token = localStorage.getItem('token');

//       if (!token) {
//         setError('Authentication token not found');
//         setLoading(false);
//         return;
//       }

//       const response = await fetch(`/api/boards/${boardId}/analytics`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });

//       if (!response.ok) {
//         const data = await response.json().catch(() => ({}));
//         throw new Error(data?.error || 'Failed to fetch analytics');
//       }

//       const data = await response.json();

//       setAnalytics(data);
//       setError(null);
//     } catch (err) {
//       console.error('Failed to fetch analytics:', err);
//       setError(err.message || 'Failed to fetch analytics');
//     } finally {
//       setLoading(false);
//     }
//   }, [boardId]);

//   /**
//    * Refresh analytics with a small debounce.
//    *
//    * This prevents 3-4 API calls if multiple Firebase events
//    * are generated for the same action.
//    */
//   const scheduleAnalyticsRefresh = useCallback(() => {
//     if (refreshTimeoutRef.current) {
//       clearTimeout(refreshTimeoutRef.current);
//     }

//     refreshTimeoutRef.current = setTimeout(() => {
//       fetchAnalytics();
//     }, 150);
//   }, [fetchAnalytics]);

//   /**
//    * Initial fetch + Firebase realtime listener
//    */
//   useEffect(() => {
//     if (!boardId) return;

//     // Initial analytics load
//     fetchAnalytics();

//     /**
//      * Firebase RTDB realtime events
//      *
//      * Your application stores realtime events at:
//      *
//      * boards/{boardId}/events
//      *
//      * We only listen for events created after this component
//      * mounted so old events don't cause unnecessary refreshes.
//      */
//     const joinedAt = Date.now();

//     const eventsRef = query(
//       ref(db, `boards/${boardId}/events`),
//       orderByChild('timestamp'),
//       startAt(joinedAt)
//     );

//     const handleNewEvent = (snapshot) => {
//       const eventData = snapshot.val();

//       if (!eventData) return;

//       const { event, data } = eventData;

//       console.log('Analytics Firebase event:', event, data);

//       // Ignore events for another board
//       if (
//         eventData.boardId &&
//         String(eventData.boardId) !== String(boardId)
//       ) {
//         return;
//       }

//       /**
//        * These events can change analytics.
//        */
//       const analyticsEvents = [
//         'task:created',
//         'task:moved',
//         'task:deleted',
//         'task:updated',
//         'task:completed',
//       ];

//       if (analyticsEvents.includes(event)) {
//         console.log(
//           `Analytics: ${event} detected. Refreshing analytics...`
//         );

//         scheduleAnalyticsRefresh();
//       }
//     };

//     // Start realtime listener
//     onChildAdded(eventsRef, handleNewEvent);

//     /**
//      * Cleanup
//      */
//     return () => {
//       off(eventsRef, 'child_added', handleNewEvent);

//       if (refreshTimeoutRef.current) {
//         clearTimeout(refreshTimeoutRef.current);
//         refreshTimeoutRef.current = null;
//       }
//     };
//   }, [boardId, fetchAnalytics, scheduleAnalyticsRefresh]);

//   /**
//    * Loading state
//    */
//   if (loading) {
//     return (
//       <div className="flex items-center justify-center py-12">
//         <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>

//         <span className="ml-3 text-gray-400">
//           Loading analytics...
//         </span>
//       </div>
//     );
//   }

//   /**
//    * Error state
//    */
//   if (error) {
//     return (
//       <div className="text-center py-12">
//         <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
//           <svg
//             className="w-8 h-8 text-red-400"
//             fill="none"
//             stroke="currentColor"
//             viewBox="0 0 24 24"
//           >
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               strokeWidth={2}
//               d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
//             />
//           </svg>
//         </div>

//         <p className="text-red-400 font-medium">
//           Failed to load analytics
//         </p>

//         <p className="text-gray-500 text-sm mt-1">
//           {error}
//         </p>
//       </div>
//     );
//   }

//   if (!analytics) return null;

//   const {
//     overview,
//     burndownData,
//     teamProductivity,
//     priorityStats,
//   } = analytics;

//   return (
//     <div className="min-h-full bg-[#0b1020] text-gray-100">
//       <div className="space-y-6 p-4 sm:p-6 lg:p-8">

//         {/* =========================
//             FILTER BAR
//         ========================== */}
//         <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
//           <div>
//             <p className="text-xs uppercase tracking-[0.2em] text-purple-400/80">
//               Performance
//             </p>
//             <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
//               Board Analytics
//             </h2>
//             <p className="mt-1 text-sm text-gray-500">
//               A clean overview of your board activity and team performance.
//             </p>
//           </div>

//           <div className="flex flex-wrap items-center gap-3">
//             <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#151b2c] px-4 py-2.5 text-sm text-gray-200 shadow-lg shadow-black/10 transition hover:border-purple-500/30 hover:bg-[#192036]">
//               <svg className="h-4 w-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M4 11h16M6 21h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
//               </svg>
//               Last 30 Days
//             </button>

//             <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#151b2c] px-4 py-2.5 text-sm text-gray-300 transition hover:border-purple-500/30 hover:bg-[#192036]">
//               Custom Range
//               <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 9l6 6 6-6" />
//               </svg>
//             </button>
//           </div>
//         </div>

//         {/* =========================
//             KPI CARDS
//         ========================== */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

//           {/* Total */}
//           <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.12] via-[#151b2c] to-[#111727] p-5">
//             <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl" />
//             <div className="relative flex items-start justify-between">
//               <div>
//                 <p className="text-sm font-medium text-blue-300">Total Tasks</p>
//                 <p className="mt-2 text-3xl font-bold text-white">{overview.totalTasks}</p>
//                 <p className="mt-1 text-xs text-gray-500">Across this board</p>
//               </div>
//               <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-400/10">
//                 <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a3 3 0 016 0M9 5a3 3 0 006 0" />
//                 </svg>
//               </div>
//             </div>
//           </div>

//           {/* Completed */}
//           <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.12] via-[#151b2c] to-[#111727] p-5">
//             <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
//             <div className="relative flex items-start justify-between">
//               <div>
//                 <p className="text-sm font-medium text-emerald-300">Completed Tasks</p>
//                 <p className="mt-2 text-3xl font-bold text-white">{overview.completedTasks}</p>
//                 <p className="mt-1 text-xs text-emerald-300/80">
//                   {overview.completionRate}% completion rate
//                 </p>
//               </div>
//               <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-400/10">
//                 <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
//                 </svg>
//               </div>
//             </div>
//           </div>

//           {/* Due soon */}
//           <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.12] via-[#151b2c] to-[#111727] p-5">
//             <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" />
//             <div className="relative flex items-start justify-between">
//               <div>
//                 <p className="text-sm font-medium text-amber-300">Due Soon</p>
//                 <p className="mt-2 text-3xl font-bold text-white">{overview.dueSoonTasks}</p>
//                 <p className="mt-1 text-xs text-gray-500">Needs your attention</p>
//               </div>
//               <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/10">
//                 <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
//                 </svg>
//               </div>
//             </div>
//           </div>

//           {/* Overdue */}
//           <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.10] via-[#151b2c] to-[#111727] p-5">
//             <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-rose-500/10 blur-2xl" />
//             <div className="relative flex items-start justify-between">
//               <div>
//                 <p className="text-sm font-medium text-rose-300">Overdue</p>
//                 <p className="mt-2 text-3xl font-bold text-white">{overview.overdueTasks}</p>
//                 <p className="mt-1 text-xs text-gray-500">
//                   {overview.overdueTasks === 0 ? 'Everything is on track' : 'Requires attention'}
//                 </p>
//               </div>
//               <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-400/10">
//                 <svg className="h-5 w-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
//                 </svg>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* =========================
//             CHARTS
//         ========================== */}
//         <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

//           {/* Burndown */}
//           <div className="rounded-2xl border border-white/[0.07] bg-[#111727]/80 p-5 sm:p-6 shadow-xl shadow-black/10">
//             <div className="flex items-center justify-between gap-3 mb-6">
//               <div>
//                 <p className="text-xs uppercase tracking-[0.16em] text-purple-400/80">Progress</p>
//                 <h3 className="mt-1 text-lg sm:text-xl font-semibold text-white">Burndown</h3>
//               </div>
//               <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-500">
//                 14 days
//               </span>
//             </div>

//             <div className="relative h-64 sm:h-72">
//               <div className="absolute inset-0 flex flex-col justify-between">
//                 {[0, 1, 2, 3].map((line) => (
//                   <div key={line} className="border-t border-white/[0.05]" />
//                 ))}
//               </div>

//               <div className="absolute inset-x-0 bottom-8 top-3 flex items-end gap-1.5 sm:gap-2">
//                 {burndownData.slice(-14).map((day) => {
//                   const maxRemaining = Math.max(
//                     ...burndownData.map((d) => d.remaining),
//                     1
//                   );

//                   const height = Math.max(
//                     8,
//                     (day.remaining / maxRemaining) * 88
//                   );

//                   return (
//                     <div
//                       key={day.date}
//                       className="group relative flex h-full flex-1 items-end justify-center"
//                     >
//                       <div
//                         className="w-full max-w-7 rounded-t-md bg-gradient-to-t from-purple-600 to-violet-400 opacity-80 transition-all duration-300 group-hover:opacity-100 group-hover:from-purple-500 group-hover:to-fuchsia-400"
//                         style={{ height: `${height}%` }}
//                         title={`${day.date}: ${day.remaining} tasks remaining`}
//                       />
//                       <span className="absolute -bottom-7 whitespace-nowrap text-[9px] sm:text-[10px] text-gray-600">
//                         {new Date(day.date).toLocaleDateString('en-US', {
//                           month: 'short',
//                           day: 'numeric',
//                         })}
//                       </span>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>

//             <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-4">
//               <div>
//                 <p className="text-xs text-gray-500">Current remaining</p>
//                 <p className="mt-1 text-lg font-semibold text-white">
//                   {burndownData.length ? burndownData[burndownData.length - 1].remaining : 0}
//                 </p>
//               </div>
//               <p className="text-xs text-gray-500">Tasks remaining over time</p>
//             </div>
//           </div>

//           {/* Priority */}
//           <div className="rounded-2xl border border-white/[0.07] bg-[#111727]/80 p-5 sm:p-6 shadow-xl shadow-black/10">
//             <div className="flex items-center justify-between gap-3 mb-6">
//               <div>
//                 <p className="text-xs uppercase tracking-[0.16em] text-amber-400/80">Workload</p>
//                 <h3 className="mt-1 text-lg sm:text-xl font-semibold text-white">Priority Distribution</h3>
//               </div>
//               <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-500">
//                 {overview.totalTasks} tasks
//               </span>
//             </div>

//             <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] items-center gap-6">
//               {/* Donut */}
//               <div className="relative mx-auto h-48 w-48">
//                 <div
//                   className="absolute inset-0 rounded-full"
//                   style={{
//                     background: `conic-gradient(
//                       #ef4444 0deg ${(priorityStats.high / Math.max(overview.totalTasks, 1)) * 360}deg,
//                       #f59e0b ${(priorityStats.high / Math.max(overview.totalTasks, 1)) * 360}deg ${((priorityStats.high + priorityStats.medium) / Math.max(overview.totalTasks, 1)) * 360}deg,
//                       #22c55e ${((priorityStats.high + priorityStats.medium) / Math.max(overview.totalTasks, 1)) * 360}deg 360deg
//                     )`,
//                   }}
//                 />
//                 <div className="absolute inset-[24px] rounded-full bg-[#111727] border border-white/[0.06] flex flex-col items-center justify-center">
//                   <span className="text-3xl font-bold text-white">{overview.totalTasks}</span>
//                   <span className="text-xs text-gray-500">tasks</span>
//                 </div>
//               </div>

//               {/* Legend */}
//               <div className="space-y-3">
//                 {[
//                   { label: 'High Priority', value: priorityStats.high, dot: 'bg-rose-500', text: 'text-rose-300' },
//                   { label: 'Medium Priority', value: priorityStats.medium, dot: 'bg-amber-400', text: 'text-amber-300' },
//                   { label: 'Low Priority', value: priorityStats.low, dot: 'bg-emerald-400', text: 'text-emerald-300' },
//                 ].map((item) => (
//                   <div
//                     key={item.label}
//                     className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3"
//                   >
//                     <div className="flex items-center gap-3">
//                       <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
//                       <span className="text-sm text-gray-300">{item.label}</span>
//                     </div>
//                     <span className={`text-sm font-semibold ${item.text}`}>{item.value}</span>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* =========================
//             TEAM PRODUCTIVITY
//         ========================== */}
//         <div className="rounded-2xl border border-white/[0.07] bg-[#111727]/80 p-5 sm:p-6 shadow-xl shadow-black/10">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
//             <div>
//               <p className="text-xs uppercase tracking-[0.16em] text-indigo-400/80">Collaboration</p>
//               <h3 className="mt-1 text-lg sm:text-xl font-semibold text-white">Team Productivity</h3>
//             </div>
//             <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-gray-500">
//               {teamProductivity.length} {teamProductivity.length === 1 ? 'member' : 'members'}
//             </div>
//           </div>

//           {teamProductivity.length > 0 ? (
//             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
//               {teamProductivity.map((member) => (
//                 <div
//                   key={member.email}
//                   className="rounded-xl border border-white/[0.06] bg-[#0d1424]/80 p-4 transition hover:border-purple-500/20 hover:bg-[#10182b]"
//                 >
//                   <div className="flex items-center justify-between gap-3">
//                     <div className="flex min-w-0 items-center gap-3">
//                       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-purple-500/30 to-indigo-500/20 text-sm font-bold text-purple-200">
//                         {member.name.charAt(0).toUpperCase()}
//                       </div>
//                       <div className="min-w-0">
//                         <p className="truncate text-sm font-semibold text-white">{member.name}</p>
//                         <p className="truncate text-xs text-gray-500">{member.email}</p>
//                       </div>
//                     </div>

//                     <div className="text-right shrink-0">
//                       <p className="text-sm font-semibold text-white">
//                         {member.completedTasks}/{member.totalTasks}
//                       </p>
//                       <p className="text-[10px] text-gray-600">completed</p>
//                     </div>
//                   </div>

//                   <div className="mt-4">
//                     <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
//                       <div
//                         className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
//                         style={{ width: `${member.completionRate}%` }}
//                       />
//                     </div>

//                     <div className="mt-2 flex items-center justify-between">
//                       <span className="text-[11px] text-gray-500">Completion rate</span>
//                       <span className="text-xs font-medium text-indigo-300">
//                         {member.completionRate.toFixed(1)}%
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <div className="rounded-xl border border-dashed border-white/[0.08] py-12 text-center">
//               <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.06]">
//                 <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
//                 </svg>
//               </div>
//               <p className="mt-3 text-sm text-gray-500">No team member data available</p>
//               <p className="mt-1 text-xs text-gray-600">
//                 Assign tasks to team members to see productivity metrics.
//               </p>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }