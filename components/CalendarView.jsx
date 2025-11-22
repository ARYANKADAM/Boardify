'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarView({ boardId }) {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [FullCalendarComp, setFullCalendarComp] = useState(null);
  const [plugins, setPlugins] = useState(null);
  const calendarRef = useRef(null);

  async function fetchEvents(from, to) {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/calendar/${encodeURIComponent(boardId)}`, window.location.origin);
      if (from) url.searchParams.set('from', new Date(from).toISOString());
      if (to) url.searchParams.set('to', new Date(to).toISOString());
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Fetch failed');
      const mapped = (data.tasks || []).map(t => ({ 
        id: t._id || t.id, 
        title: t.title, 
        start: t.dueDate ? new Date(t.dueDate).toISOString() : null, 
        listId: t.listId,
        description: t.description
      }));
      setEvents(mapped);
      return mapped;
    } catch (err) {
      setError(String(err));
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ default: FullCalendar }, { default: dayGridPlugin }, { default: interactionPlugin }] = await Promise.all([
          import('@fullcalendar/react'),
          import('@fullcalendar/daygrid'),
          import('@fullcalendar/interaction'),
        ]);
        try {
          await Promise.all([
            import('@fullcalendar/common/main.css'),
            import('@fullcalendar/daygrid/main.css'),
          ]);
        } catch (cssErr) {
          // ignore
        }
        if (!mounted) return;
        setFullCalendarComp(() => FullCalendar);
        setPlugins([dayGridPlugin, interactionPlugin]);
      } catch (e) {
        // fallback view
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    fetchEvents(first, last);
  }, [boardId]);

  const handleDatesSet = async (arg) => {
    await fetchEvents(arg.start, arg.end);
  };

  const handleEventClick = (clickInfo) => {
    const ev = clickInfo.event;
    const listId = ev.extendedProps && ev.extendedProps.listId;
    const taskId = ev.id;
    try {
      if (listId) {
        const el = document.getElementById(`list-${listId}`);
        if (el && el.scrollIntoView) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.style.transition = 'background-color 0.3s';
          const prev = el.style.backgroundColor;
          el.style.backgroundColor = '#263238';
          setTimeout(() => { el.style.backgroundColor = prev; }, 1200);
          return;
        }
      }
      router.push(`/board/${boardId}${taskId ? `?task=${taskId}` : ''}`);
    } catch (e) {
      alert(`Open task ${taskId || ''} in list ${listId || ''}`);
    }
  };

  // Navigation functions for custom calendar
  const goToPrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
    const first = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
    const last = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0, 23, 59, 59);
    fetchEvents(first, last);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
    const first = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
    const last = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0, 23, 59, 59);
    fetchEvents(first, last);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    fetchEvents(first, last);
  };

  if (FullCalendarComp && plugins) {
    const FullCalendar = FullCalendarComp;
    return (
      <div className="p-2">
        <style jsx global>{`
          .fc {
            background: transparent;
          }
          .fc .fc-toolbar-title {
            color: #e5e7eb;
            font-size: 1.25rem;
            font-weight: 700;
          }
          .fc .fc-button {
            background: rgba(107, 114, 128, 0.2);
            border: 1px solid rgba(107, 114, 128, 0.3);
            color: #9ca3af;
            text-transform: capitalize;
            padding: 0.375rem 0.75rem;
            font-size: 0.875rem;
          }
          .fc .fc-button:hover {
            background: rgba(139, 92, 246, 0.2);
            border-color: rgba(139, 92, 246, 0.3);
            color: #c084fc;
          }
          .fc .fc-button-active {
            background: rgba(139, 92, 246, 0.3);
            border-color: rgba(139, 92, 246, 0.5);
            color: #a78bfa;
          }
          .fc .fc-col-header-cell {
            background: rgba(107, 114, 128, 0.1);
            border-color: rgba(75, 85, 99, 0.3);
            padding: 0.5rem;
          }
          .fc .fc-col-header-cell-cushion {
            color: #9ca3af;
            font-weight: 600;
            font-size: 0.75rem;
            text-transform: uppercase;
          }
          .fc .fc-daygrid-day {
            background: rgba(17, 24, 39, 0.3);
            border-color: rgba(75, 85, 99, 0.3);
          }
          .fc .fc-daygrid-day:hover {
            background: rgba(139, 92, 246, 0.05);
          }
          .fc .fc-daygrid-day-number {
            color: #d1d5db;
            padding: 0.5rem;
            font-size: 0.875rem;
          }
          .fc .fc-day-today {
            background: rgba(139, 92, 246, 0.1) !important;
          }
          .fc .fc-day-today .fc-daygrid-day-number {
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            color: white;
            border-radius: 50%;
            width: 1.75rem;
            height: 1.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
          }
          .fc .fc-event {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.8), rgba(99, 102, 241, 0.8));
            border: 1px solid rgba(139, 92, 246, 0.5);
            border-radius: 0.375rem;
            padding: 0.125rem 0.375rem;
            margin: 0.125rem 0;
            font-size: 0.75rem;
            cursor: pointer;
          }
          .fc .fc-event:hover {
            background: linear-gradient(135deg, rgba(139, 92, 246, 1), rgba(99, 102, 241, 1));
            transform: scale(1.02);
          }
          .fc .fc-event-title {
            color: white;
            font-weight: 500;
          }
          .fc .fc-daygrid-day-events {
            margin-top: 0.25rem;
          }
        `}</style>
        <FullCalendar
          ref={calendarRef}
          plugins={plugins}
          initialView="dayGridMonth"
          events={events.map(e => ({ 
            id: e.id, 
            title: e.title, 
            start: e.start, 
            extendedProps: { listId: e.listId, description: e.description } 
          }))}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          headerToolbar={{ 
            left: 'prev,next today', 
            center: 'title', 
            right: 'dayGridMonth,dayGridWeek,dayGridDay' 
          }}
          height="auto"
        />
      </div>
    );
  }

  // Custom fallback calendar view
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isToday = (day) => {
    return day === today.getDate() && 
           month === today.getMonth() && 
           year === today.getFullYear();
  };

  // Create calendar grid
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Group events by date
  const eventsByDate = {};
  events.forEach(ev => {
    if (!ev.start) return;
    const date = new Date(ev.start);
    if (date.getMonth() === month && date.getFullYear() === year) {
      const day = date.getDate();
      if (!eventsByDate[day]) eventsByDate[day] = [];
      eventsByDate[day].push(ev);
    }
  });

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-12rem)] overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {monthNames[month]} {year}
          </h3>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/30 text-gray-400 hover:text-white transition-all"
              title="Previous Month"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={goToToday}
              className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-all"
            >
              Today
            </button>
            
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/30 text-gray-400 hover:text-white transition-all"
              title="Next Month"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

      {/* Loading/Error States */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-red-400 text-xs">
          {error}
        </div>
      )}
</div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-3 custom-scrollbar">
        {!loading && (
          <>
            {/* Calendar Grid */}
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 border border-gray-700/30 rounded-xl overflow-hidden">
              {/* Day Names Header */}
              <div className="grid grid-cols-7 bg-gray-800/40 border-b border-gray-700/30">
                {dayNames.map(day => (
                  <div key={day} className="p-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const hasEvents = day && eventsByDate[day];
                  const isTodayDate = day && isToday(day);
                  
                  return (
                    <div
                      key={idx}
                      className={`min-h-[70px] p-1.5 border-r border-b border-gray-700/20 transition-all ${
                        day ? 'bg-gray-900/20 hover:bg-purple-900/10' : 'bg-gray-800/10'
                      } ${isTodayDate ? 'bg-purple-900/20 ring-1 ring-purple-500/30' : ''}`}
                    >
                      {day && (
                        <>
                          <div className={`text-xs font-semibold mb-1 ${
                            isTodayDate 
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]' 
                              : 'text-gray-400'
                          }`}>
                            {day}
                          </div>
                          
                          {hasEvents && (
                            <div className="space-y-0.5">
                              {eventsByDate[day].slice(0, 2).map(ev => (
                                <div
                                  key={ev.id}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-gradient-to-r from-purple-600/40 to-indigo-600/40 border border-purple-500/30 text-purple-200 truncate hover:from-purple-600/60 hover:to-indigo-600/60 cursor-pointer transition-all"
                                  title={ev.title}
                                  onClick={() => handleEventClick({ event: { id: ev.id, extendedProps: { listId: ev.listId } } })}
                                >
                                  {ev.title}
                                </div>
                              ))}
                              {eventsByDate[day].length > 2 && (
                                <div className="text-[10px] text-purple-400 font-medium px-1.5">
                                  +{eventsByDate[day].length - 2}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Tasks List */}
            {events.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1.5 sticky top-0 bg-gray-900/50 backdrop-blur-sm py-1 z-10">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Upcoming Tasks
                </h4>
                <div className="space-y-1.5">
                  {events
                    .filter(ev => ev.start && new Date(ev.start) >= new Date())
                    .sort((a, b) => new Date(a.start) - new Date(b.start))
                    .slice(0, 10)
                    .map(ev => {
                      const dueDate = new Date(ev.start);
                      const isOverdue = dueDate < new Date();
                      const isUpcoming = dueDate - new Date() < 7 * 24 * 60 * 60 * 1000;
                      
                      return (
                        <div
                          key={ev.id}
                          className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-2 hover:border-purple-500/30 transition-all cursor-pointer group"
                          onClick={() => handleEventClick({ event: { id: ev.id, extendedProps: { listId: ev.listId } } })}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-medium text-white group-hover:text-purple-300 transition-colors truncate">
                                {ev.title}
                              </h5>
                              {ev.description && (
                                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{ev.description}</p>
                              )}
                            </div>
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${
                              isOverdue
                                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                : isUpcoming
                                ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                                : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                            }`}>
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {events.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-800/30 border border-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-xs">No tasks scheduled this month</p>
                <p className="text-gray-600 text-[10px] mt-0.5">Add due dates to tasks to see them here</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info Tip - Fixed at bottom */}
      <div className="flex-shrink-0 text-[10px] text-gray-600 text-center pt-2 mt-2 border-t border-gray-700/30">
        💡 Install FullCalendar for enhanced experience
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </div>
  );
}