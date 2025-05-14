import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NewConnectionRoute() {
  const navigate = useNavigate();
  const { addConnection } = useOutletContext();

  const [formData, setFormData] = useState({
    name: '',
    scheme: 'rdp',
    hostname: '0.0.0.0',
    port: '',
    username: '',
    password: '',
    ignoreCert: true,
    security: '',
  });

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [id]: type === 'checkbox' ? checked : value
    });
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const newConnection = addConnection(formData);
      navigate('/');
    } catch (error) {
      console.error("Failed to add connection:", error);
      setError("Failed to save connection. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <motion.div
        className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-6">New Connection</h1>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-gray-700 mb-1 font-medium">Connection Name</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="My Connection"
              className="w-full px-3 py-2 bg-gray-50 text-gray-800 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="scheme" className="block text-gray-700 mb-1 font-medium">Scheme/Protocol</label>
            <select
              id="scheme"
              value={formData.scheme}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-50 text-gray-800 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="rdp">RDP</option>
              <option value="vnc">VNC</option>
              <option value="ssh">SSH</option>
              <option value="telnet">Telnet</option>
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="hostname" className="block text-gray-700 mb-1 font-medium">Hostname or IP Address</label>
            <input
              type="text"
              id="hostname"
              value={formData.hostname}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-50 text-gray-800 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="port"
              className="block text-gray-700 mb-1 font-medium"
            >
              Port (if not default)
            </label>
            <input
              type="text"
              id="port"
              value={formData.port}
              onChange={handleInputChange}
              pattern="^$|^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$"
              title="Port number must be between 1 and 65535"
              className="w-full px-3 py-2 bg-gray-50 text-gray-800 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="username" className="block text-gray-700 mb-1 font-medium">Username</label>
            <input
              type="text"
              id="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-50 text-gray-800 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-gray-700 mb-1 font-medium">Password</label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={handleInputChange}
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-gray-50 text-gray-800 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              id="ignoreCert"
              checked={formData.ignoreCert}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="ignoreCert" className="ml-2 text-gray-700">Ignore Certificate</label>
          </div>

          <div className="mb-6">
            <label htmlFor="security" className="block text-gray-700 mb-1 font-medium">Security</label>
            <input
              type="text"
              id="security"
              value={formData.security}
              onChange={handleInputChange}
              placeholder="e.g., nla for Network Level Authentication"
              className="w-full px-3 py-2 bg-gray-50 text-gray-800 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            {error && <div className="text-red-500 mb-4">{error}</div>}``
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Saving...' : 'Save Connection'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
} 