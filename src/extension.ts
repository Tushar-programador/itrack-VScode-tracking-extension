"use strict";

const vscode = require("vscode");
const simpleGit = require("simple-git");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

const git = simpleGit();
const GITHUB_USERNAME = "tushar-programador"; // Replace with your GitHub username
const GITHUB_TOKEN = "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"; // Replace with your GitHub PAT
const REPO_NAME = "code-tracking";
let commitNumber = 1;

// Function to create GitHub repository
async function createGitHubRepo() {
  try {
    const response = await axios.post(
      "https://api.github.com/user/repos",
      {
        name: REPO_NAME,
        private: true,
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
        },
      }
    );
    vscode.window.showInformationMessage(
      `GitHub repository ${REPO_NAME} created successfully.`
    );
    return response.data.clone_url;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response && error.response.status === 422) {
      vscode.window.showInformationMessage(
        `GitHub repository ${REPO_NAME} already exists.`
      );
      return `https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git`;
    }
    vscode.window.showErrorMessage(
      `Error creating GitHub repository: ${axios.isAxiosError(error) ? error.message : 'Unknown error'}`
    );
    throw error;
  }
}

async function initializeLocalRepo(workspacePath: string, remoteUrl: string) {
  const repoPath = path.join(workspacePath, REPO_NAME);
  if (!fs.existsSync(repoPath)) {
    fs.mkdirSync(repoPath);
  }
  await git.cwd(repoPath);
  if (!fs.existsSync(path.join(repoPath, ".git"))) {
    await git.init();
    await git.addRemote("origin", remoteUrl);
  }

  // Pull the latest changes
  await git.pull("origin", "master").catch(() => {
    console.log("[DEBUG] No master branch found. Proceeding without pull.");
  });

  // Determine the highest commit number
  const files = glob.sync(path.join(repoPath, "code_*.md"));
  const numbers: number[] = files.map((file: string): number => {
    const match: RegExpMatchArray | null = file.match(/code_(\d+)\.md/);
    return match ? parseInt(match[1], 10) : 0;
  });
  commitNumber = Math.max(0, ...numbers) + 1;

  vscode.window.showInformationMessage(
    `Local repository initialized. Starting from commit ${commitNumber}.`
  );
  return repoPath;
}

// Function to generate a markdown file for the commit
async function generateMarkdownFile(repoPath: string) {
  const markdownContent = `# Code Commit ${commitNumber}\n\nThis is an auto-generated commit.\n\nTimestamp: ${new Date().toISOString()}`;
  const filePath = path.join(repoPath, `code_${commitNumber}.md`);

  try {
    fs.writeFileSync(filePath, markdownContent);
    console.log(`[DEBUG] File created: ${filePath}`);
    commitNumber++;
    return filePath;
  } catch (error) {
    console.error(`[DEBUG] Error creating file: ${error}`);
    throw error;
  }
}

// Function to commit and push changes
async function commitAndPush(repoPath: string) {
  try {
    console.log("[DEBUG] Starting commit process...");
    console.log("[DEBUG] Repository path:", repoPath);
    
    await git.cwd(repoPath);
    await git.fetch("origin");

    const branchInfo = await git.branch();
    const branchName = branchInfo.current || "master";
    
    await git.pull("origin", branchName).catch((err: any) => {
      console.log("[DEBUG] Pull failed:", err.message);
    });

    // Generate markdown file
    console.log("[DEBUG] Generating markdown file...");
    const filePath = await generateMarkdownFile(repoPath);
    console.log("[DEBUG] Generated file path:", filePath);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error("Generated file does not exist");
    }

    // Add only the generated file
    console.log("[DEBUG] Adding file to git:", filePath);
    await git.add(filePath);

    const status = await git.status();
    console.log("[DEBUG] Git status:", JSON.stringify(status, null, 2));

    if (status.files.length > 0) {
      const summary = `Auto-commit: ${new Date().toISOString()}`;
      await git.commit(summary);
      await git.push("origin", branchName);
      console.log("[DEBUG] Successfully pushed changes");
    } else {
      console.log("[DEBUG] No changes to commit");
    }
  } catch (error) {
    console.error("[DEBUG] Error in commitAndPush:", error);
    throw error;
  }
}

// Function to periodically commit changes
async function commitChangesPeriodically(repoPath: string) {
  setInterval(async () => {
    try {
      console.log("[DEBUG] Starting periodic commit...");
      await commitAndPush(repoPath);
    } catch (error) {
      console.error("[DEBUG] Error during periodic commit:", error);
    }
  }, 20 * 60 * 1000); // 20 minutes
}

// Activate function
interface ExtensionContext {
  subscriptions: { push: (disposable: import("vscode").Disposable) => void }[];
}

async function activate(context: ExtensionContext): Promise<void> {
  const disposable = vscode.commands.registerCommand(
    "itrack.startTracking",
    async () => {
      const workspacePath: string | undefined = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspacePath) {
        vscode.window.showErrorMessage(
          "No workspace folder found! Please open a folder and try again."
        );
        return;
      }
      try {
        const remoteUrl: string = await createGitHubRepo();
        const repoPath: string = await initializeLocalRepo(workspacePath, remoteUrl);
        await commitChangesPeriodically(repoPath);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error setting up tracking: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};