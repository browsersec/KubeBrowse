package utils

import (
	"html/template"
	"net/http"
	"net/url"
	"os"

	log "github.com/sirupsen/logrus"
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

	b, err := os.ReadFile("templates/connect.html")
	if err != nil {
		log.Fatalf("could not read template file: %v", err)
	}

	tmpl := template.Must(template.New("form").Parse(string(b)))

	data := struct {
		Query string
	}{
		Query: generatedQuery,
	}

	tmpl.Execute(w, data)
}
