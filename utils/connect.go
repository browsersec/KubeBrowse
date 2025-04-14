package utils

import (
	"html/template"
	"net/http"
	"net/url"
)

// ServeConnectionForm serves the HTMX form and processes form submissions
func ServeConnectionForm(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		// Process form submission
		if err := r.ParseForm(); err != nil {
			http.Error(w, "Error parsing form", http.StatusBadRequest)
			return
		}

		// Build query parameters
		scheme := r.FormValue("scheme")
		hostname := r.FormValue("hostname")
		port := r.FormValue("port")
		username := r.FormValue("username")
		password := r.FormValue("password")
		ignoreCert := r.FormValue("ignore-cert") == "on"
		useNLA := r.FormValue("nla") == "on"
		forceHTTPTunnel := r.FormValue("force-http") == "on"

		// Construct query string
		params := url.Values{}
		params.Set("scheme", scheme)
		params.Set("hostname", hostname)
		if port != "" {
			params.Set("port", port)
		}
		params.Set("username", username)
		params.Set("password", password)
		if ignoreCert {
			params.Set("ignore-cert", "true")
		}
		if useNLA {
			params.Set("nla", "true")
		}
		if forceHTTPTunnel {
			params.Set("force-http", "true")
		}

		queryString := params.Encode()

		// Check if this is an HTMX request
		if r.Header.Get("HX-Request") == "true" {
			// Return both the query string and the connection links for live updates
			w.Header().Set("Content-Type", "text/html")
			tmpl := template.Must(template.New("result").Parse(`
				<div>{{.Query}}</div>
				<div style="margin-top: 15px;">
					<a href="/tunnel?{{.Query}}" target="_blank">Connect via HTTP Tunnel</a> | 
					<a href="/websocket-tunnel?{{.Query}}" target="_blank">Connect via WebSocket</a>
				</div>
			`))

			data := struct {
				Query string
			}{
				Query: queryString,
			}

			tmpl.Execute(w, data)
			return
		}

		// For non-HTMX POST requests, redirect to the form with the query string parameter
		http.Redirect(w, r, "/connect?generated="+url.QueryEscape(queryString), http.StatusSeeOther)
		return
	}

	// Serve the form for GET requests
	generatedQuery := r.URL.Query().Get("generated")

	tmpl := template.Must(template.New("form").Parse(`
<!DOCTYPE html>
<html>
<head>
    <title>HTMX Guacamole client example</title>
    <script src="https://unpkg.com/htmx.org@1.9.6"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            text-align: center;
        }
        .form-group {
            margin-bottom: 15px;
            display: flex;
            align-items: center;
        }
        .form-group label {
            width: 200px;
            text-align: right;
            padding-right: 15px;
        }
        .form-group input {
            flex-grow: 1;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 215px;
        }
        .query-result {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f9f9f9;
            word-break: break-all;
        }
        .ribbon {
            position: absolute;
            top: 0;
            left: 0;
            width: 150px;
            height: 150px;
            overflow: hidden;
        }
        .ribbon-content {
            position: absolute;
            transform: rotate(-45deg);
            top: 30px;
            left: -30px;
            background: red;
            color: white;
            padding: 5px 100px;
            font-weight: bold;
        }
        .loading {
            display: inline-block;
            margin-left: 10px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="ribbon">
        <div class="ribbon-content">For demo only</div>
    </div>
    <h1>HTMX Guacamole client example</h1>
    <h2>Enter connection information to connect</h2>
    
    <form id="connection-form" hx-post="/connect" hx-target="#result-container" hx-trigger="change, input delay:500ms from:input">
        <div class="form-group">
            <label for="scheme">Scheme/Protocol:</label>
            <input type="text" id="scheme" name="scheme" value="rdp">
        </div>
        <div class="form-group">
            <label for="hostname">Hostname or IP Address:</label>
            <input type="text" id="hostname" name="hostname">
        </div>
        <div class="form-group">
            <label for="port">Port (if not default):</label>
            <input type="text" id="port" name="port">
        </div>
        <div class="form-group">
            <label for="username">User name:</label>
            <input type="text" id="username" name="username">
        </div>
        <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password">
        </div>
        <div class="form-group">
            <label for="ignore-cert">Ignore Certificate:</label>
            <input type="checkbox" id="ignore-cert" name="ignore-cert" hx-trigger="click">
        </div>
        <div class="form-group">
            <label for="nla">Use NLA (Windows RDP):</label>
            <input type="checkbox" id="nla" name="nla" hx-trigger="click">
        </div>
        <div class="form-group">
            <label for="force-http">Force HTTP Tunnel:</label>
            <input type="checkbox" id="force-http" name="force-http" hx-trigger="click">
        </div>
        
        <button type="button" hx-post="/connect" hx-target="#result-container">Generate Query String</button>
        <span class="loading" id="loading-indicator" hx-indicator>Updating...</span>
    </form>

    <div class="query-result">
        <h3>Generated Query String:</h3>
        <div id="result-container">
            {{if .Query}}
            <div>{{.Query}}</div>
            <div style="margin-top: 15px;">
                <a href="/tunnel?{{.Query}}" target="_blank">Connect via HTTP Tunnel</a> | 
                <a href="/websocket-tunnel?{{.Query}}" target="_blank">Connect via WebSocket</a>
            </div>
            {{else}}
            <div>Your query string will appear here</div>
            {{end}}
        </div>
    </div>

    <script>
        // Initialize with the current form values
        document.addEventListener('DOMContentLoaded', function() {
            if (document.getElementById('hostname').value) {
                document.getElementById('connection-form').dispatchEvent(new Event('change'));
            }
        });

        // Add indicator for HTMX loading
        htmx.config.indicator = '#loading-indicator';
    </script>
</body>
</html>
	`))

	data := struct {
		Query string
	}{
		Query: generatedQuery,
	}

	tmpl.Execute(w, data)
}
