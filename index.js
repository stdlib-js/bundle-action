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

const { rollup } = require( 'rollup' );
const { terser } = require( 'rollup-plugin-terser' );
const commonjs = require( '@rollup/plugin-commonjs' );
const { nodeResolve } = require( '@rollup/plugin-node-resolve' );


// VARIABLES //

const target = core.getInput( 'target' );
let pkg = core.getInput( 'pkg' );
if ( !pkg ) {
	// Case: No package specified, so use the npm package corresponding to the current repository.
	pkg = '@stdlib/' + github.context.repo.repo;
}

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
				plugins: [ nodeResolve(), commonjs(), terser({
					output: {
						comments: function onComment( node, comment ) {
							var text = comment.value;
							return /reference/i.test(text);
						}
					}
				}) ]
			};
			outputOptions = {
				file: './deno/mod.js',
				format: 'es',
				banner: '/// <reference types="./mod.d.ts" />'
			};
		break;
		case 'umd': 
			inputOptions = {
				input: './lib/index.js',
				plugins: [ nodeResolve(), commonjs(), terser() ]
			};
			outputOptions = {
				file: './umd/mod.js',
				format: 'umd',
				name: pkg
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
		await bundle.write( outputOptions );
		console.log( 'Finished.' );
	} catch ( err ) {
		console.error( err );
	}
};

build()
