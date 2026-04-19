# demo.tape — harness-evolve CLI demo
# Regenerate: vhs demo.tape  (after `npm run build`)
# Target: <5MB, ~10s total
Output demo.gif

Set FontSize 18
Set Width 1200
Set Height 600
Set TypingSpeed 40ms
Set Theme "Dracula"

# Show the top-level CLI surface using local dist build
Type "node dist/cli.js --help"
Sleep 500ms
Enter
Sleep 5s

# Show the status subcommand (read-only, safe)
Type "clear"
Enter
Sleep 500ms
Type "node dist/cli.js status --help"
Sleep 500ms
Enter
Sleep 3s

# Let the viewer read the output
Sleep 2s
