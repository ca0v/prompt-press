
export class TersifyActionParser {
    static readonly SUPPORTED_TYPES = ['Remove from', 'Add to', 'None'];

    constructor(private action: string) { }

    // PromptPress/IMP-1017
    isRemoveFromAction(): boolean {
        return this.action.startsWith('Remove from ');
    }

    // PromptPress/IMP-1018
    isAddToAction(): boolean {
        return this.action.startsWith('Add to ');
    }

    // PromptPress/IMP-1019
    isNoneAction(): boolean {
        return this.action === 'None';
    }

    // PromptPress/IMP-1020
    isKnownAction(): boolean {
        return this.isRemoveFromAction() || this.isAddToAction() || this.isNoneAction();
    }

    // PromptPress/IMP-1021
    getActionName(): string {
        if (this.isRemoveFromAction()) {
            return 'Remove from';
        } else if (this.isAddToAction()) {
            return 'Add to';
        } else if (this.isNoneAction()) {
            return 'None';
        }
        return 'Unknown';
    }

    // PromptPress/IMP-1022
    getActionTarget(): string {
        if (this.isRemoveFromAction()) {
            return this.action.substring('Remove from '.length);
        } else if (this.isAddToAction()) {
            return this.action.substring('Add to '.length);
        }
        return '';
    }
}
