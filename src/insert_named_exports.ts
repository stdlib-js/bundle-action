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
const EXPORTS_COMMENT_REGEX = /^\s*\/\/\s*exports:\s*(\{[^}]*\})\s*$/m;


// FUNCTIONS //

/**
* Transform CommonJS requires to ESM imports.
*
* @param code - source to be transformed
* @param id - module id
* @returns transformed source or null if no transformation was performed
*/
function transform( code: string, id: string ): null|{ code: string, map: SourceMap } {
	if ( !SET_EXPORT_REGEX.test( code ) && !EXPORTS_COMMENT_REGEX.test( code ) ) {
		return null;
	}
	const destructured: Array<string> = [];
	const exports: Array<string> = [];
	const magicString = new MagicString( code );
	replace( code, SET_EXPORT_REGEX, transformExport );
	replace( code, EXPORTS_COMMENT_REGEX, transformExportsComment );
	let changed = false;
	if ( exports.length > 0 ) {
		magicString.append( '\nexport { ' + exports.join( ', ' ) + '};' );
		changed = true;
	}
	else if ( destructured.length > 0 ) {
		magicString.append( destructured.join( '\n' ) );
		changed = true;
	}
	if ( !changed ) {
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
	* @param namespace - package namespace
	* @param exportName - exported name
	* @param identifier - exported identifier
	* @returns matched string
	*/
	function transformExport( str: string, namespace: string, exportName: string, identifier: string ): string {
		exports.push( identifier + ' as ' + exportName );
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
	function transformExportsComment( str: string, json: string ): string {
		const parsed = JSON.parse( json );
		for ( const key in parsed ) {
			const value = parsed[ key ];
			if ( typeof value === 'string' && value.includes( '.' ) ) {
				const [ main, name ] = value.split( '.' );
				destructured.push( `export const { ${name} as ${key} } = ${main};` );
			}
		}
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
