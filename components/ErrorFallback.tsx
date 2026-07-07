// Shown when an unhandled render error reaches the top-level Sentry
// ErrorBoundary (see main.tsx). If VITE_SENTRY_DSN is set, Sentry has
// already captured the error by the time this renders.
export default function ErrorFallback() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h1>
        <p className="text-gray-600 text-sm mb-6">
          We hit an unexpected error. Reloading the page usually fixes it.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
