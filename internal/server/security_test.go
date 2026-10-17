package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"
)

// A page of another site can send "simple" requests (text/plain, multipart)
// to the local dashboard without a CORS preflight: guard must refuse them.
func TestLocalCSRF(t *testing.T) {
	ts, _ := newTestServer(t)
	u, _ := url.Parse(ts.URL)
	_, port, _ := strings.Cut(u.Host, ":")
	otherPort := "http://127.0.0.1:" + strconv.Itoa(mustAtoi(t, port)+1)

	post := func(path, ctype, body string, hdr ...string) int {
		t.Helper()
		req, _ := http.NewRequest("POST", ts.URL+path, strings.NewReader(body))
		req.Header.Set("Content-Type", ctype)
		for i := 0; i+1 < len(hdr); i += 2 {
			req.Header.Set(hdr[i], hdr[i+1])
		}
		resp, _ := doReq(t, req)
		return resp.StatusCode
	}
	ranks := func() int {
		t.Helper()
		_, body := do(t, "GET", ts.URL+"/api/ranks", "")
		var rs []json.RawMessage
		if err := json.Unmarshal([]byte(body), &rs); err != nil {
			t.Fatalf("ranks: %s", body)
		}
		return len(rs)
	}
	rank := `{"playlist":"2v2","mmr":1000}`

	for _, c := range []struct {
		name string
		hdr  []string
	}{
		{"other site", []string{"Origin", "https://evil.example"}},
		{"other site, http", []string{"Origin", "http://evil.example"}},
		{"other localhost port", []string{"Origin", otherPort}},
		{"localhost, other port", []string{"Origin", "http://localhost:" + strconv.Itoa(mustAtoi(t, port)+1)}},
		{"same host, https", []string{"Origin", "https://" + u.Host}},
		{"opaque origin", []string{"Origin", "null"}},
		{"cross-site, no Origin", []string{"Sec-Fetch-Site", "cross-site"}},
		{"same-site, no Origin", []string{"Sec-Fetch-Site", "same-site"}},
	} {
		if code := post("/api/ranks", "text/plain", rank, c.hdr...); code != http.StatusForbidden {
			t.Errorf("%s: %d", c.name, code)
		}
	}
	if n := ranks(); n != 0 {
		t.Fatalf("cross-site requests stored %d ranks", n)
	}
	if code := post("/api/trainings", "text/plain", `{"duration_s":600}`, "Origin", "https://evil.example"); code != http.StatusForbidden {
		t.Errorf("cross-site training: %d", code)
	}
	if code := post("/api/import", "multipart/form-data; boundary=x", "--x--\r\n", "Origin", "https://evil.example"); code != http.StatusForbidden {
		t.Errorf("cross-site import: %d", code)
	}
	req, _ := http.NewRequest("DELETE", ts.URL+"/api/ranks/1", nil)
	req.Header.Set("Origin", "https://evil.example")
	if resp, _ := doReq(t, req); resp.StatusCode != http.StatusForbidden {
		t.Errorf("cross-site delete: %d", resp.StatusCode)
	}

	// The dashboard itself (same origin), and tools that are not browsers.
	if code := post("/api/ranks", "application/json", rank, "Origin", ts.URL, "Sec-Fetch-Site", "same-origin"); code != http.StatusCreated {
		t.Fatalf("same origin: %d", code)
	}
	if code := post("/api/ranks", "application/json", rank, "Origin", "http://"+strings.ToUpper(u.Host)); code != http.StatusCreated {
		t.Fatalf("same origin, other case: %d", code)
	}
	if code := post("/api/ranks", "application/json", rank, "Sec-Fetch-Site", "same-origin"); code != http.StatusCreated {
		t.Fatalf("same origin without Origin: %d", code)
	}
	if code := post("/api/ranks", "application/json", rank); code != http.StatusCreated {
		t.Fatalf("no Origin: %d", code)
	}
	if n := ranks(); n != 4 {
		t.Fatalf("ranks %d, want 4", n)
	}
	// Reads stay open to cross-site requests' preflights and navigations.
	req, _ = http.NewRequest("GET", ts.URL+"/api/ranks", nil)
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	if resp, _ := doReq(t, req); resp.StatusCode != http.StatusOK {
		t.Fatalf("cross-site GET: %d", resp.StatusCode)
	}
}

func mustAtoi(t *testing.T, s string) int {
	t.Helper()
	n, err := strconv.Atoi(s)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func TestSafeNext(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		{"/", "/"},
		{"/#/joueurs", "/#/joueurs"},
		{"/players/alice?tab=ranks&days=30", "/players/alice?tab=ranks&days=30"},
		{"/a/b?next=/c#x", "/a/b?next=/c#x"},
		{"", "/"},
		{"joueurs", "/"},
		{"https://evil.example", "/"},
		{"//evil.example", "/"},
		{"///evil.example", "/"},
		{"/\\evil.example", "/"},
		{"/\\\\evil.example", "/"},
		{"/a\\b", "/"},
		{"/\t/evil.example", "/"},
		{"/\t\\evil.example", "/"},
		{"/\r/evil.example", "/"},
		{"/\n/evil.example", "/"},
		{"/\r\n/evil.example", "/"},
		{"/ok\x00", "/"},
		{"/ok\x7f", "/"},
		{"/ok\x1b", "/"},
		{"/auth/login", "/"},
		{"/auth/callback?code=x", "/"},
		{"/%zz", "/"},
	} {
		if got := safeNext(c.in); got != c.want {
			t.Errorf("safeNext(%q) = %q, want %q", c.in, got, c.want)
		}
	}
	// As they arrive from the query string (decoded by r.URL.Query()).
	for _, raw := range []string{"%2F%09%2Fevil.example", "/%09/evil.example", "/%5Cevil.example", "%2F%2Fevil.example",
		"/%0D%0A/evil.example", "/%7F/x", "/%00"} {
		q, err := url.ParseQuery("next=" + raw)
		if err != nil {
			t.Fatal(err)
		}
		if got := safeNext(q.Get("next")); got != "/" {
			t.Errorf("safeNext(decoded %s) = %q", raw, got)
		}
	}
	// Encoded characters that stay encoded after decoding are harmless paths.
	q, _ := url.ParseQuery("next=" + url.QueryEscape("/players/a%2Fb"))
	if got := safeNext(q.Get("next")); got != "/players/a%2Fb" {
		t.Errorf("escaped path: %q", got)
	}
}

// The session cookie is renewed when the session's expiry slides, else the
// browser would drop it after the first TTL although the server extended it.
func TestSessionCookieSlides(t *testing.T) {
	e := newHub(t, nil)
	ctx := context.Background()
	u, err := e.st.UpsertOIDCUser(ctx, "dev:alice", "alice", "Alice", "")
	if err != nil {
		t.Fatal(err)
	}
	get := func(tok string) *http.Response {
		t.Helper()
		req, _ := http.NewRequest("GET", e.ts.URL+"/api/session", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
		resp, _ := doReq(t, req)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("session: %d", resp.StatusCode)
		}
		return resp
	}

	fresh, err := e.st.CreateSession(ctx, u.ID, e.s.Hub.ttl())
	if err != nil {
		t.Fatal(err)
	}
	if sc := get(fresh).Header.Values("Set-Cookie"); len(sc) != 0 {
		t.Fatalf("fresh session re-issued its cookie: %v", sc)
	}

	old, err := e.st.CreateSession(ctx, u.ID, time.Hour) // far less than half the TTL left
	if err != nil {
		t.Fatal(err)
	}
	cs := get(old).Cookies()
	if len(cs) != 1 {
		t.Fatalf("near-expiry session: cookies %v", cs)
	}
	c := cs[0]
	if c.Name != sessionCookie || c.Value != old || c.MaxAge != int(e.s.Hub.ttl().Seconds()) || c.Path != "/" ||
		!c.HttpOnly || c.SameSite != http.SameSiteLaxMode {
		t.Fatalf("re-issued cookie: %+v", c)
	}
	// Slid once: the next request finds it fresh again.
	if sc := get(old).Header.Values("Set-Cookie"); len(sc) != 0 {
		t.Fatalf("slid session re-issued again: %v", sc)
	}
}
