package domain_test

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"rocket-tracker/internal/domain"
)

func TestMatchNormalizeContract(t *testing.T) {
	local := time.Date(2026, 10, 18, 15, 4, 5, 987654321, time.FixedZone("UTC+2", 7200))
	for _, tc := range []struct {
		name  string
		match domain.Match
		first string
	}{
		{"historical", domain.Match{}, "none"},
		{"unknown goals", domain.Match{Goals: []domain.Goal{{Team: ""}, {Team: "unknown"}}}, "none"},
		{"first known goal", domain.Match{Goals: []domain.Goal{{Team: ""}, {Team: "them"}, {Team: "us"}}}, "them"},
		{"explicit first goal", domain.Match{FirstGoal: "us", Goals: []domain.Goal{{Team: "them"}}}, "us"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			m := tc.match
			m.StartedAt, m.EndedAt = local, local.Add(5*time.Minute)
			m.TeamScore, m.OppScore, m.GoalDiff = 1, 3, 99
			m.Normalize()
			if m.Players == nil || m.Goals == nil || m.Statfeed == nil {
				t.Fatalf("required collections are nil: %+v", m)
			}
			if m.Movement != nil || m.Hits != nil || m.Demolitions != nil {
				t.Fatal("normalization invented missing telemetry")
			}
			if m.GoalDiff != -2 || m.FirstGoal != tc.first {
				t.Fatalf("derived fields: diff=%d first=%q", m.GoalDiff, m.FirstGoal)
			}
			want := time.Date(2026, 10, 18, 13, 4, 5, 0, time.UTC)
			if m.StartedAt != want || m.EndedAt != want.Add(5*time.Minute) {
				t.Fatalf("UTC seconds: %v / %v", m.StartedAt, m.EndedAt)
			}
			before, err := json.Marshal(m)
			if err != nil {
				t.Fatal(err)
			}
			m.Normalize()
			after, err := json.Marshal(m)
			if err != nil || string(before) != string(after) {
				t.Fatalf("normalization is not idempotent: %s / %s (%v)", before, after, err)
			}
		})
	}
}

func TestProfileIdentityContract(t *testing.T) {
	for _, tc := range []struct {
		me   domain.MeStats
		want string
	}{
		{domain.MeStats{PrimaryID: " Epic|MAIN|0 ", Name: "Other"}, "epic|main|0"},
		{domain.MeStats{PrimaryID: " \t", Name: " ÉLODIE "}, "name:élodie"},
		{domain.MeStats{}, ""},
		{domain.MeStats{Name: " \t\n"}, ""},
	} {
		m := &domain.Match{Me: tc.me}
		if got := domain.ProfileKey(m); got != tc.want {
			t.Errorf("ProfileKey(%+v) = %q; want %q", tc.me, got, tc.want)
		}
		if m.Me != tc.me {
			t.Fatal("identity lookup mutated the match")
		}
	}
	main := &domain.Match{Me: domain.MeStats{PrimaryID: "Epic|main|0"}}
	alias := &domain.Match{Me: domain.MeStats{PrimaryID: " EPIC|MAIN|0 "}}
	other := &domain.Match{Me: domain.MeStats{PrimaryID: "Steam|alt|0"}}
	unknown := &domain.Match{}
	unknown2 := &domain.Match{}
	all := []*domain.Match{other, alias, unknown, main, unknown2}
	if got := domain.SameProfile(all, main); !reflect.DeepEqual(got, []*domain.Match{alias, main}) {
		t.Fatalf("profile order/pointers: %+v", got)
	}
	if got := domain.SameProfile(all, unknown); !reflect.DeepEqual(got, []*domain.Match{unknown, unknown2}) {
		t.Fatalf("unknown profile semantics changed: %+v", got)
	}
	if got := domain.SameProfile(nil, main); got == nil || len(got) != 0 {
		t.Fatalf("empty history must remain a non-nil empty slice: %+v", got)
	}
}

func TestMatchJSONContract(t *testing.T) {
	// Historical records omit telemetry; normalization must retain its absence.
	var old domain.Match
	if err := json.Unmarshal([]byte(`{"guid":"legacy","partial":true,"team_score":0,"opp_score":1}`), &old); err != nil {
		t.Fatal(err)
	}
	old.Normalize()
	b, err := json.Marshal(old)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(b, &fields); err != nil {
		t.Fatal(err)
	}
	for key, want := range map[string]string{"players": "[]", "goals": "[]", "statfeed": "{}", "movement": "null", "hits": "null", "partial": "true", "goal_diff": "-1"} {
		if got := string(fields[key]); got != want {
			t.Errorf("historical %s = %s; want %s", key, got, want)
		}
	}
	if _, ok := fields["demolitions"]; ok {
		t.Fatal("missing demolitions must remain omitted")
	}

	// Fixed API-shaped fixture exercises every model/tag, optional telemetry,
	// signed positions, explicit zero samples and unchanged speed units.
	const full = `{
		"id":7,"guid":"synthetic","online":true,
		"started_at":"2026-10-18T13:00:00Z","ended_at":"2026-10-18T13:05:12Z",
		"duration_s":312,"overtime":true,"overtime_s":12,"arena":"Stadium_P",
		"mode":"2v2","team_size":2,"variant":"Soccar","tag":"ranked",
		"result":"loss","forfeit":false,"partial":true,"my_team":0,
		"team_score":1,"opp_score":2,"goal_diff":-1,"first_goal":"them","mvp":false,
		"me":{"name":"X","primary_id":"Epic|synthetic|0","score":512,"goals":1,"shots":4,"assists":1,"saves":2,"touches":31,"demos":1},
		"players":[{"name":"X","primary_id":"Epic|synthetic|0","team":0,"score":512,"goals":1,"shots":4,"assists":1,"saves":2,"touches":31,"demos":1,"is_me":true}],
		"movement":{"sample_s":0,"avg_speed":0,"supersonic_pct":0,"ground_pct":0,"wall_pct":0,"air_pct":0,"avg_boost":0,"zero_boost_pct":0,"full_boost_pct":0,"boosting_pct":0,"powerslide_pct":0,"demolished_s":0},
		"hits":{"count":1,"avg_speed":2100,"max_speed":4300,"points":[{"t":12.5,"x":-1200,"y":-3400,"z":93,"pre":800,"post":2400}]},
		"goals":[{"t":45.2,"team":"them","scorer":"Opp","assister":"","speed":3120.4,"me_scored":false,"me_assist":false,"overtime":false,"impact":{"x":-310,"y":-5120,"z":180}}],
		"statfeed":{"EpicSave":1},"demolitions":[{"t":80.1,"player":"Opp","mine":true}]
	}`
	var m domain.Match
	if err := json.Unmarshal([]byte(full), &m); err != nil {
		t.Fatal(err)
	}
	m.Normalize()
	b, err = json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	var want, got any
	if err := json.Unmarshal([]byte(full), &want); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("JSON contract changed: %s", b)
	}
	var roundTrip domain.Match
	if err := json.Unmarshal(b, &roundTrip); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(m, roundTrip) {
		t.Fatalf("JSON round trip changed values: %+v", roundTrip)
	}
	// Older hit/goal records have aggregates but no touch points or impacts.
	var historical domain.Match
	if err := json.Unmarshal([]byte(`{"hits":{"count":2,"avg_speed":1000,"max_speed":2000},"goals":[{"team":"us"}]}`), &historical); err != nil {
		t.Fatal(err)
	}
	if historical.Hits.Points != nil || historical.Goals[0].Impact != nil {
		t.Fatal("historical optional fields acquired telemetry")
	}
	b, err = json.Marshal(historical)
	if err != nil {
		t.Fatal(err)
	}
	var optional struct {
		Hits  map[string]json.RawMessage   `json:"hits"`
		Goals []map[string]json.RawMessage `json:"goals"`
	}
	if err := json.Unmarshal(b, &optional); err != nil {
		t.Fatal(err)
	}
	if _, ok := optional.Hits["points"]; ok {
		t.Fatal("absent touch points must remain omitted")
	}
	if _, ok := optional.Goals[0]["impact"]; ok {
		t.Fatal("absent goal impact must remain omitted")
	}
}
