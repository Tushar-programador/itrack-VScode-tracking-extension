"use strict";

const vscode = require("vscode");
const simpleGit = require("simple-git");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

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
  } catch (error : any) {
    if (axios.isAxiosError(error) && error.response && (error.response.status === 422)) {
      vscode.window.showInformationMessage(
        `GitHub repository ${REPO_NAME} already exists.`
      );
      return `https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git`;
    }
    vscode.window.showErrorMessage(
      `Error creating GitHub repository: ${axios.isAxiosError(error as any) ? (error as any).message : 'Unknown error'}`
    );
    throw error;
  }
}

// Function to initialize local repository
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
  vscode.window.showInformationMessage("Local repository initialized.");
  return repoPath;
}

// Function to generate a markdown file for the commit
async function generateMarkdownFile(repoPath: string) {
  const markdownContent = `# Code Commit ${commitNumber}\n\nThis is an auto-generated commit.\n\nTimestamp: ${new Date().toISOString()}`;
  const filePath = path.join(repoPath, `code_${commitNumber}.md`);
  fs.writeFileSync(filePath, markdownContent);
  commitNumber++;
  return filePath;
}

// Function to commit and push changes
async function commitAndPush(repoPath: string) {
  try {
    vscode.window.showInformationMessage("Starting commit and push process...");
    console.log("[DEBUG] Changing working directory to:", repoPath);
    await git.cwd(repoPath);

    console.log("[DEBUG] Fetching from remote repository...");
    await git.fetch("origin");

    const branchInfo = await git.branch();
    const branchName = branchInfo.current || "master";
    console.log("[DEBUG] Current branch:", branchName);

    console.log("[DEBUG] Pulling latest changes...");
    await git.pull("origin", branchName);

    console.log("[DEBUG] Adding all changes...");
    await git.add("./*");

    const status = await git.status();
    console.log("[DEBUG] Git status:", status);

    if (status.files.length > 0) {
      const summary = `Auto-commit: ${new Date().toISOString()}`;
      console.log("[DEBUG] Committing changes with summary:", summary);
      await git.commit(summary);

      console.log("[DEBUG] Pushing changes...");
      await git.push("origin", branchName);
      vscode.window.showInformationMessage(
        `Committed and pushed changes: ${summary}`
      );
    } else {
      vscode.window.showInformationMessage("No changes to commit.");
      console.log("[DEBUG] No changes to commit.");
    }
  } catch (error) {
    console.error("[DEBUG] Error during commit and push:", error);
    vscode.window.showErrorMessage(
      `Error during commit process: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
  }, 1 * 60 * 1000); // 20 minutes
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
