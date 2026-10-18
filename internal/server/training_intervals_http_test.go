package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"rocket-tracker/internal/domain"
	"rocket-tracker/internal/store"
)

func TestTrainingIntervalEnvelopeIntegration(t *testing.T) {
	for _, agent := range []bool{false, true} {
		t.Run(map[bool]string{false: "dashboard", true: "agent"}[agent], func(t *testing.T) {
			h, sc, token := ingestionHandler(t)
			path := "/api/agent/trainings"
			if !agent {
				// The desktop route has no Hub and uses local scope.
				st, err := store.Open(t.TempDir() + "/local.db")
				if err != nil {
					t.Fatal(err)
				}
				defer st.Close()
				h = (&Server{Store: st}).Handler()
				sc = st.User(store.LocalUser)
				path = "/api/trainings"
			}
			start := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
			tr := domain.Training{StartedAt: start, EndedAt: start.Add(6 * time.Hour), Source: "timer", ActiveIntervals: make([]domain.TrainingInterval, domain.MaxTrainingIntervals)}
			for i := range tr.ActiveIntervals {
				at := start.Add(time.Duration(i) * 5 * time.Second)
				tr.ActiveIntervals[i] = domain.TrainingInterval{StartedAt: at, EndedAt: at.Add(time.Second)}
			}
			var value any = tr
			if agent {
				value = map[string]any{"key": "many-intervals", "training": tr}
			}
			raw, err := json.Marshal(value)
			if err != nil {
				t.Fatal(err)
			}
			if len(raw) <= 1<<14 || len(raw) >= MaxTrainingBody {
				t.Fatalf("fixture envelope size: %d", len(raw))
			}
			for _, tc := range []struct {
				suffix string
				status int
			}{{"", 200}, {"{}", 400}, {strings.Repeat(" ", MaxTrainingBody-len(raw)+1), 413}} {
				r := httptest.NewRequest(http.MethodPost, path, bytes.NewBuffer(append(append([]byte{}, raw...), tc.suffix...)))
				r.ContentLength = -1
				if !agent {
					r.Host = "127.0.0.1:8765"
					r.Header.Set("Origin", "http://127.0.0.1:8765")
				}
				if agent {
					r.Header.Set("Authorization", "Bearer "+token)
				}
				w := httptest.NewRecorder()
				h.ServeHTTP(w, r)
				want := tc.status
				if !agent && want == 200 {
					want = 201
				}
				if w.Code != want {
					t.Fatalf("status %d want %d: %s", w.Code, want, w.Body.String())
				}
				rows, err := sc.Trainings(context.Background())
				if err != nil || len(rows) != 1 {
					t.Fatalf("rows=%d err=%v", len(rows), err)
				}
				if rows[0].ActiveDuration() != time.Duration(domain.MaxTrainingIntervals)*time.Second {
					t.Fatalf("activity lost: %v", rows[0].ActiveDuration())
				}
			}
		})
	}
}
