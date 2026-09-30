import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { verifyRelease } from "../scripts/verify-release.mjs";

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), "cotd-release-"));
  t.after(() => {
    const target = resolve(cwd);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("cotd-release-"));
    rmSync(target, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync("git", [
    "-c", "user.name=Release test", "-c", "user.email=release-test@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false",
    "-c", `core.hooksPath=${join(cwd, "no-hooks")}`, ...args,
  ], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--initial-branch=main");
  git("commit", "--allow-empty", "-m", "Initial commit");
  const sha = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", sha);
  return { cwd, git, sha };
}

test("release accepts lightweight and annotated stable tags on main", t => {
  const { cwd, git, sha } = repository(t);
  git("tag", "v1.2.3");
  assert.deepEqual(verifyRelease({ cwd, sha, tag: "v1.2.3" }), { sha, tag: "v1.2.3" });
  git("tag", "-a", "v1.2.4", "-m", "Release");
  assert.equal(verifyRelease({ cwd, sha, tag: "v1.2.4" }).sha, sha);
});

test("release rejects invalid versions, prerelease tags and missing event SHAs", () => {
  for (const tag of ["main", "1.2.3", "v01.2.3", "v1.2.3-rc.1", "v1.2.3+build", "v1.2.3;echo unsafe", undefined]) {
    assert.throws(() => verifyRelease({ tag, sha: "a".repeat(40) }), /stable version tag/);
  }
  assert.throws(() => verifyRelease({ tag: "v1.2.3" }), /commit SHA/);
});

test("release rejects a tagged commit that has not reached main", t => {
  const { cwd, git } = repository(t);
  git("checkout", "-b", "feature");
  git("commit", "--allow-empty", "-m", "Unmerged change");
  git("tag", "v1.2.3");
  const sha = git("rev-parse", "HEAD");
  assert.throws(() => verifyRelease({ cwd, sha, tag: "v1.2.3" }), /merged into origin\/main/);
  git("update-ref", "refs/remotes/origin/main", sha);
  assert.equal(verifyRelease({ cwd, sha, tag: "v1.2.3" }).sha, sha);
});

test("release pins the event commit even if main advances, and rejects moved tags", t => {
  const { cwd, git, sha } = repository(t);
  git("tag", "v1.2.3");
  git("commit", "--allow-empty", "-m", "Next main commit");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  assert.throws(() => verifyRelease({ cwd, sha, tag: "v1.2.3" }), /match the release event/);
  git("checkout", "--detach", sha);
  assert.equal(verifyRelease({ cwd, sha, tag: "v1.2.3" }).sha, sha);
  git("tag", "-f", "v1.2.3", "refs/remotes/origin/main");
  assert.throws(() => verifyRelease({ cwd, sha, tag: "v1.2.3" }), /match the release event/);
});
