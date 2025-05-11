import { useState, useEffect } from 'react';
import GuacClient from './components/GuacClient';
import './App.css';

function App() {
  const [connect, setConnect] = useState(false);
  const [formData, setFormData] = useState({
    scheme: 'rdo',
    hostname: '0.0.0.0',
    port: '',
    user: '',
    pass: '',
    ignoreCert: true,
    security: '',
    forceHttp: false,
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    // Load saved connection details from localStorage on mount
    if (window.localStorage && window.localStorage.getItem('query')) {
      try {
        const query = JSON.parse(window.localStorage.getItem('query'));
        setFormData({
          scheme: query.scheme || 'rdp',
          hostname: query.hostname || '0.0.0.0',
          port: query.port || '',
          user: query.username || '',
          pass: query.password || '',
          ignoreCert: query['ignore-cert'] !== false,
          security: query.security || '',
          forceHttp: query.forceHttp || false,
          width: window.innerWidth,
          height: window.innerHeight
        });
      } catch (e) {
        window.localStorage.setItem('query', '{}');
      }
    }

    // Update dimensions if window is resized before connection
    const handleResize = () => {
      setFormData(prevData => ({
        ...prevData,
        width: window.innerWidth,
        height: window.innerHeight
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [id]: type === 'checkbox' ? checked : value
    });
  };

  const buildQueryObj = () => {
    return {
      scheme: formData.scheme,
      hostname: formData.hostname,
      port: formData.port,
      'ignore-cert': formData.ignoreCert,
      security: formData.security,
      username: formData.user,
      password: formData.pass,
      width: Math.round(formData.width * (window.devicePixelRatio || 1)),
      height: Math.round(formData.height * (window.devicePixelRatio || 1))
    };
  };

  const buildQueryString = () => {
    const queryString = [];
    const queryObj = buildQueryObj();
    
    for (const [k, v] of Object.entries(queryObj)) {
      if (v) {
        queryString.push(`${k}=${encodeURIComponent(v)}`);
      }
    }
    
    return queryString.join("&");
  };

  const getScrubbedQuery = () => {
    return buildQueryString().replace(/password=[^&]+/, 'password=****');
  };

  const handleConnect = () => {
    if (window.localStorage) {
      window.localStorage.setItem('query', JSON.stringify(buildQueryObj()));
    }
    setConnect(true);
  };

  return (
    <div className="container">
      {/* <a style={{ position: 'fixed' }} href="https://github.com/wwt/guac-vue">
        <img 
          width="149" 
          height="149"
          src="https://github.blog/wp-content/uploads/2008/12/forkme_left_red_aa0000.png?resize=149%2C149"
          alt="Fork me on GitHub" 
        />
      </a> */}
      
      {!connect ? (
        <div id="app">
          <h1>React Guacamole client example</h1>
          <p>Enter connection information to connect</p>

          <div className="field">
            <label htmlFor="scheme">Scheme/Protocol</label>
            <input 
              type="text" 
              id="scheme" 
              value={formData.scheme} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="field">
            <label htmlFor="hostname">Hostname or IP Address</label>
            <input 
              type="text" 
              id="hostname" 
              value={formData.hostname} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="field">
            <label htmlFor="port">Port (if not default)</label>
            <input 
              type="text" 
              id="port" 
              value={formData.port} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="field">
            <label htmlFor="user">User name</label>
            <input 
              type="text" 
              id="user" 
              value={formData.user} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="field">
            <label htmlFor="pass">Password</label>
            <input 
              type="password" 
              id="pass" 
              value={formData.pass} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="field">
            <label htmlFor="ignoreCert">Ignore Certificate</label>
            <span>
              <input 
                type="checkbox" 
                id="ignoreCert" 
                checked={formData.ignoreCert} 
                onChange={handleInputChange} 
              />
            </span>
          </div>

          <div className="field">
            <label htmlFor="security">Security</label>
            <input 
              type="text" 
              id="security" 
              value={formData.security} 
              onChange={handleInputChange} 
              placeholder="type nla here for Network Level Authentication" 
            />
          </div>

          <div className="field">
            <label>Query string</label>
            <span className="pl-1">{getScrubbedQuery()}</span>
          </div>

          <div className="field">
            <label htmlFor="forceHttp">Force HTTP Tunnel</label>
            <span>
              <input 
                type="checkbox" 
                id="forceHttp" 
                checked={formData.forceHttp} 
                onChange={handleInputChange} 
              />
            </span>
          </div>

          <div className="center">
            <button className="connect" onClick={handleConnect}>Connect</button>
          </div>
        </div>
      ) : (
        <GuacClient query={buildQueryString()} forceHttp={formData.forceHttp} />
      )}
    </div>
  );
}

export default App;