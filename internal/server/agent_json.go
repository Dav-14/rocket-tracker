package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// decodeAgentJSON verifies the entire envelope before any ingestion side effect.
func decodeAgentJSON(w http.ResponseWriter, r *http.Request, dst any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	data, err := io.ReadAll(r.Body)
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		writeErr(w, http.StatusRequestEntityTooLarge, "JSON body too large")
		return false
	}
	if err != nil {
		writeErr(w, http.StatusBadRequest, "could not read JSON body")
		return false
	}
	// Determine the size before format errors, so an oversized malformed body
	// has the same 413 response regardless of where its first error appears.
	dec := json.NewDecoder(bytes.NewReader(data))
	err = dec.Decode(dst)
	if err == nil {
		var extra json.RawMessage
		err = dec.Decode(&extra)
		if err == io.EOF {
			return true
		}
	}
	writeErr(w, http.StatusBadRequest, "expected exactly one JSON value")
	return false
}
