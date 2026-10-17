package agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"rocket-tracker/internal/store"
)

// Outbox is a directory of matches and trainings waiting to be uploaded, one
// JSON file each (written atomically, so a crash never leaves half a file).
// It is meant for one server, noted in destFile (see SetDestination).
type Outbox struct {
	dir  string
	wake chan struct{}
	mu   sync.Mutex // put vs SetDestination
}

// destFile, in the outbox, holds the server its entries are meant for.
const destFile = "destination"

type outboxEntry struct {
	Key      string          `json:"key"`
	Match    *store.Match    `json:"match,omitempty"`
	Training *store.Training `json:"training,omitempty"`
}

// Entry is a queued match or training.
type Entry struct {
	Key      string
	Match    *store.Match
	Training *store.Training
}

// OpenOutbox creates dir if needed.
func OpenOutbox(dir string) (*Outbox, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Outbox{dir: dir, wake: make(chan struct{}, 1)}, nil
}

// Dir returns the outbox directory.
func (o *Outbox) Dir() string { return o.dir }

// Put queues a match and wakes the uploader.
func (o *Outbox) Put(key string, m *store.Match) error { return o.put(outboxEntry{Key: key, Match: m}) }

// PutTraining queues a training and wakes the uploader.
func (o *Outbox) PutTraining(key string, t *store.Training) error {
	return o.put(outboxEntry{Key: key, Training: t})
}

func (o *Outbox) put(e outboxEntry) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	key := e.Key
	b, err := json.Marshal(e)
	if err != nil {
		return err
	}
	name := filepath.Join(o.dir, key+".json")
	tmp := name + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmp, name); err != nil {
		os.Remove(tmp)
		return err
	}
	o.Wake()
	return nil
}

// SetDestination makes server (normalized, see NormalizeServer) the server
// the outbox is uploaded to. Entries queued for another server are moved to a
// sibling folder (outbox-<old host>-<time>) rather than sent to the new one,
// which may belong to someone else: they stay in the local database too, and
// can be imported by hand. An outbox without a destination (older versions)
// adopts server. It returns the folder entries were moved to, if any.
func (o *Outbox) SetDestination(server string, log *slog.Logger) (string, error) {
	o.mu.Lock()
	defer o.mu.Unlock()
	path := filepath.Join(o.dir, destFile)
	b, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	old := strings.TrimSpace(string(b))
	if err == nil && sameServer(old, server) {
		return "", nil
	}
	aside := ""
	if old != "" {
		if aside, err = o.moveAside(old); err != nil {
			return "", err
		}
		if aside != "" && log != nil {
			log.Warn("the server changed: matches still queued for the previous one were moved aside instead of being sent to the new one;"+
				" they are in the local database too, and can be imported on the right server by hand",
				"previous", old, "server", server, "folder", aside)
		}
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(server+"\n"), 0o644); err != nil {
		return aside, err
	}
	return aside, os.Rename(tmp, path)
}

// moveAside moves the queued entries (for server old) to a new sibling
// folder, and returns it ("" when nothing was queued).
func (o *Outbox) moveAside(old string) (string, error) {
	items, err := o.Pending()
	if err != nil || len(items) == 0 {
		return "", err
	}
	host := old
	if u, err := url.Parse(old); err == nil && u.Host != "" {
		host = u.Host
	}
	host = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '-' {
			return r
		}
		return '_'
	}, host)
	dst := fmt.Sprintf("%s-%s-%s", filepath.Clean(o.dir), host, time.Now().Format("20060102-150405"))
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(dst, destFile), []byte(old+"\n"), 0o644); err != nil {
		return "", err
	}
	for _, it := range items {
		if err := os.Rename(filepath.Join(o.dir, it), filepath.Join(dst, it)); err != nil {
			return dst, err
		}
	}
	return dst, nil
}

// sameServer compares two normalized server URLs (scheme and host ignore case).
func sameServer(a, b string) bool {
	ua, ea := url.Parse(a)
	ub, eb := url.Parse(b)
	if ea != nil || eb != nil {
		return a == b
	}
	return strings.EqualFold(ua.Scheme, ub.Scheme) && strings.EqualFold(ua.Host, ub.Host) &&
		strings.TrimRight(ua.Path, "/") == strings.TrimRight(ub.Path, "/")
}

// Wake asks the uploader to run now.
func (o *Outbox) Wake() {
	select {
	case o.wake <- struct{}{}:
	default:
	}
}

// Woken is signalled by Wake.
func (o *Outbox) Woken() <-chan struct{} { return o.wake }

// Pending returns the queued file names, oldest first.
func (o *Outbox) Pending() ([]string, error) {
	es, err := os.ReadDir(o.dir)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, e := range es {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}

// Load reads a queued match or training.
func (o *Outbox) Load(name string) (Entry, error) {
	b, err := os.ReadFile(filepath.Join(o.dir, name))
	if err != nil {
		return Entry{}, err
	}
	var e outboxEntry
	if err := json.Unmarshal(b, &e); err != nil {
		return Entry{}, err
	}
	if e.Match == nil && e.Training == nil {
		return Entry{}, errors.New("empty outbox entry")
	}
	if e.Key == "" {
		e.Key = strings.TrimSuffix(name, ".json")
	}
	return Entry{Key: e.Key, Match: e.Match, Training: e.Training}, nil
}

// Remove drops an uploaded match.
func (o *Outbox) Remove(name string) error {
	err := os.Remove(filepath.Join(o.dir, name))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

// Reject moves an entry the server refused to rejected/ (kept for diagnosis).
func (o *Outbox) Reject(name string) error {
	dst := filepath.Join(o.dir, "rejected")
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	return os.Rename(filepath.Join(o.dir, name), filepath.Join(dst, name))
}
