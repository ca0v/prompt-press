import { SpecFileWatcher } from '../watchers/specFileWatcher';
import { TestRunner, it } from './framework';
import { Assert } from "./Assert";
import * as path from 'path';

const workspaceRoot = '/workspace';
const watcher = new SpecFileWatcher(false, workspaceRoot) as any;

new TestRunner().describe('SpecFileWatcher.resolveSpecPath', () => {
    it('should resolve requirement path to requirements folder', () => {
        const result = watcher.resolveSpecPath('foo.req');
        Assert.equal(result, path.join(workspaceRoot, 'specs', 'requirements', 'foo.req.md'));
    });
    it('should resolve design path to design folder', () => {
        const result = watcher.resolveSpecPath('bar.design');
        Assert.equal(result, path.join(workspaceRoot, 'specs', 'design', 'bar.design.md'));
    });
    it('should resolve implementation path to implementation folder', () => {
        const result = watcher.resolveSpecPath('baz.impl');
        Assert.equal(result, path.join(workspaceRoot, 'specs', 'implementation', 'baz.impl.md'));
    });
    it('should handle unknown phase gracefully', () => {
        const result = watcher.resolveSpecPath('qux.unknown');
        Assert.equal(result, path.join(workspaceRoot, 'specs', 'qux.unknown.md'));
    });
});
