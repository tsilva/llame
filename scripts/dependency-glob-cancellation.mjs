import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';

export function registerGlobCancellationTests(glob) {
  for (const mode of ['promise', 'stream']) {
    for (const budget of ['abort', 'timeout']) {
      test(`glob ${mode} stops directory work after ${budget}`, async () => {
        const root = await mkdtemp(path.join(tmpdir(), 'dependency-glob-cancel-'));
        try {
          for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
            const directory = path.join(root, String(a), String(b));
            await mkdir(directory, {recursive: true});
            await writeFile(path.join(directory, 'file.js'), 'export {};\n');
          }
          const controller = new AbortController();
          const signal = budget === 'timeout' ? AbortSignal.timeout(5) : controller.signal;
          let reads = 0;
          let readsAtAbort;
          signal.addEventListener('abort', () => {readsAtAbort = reads;}, {once: true});
          let first = true;
          const instrumented = {...fs, readdir(directory, options, callback) {
            reads++;
            fs.readdir(directory, options, (...result) => {
              const finish = () => {
                if (first) {
                  first = false;
                  if (budget === 'abort') controller.abort(new Error('intentional test cancellation'));
                }
                callback(...result);
              };
              if (first && budget === 'timeout') setTimeout(finish, 15);
              else finish();
            });
          }};
          let rejection;
          try {
            if (mode === 'promise') await glob.glob('**/*', {cwd: root, fs: instrumented, signal});
            else for await (const value of glob.globStream('**/*', {cwd: root, fs: instrumented, signal})) void value;
          } catch (error) {rejection = error;}
          assert.ok(rejection, 'cancellation must reject the operation');
          assert.equal(signal.aborted, true);
          assert.equal(rejection, signal.reason);
          assert.equal(reads, readsAtAbort, 'no directory requests may start between abort and rejection');
          const readsAtRejection = reads;
          await delay(60);
          assert.equal(reads, readsAtRejection, 'no directory requests may start after rejection');
        } finally {await rm(root, {recursive: true, force: true});}
      });
    }
  }
  test('glob normal promise and stream traversal still returns requested files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dependency-glob-normal-'));
    try {
      await mkdir(path.join(root, 'src'), {recursive: true});
      await writeFile(path.join(root, 'src/a.js'), 'export {};\n');
      await writeFile(path.join(root, 'src/a.map'), '{}\n');
      assert.deepEqual(await glob.glob('**/*.js', {cwd: root, nodir: true}), ['src/a.js']);
      const streamed = [];
      for await (const value of glob.globStream('**/*.js', {cwd: root, nodir: true})) streamed.push(value);
      assert.deepEqual(streamed, ['src/a.js']);
    } finally {await rm(root, {recursive: true, force: true});}
  });
}
