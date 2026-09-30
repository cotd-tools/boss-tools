import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function verifyRelease({ tag, sha, cwd = process.cwd() }) {
  if (typeof tag !== "string" || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error("Production releases require a stable version tag such as v1.2.3.");
  }
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error("A release event commit SHA is required.");
  }
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const head = git("rev-parse", "--verify", "HEAD");
  const tagged = git("rev-parse", "--verify", `refs/tags/${tag}^{commit}`);
  if (head !== sha || tagged !== sha) {
    throw new Error("The checked-out commit and version tag must match the release event SHA.");
  }
  try {
    git("merge-base", "--is-ancestor", sha, "refs/remotes/origin/main");
  } catch {
    throw new Error("The release commit must already be merged into origin/main.");
  }
  return { tag, sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const release = verifyRelease({ tag: process.env.RELEASE_TAG, sha: process.env.GITHUB_SHA });
    console.log(`Verified ${release.tag} at ${release.sha} on main.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
