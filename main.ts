#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write

import { parseArgs } from "jsr:@std/cli/parse-args";
import { bold, green, red, yellow } from "jsr:@std/fmt/colors";
import { join } from "jsr:@std/path/join";
import denojson from "./deno.json" with { type: "json" };

interface CliOptions {
  output: string;
  version: boolean;
  help: boolean;
}

interface Stats {
  processed: number;
  skipped: number;
}

const HELP_TEXT = `
Repository Context Generator ${denojson.version}

A utility to generate a context file containing the contents of all tracked files in a git repository.

USAGE:
    repo-context [OPTIONS]

OPTIONS:
    -h, --help       Show this help message
    -v, --version    Show version information
    -o, --output     Specify output file (default: repo_context.txt)
`;

class RepoContextGenerator {
  private outputFile: string;
  private stats: Stats = { processed: 0, skipped: 0 };
  private repoRoot: string = "";
  private ignorePatterns: string[] = [];

  constructor(outputFile = "repo_context.txt") {
    this.outputFile = outputFile;
  }

  private async checkGitRepo(): Promise<boolean> {
    try {
      const process = new Deno.Command("git", {
        args: ["rev-parse", "--git-dir"],
        stdout: "null",
        stderr: "null",
      });
      const { success } = await process.output();
      return success;
    } catch {
      return false;
    }
  }

  private async getRepoInfo(): Promise<{ root: string; branch: string }> {
    try {
      const [rootOutput, branchOutput] = await Promise.all([
        new Deno.Command("git", {
          args: ["rev-parse", "--show-toplevel"],
          stdout: "piped",
        }).output(),
        new Deno.Command("git", {
          args: ["branch", "--show-current"],
          stdout: "piped",
        }).output(),
      ]);

      return {
        root: new TextDecoder().decode(rootOutput.stdout).trim(),
        branch: new TextDecoder().decode(branchOutput.stdout).trim(),
      };
    } catch (error) {
      let message = "Unknown Error";
      if (error instanceof Error) message = error.message;
      throw new Error(`Failed to get repository info: ${message}`);
    }
  }

  private async getTrackedFiles(): Promise<string[]> {
    try {
      const process = new Deno.Command("git", {
        args: ["ls-files"],
        stdout: "piped",
        stderr: "piped",
      });

      const output = await process.output();

      if (!output.success) {
        const errorMessage = new TextDecoder().decode(output.stderr);
        throw new Error(`Git ls-files failed: ${errorMessage}`);
      }

      return new TextDecoder()
        .decode(output.stdout)
        .split("\n")
        .filter((line) => line.trim() !== "");
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(
          "Git executable not found. Please ensure git is installed and in your PATH",
        );
      }
      throw error;
    }
  }

  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const process = new Deno.Command("file", {
        args: [filePath],
        stdout: "piped",
      });
      const output = await process.output();
      const result = new TextDecoder().decode(output.stdout);
      return !result.toLowerCase().includes("text") &&
        !result.toLowerCase().includes("empty");
    } catch (error) {
      // If file command fails, assume binary for safety
      let message = "Unknown Error";
      if (error instanceof Error) message = error.message;
      console.error(red(`Error checking file type: ${filePath}: ${message}`));
      return true;
    }
  }

  private async formatFileContent(
    relativePath: string,
    fullPath: string,
  ): Promise<string> {
    const content = await Deno.readTextFile(fullPath);
    return `\n=== File: ${relativePath} ===\n\n${content}\n\n=== End: ${relativePath} ===\n`;
  }

  async generate(): Promise<void> {
    if (!await this.checkGitRepo()) {
      console.error(red("Error: Not a git repository"));
      Deno.exit(1);
    }

    const { root, branch } = await this.getRepoInfo();
    this.repoRoot = root;
    console.log(
      green(`Generating repository context in ${this.outputFile}...`),
    );

    const header = [
      `Repository Context Generated on ${new Date().toISOString()}`,
      `Repository Root: ${root}`,
      `Current Branch: ${branch}`,
      `Generator Version: ${denojson.version}`,
      "\n---\n",
    ].join("\n");

    await Deno.writeTextFile(this.outputFile, header);

    const files = await this.getTrackedFiles();
    for (const relativePath of files) {
      const fullPath = join(this.repoRoot, relativePath);

      try {
        const stat = await Deno.lstat(fullPath);

        if (stat.isSymlink) {
          this.stats.skipped++;
          console.log(yellow(`Skipped symlink: ${relativePath}`));
          continue;
        }

        if (await this.isBinaryFile(fullPath)) {
          this.stats.skipped++;
          console.log(yellow(`Skipped binary file: ${relativePath}`));
          continue;
        }

        const content = await this.formatFileContent(relativePath, fullPath);
        await Deno.writeTextFile(this.outputFile, content, { append: true });
        this.stats.processed++;
        console.log(green(`Processed: ${relativePath}`));
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          this.stats.skipped++;
          console.log(yellow(`Skipped missing file: ${relativePath}`));
        } else {
          console.error(
            red(`Error processing ${relativePath}: ${error.message}`),
          );
        }
      }
    }

    const summary = [
      "\n=== Summary ===\n",
      `Files processed: ${this.stats.processed}`,
      `Files skipped: ${this.stats.skipped} (binary, symlinks, or missing)`,
      `Generated on: ${new Date().toISOString()}`,
      `Generator Version: ${denojson.version}`,
    ].join("\n");

    await Deno.writeTextFile(this.outputFile, summary, { append: true });

    console.log(bold("\nComplete!"));
    console.log(`Processed ${this.stats.processed} files`);
    console.log(`Skipped ${this.stats.skipped} files`);
    console.log(`Output saved to: ${this.outputFile}`);
  }
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["output"],
    boolean: ["help", "version"],
    alias: {
      h: "help",
      v: "version",
      o: "output",
    },
    default: {
      output: "repo_context.txt",
      help: false,
      version: false,
    },
  }) as CliOptions;

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  if (args.version) {
    console.log(`Repository Context Generator v${denojson.version}`);
    Deno.exit(0);
  }

  const generator = new RepoContextGenerator(args.output);
  await generator.generate();
}

if (import.meta.main) {
  await main();
}

