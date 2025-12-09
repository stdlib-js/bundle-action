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
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// MODULES //
const magic_string_1 = __importDefault(require("magic-string"));
const core_1 = require("@actions/core");
const string_replace_1 = __importDefault(require("@stdlib/string-replace"));
// VARIABLES //
const SET_EXPORT_REGEX = /^setReadOnly\s*\(\s*(\w+)\s*,\s*['"](\w+)['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*;\s*$/mg;
const EXPORTS_COMMENT_REGEX = /^\s*\/\/\s*exports:\s*(\{[^}]*\})\s*$/m;
const EXPORT_DEFAULT_REGEX = /^export\s+default\s+(\w+)\s*;?\s*$/m;
const IMPORT_REGEX = /^import\s+(\w+)\s+from\s+/mg;
// MAIN //
/**
* Returns a plugin to transform CommonJS require statements to ES module imports.
*
* @param options - options
* @param options.ignore - list of modules to ignore (default: [])
* @returns plugin
*/
function pluginFactory({ ignore = [] } = {}) {
    const plugin = {
        'name': 'rollup-plugin-insert-named-exports',
        'transform': transform
    };
    return plugin;
    /**
    * Transform CommonJS requires to ESM imports.
    *
    * @param code - source to be transformed
    * @param id - module id
    * @returns transformed source or null if no transformation was performed
    */
    function transform(code, id) {
        (0, core_1.debug)(`Processing module with identifier ${id}...`);
        // Check for explicit exports comment first (authoritative when present):
        const hasExportsComment = EXPORTS_COMMENT_REGEX.test(code);
        const hasSetReadOnly = SET_EXPORT_REGEX.test(code);
        // Reset lastIndex after test() calls with global regex:
        SET_EXPORT_REGEX.lastIndex = 0;
        if (!hasSetReadOnly && !hasExportsComment) {
            return null;
        }
        if (ignore.includes(id)) {
            return null;
        }
        // Detect the default export identifier (e.g., `export default main` -> "main"):
        const defaultExportMatch = code.match(EXPORT_DEFAULT_REGEX);
        const defaultExportName = defaultExportMatch ? defaultExportMatch[1] : null;
        // Collect all imported identifiers to avoid re-declaring them:
        const importedIdentifiers = new Set();
        let importMatch;
        while ((importMatch = IMPORT_REGEX.exec(code)) !== null) {
            importedIdentifiers.add(importMatch[1]);
        }
        IMPORT_REGEX.lastIndex = 0;
        const destructured = [];
        const exports = [];
        const magicString = new magic_string_1.default(code);
        if (hasExportsComment) {
            (0, string_replace_1.default)(code, EXPORTS_COMMENT_REGEX, transformExportsComment);
        }
        else {
            (0, string_replace_1.default)(code, SET_EXPORT_REGEX, transformExport);
        }
        let changed = false;
        if (destructured.length > 0) {
            magicString.append('\n' + destructured.join('\n'));
            changed = true;
        }
        if (exports.length > 0) {
            magicString.append('\nexport { ' + exports.join(', ') + ' };');
            changed = true;
        }
        if (!changed) {
            return null;
        }
        return {
            'code': magicString.toString(),
            'map': magicString.generateMap()
        };
        /**
        * Transform an export to an ESM named export.
        *
        * @private
        * @param str - matched string
        * @param namespace - the object being modified (first arg to setReadOnly)
        * @param exportName - exported name
        * @param identifier - exported identifier
        * @returns matched string
        */
        function transformExport(str, namespace, exportName, identifier) {
            if (defaultExportName && namespace !== defaultExportName) {
                return str;
            }
            (0, core_1.debug)(`Transforming namespace export ${exportName}...`);
            exports.push(identifier + ' as ' + exportName);
            return str;
        }
        /**
        * Transform an exports comment to an ESM named export.
        *
        * @private
        * @param str - matched string
        * @param json - JSON object string mapping exported names to `object.property` expressions
        * @returns matched string
        */
        function transformExportsComment(str, json) {
            const parsed = JSON.parse(json);
            for (const key in parsed) {
                const value = parsed[key];
                if (typeof value === 'string' && value.includes('.')) {
                    const [obj, name] = value.split('.');
                    // If the export name matches an already-imported identifier, re-export it directly:
                    if (importedIdentifiers.has(key)) {
                        exports.push(key);
                    }
                    else {
                        destructured.push(`export const { ${name}: ${key} } = ${obj};`);
                    }
                }
            }
            return str;
        }
    }
}
// EXPORTS //
exports.default = pluginFactory;
//# sourceMappingURL=insert_named_exports.js.map