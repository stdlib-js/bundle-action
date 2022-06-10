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

const process = require( 'process' );
const path = require( 'path' );
const fs = require( 'fs' );
const core = require( '@actions/core' );
const github = require( '@actions/github' );
const { rollup } = require( 'rollup' );
const { terser } = require( 'rollup-plugin-terser' );
const { nodeResolve } = require( '@rollup/plugin-node-resolve' );
const analyze = require( 'rollup-plugin-analyzer' );
const commonjs = require( '@rollup/plugin-commonjs' );
const nodePolyfills = require( 'rollup-plugin-polyfill-node' );
const shim = require( 'rollup-plugin-shim' );
const { visualizer } = require( 'rollup-plugin-visualizer' );
const replace = require( '@stdlib/string-replace' );
const json = require( '@rollup/plugin-json' );
const insertNamedExports = require( './insert_named_exports.js' );
const removeModuleExports = require( './remove_module_exports.js' );
const browserShims = require( './browser_shims.json' );


// VARIABLES //

const target = core.getInput( 'target' );
const minify = core.getInput( 'minify' ) !== 'false';
let pkg = core.getInput( 'pkg' );
if ( !pkg ) {
	// Case: No package specified, so use the npm package corresponding to the current repository.
	pkg = '@stdlib/' + github.context.repo.repo;
}
let alias = core.getInput( 'alias' );
if ( !alias ) {
	// Case: No alias specified, so use the npm package name:
	alias = pkg;
}
const esmPlugin =  {
	name: 'rollup-plugin-esm-url-plugin',
	resolveId( pkg ) {
		if ( pkg.startsWith( '@stdlib' ) ) {
			const version = '@esm'; 
			pkg = replace( pkg, '@stdlib/', '' ); // e.g., `@stdlib/math/base` -> `math/base`
			pkg = replace( pkg, '/', '-' ); // e.g., `math/base/special/gamma` -> `math-base-special-gamma`
			const url = 'https://cdn.jsdelivr.net/gh/stdlib-js/' + pkg + version + '/index.mjs';
			return {
				id: url,
				external: true
			};
		}
		return null;
	}
};
const terserOptions = {
	output: {
		comments: function onComment( node, comment ) {
			const text = comment.value;
			return /\/ <reference/i.test( text ) || text.includes( 'The Stdlib Authors. License is Apache-2.0' );
		}
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
async function onAnalysis( res ) {
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
	await core.summary
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
function config( target ) {
	let inputOptions;
	let outputOptions;
	switch ( target ) {
		case 'deno':
			inputOptions = {
				input: entryPoint,
				plugins: [ 
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false }), 
					commonjs({ ignoreGlobal: false }), 
					insertNamedExports,
					json({ compact: true }),
					removeModuleExports
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
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false,  browser: false }), 
					commonjs(), 
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
					shim( browserShims ),
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false, browser: true }), 
					commonjs(), 
					json({ compact: true }), 
					removeModuleExports
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
					shim( browserShims ),
					esmPlugin, 
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false, browser: true }), 
					commonjs(), 
					insertNamedExports,
					json({ compact: true }),
					removeModuleExports
				],
				preserveEntrySignatures: false
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
*/
async function build() {
	const { inputOptions, outputOptions } = config( target );
	try {
		const bundle = await rollup( inputOptions );
		const res = await bundle.write( outputOptions );
		console.log( 'Results:' );
		console.log( res );
		console.log( 'Finished.' );
	} catch ( err ) {
		core.setFailed( err.message );
	}
};

build()
