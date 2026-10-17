package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"rocket-tracker/internal/setup"
)

// Setup runs the steps of the installation wizard (web/setup.html) for the
// local dashboard: the app implements it (it needs the executable, the
// registry and the agent).
type Setup interface {
	State(ctx context.Context) SetupState
	// EnableStatsAPI turns the Stats API on in the game ini (rlDir "" =
	// detected), asking for administrator rights when needed.
	EnableStatsAPI(rlDir string) (setup.IniStatus, error)
	// Connect checks the server and the device token, saves them and starts
	// sending the matches. An empty server disconnects (local only).
	Connect(ctx context.Context, server, token string) (*SetupServer, error)
	// Finish registers (or removes) the autostart, marks the setup as done and
	// returns the dashboard to open: the server when it answers, else the local one.
	Finish(ctx context.Context, autostart bool) (url string, err error)
}

// SetupState is what the wizard shows.
type SetupState struct {
	InstallDir string          `json:"install_dir"` // "" = Rocket League not found
	Ini        setup.IniStatus `json:"ini"`
	Autostart  bool            `json:"autostart"`
	Done       bool            `json:"done"`
	Server     *SetupServer    `json:"server"` // nil = local only
}

// SetupServer is the server this PC sends its matches to.
type SetupServer struct {
	URL       string `json:"url"`
	User      string `json:"user,omitempty"`
	Device    string `json:"device,omitempty"`
	Reachable bool   `json:"reachable"`
}

func (s *Server) setupRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/setup", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, s.Setup.State(r.Context()))
	})
	mux.HandleFunc("POST /api/setup/statsapi", s.setupPost(func(w http.ResponseWriter, r *http.Request, body setupBody) {
		ini, err := s.Setup.EnableStatsAPI(strings.TrimSpace(body.RLDir))
		if err != nil {
			writeErr(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		s.iniMu.Lock()
		s.iniAt = time.Time{}
		s.iniMu.Unlock()
		writeJSON(w, http.StatusOK, ini)
	}))
	mux.HandleFunc("POST /api/setup/server", s.setupPost(func(w http.ResponseWriter, r *http.Request, body setupBody) {
		srv, err := s.Setup.Connect(r.Context(), strings.TrimSpace(body.Server), strings.TrimSpace(body.Token))
		if err != nil {
			writeErr(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"server": srv})
	}))
	mux.HandleFunc("POST /api/setup/finish", s.setupPost(func(w http.ResponseWriter, r *http.Request, body setupBody) {
		u, err := s.Setup.Finish(r.Context(), body.Autostart)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"url": u})
	}))
}

type setupBody struct {
	RLDir     string `json:"rl_dir"`
	Server    string `json:"server"`
	Token     string `json:"token"`
	Autostart bool   `json:"autostart"`
}

// setupPost refuses requests from other sites (the steps edit the game files
// and the registry) and decodes the body.
func (s *Server) setupPost(h func(http.ResponseWriter, *http.Request, setupBody)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !localOrigin(r) {
			writeErr(w, http.StatusForbidden, "cross-origin request refused")
			return
		}
		var body setupBody
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<14)).Decode(&body); err != nil && err != io.EOF {
			writeErr(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		h(w, r, body)
	}
}
