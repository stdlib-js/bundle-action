"use strict";
/**
* @license Apache-2.0
*
* Copyright (c) 2022 The Stdlib Authors.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// MODULES //
const process_1 = __importDefault(require("process"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const module_1 = require("module");
const axios_1 = __importDefault(require("axios"));
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const rollup_1 = require("rollup");
const rollup_plugin_terser_1 = require("rollup-plugin-terser");
const plugin_alias_1 = __importDefault(require("@rollup/plugin-alias"));
const plugin_node_resolve_1 = require("@rollup/plugin-node-resolve");
const rollup_plugin_analyzer_1 = __importDefault(require("rollup-plugin-analyzer"));
const plugin_commonjs_1 = __importDefault(require("@rollup/plugin-commonjs"));
const rollup_plugin_polyfill_node_1 = __importDefault(require("rollup-plugin-polyfill-node"));
const rollup_plugin_shim_1 = __importDefault(require("rollup-plugin-shim"));
const rollup_plugin_visualizer_1 = require("rollup-plugin-visualizer");
const string_replace_1 = __importDefault(require("@stdlib/string-replace"));
const plugin_json_1 = __importDefault(require("@rollup/plugin-json"));
const insert_named_exports_1 = __importDefault(require("./insert_named_exports"));
const browser_shims_json_1 = __importDefault(require("./browser_shims.json"));
const general_shims_json_1 = __importDefault(require("./general_shims.json"));
// VARIABLES //
const target = (0, core_1.getInput)('target');
const minify = (0, core_1.getInput)('minify') !== 'false';
let pkg = (0, core_1.getInput)('pkg');
if (!pkg) {
    // Case: No package specified, so use the npm package corresponding to the current repository.
    pkg = '@stdlib/' + github_1.context.repo.repo;
}
let alias = (0, core_1.getInput)('alias');
if (!alias) {
    // Case: No alias specified, so use the npm package name:
    alias = pkg;
}
const TAG_FOR_SLUG = {};
const esmPlugin = {
    name: 'rollup-plugin-esm-url-plugin',
    async resolveId(pkg) {
        if (pkg.startsWith('@stdlib')) {
            pkg = (0, string_replace_1.default)(pkg, '@stdlib/', ''); // e.g., `@stdlib/math/base` -> `math/base`
            pkg = (0, string_replace_1.default)(pkg, '/', '-'); // e.g., `math/base/special/gamma` -> `math-base-special-gamma`
            const slug = 'stdlib-js/' + pkg;
            if (!(slug in TAG_FOR_SLUG)) {
                // Make request to GitHub API to get the latest tag for the specified package:
                try {
                    const res = await axios_1.default.get(`https://api.github.com/repos/${slug}/tags`);
                    const tag = (res.data || []).find(elem => elem.name.endsWith('-esm'));
                    TAG_FOR_SLUG[slug] = tag;
                }
                catch (err) {
                    (0, core_1.warning)(`Encountered an error when attempting to resolve the latest ESM tag for package "${pkg}": ${err.message}`);
                }
            }
            let version;
            const tag = TAG_FOR_SLUG[slug];
            if (!tag) {
                (0, core_1.info)(`Unable to resolve the latest ESM tag for package "${pkg}". Loading the latest code on the "esm" branch instead.`);
                version = '@esm';
            }
            else {
                (0, core_1.info)(`Resolved latest ESM tag for package "${pkg}" to "${tag.name}".`);
                version = '@' + tag.name;
            }
            const url = 'https://cdn.jsdelivr.net/gh/' + slug + version + '/index.mjs';
            return {
                id: url,
                external: true
            };
        }
        return null;
    }
};
const terserOptions = {
    'output': {
        'comments': function onComment(node, comment) {
            const text = comment.value;
            return /\/ <reference/i.test(text) || text.includes('The Stdlib Authors. License is Apache-2.0');
        }
    },
    'toplevel': true,
    'compress': {
        'hoist_funs': false,
        'hoist_vars': false
    }
};
const CURRENT_YEAR = new Date().getFullYear();
const LICENSE_COMMENT = '// Copyright (c) ' + CURRENT_YEAR + ' The Stdlib Authors. License is Apache-2.0: http://www.apache.org/licenses/LICENSE-2.0';
const cwd = process_1.default.cwd();
const pkgJSON = JSON.parse(fs_1.default.readFileSync(path_1.default.join(cwd, 'package.json'), 'utf8'));
let entryPoint;
if (typeof pkgJSON.browser === 'object') {
    if (pkgJSON.browser['./lib']) {
        entryPoint = pkgJSON.browser['./lib'];
    }
}
else if (typeof pkgJSON.browser === 'string') {
    entryPoint = pkgJSON.browser;
}
if (!entryPoint) {
    entryPoint = './lib/index.js';
}
// FUNCTIONS //
/**
* Callback invoked with results of bundle results analysis.
*
* @private
* @param {Object} res - analysis results
*/
async function onAnalysis(res) {
    const piechart = [
        'pie title Rollup Bundle Modules'
    ];
    const table = [
        [
            {
                data: 'ID', header: true
            },
            {
                data: 'Size', header: true
            },
            {
                data: 'Original Size', header: true
            },
            {
                data: 'Dependents', header: true
            },
            {
                data: 'Percent', header: true
            },
            {
                data: 'Reduction', header: true
            },
            {
                data: 'Rendered Exports', header: true
            },
            {
                data: 'Removed Exports', header: true
            }
        ]
    ].concat(res.modules.map(elem => {
        piechart.push(` "${elem.id}" : ${elem.percent}`);
        return [
            elem.id,
            String(elem.size),
            String(elem.origSize),
            elem.dependents.join(', '),
            String(elem.percent),
            String(elem.reduction),
            elem.renderedExports.join(', '),
            elem.removedExports.join(', ')
        ];
    }));
    await core_1.summary
        .addHeading('Analysis Results', 'h1')
        .addRaw(`Bundle size in bytes: ${res.bundleSize} (before minification).`)
        .addBreak()
        .addRaw(`Original bundle size in bytes: ${res.bundleOrigSize} (before minification).`)
        .addBreak()
        .addRaw(`Bundle reduction (in %): ${res.bundleReduction}.`)
        .addBreak()
        .addRaw(`Count of all included modules: ${res.moduleCount}.`)
        .addBreak()
        .addHeading('Modules', 'h2')
        .addTable(table)
        .addCodeBlock(piechart.join('\n'), 'mermaid')
        .write();
}
/**
* Returns rollup input and output options for a given target.
*
* @private
* @param {string} target - build target (`deno`, `umd`, or `esm`)
* @returns {Object} rollup input and output options
*/
function config(target) {
    let inputOptions;
    let outputOptions;
    switch (target) {
        case 'deno':
            inputOptions = {
                input: entryPoint,
                plugins: [
                    (0, rollup_plugin_shim_1.default)(general_shims_json_1.default),
                    (0, plugin_alias_1.default)({
                        entries: [
                            { find: 'readable-stream', replacement: 'stream' }
                        ]
                    }),
                    (0, rollup_plugin_polyfill_node_1.default)({ include: null }),
                    (0, plugin_node_resolve_1.nodeResolve)({ preferBuiltins: false, browser: false }),
                    (0, plugin_commonjs_1.default)({ ignoreGlobal: false, ignoreTryCatch: 'remove', transformMixedEsModules: true, requireReturnsDefault: false }),
                    (0, insert_named_exports_1.default)(),
                    (0, plugin_json_1.default)({ compact: true })
                ]
            };
            outputOptions = {
                file: './deno/mod.js',
                format: 'es',
                banner: [
                    LICENSE_COMMENT,
                    '',
                    '/// <reference types="./mod.d.ts" />'
                ].join('\n'),
                sourcemap: true
            };
            break;
        case 'umd-node':
            inputOptions = {
                input: entryPoint,
                plugins: [
                    (0, rollup_plugin_shim_1.default)(general_shims_json_1.default),
                    (0, plugin_alias_1.default)({
                        entries: [
                            { find: 'readable-stream', replacement: 'stream' }
                        ]
                    }),
                    (0, plugin_node_resolve_1.nodeResolve)({ preferBuiltins: false, browser: false }),
                    (0, plugin_commonjs_1.default)({ ignoreGlobal: false, transformMixedEsModules: true, requireReturnsDefault: false }),
                    (0, insert_named_exports_1.default)({ ignore: [path_1.default.resolve(cwd, entryPoint)] }),
                    (0, plugin_json_1.default)({ compact: true })
                ],
                external: module_1.builtinModules
            };
            outputOptions = {
                file: './umd/index.js',
                format: 'umd',
                banner: LICENSE_COMMENT,
                name: alias,
                sourcemap: true,
                exports: 'default'
            };
            break;
        case 'umd-browser':
            inputOptions = {
                input: entryPoint,
                plugins: [
                    (0, rollup_plugin_shim_1.default)({ ...general_shims_json_1.default, ...browser_shims_json_1.default }),
                    (0, plugin_alias_1.default)({
                        entries: [
                            { find: 'readable-stream', replacement: 'stream' }
                        ]
                    }),
                    (0, rollup_plugin_polyfill_node_1.default)({ include: null }),
                    (0, plugin_node_resolve_1.nodeResolve)({ preferBuiltins: false, browser: true }),
                    (0, plugin_commonjs_1.default)({ ignoreGlobal: false, ignoreTryCatch: 'remove', transformMixedEsModules: true, requireReturnsDefault: false }),
                    (0, insert_named_exports_1.default)({ ignore: [path_1.default.resolve(cwd, entryPoint)] }),
                    (0, plugin_json_1.default)({ compact: true })
                ]
            };
            outputOptions = {
                file: './umd/browser.js',
                format: 'umd',
                banner: LICENSE_COMMENT,
                name: alias,
                sourcemap: true,
                exports: 'default'
            };
            break;
        case 'esm':
            inputOptions = {
                input: entryPoint,
                plugins: [
                    (0, rollup_plugin_shim_1.default)({ ...general_shims_json_1.default, ...browser_shims_json_1.default }),
                    (0, plugin_alias_1.default)({
                        entries: [
                            { find: 'readable-stream', replacement: 'stream' }
                        ]
                    }),
                    esmPlugin,
                    (0, rollup_plugin_polyfill_node_1.default)({ include: null }),
                    (0, plugin_node_resolve_1.nodeResolve)({ preferBuiltins: false, browser: true }),
                    (0, plugin_commonjs_1.default)({ ignoreTryCatch: 'remove', transformMixedEsModules: true, requireReturnsDefault: false }),
                    (0, insert_named_exports_1.default)(),
                    (0, plugin_json_1.default)({ compact: true })
                ]
            };
            outputOptions = {
                file: './esm/index.mjs',
                format: 'es',
                banner: [
                    LICENSE_COMMENT,
                    '',
                    '/// <reference types="./index.d.ts" />'
                ].join('\n'),
                sourcemap: true
            };
            break;
        default:
            throw new Error(`Unknown target: ${target}`);
    }
    inputOptions.preserveEntrySignatures = 'strict';
    if (minify) {
        inputOptions.plugins.push((0, rollup_plugin_terser_1.terser)(terserOptions));
    }
    switch (target) {
        case 'deno':
            inputOptions.plugins.push((0, rollup_plugin_visualizer_1.visualizer)({ filename: './deno/stats.html' }));
            break;
        case 'umd-node':
            inputOptions.plugins.push((0, rollup_plugin_visualizer_1.visualizer)({ filename: './umd/stats_node.html' }));
            break;
        case 'umd-browser':
            inputOptions.plugins.push((0, rollup_plugin_visualizer_1.visualizer)({ filename: './umd/stats_browser.html' }));
            break;
        case 'esm':
            inputOptions.plugins.push((0, rollup_plugin_visualizer_1.visualizer)({ filename: './esm/stats.html' }));
            inputOptions.plugins.push((0, rollup_plugin_analyzer_1.default)({ onAnalysis }));
            break;
    }
    return { inputOptions, outputOptions };
}
// MAIN //
/**
* Main function.
*
* @returns {Promise<void>} a promise which resolves when the bundle has been created
*/
async function build() {
    const command = [
        'find ./ -type f -name \'*.[jt]s\' \\( -not -path "./umd/**" -not -path "./esm/**" -not -path "./deno/**" -not -path "./node_modules/**" -o -path "./node_modules/@stdlib/*/lib/**" \\) -print0 ',
        '| xargs -0 ',
        'sed -Ei ',
        '"',
        's/module\\.exports\\s*=\\s*/export default /g',
        ';',
        's/setReadOnly\\(\\s*([a-zA-Z0-9_]+)\\s*,\\s*\'setReadOnly\',\\s*require\\(\\s*\'([^\']+)\'\\s*\\)\\s*\\);/\\nsetReadOnly( \\1, \'setReadOnly\', setReadOnly );/g',
        ';',
        's/setReadOnly\\(\\s*([a-zA-Z0-9_]+)\\s*,\\s*\'([a-zA-Z0-9_]+)\',\\s*require\\(\\s*\'([^\']+)\'\\s*\\)\\s*\\);/import \\2 from \'\\3\';\\nsetReadOnly( \\1, \'\\2\', \\2 );/g',
        ';',
        's/var\\s+([a-zA-Z0-9_]+)\\s*=\\s*require\\(\\s*(\'[@.][^) ]+)\\s*\\);/import \\1 from \\2;/g',
        ';',
        's/var\\s+([a-zA-Z0-9_]+)\\s*=\\s*require\\(\\s*(\'[@.][^) ]+)\\s*\\)\\.([a-zA-Z0-9]+);/import { \\3 as \\1 } from \\2;/g',
        '"'
    ].join('');
    (0, core_1.info)('Converting CommonJS to ES modules via command:');
    (0, core_1.info)(command);
    (0, child_process_1.execSync)(command);
    const replaceNativeRequires = [
        'find ./ -type f -name \'*.[jt]s\' \\( -not -path "./umd/**" -not -path "./esm/**" -not -path "./deno/**" -not -path "./node_modules/**" -o -path "./node_modules/@stdlib/*/lib/**" \\) -print0 ',
        '| xargs -0 ',
        'perl -0777 -i -pe ',
        '"',
        's/var join = require\\( \'path\' \\).join;\nvar tryRequire = require\\( \'\\@stdlib\\/utils-try-require\' \\);\\Rvar isError = require\\( \'\\@stdlib\\/assert-is-error\' \\);\\Rvar main = require\\( \'.\\/main.js\' \\);\\R\\R\\R\\/\\/ MAIN \\/\\/\\R\\Rvar (\\w+);\\Rvar tmp = tryRequire\\( join\\( __dirname, \'\\.\\/native.js\' \\) \\);\\Rif \\( isError\\( tmp \\) \\) {\\R\\t\\g1 = main;\\R} else {\\R\\t\\g1 = tmp;\\R}/var \\$1 = require( \'.\\/main.js\' );/g',
        '"'
    ].join('');
    (0, core_1.info)('Replacing native requires via command:');
    (0, core_1.info)(replaceNativeRequires);
    (0, child_process_1.execSync)(replaceNativeRequires);
    const { inputOptions, outputOptions } = config(target);
    try {
        const bundle = await (0, rollup_1.rollup)(inputOptions);
        const res = await bundle.write(outputOptions);
        (0, core_1.info)('Results:');
        (0, core_1.info)(JSON.stringify(res, null, 2));
        (0, core_1.info)('Finished.');
    }
    catch (err) {
        (0, core_1.setFailed)(err.message);
    }
}
build();
//# sourceMappingURL=index.js.map