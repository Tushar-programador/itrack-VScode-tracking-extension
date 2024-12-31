import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const git: SimpleGit = simpleGit();
const REPO_NAME = 'code-tracking';
let commitNumber = 1;

// Function to create GitHub repository
async function createGitHubRepo(token: string, username: string) {
    try {
        const response = await axios.post(
            'https://api.github.com/user/repos',
            { name: REPO_NAME, private: true },
            { headers: { Authorization: `token ${token}` } }
        );
        vscode.window.showInformationMessage(`GitHub repository ${REPO_NAME} created successfully.`);
        return response.data.clone_url;
    } catch (error: any) {
        if (error.response?.status === 422) {
            vscode.window.showInformationMessage(`GitHub repository ${REPO_NAME} already exists.`);
            return `https://github.com/${username}/${REPO_NAME}.git`;
        }
        vscode.window.showErrorMessage(`Error creating GitHub repository: ${error.message}`);
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
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
        await git.init();
        await git.addRemote('origin', remoteUrl);
    }
    vscode.window.showInformationMessage('Local repository initialized.');
    return repoPath;
}

// Function to generate a markdown file
async function generateMarkdownFile(repoPath: string) {
    const markdownContent = `# Code Commit ${commitNumber}\n\nThis is an auto-generated commit.\n\nTimestamp: ${new Date().toISOString()}`;
    const filePath = path.join(repoPath, `code_${commitNumber}.md`);
    fs.writeFileSync(filePath, markdownContent);
    commitNumber++;
    return filePath;
}

// Function to commit and push changes
// Function to commit and push changes
// Function to commit and push changes
async function commitAndPush(repoPath: string) {
    await git.cwd(repoPath);

    try {
        
        // Ensure the correct branch is used
        const branchSummary = await git.branch();
        const currentBranch = branchSummary.current || 'main';

        // Fetch and rebase changes from the remote branch
        await git.fetch('origin', currentBranch);
        await git.pull('origin', currentBranch, ['--rebase']);
    } catch (error: any) {
        vscode.window.showWarningMessage(
            `Pull failed. Ensure there are no conflicts or remote changes that require manual resolution: ${error.message}`
        );
        return; // Exit if pull fails to avoid further issues
    }

    // Generate a markdown file
    const filePath = await generateMarkdownFile(repoPath);
    await git.add(filePath);

    const status = await git.status();
    if (status.files.length > 0) {
        const commitMessage = `Auto-commit: ${new Date().toISOString()}`;
        await git.commit(commitMessage);

        try {
            await git.push('origin', 'main');
            vscode.window.showInformationMessage(`Committed and pushed: ${commitMessage}`);
        } catch (pushError: any) {
            vscode.window.showErrorMessage(`Push failed: ${pushError.message}`);
        }
    } else {
        vscode.window.showInformationMessage('No changes to commit.');
    }
}

// Periodic commit function
async function commitChangesPeriodically(repoPath: string) {
    setInterval(async () => {
        try {
            await commitAndPush(repoPath);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error during commit: ${error.message}`);
        }
    }, 20 * 60 * 1000); // 20 minutes
}

// Activate extension
export async function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('itrack.startTracking', async () => {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (!workspacePath) {
            vscode.window.showErrorMessage('No workspace folder found! Please open a folder and try again.');
            return;
        }

        const token = await vscode.window.showInputBox({ prompt: 'Enter your GitHub Personal Access Token' });
        const username = await vscode.window.showInputBox({ prompt: 'Enter your GitHub Username' });

        if (!token || !username) {
            vscode.window.showErrorMessage('GitHub credentials are required.');
            return;
        }

        try {
            const remoteUrl = await createGitHubRepo(token, username);
            const repoPath = await initializeLocalRepo(workspacePath, remoteUrl);
            await commitChangesPeriodically(repoPath);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error setting up tracking: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

// Deactivate extension
export function deactivate() {}
