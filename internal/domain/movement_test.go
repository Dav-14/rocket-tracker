package domain_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"rocket-tracker/internal/domain"
)

func TestMovementAvailabilityJSONRoundTrip(t *testing.T) {
	zero, half := 0.0, 0.5
	for _, tc := range []struct {
		name     string
		movement domain.Movement
		unknown  bool
	}{
		{"legacy numeric zero", domain.Movement{}, false},
		{"measured zero", domain.Movement{CarSampleS: &half, SampleS: 0.5, GroundPct: 100, ZeroBoostPct: 100}, false},
		{"demolition only", domain.Movement{CarSampleS: &zero, SampleS: 0.5, DemolishedS: 0.5}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, err := json.Marshal(tc.movement)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]json.RawMessage
			if err := json.Unmarshal(b, &fields); err != nil {
				t.Fatal(err)
			}
			for _, key := range []string{"avg_speed", "supersonic_pct", "ground_pct", "wall_pct", "air_pct", "avg_boost", "zero_boost_pct", "full_boost_pct", "boosting_pct", "powerslide_pct"} {
				got, present := fields[key]
				if !present || (string(got) == "null") != tc.unknown {
					t.Fatalf("availability %s: %s", key, b)
				}
			}
			if tc.unknown && (string(fields["car_sample_s"]) != "0" || string(fields["demolished_s"]) != "0.5") {
				t.Fatalf("lost observed duration: %s", b)
			}
			if tc.movement.CarSampleS == nil {
				if _, ok := fields["car_sample_s"]; ok {
					t.Fatalf("legacy schema changed: %s", b)
				}
			}
			var restored domain.Movement
			if err := json.Unmarshal(b, &restored); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(restored, tc.movement) {
				t.Fatalf("round trip: %+v", restored)
			}
			again, err := json.Marshal(restored)
			if err != nil || string(b) != string(again) {
				t.Fatalf("availability lost after storage: %s / %s (%v)", b, again, err)
			}
		})
	}
}
