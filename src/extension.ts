import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const git: SimpleGit = simpleGit();

const GITHUB_USERNAME = 'tushar-programador'; // Replace with your GitHub username
const GITHUB_TOKEN = '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'; // Replace with your GitHub PAT
const REPO_NAME = 'code-tracking';

let commitNumber = 1; // To track the number for the markdown file

// Function to create GitHub repository
async function createGitHubRepo() {
    try {
        const response = await axios.post(
            'https://api.github.com/user/repos',
            {
                name: REPO_NAME,
                private: true, // Set to false if you want a public repository
            },
            {
                headers: {
                    Authorization: `token ${GITHUB_TOKEN}`,
                },
            }
        );
        vscode.window.showInformationMessage(`GitHub repository ${REPO_NAME} created successfully.`);
        return response.data.clone_url;
    } catch (error: any) {
        if (error.response && error.response.status === 422) {
            vscode.window.showInformationMessage(`GitHub repository ${REPO_NAME} already exists.`);
            return `https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git`;
        }
        vscode.window.showErrorMessage(`Error creating GitHub repository: ${error.message}`);
        throw error;
    }
}

// Function to initialize local repository and set the remote URL
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
}

// Function to generate a markdown file with the commit number
async function generateMarkdownFile(repoPath: string) {
    const markdownContent = `# Code Commit ${commitNumber}\n\nThis is an auto-generated commit.\n\nTimestamp: ${new Date().toISOString()}`;

    const filePath = path.join(repoPath, `code_${commitNumber}.md`);
    fs.writeFileSync(filePath, markdownContent);
    commitNumber++; // Increment the commit number for the next file

    vscode.window.showInformationMessage(`Generated markdown file: code_${commitNumber - 1}.md`);

    return filePath;
}

// Function to commit and push the markdown file
// Function to commit and push the markdown file
async function commitAndPush(repoPath: string) {
    const filePath = await generateMarkdownFile(repoPath);

    try {
        await git.cwd(repoPath);
        await git.add(filePath); // Add the markdown file to git
        const status = await git.status();

        if (status.files.length > 0) {
            const summary = `Auto-commit: ${new Date().toISOString()}`;
            await git.commit(summary);
            await git.push('origin', 'master'); // Change 'main' to 'master' if needed
            vscode.window.showInformationMessage(`Committed and pushed changes: ${summary}`);
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error committing changes: ${error.message}`);
    }
}


// Periodic commit function
async function commitChangesPeriodically(repoPath: string) {
    setInterval(async () => {
        try {
            await commitAndPush(repoPath);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error during commit process: ${error.message}`);
        }
    }, 1 * 60 * 1000); // 20 minutes
}

export async function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('itrack.startTracking', async () => {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (!workspacePath) {
            vscode.window.showErrorMessage('No workspace folder found! Please open a folder and try again.');
            return;
        }

        try {
            const remoteUrl = await createGitHubRepo();
            await initializeLocalRepo(workspacePath, remoteUrl);
            const repoPath = path.join(workspacePath, REPO_NAME);
            await commitChangesPeriodically(repoPath);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error setting up tracking: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
