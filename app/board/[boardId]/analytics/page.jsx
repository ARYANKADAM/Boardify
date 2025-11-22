'use client';

import { useParams, useRouter } from 'next/navigation';
import BoardAnalytics from '../../../../components/BoardAnalytics';

export default function AnalyticsPage() {
  const { boardId } = useParams();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-gray-100">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-xl border-b border-gray-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              onClick={() => router.push(`/board/${boardId}`)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-white transition-all shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-gray-300 bg-clip-text text-transparent truncate">
                Board Analytics
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 truncate">Performance insights and metrics</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-26 px-4 pb-6">
        <BoardAnalytics boardId={boardId} />
      </div>
    </div>
  );
}