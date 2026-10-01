// 拡張子なしの相対 import（Vite 流）を Node の型ストリップ実行で解決する: `node --import ./tests/ts-resolve.mjs tests/xxx.mjs`
import { register } from 'node:module';
register(new URL('./ts-resolve-hooks.mjs', import.meta.url));
