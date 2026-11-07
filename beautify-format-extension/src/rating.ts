// Asks for a rating once, after the extension has been useful many times.
import * as vscode from 'vscode';

const COUNT_KEY = 'beautifyFormat.formatCount';
const NEXT_KEY = 'beautifyFormat.nextRatingPrompt'; // format count at which to ask; -1 = never
const FIRST_PROMPT = 25;
const LATER = 100;

const MARKETPLACE_URL = 'https://marketplace.visualstudio.com/items?itemName=DataBeautify.beautify-format&ssr=false#review-details';
const OPEN_VSX_URL = 'https://open-vsx.org/extension/DataBeautify/beautify-format/reviews';

let prompting = false;

export function recordSuccess(context: vscode.ExtensionContext) {
    const count = context.globalState.get<number>(COUNT_KEY, 0) + 1;
    void context.globalState.update(COUNT_KEY, count);

    const next = context.globalState.get<number>(NEXT_KEY, FIRST_PROMPT);
    if (next < 0 || count < next || prompting) return;

    prompting = true;
    // Postpone first, so a closed or ignored message never asks again right away
    void context.globalState.update(NEXT_KEY, count + LATER);

    const rate = 'Rate';
    const later = 'Later';
    const never = "Don't Ask Again";
    vscode.window.showInformationMessage(
        `Beautify Format has formatted ${count} files for you. If it saves you time, a rating helps others find it.`,
        rate, later, never,
    ).then(choice => {
        prompting = false;
        if (choice === rate || choice === never) {
            void context.globalState.update(NEXT_KEY, -1);
        }
        if (choice === rate) {
            // VS Code itself uses the Microsoft Marketplace; forks (VSCodium, Cursor, ...) use Open VSX
            const isMicrosoft = vscode.env.uriScheme === 'vscode' || vscode.env.uriScheme === 'vscode-insiders';
            void vscode.env.openExternal(vscode.Uri.parse(isMicrosoft ? MARKETPLACE_URL : OPEN_VSX_URL));
        }
    });
}
