import ShareWSSession from '../components/ShareWSSession';

export default function ShareWSSessionRoute() {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-bold mb-2 text-center">KubeBrowse Session Sharing</h1>
        <p className="text-gray-600 mb-6 text-center">
          Join a shared session to collaborate on the same connection. You'll see exactly what the host sees in real-time.
        </p>
        <ShareWSSession />
      </div>
    </div>
  );
}