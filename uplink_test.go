package main

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"rocket-tracker/internal/agent"
	"rocket-tracker/internal/store"
)

// Regression: a match finished while no agent ran (the wizard reconfiguring
// the server, or before it started) was never queued for the server.
func TestUplinkQueuesWithoutRunningAgent(t *testing.T) {
	dataDir := t.TempDir()
	up := &uplink{ctx: context.Background(), log: slog.New(slog.DiscardHandler), dataDir: dataDir}
	t0 := time.Date(2026, 10, 1, 20, 0, 0, 0, time.UTC)
	m := &store.Match{GUID: "G", Online: true, StartedAt: t0, EndedAt: t0.Add(5 * time.Minute), Result: "win"}
	tr := &store.Training{StartedAt: t0, EndedAt: t0.Add(10 * time.Minute), Source: "game"}
	obDir := filepath.Join(dataDir, "outbox")

	// Local only (no agent.json): nothing is queued.
	up.Save(m)
	if _, err := os.Stat(obDir); !os.IsNotExist(err) {
		t.Fatalf("outbox written in local-only mode: %v", err)
	}

	if err := agent.SaveConfig(agentConfigPath(dataDir), &agent.Config{Server: "https://a.example.com", Token: "t"}); err != nil {
		t.Fatal(err)
	}
	up.Save(m)
	up.SaveTraining(tr)
	ob, err := agent.OpenOutbox(obDir)
	if err != nil {
		t.Fatal(err)
	}
	if p, _ := ob.Pending(); len(p) != 2 {
		t.Fatalf("pending %v", p)
	}
	// Meant for the configured server: an agent started for it keeps them.
	if aside, err := ob.SetDestination("https://a.example.com", nil); err != nil || aside != "" {
		t.Fatalf("destination not recorded: %q %v", aside, err)
	}
}
