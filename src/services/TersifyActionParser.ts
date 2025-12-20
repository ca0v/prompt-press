
export class TersifyActionParser {
    static readonly SUPPORTED_TYPES = ['Remove from', 'Add to', 'None'];

    constructor(private action: string) { }

    isRemoveFromAction(): boolean {
        return this.action.startsWith('Remove from ');
    }

    isAddToAction(): boolean {
        return this.action.startsWith('Add to ');
    }

    isNoneAction(): boolean {
        return this.action === 'None';
    }

    isKnownAction(): boolean {
        return this.isRemoveFromAction() || this.isAddToAction() || this.isNoneAction();
    }

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

    getActionTarget(): string {
        if (this.isRemoveFromAction()) {
            return this.action.substring('Remove from '.length);
        } else if (this.isAddToAction()) {
            return this.action.substring('Add to '.length);
        }
        return '';
    }
}
