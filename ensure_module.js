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

// MODULES //

const MagicString = require( 'magic-string' );


// VARIABLES //

const MODULE_EXPORTS_RE = /^module\.exports\s*=\s*(\w+)\s*;\s*$/m;


// FUNCTIONS //

/**
* Ensure `module` is defined when `module.exports` is referenced.
*
* @param {string} code - source to be transformed
* @param {string} id - module id
* @returns {(null|Object)} transformed source or null if no transformation was performed
*/
function transform( code, id ) {
	if ( !MODULE_EXPORTS_RE.test( code ) ) {
		return null;
	}
	const magicString = new MagicString( code );
	magicString.prepend( '\nvar module = { exports: {} };\n' );
	return {
		'code': magicString.toString(),
		'map': magicString.generateMap()
	};
}


// MAIN //

const plugin = {
	'name': 'rollup-plugin-ensure-module',
	'transform': transform
};


// EXPORTS //

module.exports = plugin;