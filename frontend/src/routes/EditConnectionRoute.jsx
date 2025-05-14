import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function EditConnectionRoute() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { connections, updateConnection } = useOutletContext();
  
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
  
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Find the connection with the given ID
    const foundConnection = connections.find(conn => conn.id === id);
    
    if (!foundConnection) {
      setNotFound(true);
      return;
    }
    
    setFormData(foundConnection);
  }, [id, connections]);

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [id]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateConnection(id, formData);
    navigate('/');
  };

  if (notFound) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Not Found</h2>
          <p className="text-gray-700 mb-6">The connection you are trying to edit does not exist.</p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <motion.div 
        className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Edit Connection</h1>
        
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
            <label htmlFor="port" className="block text-gray-700 mb-1 font-medium">Port (if not default)</label>
            <input 
              type="text" 
              id="port" 
              value={formData.port} 
              onChange={handleInputChange} 
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
              value={formData.password || ''} 
              onChange={handleInputChange} 
              placeholder="Leave empty to keep current password"
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
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Update Connection
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
} 