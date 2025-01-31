# Repository Context Generator

A Deno-based utility that generates a comprehensive context file containing the contents of all tracked files in a git repository. This tool is useful for creating a single document that captures the current state of your repository's content.

## Features

- Generates a single context file with all tracked repository content
- Automatically detects and skips binary files and symlinks
- Includes repository metadata (branch, generation time)
- Progress tracking and detailed summary statistics
- Configurable output location
- Written in TypeScript and runs on Deno

## Prerequisites

- [Deno](https://deno.land/) (Latest version recommended)
- Git installed and accessible in PATH
- `file` command (for binary file detection)

## Installation

You can compile the script without needing to clone the repository using:
```bash
deno compile --allow-read --allow-run --allow-write https://raw.githubusercontent.com/JLCarveth/context-gen/refs/heads/master/main.ts
```

Alternatively, you can install it globally:
```bash
deno install -g --allow-read --allow-run --allow-write main.ts
```

## Usage

Basic usage:
```bash
deno run --allow-read --allow-run --allow-write main.ts
```

Or if installed globally:
```bash
context-gen
```

### Command Line Options

```
OPTIONS:
    -h, --help       Show this help message
    -v, --version    Show version information
    -o, --output     Specify output file (default: repo_context.txt)
```

### Example Output Structure

The generated context file follows this structure:
```
Repository Context Generated on 2024-01-31T12:00:00.000Z
Repository Root: /path/to/repo
Current Branch: main
Generator Version: 1.0.0

---

=== File: src/main.ts ===
[file contents here]
=== End: src/main.ts ===

=== Summary ===
Files processed: 42
Files skipped: 5 (binary, symlinks, or missing)
Generated on: 2024-01-31T12:00:00.000Z
Generator Version: 1.0.0
```

## Features

### Binary File Detection
- Uses the `file` command to detect binary files
- Automatically skips binary files to prevent corruption
- Logs skipped files for transparency

### Error Handling
- Graceful handling of missing files
- Clear error messages for common issues
- Detailed logging of skipped files and errors

### Progress Tracking
- Real-time progress display
- Summary statistics at completion
- Color-coded console output for better visibility


## Planned Features
- Check for an optional `.cgignore` file which lists files / paths to omit from the context generation.
