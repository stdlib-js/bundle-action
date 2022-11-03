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

// MODULES //

import process from 'process';
import { execSync as shell } from 'child_process';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { getInput, setFailed, summary } from '@actions/core';
import { context } from '@actions/github';
import { InputOptions, OutputOptions, rollup } from 'rollup';
import { terser } from 'rollup-plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import analyze from 'rollup-plugin-analyzer';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import shim from 'rollup-plugin-shim';
import { visualizer } from 'rollup-plugin-visualizer';
import replace from '@stdlib/string-replace';
import json from '@rollup/plugin-json';
import insertNamedExports from './insert_named_exports';
import browserShims from './browser_shims.json';
import generalShims from './general_shims.json';


// VARIABLES //

const target = getInput( 'target' );
const minify = getInput( 'minify' ) !== 'false';
let pkg = getInput( 'pkg' );
if ( !pkg ) {
	// Case: No package specified, so use the npm package corresponding to the current repository.
	pkg = '@stdlib/' + context.repo.repo;
}
let alias = getInput( 'alias' );
if ( !alias ) {
	// Case: No alias specified, so use the npm package name:
	alias = pkg;
}
const esmPlugin =  {
	name: 'rollup-plugin-esm-url-plugin',
	async resolveId( pkg ) {
		if ( pkg.startsWith( '@stdlib' ) ) {
			pkg = replace( pkg, '@stdlib/', '' ); // e.g., `@stdlib/math/base` -> `math/base`
			pkg = replace( pkg, '/', '-' ); // e.g., `math/base/special/gamma` -> `math-base-special-gamma`
			const slug = 'stdlib-js/' + pkg;
			
			// Make request to GitHub API to get the latest tag for the specified package:
			const res = await axios.get( `https://api.github.com/repos/${slug}/tags` );
			const tag = ( res.data || [] ).find( elem => elem.name.endsWith( '-esm' ) );
			let version;
			if ( !tag ) {
				version = '@esm';
			} else {
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
		'comments': function onComment( node, comment ) {
			const text = comment.value;
			return /\/ <reference/i.test( text ) || text.includes( 'The Stdlib Authors. License is Apache-2.0' );
		}
	},
	'toplevel': true,
	'compress': {
		'hoist_funs': false,
		'hoist_vars': false
	}
};
const CURRENT_YEAR = new Date().getFullYear();
const LICENSE_COMMENT = '// Copyright (c) '+CURRENT_YEAR+' The Stdlib Authors. License is Apache-2.0: http://www.apache.org/licenses/LICENSE-2.0';
const cwd = process.cwd();
const pkgJSON = JSON.parse( fs.readFileSync( path.join( cwd, 'package.json' ), 'utf8' ) );
const entryPoint = pkgJSON.browser ? pkgJSON.browser : './lib/index.js';


// FUNCTIONS //

/**
* Callback invoked with results of bundle results analysis.
*
* @private
* @param {Object} res - analysis results
*/
async function onAnalysis( res: any ) {
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
	].concat( res.modules.map( elem => {
		piechart.push( ` "${elem.id}" : ${elem.percent}` );
		return [
			elem.id,
			String( elem.size ),
			String( elem.origSize ),
			elem.dependents.join( ', ' ),
			String( elem.percent ),
			String( elem.reduction ),
			elem.renderedExports.join( ', ' ),
			elem.removedExports.join( ', ' )
		];
	}) );
	await summary
		.addHeading( 'Analysis Results', 'h1' )
		.addRaw( `Bundle size in bytes: ${res.bundleSize} (before minification).` )
		.addBreak()
		.addRaw( `Original bundle size in bytes: ${res.bundleOrigSize} (before minification).` )
		.addBreak()
		.addRaw( `Bundle reduction (in %): ${res.bundleReduction}.` )
		.addBreak()
		.addRaw( `Count of all included modules: ${res.moduleCount}.` )
		.addBreak()
		.addHeading( 'Modules', 'h2' )
		.addTable( table )
		.addCodeBlock( piechart.join( '\n' ), 'mermaid' )
		.write();
}

/**
* Returns rollup input and output options for a given target. 
*
* @private
* @param {string} target - build target (`deno`, `umd`, or `esm`)
* @returns {Object} rollup input and output options
*/
function config( target: string ): { inputOptions: InputOptions, outputOptions: OutputOptions } {
	let inputOptions;
	let outputOptions;
	switch ( target ) {
		case 'deno':
			inputOptions = {
				input: entryPoint,
				plugins: [ 
					shim( generalShims ),
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false, browser: false }), 
					commonjs({ ignoreGlobal: false, ignoreTryCatch: 'remove' }), 
					insertNamedExports,
					json({ compact: true }),
				]
			};
			outputOptions = {
				file: './deno/mod.js',
				format: 'es',
				banner: [
					LICENSE_COMMENT,
					'',
					'/// <reference types="./mod.d.ts" />'
				].join( '\n' ),
				sourcemap: true
			};
		break;
		case 'umd-node':
			inputOptions = {
				input: entryPoint,
				plugins: [ 
					shim( generalShims ),
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false,  browser: false }), 
					commonjs({ ignoreGlobal: false }), 
					insertNamedExports,
					json({ compact: true })
				]
			};
			outputOptions = {
				file: './umd/index.js',
				format: 'umd',
				banner: LICENSE_COMMENT,
				name: alias,
				sourcemap: true
			};
		break;
		case 'umd-browser':
			inputOptions = {
				input: entryPoint,
				plugins: [ 
					shim({ ...generalShims, ...browserShims }),
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false, browser: true }), 
					commonjs({ ignoreGlobal: false, ignoreTryCatch: 'remove' }), 
					insertNamedExports,
					json({ compact: true })
				]
			};
			outputOptions = {
				file: './umd/browser.js',
				format: 'umd',
				banner: LICENSE_COMMENT,
				name: alias,
				sourcemap: true
			};
		break;
		case 'esm':
			inputOptions = {
				input: entryPoint,
				plugins: [ 
					shim({ ...generalShims, ...browserShims }),
					esmPlugin, 
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false, browser: true }), 
					commonjs({ ignoreTryCatch: 'remove' }), 
					insertNamedExports,
					json({ compact: true })
				]
			};
			outputOptions = {
				file: './esm/index.mjs',
				format: 'es',
				banner: [
					LICENSE_COMMENT,
					'',
					'/// <reference types="./index.d.ts" />'
				].join( '\n' ),
				sourcemap: true
			};
		break;
		default:
			throw new Error( `Unknown target: ${target}` );
	}
	inputOptions.preserveEntrySignatures = 'strict';
	if ( minify ) {
		inputOptions.plugins.push( terser( terserOptions ) );
	}
	switch ( target ) {
		case 'deno':
			inputOptions.plugins.push( visualizer({ filename: './deno/stats.html' }) );
		break;
		case 'umd-node':
			inputOptions.plugins.push( visualizer({ filename: './umd/stats_node.html' }) );
		break;
		case 'umd-browser':
			inputOptions.plugins.push( visualizer({ filename: './umd/stats_browser.html' }) );
		break;
		case 'esm':
			inputOptions.plugins.push( visualizer({ filename: './esm/stats.html' }) );
			inputOptions.plugins.push( analyze({ onAnalysis }) );
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
async function build(): Promise<void> {
	const command = [
		'find ./ -type f -name \'*.[jt]s\' \\( -path "./lib/*" -o -path "./node_modules/@stdlib/*/lib/**" \\) -print0 ', // Find all JavaScript and TypeScript files in the destination directory and print their full names to standard output...
		'| xargs -0 ', // Convert standard input to the arguments for following `sed` command...
		'sed -Ei ', // Edit files in-place without creating a backup...
		'"',
		's/module\\.exports\\s*=\\s*/export default /g', // Replace `module.exports =` with `export default`...
		';',
		's/setReadOnly\\(\\s*([a-zA-Z0-9_]+)\\s*,\\s*\'([a-zA-Z0-9_]+)\',\\s*require\\(\\s*\'([^\']+)\'\\s*\\)\\s*\\);/import \\2 from \'\\3\';\\nsetReadOnly( \\1, \'\\2\', \\2 );/g', // Replace `setReadOnly( foo, 'bar', require( 'baz' ) );` with `import bar from 'baz';\nsetReadOnly( foo, 'bar', bar );`...
		';',
		's/var Readable\\s*=\\s*require\\(\\s*\'readable-stream\'\\s*\\)\\.Readable;/import readableStream from \'readable-stream\'; const Readable = readableStream.Readable;/g',
		';',
		's/var\\s+([a-zA-Z0-9_]+)\\s*=\\s*require\\(\\s*([^)]+)\\s*\\);/import \\1 from \\2;/g', // Replace `var foo = require( 'bar' );` with `import foo from 'bar';`...
		';',
		's/var\\s+([a-zA-Z0-9_]+)\\s*=\\s*require\\(\\s*([^)]+)\\s*\\)\\.([a-zA-Z0-9]+);/import { \\3 as \\1 } from \\2;/g', // Replace `var foo = require( 'bar' ).baz;` with `import { baz as foo } from 'bar';`...
		'"'
	].join( '' );
	shell( command );

	const { inputOptions, outputOptions } = config( target );
	try {
		const bundle = await rollup( inputOptions );
		const res = await bundle.write( outputOptions );
		console.log( 'Results:' );
		console.log( res );
		console.log( 'Finished.' );
	} catch ( err ) {
		setFailed( err.message );
	}
}

build()
