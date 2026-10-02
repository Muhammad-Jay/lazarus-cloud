// Command lazarus is the Lazarus command-line client.
//
// The CLI is a thin transport over the Lazarus control-plane API. It holds no
// business rules: it never re-implements policy, never decides whether a
// deployment is allowed, and never treats a server response as anything other
// than authoritative. See AGENTS.md §3.
//
// This file is a build-wiring stub. The real command surface lands in Phase 19
// (TODO.md); it exists so `go.work` resolves and `go build ./...`, `go vet ./...`
// and `go test ./...` are all meaningful from the initial commit onward.
package main

import (
	"fmt"
	"os"
)

// version is overridden at build time:
//
//	go build -ldflags "-X main.version=v1.2.3" ./...
var version = "dev"

func main() {
	// Target-specific information belongs on stdout; diagnostics belong on
	// stderr, so this output stays pipeable.
	fmt.Fprintf(os.Stdout, "lazarus %s\n", version)
	fmt.Fprintf(os.Stderr, "The CLI command surface is not implemented yet — see TODO.md Phase 19.\n")
}
