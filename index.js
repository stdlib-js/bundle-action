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

const core = require( '@actions/core' );
const github = require( '@actions/github' );
const { rollup } = require( 'rollup' );
const { terser } = require( 'rollup-plugin-terser' );
const { nodeResolve } = require( '@rollup/plugin-node-resolve' );
const commonjs = require( '@rollup/plugin-commonjs' );
const nodePolyfills = require( 'rollup-plugin-polyfill-node' );
const { visualizer } = require( 'rollup-plugin-visualizer' );
const replace = require( '@stdlib/string-replace' );
const json = require( '@rollup/plugin-json' );
const insertNamedExports = require( './insert_named_exports.js' );
const removeModuleExports = require( './remove_module_exports.js' );


// VARIABLES //

const target = core.getInput( 'target' );
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


// FUNCTIONS //

/**
* Returns rollup input and output options for a given target. 
*
* @private
* @param {string} target - build target (`deno`, `umd`, or `esm`)
* @returns {Object} - rollup input and output options
*/
function config( target ) {
	let inputOptions;
	let outputOptions;
	switch ( target ) {
		case 'deno':
			inputOptions = {
				input: './lib/index.js',
				plugins: [ 
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false }), 
					commonjs({ ignoreGlobal: false }), 
					insertNamedExports,
					json({ compact: true }),
					removeModuleExports,
					terser( terserOptions )
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
		case 'umd': 
			inputOptions = {
				input: './lib/index.js',
				plugins: [ 
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false }), 
					commonjs(), 
					json({ compact: true }), 
					terser( terserOptions ), 
					visualizer({ filename: './umd/stats.html'}) 
				]
			};
			outputOptions = {
				file: './umd/bundle.js',
				format: 'umd',
				banner: LICENSE_COMMENT,
				name: alias,
				sourcemap: true
			};
		break;
		case 'esm':
			inputOptions = {
				input: './lib/index.js',
				plugins: [ 
					esmPlugin, 
					nodePolyfills({ include: null }), 
					nodeResolve({ preferBuiltins: false }), 
					commonjs(), 
					insertNamedExports,
					json({ compact: true }),
					terser( terserOptions ),
					visualizer({ filename: './esm/stats.html'}) 
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
