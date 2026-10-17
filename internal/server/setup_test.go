package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"rocket-tracker/internal/config"
	"rocket-tracker/internal/setup"
	"rocket-tracker/internal/store"
)

type fakeSetup struct {
	server    *SetupServer
	autostart bool
	finished  bool
}

func (f *fakeSetup) State(ctx context.Context) SetupState {
	return SetupState{InstallDir: `C:\RL`, Server: f.server, Autostart: f.autostart, Done: f.finished}
}

func (f *fakeSetup) EnableStatsAPI(rlDir string) (setup.IniStatus, error) {
	return setup.IniStatus{Found: true, OK: true, PacketSendRate: 30}, nil
}

func (f *fakeSetup) Connect(ctx context.Context, server, token string) (*SetupServer, error) {
	if server == "" {
		f.server = nil
		return nil, nil
	}
	f.server = &SetupServer{URL: server, User: "Alice", Reachable: true}
	return f.server, nil
}

func (f *fakeSetup) Finish(ctx context.Context, autostart bool) (string, error) {
	f.autostart, f.finished = autostart, true
	if f.server != nil {
		return f.server.URL, nil
	}
	return "http://localhost:8765", nil
}

func TestSetupWizardRoutes(t *testing.T) {
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "db.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	cfg, err := config.Load(filepath.Join(dir, "config.json"))
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeSetup{}
	ts := httptest.NewServer((&Server{Version: "test", Store: st, Config: cfg, Setup: f}).Handler())
	t.Cleanup(ts.Close)

	post := func(path, body, origin string) (*http.Response, string) {
		req, _ := http.NewRequest("POST", ts.URL+path, strings.NewReader(body))
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		return doReq(t, req)
	}

	if resp, body := post("/api/setup/server", `{"server":"https://rl.example.com","token":"rtk_x"}`, "https://evil.example"); resp.StatusCode != http.StatusForbidden {
		t.Fatalf("cross-origin connect: %d %s", resp.StatusCode, body)
	}
	if f.server != nil {
		t.Fatal("cross-origin request changed the server")
	}
	if resp, body := post("/api/setup/server", `{"server":"https://rl.example.com","token":"rtk_x"}`, "http://localhost:8765"); resp.StatusCode != 200 || !strings.Contains(body, `"user":"Alice"`) {
		t.Fatalf("connect: %d %s", resp.StatusCode, body)
	}
	resp, body := do(t, "GET", ts.URL+"/api/setup", "")
	var state SetupState
	if resp.StatusCode != 200 || json.Unmarshal([]byte(body), &state) != nil || state.Server == nil || state.Server.URL != "https://rl.example.com" {
		t.Fatalf("state: %d %s", resp.StatusCode, body)
	}
	if resp, body := post("/api/setup/statsapi", `{}`, ""); resp.StatusCode != 200 || !strings.Contains(body, `"ok":true`) {
		t.Fatalf("stats api: %d %s", resp.StatusCode, body)
	}
	if resp, body := post("/api/setup/finish", `{"autostart":true}`, ""); resp.StatusCode != 200 || !strings.Contains(body, `"url":"https://rl.example.com"`) || !f.autostart {
		t.Fatalf("finish: %d %s", resp.StatusCode, body)
	}
}

func TestSetupRoutesOnlyWithWizard(t *testing.T) {
	ts, _ := newTestServer(t)
	if resp, _ := do(t, "GET", ts.URL+"/api/setup", ""); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("without a wizard: %d", resp.StatusCode)
	}
}

func doReq(t *testing.T, req *http.Request) (*http.Response, string) {
	t.Helper()
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp, string(b)
}
