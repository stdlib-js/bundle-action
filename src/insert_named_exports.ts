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

import MagicString, { SourceMap } from 'magic-string';
import replace from '@stdlib/string-replace';


// VARIABLES //

const SET_EXPORT_REGEX = /^setReadOnly\s*\(\s*(\w+)\s*,\s*['"](\w+)['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*;\s*$/mg;


// FUNCTIONS //

/**
* Transform CommonJS requires to ESM imports.
*
* @param {string} code - source to be transformed
* @param {string} id - module id
* @returns {(null|Object)} transformed source or null if no transformation was performed
*/
function transform( code: string, id: string ): null|{ code: string, map: SourceMap } {
	if ( !SET_EXPORT_REGEX.test( code ) ) {
		return null;
	}
	const exports = [];
	const magicString = new MagicString( code );
	replace( code, SET_EXPORT_REGEX, transformExport );
	if ( exports.length === 0 ) {
		return null;
	}
	magicString.append( '\nexport { ' + exports.join( ', ' ) + '};' );
	return {
		'code': magicString.toString(),
		'map': magicString.generateMap()
	};

	/**
	* Transform an export to an ESM named export.
	*
	* @private
	* @param {string} str - matched string
	* @param {string} namespace - package namespace
	* @param {string} exportName - exported name
	* @param {string} identifier - exported identifier
	* @returns {string} transformed export statement
	*/
	function transformExport( str: string, namespace: string, exportName: string, identifier: string ): string {
		exports.push( identifier + ' as ' + exportName );
		return str;
	}
}


// MAIN //

const plugin = {
	'name': 'rollup-plugin-insert-named-exports',
	'transform': transform
};


// EXPORTS //

export default plugin;
