export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-green-100">
      <div className="bg-white p-10 rounded-lg shadow-lg flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-4 text-blue-700">Task Manager</h1>
        <p className="mb-8 text-gray-600 text-center">Collaborate with your team in real-time. Organize boards, assign tasks, and track progress instantly.</p>
        <div className="flex gap-4">
          <a href="/login" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold">Sign In</a>
          <a href="/register" className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold">Register</a>
        </div>
      </div>
    </div>
  );
}
