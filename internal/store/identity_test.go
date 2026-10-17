package store

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// Two accounts of one user in the same online game are two matches; a row
// stored without a known account (older versions) is still the same match.
func TestOnlineMatchIdentityIncludesProfile(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	sc := s.User(3)
	t0 := time.Date(2026, 10, 1, 20, 0, 0, 0, time.UTC)
	mk := func(id string, score int) *Match {
		return &Match{GUID: "G", Online: true, StartedAt: t0, EndedAt: t0.Add(5 * time.Minute), Result: "win", TeamScore: score,
			Me: MeStats{Name: id, PrimaryID: "Epic|" + id + "|0"}}
	}
	a, b := mk("a", 1), mk("b", 2)
	if err := sc.Ingest(ctx, a, "k1"); err != nil {
		t.Fatal(err)
	}
	if err := sc.Ingest(ctx, b, "k2"); err != nil {
		t.Fatal(err)
	}
	if a.ID == b.ID {
		t.Fatal("the second account overwrote the first")
	}
	again := mk("a", 3)
	if err := sc.Ingest(ctx, again, "k3"); err != nil || again.ID != a.ID {
		t.Fatalf("same account again: id %d vs %d %v", again.ID, a.ID, err)
	}
	if n, _ := sc.Count(ctx); n != 2 {
		t.Fatalf("count %d", n)
	}

	// A legacy row (no profile): any account's copy replaces it.
	legacy := &Match{GUID: "L", Online: true, StartedAt: t0, EndedAt: t0.Add(time.Minute), Result: "abandoned"}
	if err := sc.Save(ctx, legacy); err != nil {
		t.Fatal(err)
	}
	full := &Match{GUID: "L", Online: true, StartedAt: t0, EndedAt: t0.Add(6 * time.Minute), Result: "win", Me: MeStats{PrimaryID: "Epic|a|0"}}
	if err := sc.Save(ctx, full); err != nil || full.ID != legacy.ID {
		t.Fatalf("legacy row not matched: %d vs %d %v", full.ID, legacy.ID, err)
	}
	var profile string
	_ = s.db.QueryRow(`SELECT profile FROM matches WHERE id = ?`, full.ID).Scan(&profile)
	if profile != "epic|a|0" {
		t.Fatalf("profile column %q", profile)
	}
	if n, _ := sc.Count(ctx); n != 3 {
		t.Fatalf("count %d", n)
	}
}

// The same match uploaded many times at once (agent retries) is stored once.
func TestConcurrentIngestSameMatch(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	t0 := time.Date(2026, 10, 1, 20, 0, 0, 0, time.UTC)
	for _, online := range []bool{true, false} {
		sc := s.User(map[bool]int64{true: 1, false: 2}[online])
		var wg sync.WaitGroup
		errs := make(chan error, 32)
		for i := range 32 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				m := &Match{GUID: "G", Online: online, StartedAt: t0, EndedAt: t0.Add(5 * time.Minute), Result: "win", Me: MeStats{Name: "Me"}}
				// Online: the same guid; offline: each retry with its own key.
				if err := sc.Ingest(ctx, m, fmt.Sprintf("key-%d", i)); err != nil {
					errs <- err
				}
			}()
		}
		wg.Wait()
		close(errs)
		for err := range errs {
			t.Fatal(err)
		}
		if n, _ := sc.Count(ctx); n != 1 {
			t.Fatalf("online=%v: %d rows", online, n)
		}
	}
}

// An offline match uploaded live (random outbox key), then imported from the
// local database (ImportKey), is stored once.
func TestOfflineMatchLiveThenImport(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	sc := s.User(1)
	t0 := time.Date(2026, 10, 1, 20, 0, 0, 0, time.UTC)
	mk := func(start time.Time) *Match {
		return &Match{GUID: "local-1759348800000", StartedAt: start, EndedAt: start.Add(5 * time.Minute), Result: "loss", Me: MeStats{PrimaryID: "Epic|me|0"}}
	}
	live := mk(t0.Add(123 * time.Millisecond)) // the tracker's time, before truncation
	if err := sc.Ingest(ctx, live, "0000018f-abcdef"); err != nil {
		t.Fatal(err)
	}
	if _, err := sc.SetTag(ctx, live.ID, "casual"); err != nil {
		t.Fatal(err)
	}
	imported := mk(t0)
	if err := sc.Ingest(ctx, imported, ImportKey(imported)); err != nil {
		t.Fatal(err)
	}
	if imported.ID != live.ID {
		t.Fatalf("import duplicated the live upload: %d vs %d", imported.ID, live.ID)
	}
	// Imported again: still one.
	if err := sc.Ingest(ctx, mk(t0), ImportKey(imported)); err != nil {
		t.Fatal(err)
	}
	// Another offline match (another start) is another row; so is another
	// account's.
	if err := sc.Ingest(ctx, mk(t0.Add(time.Hour)), "k2"); err != nil {
		t.Fatal(err)
	}
	other := mk(t0)
	other.Me.PrimaryID = "Epic|other|0"
	if err := sc.Ingest(ctx, other, "k3"); err != nil {
		t.Fatal(err)
	}
	if n, _ := sc.Count(ctx); n != 3 {
		t.Fatalf("count %d", n)
	}
	if m, _ := sc.Get(ctx, live.ID); m.Tag != "casual" {
		t.Fatalf("tag lost: %+v", m)
	}
}

// A database of the previous schema (v6) gets the profile column filled, so
// the matches already stored keep matching their account.
func TestUpgradeFillsProfile(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "old.db")
	db, err := sql.Open("sqlite", "file:"+filepath.ToSlash(path))
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range migrations[:6] {
		if _, err := db.Exec(m); err != nil {
			t.Fatal(err)
		}
	}
	_, err = db.Exec(`PRAGMA user_version = 6;
		INSERT INTO matches (user_id, guid, online, started_at, ended_at, result, data) VALUES
		(5, 'G', 1, '2026-10-01T20:00:00Z', '2026-10-01T20:05:00Z', 'win',
		 '{"guid":"G","online":true,"started_at":"2026-10-01T20:00:00Z","ended_at":"2026-10-01T20:05:00Z","result":"win","me":{"name":"Élise","primary_id":""}}')`)
	db.Close()
	if err != nil {
		t.Fatal(err)
	}
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	var profile string
	if err := s.db.QueryRow(`SELECT profile FROM matches`).Scan(&profile); err != nil || profile != "name:élise" {
		t.Fatalf("profile %q %v", profile, err)
	}
	t0 := time.Date(2026, 10, 1, 20, 0, 0, 0, time.UTC)
	other := &Match{GUID: "G", Online: true, StartedAt: t0, EndedAt: t0.Add(5 * time.Minute), Result: "win", Me: MeStats{Name: "Bob"}}
	if err := s.User(5).Save(ctx, other); err != nil {
		t.Fatal(err)
	}
	if n, _ := s.User(5).Count(ctx); n != 2 {
		t.Fatalf("another account of the same game: %d rows", n)
	}
}

// The data revision changes on every write of the user's data, and only of
// that user's.
func TestDataRev(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	sc, other := s.User(1), s.User(2)
	t0 := time.Date(2026, 10, 1, 20, 0, 0, 0, time.UTC)
	rev := sc.DataRev()
	if rev < time.Now().Add(-time.Hour).UnixMilli() {
		t.Fatalf("revision %d does not start from the opening time", rev)
	}
	step := func(what string, f func() error) {
		t.Helper()
		before, otherBefore := sc.DataRev(), other.DataRev()
		if err := f(); err != nil {
			t.Fatalf("%s: %v", what, err)
		}
		if sc.DataRev() == before {
			t.Fatalf("%s: revision unchanged", what)
		}
		if other.DataRev() != otherBefore {
			t.Fatalf("%s: another user's revision changed", what)
		}
	}
	m := &Match{GUID: "G", Online: true, StartedAt: t0, EndedAt: t0.Add(time.Minute), Result: "abandoned"}
	step("save", func() error { return sc.Save(ctx, m) })
	step("result", func() error {
		return sc.Save(ctx, &Match{GUID: "G", Online: true, StartedAt: t0, EndedAt: t0.Add(5 * time.Minute), Result: "win"})
	})
	step("tag", func() error { _, err := sc.SetTag(ctx, m.ID, "casual"); return err })
	tr := &Training{StartedAt: t0, EndedAt: t0.Add(10 * time.Minute), Source: "timer"}
	step("training", func() error { return sc.AddTraining(ctx, tr, "") })
	step("merge", func() error {
		return sc.AddTraining(ctx, &Training{StartedAt: t0.Add(5 * time.Minute), EndedAt: t0.Add(20 * time.Minute), Source: "game"}, "")
	})
	step("focus", func() error { _, err := sc.SetTrainingFocus(ctx, tr.ID, "aerials"); return err })
	step("manual", func() error { return sc.SetManual(ctx, ManualDay{Day: "2026-10-01", Mode: "2v2", Games: 3, Wins: 1}) })
	mmr := 1000
	rk := &Rank{At: t0, Playlist: "2v2", MMR: &mmr}
	step("rank", func() error { return sc.AddRank(ctx, rk) })
	step("rank delete", func() error { return sc.DeleteRank(ctx, rk.ID) })
	step("training delete", func() error { return sc.DeleteTraining(ctx, tr.ID) })
	step("profile delete", func() error { _, err := sc.DeleteProfile(ctx, ""); return err })
	m2 := &Match{GUID: "H", Online: true, StartedAt: t0, EndedAt: t0.Add(time.Minute), Result: "win"}
	_ = sc.Save(ctx, m2)
	step("delete", func() error { return sc.Delete(ctx, m2.ID) })
	step("import", func() error { return sc.SaveMany(ctx, []*Match{{GUID: "I", StartedAt: t0, EndedAt: t0}}) })
}
