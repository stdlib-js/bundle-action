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
const resolve = require( 'rollup-plugin-url-resolve' );
const { terser } = require( 'rollup-plugin-terser' );


// VARIABLES //

console.log( github.context.repo );

const pkg = core.getInput( 'pkg' );
const input = '__es_bundle__.js';
const src = `export * from 'https://cdn.skypack.dev/${pkg}'
export { default } from '${url}'`;

const skypackFetchPlugin = {
	name: 'skypack-fetch-pkg',
	load( id ) {
		if ( id === input ) {
			return src;
		}
		return null;
	},
	resolveId( source ) {
		if ( source === input ) {
			return source;
		}
		return null;
	}
};
const inputOptions = {
	input,
	plugins: [ skypackFetchPlugin, resolve(), terser({
		output: {
			comments: function onComment( node, comment ) {
				var text = comment.value;
				return /reference/i.test(text);
			}
		}
	}) ]
};
const outputOptions = {
	file: './deno/mod.js',
	format: 'es',
	banner: '/// <reference types="./mod.d.ts" />',
	name: pkg
};


// MAIN //

/**
 * Main function.
 */
async function build() {
	try {
		const bundle = await rollup( inputOptions );
		await bundle.write( outputOptions );
		console.log( 'Finished.' );
	} catch ( err ) {
		console.error( err );
	}
};

build()
