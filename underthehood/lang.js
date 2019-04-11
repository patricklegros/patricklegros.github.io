'use strict';

var ERROR = '', RAWSOURCE = '', SOURCE = '', TOKENS = [], TOK = 1,
	PROGRAM = [], FUNCTION = [], SCOPE = [], LEVEL = 0, 
	MEMORY = {}, REPLAY = [], REPMAX = false, REP = 0;

/////////////////////////////////
// run
function run(){
	// read source
	RAWSOURCE = $( '#code' ).html();
	SOURCE = RAWSOURCE.replace( /<br>/g, '\n' ).replace( /&gt;/g, '>' ).replace( /&lt;/g, '<' ).replace( /&amp;/g, '&' ).replace( /&nbsp;/g, ' ' );
	// step 1: tokenizer
	tokenizer();
	//console.log( 'tokenizer done' );
	htmlBuildAllTokens();
	// step 2: parse
	if( !ERROR ){
		parse();
		//console.log( 'program done' );
		// step 3: exec
		if( !ERROR ){
			//
			exec();
			//console.log( 'exec done' );
			//console.log( 'MEMORY:', MEMORY );
		}
	}
	// controls
	$('.exec').hide();
	$('.edit').show();
	$('#code').attr('contenteditable', 'false' );
}

function edit(){
	$('.exec').show();
	$('.edit').hide();
	$('#code').html( RAWSOURCE );
	$('#code').attr('contenteditable', 'true' );
	message( '' );
}

/////////////////////////////////
// record/replay
function record( type, groupA, groupB, msg ){
	if( REPLAY.length < 10000 ){
		if( type === 'OPER' ){
			REPLAY.push([ 'OPERBEG', groupA, groupB, msg || '~~' ]);
			REPLAY.push([ 'OPEREND', groupA, groupB, msg || '~~' ]);
		}else
			REPLAY.push([ type, groupA, groupB, msg || '~~' ]);
	}else{
		REPMAX = true ;
		message( 'max replay reached (possible infinite loop)' );
	}
}

function nextExpr(){
	do next();
	while( REPLAY[REP][0] !== 'EXPRBEG' && REPLAY[REP][0] !== 'PROGEND' && REP < REPLAY.length );
}

function next(){
	if( REP >= REPLAY.length - 1 )
		return;
	REP++;
	message( REPLAY[REP][3] );
	switch( REPLAY[REP][0] ){
		case 'STMTBEG': mark( 'mark', true, REPLAY[REP][1] );	break;
		case 'STMTEND': mark( 'mark', false, REPLAY[REP][1] );	break;
		case 'EXPRBEG': mark( 'expr', true, REPLAY[REP][1] );	break;
		case 'EXPREND': replace( REPLAY[REP][1], REPLAY[REP][2] );	break;
		case 'OPERBEG': mark( 'mark', true, REPLAY[REP][1] );	break;
		case 'OPEREND': replace( REPLAY[REP][1], REPLAY[REP][2], 'expr' );	break;
		case 'PROGEND':
		case 'REPMAX':
	}
}

function prevExpr(){
	do prev();
	while( REPLAY[REP][0] !== 'EXPRBEG' && REPLAY[REP][0] !== 'PROGBEG' && REP > 0 );
}

function prev(){
	if( REP <= 0  )
		return;
	switch( REPLAY[REP][0] ){
		case 'STMTBEG': mark( 'mark', false, REPLAY[REP][1] );	break;
		case 'STMTEND': mark( 'mark', true, REPLAY[REP][1] );	break;
		case 'EXPRBEG': mark( 'expr', false, REPLAY[REP][1] ); 	break;
		case 'EXPREND': replace( REPLAY[REP][2], REPLAY[REP][1], 'expr' );	break;
		case 'OPERBEG': mark( 'mark', false, REPLAY[REP][1] );	break;
		case 'OPEREND': replace( REPLAY[REP][2], REPLAY[REP][1], 'expr mark' );	break;
		case 'PROGEND':
		case 'REPMAX':
	}
	REP--;
	message( REPLAY[REP][3] );
}

function replace( tokensA, tokensB, clas ){
	//
	tokensA = flatten( tokensA );
	$('#tok'+ tokensA[0] ).replaceWith( '<span id=replace></span>' );
	for(var i = 1; i < tokensA.length; ++i )
		$('#tok'+ tokensA[i] ).remove();
	//
	tokensB = flatten( tokensB );
	$('#replace').replaceWith( htmlTokens( tokensB, clas ) );
}

function mark( clas, mark, tokens ){
	if( typeof tokens === 'number' )
		tokens = [tokens];
	else 
		tokens = flatten( tokens );
	//
	for(var i = 0; i < tokens.length; i++){
		if( mark ){
			$('#tok'+tokens[i]).addClass( clas );
		}
		else
			$('#tok'+tokens[i]).removeClass( clas );
	}
}

function htmlTokens( tokens, clas ){
	var html = '', t = 0;
	if( typeof tokens === 'number' )
		tokens = [tokens] ;
	for(; t < tokens.length; ++t )
		html+= '<span id="tok'+ tokens[t] +'" class="'+ htmlClassTokens( tokens[t] ) +' '+ (clas || '') +'">'+ TOKENS[tokens[t]].wspace +'<i>'+ TOKENS[tokens[t]].value +'</i></span>';
	return html ;
}

function htmlBuildAllTokens(){
	$('#code').html('');
	for(var t = 1; t < TOKENS.length-1; ++t )
		 $('#code').append( htmlTokens( t ) );
}

function htmlClassTokens( tokid ){
	switch( TOKENS[tokid].token ){
		case 'ERROR':		return 'error';
		case 'NUMBER':		return 'const';
		case 'IDENTIFIER':	return 'const';
		case 'COMMENT':		return 'comment';
		default:			return '';
	}
}

/////////////////////////////////
// run
function exec(){
	LEVEL = -1, REPLAY = [], REP = 0;
	record( 'PROGBEG', null, null, 'begin program' );
	execBlock( PROGRAM );
	record( 'PROGEND', null, null, 'end program' );
}

function execBlock( block, b ){
	var ret = [''], b = b || 0;
	for(; !REPMAX && !ERROR &&  b < block.length ; ++b ){
		ret = execStmt( block[b] );
		if( ret[0] ){
			break;
		}
	}
	return ret ;
}

function execStmt( stmt ){
	var ret = [''];
	switch( stmt[0] ){
		case 'IF':
			record( 'STMTBEG', stmt[1], null, 'begin if statement' );
			if( value( exprLast( execExpr( stmt[2] ) ) ) ){
				ret = execStmt( stmt[3] );
			}else if( stmt[4] !== 0 ){
				record( 'STMTBEG', stmt[4], null, 'begin else statement' );
				ret = execStmt( stmt[5] );
				record( 'STMTEND', stmt[4], null, 'end else statement' );
			}
			record( 'STMTEND', stmt[1], null, 'end if statement' );
			break;
		case 'WHILE':
			record( 'STMTBEG', stmt[1], null, 'begin while statement' );
			while( !REPMAX && !ERROR && value( exprLast( execExpr( stmt[2] ) ) ) ){
				ret = execStmt( stmt[3] );
				if( ret[0] === 'BREAK' ){
					ret = [''];
					break;
				}else if( ret[0] === 'CONTINUE' ){
					ret = [''];
				}
			}
			record( 'STMTEND', stmt[1], null, 'end while statement' );
			break;
		case 'FOR':
			record( 'STMTBEG', stmt[1], null, 'begin for statement' );
			for( execExpr( stmt[2] ); !REPMAX && !ERROR && value( exprLast( execExpr( stmt[3] ) ) ); execExpr( stmt[4] ) ){
				ret = execStmt( stmt[5] );
				if( ret[0] === 'BREAK' ){
					ret = [''];
					break;
				}else if( ret[0] === 'CONTINUE' ){
					ret = [''];
				}
			}
			record( 'STMTEND', stmt[1], null, 'end for statement' );
			break;
		case 'DO':
			record( 'STMTBEG', [stmt[1], stmt[3]], null, 'begin do while statement' );
			do execStmt( stmt[2] );
			while( !REPMAX && !ERROR && value( exprLast( execExpr( stmt[4] ) ) ) );
			record( 'STMTEND', [stmt[1], stmt[3]], null, 'end do while statement' );
			break;
		case 'BREAK':
			record( 'STMTBEG', stmt[1], null, 'begin break statement' );
			ret = ['BREAK'];
			record( 'STMTEND', stmt[1], null, 'begin break statement' );
			break;
		case 'CONTINUE':
			record( 'STMTBEG', stmt[1], null, 'continue statement' );
			ret = ['CONTINUE'];
			record( 'STMTEND', stmt[1], null, 'continue statement' );
			break;
		case 'SWITCH':
			record( 'STMTBEG', stmt[1], null, 'begin switch statement' );
			// ??
			var switchTok = exprLast( execExpr( stmt[2] ) ), b = 0;
			for(; b < stmt[3][1].length; ++b){
				if( stmt[3][1][b][0] === 'CASE' ){
					record( 'STMTBEG', stmt[3][1][b][1], null, 'begin case statement' );
					if( value( switchTok ) === value( exprLast( execExpr( stmt[3][1][b][2] ) ) ) ){
						record( 'STMTEND', stmt[3][1][b][1], null, 'end case statement true' );
						ret = execBlock( stmt[3][1], b++ );
						break;
					}else{
						record( 'STMTEND', stmt[3][1][b][1], null, 'end case statement false' );
					}
				}else if( stmt[3][1][b][0] === 'DEFAULT' ){
					record( 'STMTBEG', stmt[3][1][b][1], null, 'begin default statement' );
					record( 'STMTEND', stmt[3][1][b][1], null, 'end default statement' );
					ret = execBlock( stmt[3][1], b++ );
					break;
				}
			}
			
			record( 'STMTEND', stmt[1], null, 'end switch statement' );
			break;
		case 'CASE': case 'DEFAULT':
			break; // skip over cause they are jump statements
		case 'BLOCK':
			ret = execBlock( stmt[1] );
			break;
		case 'EXPR':
			execExpr( stmt[1] );
	}
	return ret;
}

function execExpr( expr ){
	var e = 1, fullExpr = expr.slice();
	expr = expr.slice();
	// 
	if( expr[0] === 'TOP' )
		record( 'EXPRBEG', fullExpr, null, 'begin expression' );
	//
	for(; e < expr.length && !REPMAX ; ++e )
		if( typeof expr[e] === 'object' )
			expr[e] = execTree( expr[e] );
	//
	if( expr[0] === 'TOP' )
		record( 'EXPREND', expr, fullExpr, 'end expression' );
	//
	return expr ;
}

function execTree( tree ){
	var retTok = 0;
	// if value 
	if( typeof tree === 'number' )
		return tree;
	// if tree is resolved [#]
	if( typeof tree[0] === 'number' )
		return tree;
	//  if tree is unresolved ["", #+]
	tree = tree.slice();
	//
	switch( tree[0] ){
		// 
		case '()':
			retTok = exprLast( execExpr( tree ) );
			record( 'OPER', tree, retTok, 'resolve sub expression' );
			break;
		case '?:':
			retTok = exprLast( execExpr( tree ) );
		case 'sub[]':
			break;
		// short circuit
		case '&&':
			tree[1] = execTree( tree[1] );
			if( value( tree[1] ) ){
				tree[3] = execTree( tree[3] );
				if( value( tree[3] ) ){
					retTok = tokenNew( 'BOOL', true, tree[1] );
					record( 'OPER', tree, retTok, 'logic && true' );
				}else{
					retTok = tokenNew( 'BOOL', false, tree[1] );
					record( 'OPER', tree, retTok, 'logic && false' );
				}
			}else{
				retTok = tokenNew( 'BOOL', false, tree[1] );
				record( 'OPER', tree, retTok, 'logic && false short-cicuit' );
			}
			break;
		case '||':
			tree[1] = execTree( tree[1] );
			if( value( tree[1] ) ){
				retTok = tokenNew( 'BOOL', true, tree[1] );
				record( 'OPER', tree, retTok, 'logic || true short-cicuit' );
			}else{
				tree[3] = execTree( tree[3] );
				if( value( tree[3] ) ){
					retTok = tokenNew( 'BOOL', true, tree[1] );
					record( 'OPER', tree, retTok, 'logic || true' );
				}else{
					retTok = tokenNew( 'BOOL', false, tree[1] );
					record( 'OPER', tree, retTok, 'logic || false' );
				}
			}
			break;
		case '?':
			tree[1] = execTree( tree[1] );
			if( value( tree[1] ) ){
				record( 'OPER', tree, tree[3], 'ternary true' );
				tree = tree[3];
				retTok = execTree( tree );
			}else{
				record( 'OPER', tree, tree[5], 'ternary false' );
				tree = tree[5];
				retTok = execTree( tree );
			}
			break;
		case '??':
			break;
		// inc/dec
		case 'n++':
			if( isIdentifier( tree[1] ) ){
				retTok = tokenNew( 'NUMBER', value( tree[1] ), tree[1] );
				memorySet( tree[1], tokenNew( 'NUMBER', value( tree[1] )+1, tree[1] ) );
				record( 'OPER', tree, retTok, 'postfix increment' );
			}else
				error( 'expecting identifier', tree[1] );
			break;
		case 'n--':
			if( isIdentifier( tree[1] ) ){
				retTok = tokenNew( 'NUMBER', value( tree[1] ), tree[1] );
				memorySet( tree[1], tokenNew( 'NUMBER', value( tree[1] )-1, tree[1] ) );
				record( 'OPER', tree, retTok, 'prefix decrement' );
			}else
				error( 'expecting identifier', tree[1] );
			break;
		case '++n':
			if( isIdentifier( tree[2] ) ){
				retTok = tokenNew( 'NUMBER', value( tree[2] )+1, tree[1] );
				memorySet( tree[2], retTok );
				record( 'OPER', tree, retTok, 'prefix increment' );
			}else
				error( 'expecting identifier', tree[2] );
			break;
		case '--n':
			if( isIdentifier( tree[2] ) ){
				retTok = tokenNew( 'NUMBER', value( tree[2] )-1, tree[1] );
				memorySet( tree[2], retTok );
				record( 'OPER', tree, retTok, 'prefix decrement' );
			}else
				error( 'expecting identifier', tree[2] );
			break;
		// unary right
		case '!':
			tree[2] = execTree( tree[2] );
			retTok = tokenNew( 'BOOL', !value( tree[2] ), tree[1] );
			record( 'OPER', tree, retTok, 'logic not' );
			break;
		case '-n':
			tree[2] = execTree( tree[2] );
			retTok = tokenNew( 'NUMBER', -value( tree[2] ), tree[1] );
			record( 'OPER', tree, retTok, 'negative unary' );
			break;
		case '+n':
			tree[2] = execTree( tree[2] );
			retTok = tokenNew( 'NUMBER', +value( tree[2] ), tree[1] );
			record( 'OPER', tree, retTok, 'plus unary' );
			break;
		// left rights
		case '*':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'NUMBER', value( tree[1] ) * value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'multiplication' );
			break;
		case '/':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'NUMBER', value( tree[1] ) / value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'division' );
			break;
		case '%':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'NUMBER', value( tree[1] ) % value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'modular' );
			break;
		case '+':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'NUMBER', value( tree[1] ) + value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'addition' );
			break;
		case '-':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'NUMBER', value( tree[1] ) - value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'subtraction' );
			break;
		// comparison
		case '==':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'BOOL', value( tree[1] ) === value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'comparison equal' );
			break;
		case '!=':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'BOOl', value( tree[1] ) !== value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'comparison not equal' );
			break;
		case '<':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'BOOL', value( tree[1] ) < value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'comparison equal' );
			break;
		case '<=':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'BOOL', value( tree[1] ) <= value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'comparison less than equal' );
			break;
		case '>':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'BOOL', value( tree[1] ) > value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'comparison equal' );
			break;
		case '>=':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'BOOL', value( tree[1] ) > value( tree[3] ), tree[1] );
			record( 'OPER', tree, retTok, 'comparison greater than equal' );
			break;
		case '<=>':
			tree[1] = execTree( tree[1] );
			tree[3] = execTree( tree[3] );
			retTok = tokenNew( 'NUMBER', value( tree[1] ) < value( tree[3] ) ? -1 : ( value( tree[1] ) > value( tree[3] ) ? 1 : 0 ), tree[1] );
			record( 'OPER', tree, retTok, 'SPACESHIP! operator' );
			break;
		// assignment
		case '=':
			tree[3] = execTree( tree[3] );
			if( isIdentifier( tree[1] ) ){
				memorySet( tree[1], tree[3] );
				retTok = tokenNew( TOKENS[tree[3]].token, value( tree[3] ), tree[1] );
				record( 'OPER', tree, retTok, 'assignment' );
			}else{
				error( 'expecting identifier as left operator', tree[1] );
			}
			break;
	}
	return retTok;
}

function exprLast( expr ){
	for(var e = expr.length-1; e >= 0; --e )
		if( [')',']',':',','].indexOf( TOKENS[expr[e]].token ) === -1  )
			return expr[e];
	return 0 ;
}

function exprArray( expr ){
	var arr = [];
	for(var e = expr.length-1; e > 0; --e )
		if( ['(',')','[',']','?',':',','].indexOf( TOKENS[expr[e]].token ) === -1  )
			return arr.push( TOKENS[expr[e]].value );
	
	return arr ;
}

function value( tokid ){
	if( typeof tokid === 'object' )
		tokid = exprLast( tokid );
	//
	if( TOKENS[tokid].token === 'IDENTIFIER' ){
		if( typeof TOKENS[ MEMORY[ TOKENS[tokid].value ] ] !== 'undefined' ){
			return TOKENS[ MEMORY[ TOKENS[tokid].value ] ].value ;
		}else{
			error( 'undefined variable `'+ TOKENS[tokid].value +'`', tokid );
		}
	}
	return TOKENS[tokid].value ;
}

function memorySet( tokid1, tokid2 ){
	MEMORY[ TOKENS[tokid1].value ] = tokid2 ;
}

function tokenNew( type, value, ref ){
	return -1 + TOKENS.push({ token:type, value:value, line:TOKENS[ref].line, wspace:TOKENS[ref].wspace });
}

/////////////////////////////////
// parser
function parse(){
	// reset
	PROGRAM = [], SCOPE = [], LEVEL = -1, TOK = 1 ;
	PROGRAM = parseBlock();
}

function parseBlock(){
	var block = [], stmt = [];
	LEVEL++;
	while( TOK < TOKENS.length && !ERROR ){
		if( TOKENS[TOK].token === 'COMMENT' ){
			TOK++;
		}else if( TOKENS[TOK].token === '}' ){
			TOK++ ;
			if( LEVEL === 0 )
				error( 'unexpected b `}`', TOK++ );
			break;
		}else if( TOKENS[TOK].token === 'EndFile' ){
			if( LEVEL > 0 )
				error( 'unexpected `EndFile`, missing `}`', TOK++ );
			break;
		}else{
			stmt = parseStmt();
			if( stmt[0] )
				block.push( stmt );
		}
	}
	LEVEL--;
	return block;
}

function parseStmt( scope ){
	var stmt = [];
	if( scope )
		SCOPE.push( scope );
	//
	switch( TOKENS[TOK].token ){
		case 'COMMENT':
			stmt = ['', TOK++];
			break;
		case 'IF':
			stmt = ['IF', TOK++, [], [], 0, [] ];
			if( TOKENS[TOK].token === '(' ){
				TOK++;
				stmt[2] = parseExpr( 'TOP', ')' );
				stmt[3] = parseStmt( 'IF' );
				if( TOKENS[TOK].token === 'ELSE' ){
					stmt[4] = TOK++ ;
					stmt[5] = parseStmt( 'ELSE' );
				}
			}else
				error( 'require `(` after `if`', TOK );
			break;
		case 'ELSE':
			error( '`else` statements must follow `if`', TOK );
			break;
		case 'WHILE':
			stmt = ['WHILE', TOK++, [], [] ];
			if( TOKENS[TOK].token === '(' ){
				TOK++;
				stmt[2] = parseExpr( 'TOP', ')' );
				stmt[3] = parseStmt( 'WHILE' );
			}else
				error( 'require `(` after `while`', TOK );
			break;
		case 'FOR':
			stmt = ['FOR', TOK++, [], [], [], [] ];
			if( TOKENS[TOK].token === '(' ){
				TOK++;
				stmt[2] = parseExpr( 'TOP', ';' );
				stmt[3] = parseExpr( 'TOP', ';' );
				stmt[4] = parseExpr( 'TOP', ')' );
				stmt[5] = parseStmt( 'FOR' );
			}else
				error( 'require `(` after `while`', TOK );
			break;
		case 'DO':
			stmt = ['DO', TOK++, [], 0, [] ];
			stmt[2] = parseStmt( 'DO' );
			if( TOKENS[TOK].token === 'WHILE' ){
				stmt[3] = TOK++;
				if( TOKENS[TOK].token === '(' ){
					TOK++;
					stmt[4] = parseExpr( 'TOP', ')' );
					if( TOKENS[TOK].token === ';' ){
						TOK++;
					}else
						error( 'require `;` after `do while()`', TOK );
				}else
					error( 'require `(` after `while`', TOK );
			}else
				error( 'require `while` after `do``stmt|block`', TOK );
			break;
		case 'BREAK':
			stmt = ['BREAK', TOK++];
			if( SCOPE.indexOf( 'WHILE' ) > -1 || SCOPE.indexOf( 'FOR' ) > -1 || SCOPE.indexOf( 'DO' ) > -1 || SCOPE.indexOf( 'SWITCH' ) > -1 ){
				if( TOKENS[TOK].token !== ';' )
					error( 'expecting `;` after `break`', TOK );
				TOK++;
			}else
				error( '`break` must be inside `while`, `for`, `do` or `switch` scope', TOK++ );
			break;
		case 'CONTINUE':
			stmt = ['CONTINUE', TOK++];
			if( SCOPE.indexOf( 'WHILE' ) > -1 || SCOPE.indexOf( 'FOR' ) > -1 || SCOPE.indexOf( 'DO' ) > -1 ){
				if( TOKENS[TOK].token !== ';' )
					error( 'expecting `;` after `continue`', TOK );
				TOK++;
			}else
				error( '`continue` must be inside `while`, `for` or `do` scope', TOK++ );
			break;
		case 'SWITCH':
			stmt = ['SWITCH', TOK++, [], []];
			if( TOKENS[TOK].token === '(' ){
				TOK++;
				stmt[2] = parseExpr( 'TOP', ')' );
				if( TOKENS[TOK].token === '{' ){
					stmt[3] = parseStmt( 'SWITCH' );
				}else
					error( 'require `{` block after `switch( expr )`', TOK );
			}else
				error( 'require `(` after `switch`', TOK );
			break;
		case 'CASE':
			stmt = ['CASE', TOK++, [] ];
			stmt[2] = parseExpr( 'TOP', ':' );
			break;
		case 'DEFAULT':
			stmt = ['DEFAULT', TOK++ ];
			if( TOKENS[TOK++].token !== ':' )
				error( 'require `:` after `default`', TOK-1 );
			break;
		case '{':
			TOK++;
			stmt = ['BLOCK', parseBlock() ];
			break;
		default:
			stmt = ['EXPR', parseExpr( 'TOP', ';' ) ];
	}
	//
	if( scope )
		SCOPE.pop( scope );
	//
	return stmt; 
}

function parseExpr( type, end, firstToken ){
	var expr = [type], e = 0, i = 0 ;
	if( firstToken )
		expr[++e] = firstToken;
	expr[++e] = [];
	// find expression
	out:
	while( TOK < TOKENS.length && !ERROR ){
		switch( TOKENS[TOK].token ){
			case 'COMMENT':
				TOK++;
				break;
			case ',':
				expr[++e] = TOK++ ;
				expr[++e] = [];
				break;
			case '(':
				expr[e].push( parseExpr( '()', ')', TOK++ ) );
				break;
			case '[':
				expr[e].push( parseExpr( '[]', ']', TOK++ ) );
				break;
			case '?':
				expr[e].push( TOK++ );
				expr[e].push( parseExpr( '?:', ':' ) );
				expr[e].push( TOK++ );
				break;
			case ')': case ']': case ':': case ';':
				if ( TOKENS[TOK].token !== end )
					error( 'require `'+ end +'`, unexpected `'+ TOKENS[TOK].token +'`', TOK );
				if( type !== 'TOP' && TOKENS[TOK].token !== ':' ) // only add if wrap ie (expr) [expr] ?expr:
					expr.push( TOK );
				if( type !== '?:' ) // dont inc if : from e?e:e , need to save it on lower level
					TOK++
				break out;
			case 'IDENTIFIER': case 'BOOL': case 'NUMBER': case 'STRING':
			case '==': case '!=': case '<=>': case '<=': case '<': case '>=': case '>': case '&&': case '||': case '!':
			case '=' : case '*=': case '/=': case '+=': case '-=': case '*': case '/': case '%': case '+': case '-': case '++': case '--':
				expr[e].push( TOK++ );
				break;
			default:
				error( 'invalid expression token `'+ TOKENS[TOK].token +'` ', TOK++ );
		}
	}
	// parse operators 
	for(e = 1; e < expr.length; ++e){
		// not expression ( is a marker ()[],?:
		if( typeof expr[e] !== 'object' )
			continue;
		// empty expression
		if( expr[e].length === 0 ){
			error( 'empty expression ', expr );
			continue;
		}
		// func() [] n++ n--
		for( i = 0; i < expr[e].length; ++i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '++': if( isIdentifier( expr[e][i-1] ) ) parseLOperator( expr[e], 'n++', i-- ) ; break;
					case '--': if( isIdentifier( expr[e][i-1] ) ) parseLOperator( expr[e], 'n--', i-- ) ; break;
					case 'IDENTIFIER': typeof expr[e][i+1] === 'object' && expr[e][i][0] === '()' && parseLOperator( expr[e], 'func', i-- ); break;
				}
			}
			else if( typeof expr[e][i] === 'object' && expr[e][i][0] === '[]' && isValue( expr[e][i-1] ) ){
				parseLOperator( expr[e], 'sub[]', i-- );
			}
		}
		// !n ++n --n -n (RtL)
		for( i = expr[e].length-1; i >= 0; --i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '!' : parseROperator( expr[e], '!'  , i ); break;
					case '++': parseROperator( expr[e], '++n', i ); break;
					case '--': parseROperator( expr[e], '--n', i ); break;
					case '-' : if( !isValue(expr[e][i-1]) ) parseROperator( expr[e], '-n', i ); break;
					case '+' : if( !isValue(expr[e][i-1]) ) parseROperator( expr[e], '+n', i ); break;
				}
			}
		}
		// * / %
		for( i = 0; i < expr[e].length; ++i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '*': parseLROperator( expr[e], '*', i-- ); break;
					case '/': parseLROperator( expr[e], '/', i-- ); break;
					case '%': parseLROperator( expr[e], '%', i-- ); break;
				}
			}
		}
		// + -
		for( i = 0; i < expr[e].length; ++i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '+': parseLROperator( expr[e], '+', i-- ); break;
					case '-': parseLROperator( expr[e], '-', i-- ); break;
				}
			}
		}
		// < <= > >=
		for( i = 0; i < expr[e].length; ++i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '<' :  parseLROperator( expr[e], '<' ,  i-- ); break;
					case '<=':  parseLROperator( expr[e], '<=',  i-- ); break;
					case '>' :  parseLROperator( expr[e], '>' ,  i-- ); break;
					case '>=':  parseLROperator( expr[e], '>=',  i-- ); break;
				}
			}
		}
		// == != <=>
		for( i = 0; i < expr[e].length; ++i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '==':  parseLROperator( expr[e], '==' , i-- ); break;
					case '!=':  parseLROperator( expr[e], '!=' , i-- ); break;
					case '<=>': parseLROperator( expr[e], '<=>', i-- ); break;
				}
			}
		}
		// &&
		for( i = 0; i < expr[e].length; ++i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '&&': parseLROperator( expr[e], '&&', i-- ); break;
				}
			}
		}
		// ||
		for( i = 0; i < expr[e].length; ++i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '||': parseLROperator( expr[e], '||', i-- ); break;
				}
			}
		}
		// ? : ?:
		for( i = expr[e].length-1; i >= 0; --i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '?' : parseL1R3Operator( expr[e], '?' , i ); break;
					case '??': parseLROperator( expr[e], '?:', i ); break;
				}
			}
		}
		// = *= /= %= += -= (RtL)
		for( i = expr[e].length-1; i > 0; --i ){
			if( typeof expr[e][i] === 'number' ){
				switch( TOKENS[expr[e][i]].token ){
					case '=' : parseLROperator( expr[e], '=' , i-- ); break;
					case '*=': parseLROperator( expr[e], '*=', i-- ); break;
					case '/=': parseLROperator( expr[e], '/=', i-- ); break;
					case '%=': parseLROperator( expr[e], '%=', i-- ); break;
					case '+=': parseLROperator( expr[e], '+=', i-- ); break;
					case '-=': parseLROperator( expr[e], '-=', i-- ); break;
				}
			}
		}
		// covert
		if( expr[e].length === 1 ){
			if( typeof expr[e][0] === 'object' )
			expr[e] = expr[e][0];
		}else
			error( 'could not resolve expression', expr[e] );
	}
	//
	return expr;
}

function parseLROperator( expr, oper, pos ){
	expr.splice( pos-1, 3, [oper, expr[pos-1] || 0, expr[pos], expr[pos+1] || 0 ] );
}

function parseLOperator( expr, oper, pos ){
	expr.splice( pos-1, 2, [oper, expr[pos-1] || 0, expr[pos] ] );
}

function parseROperator( expr, oper, pos ){
	expr.splice( pos, 2, [oper, expr[pos], expr[pos+1] || 0 ] );
}

function parseL1R3Operator( expr, oper, pos ){
	expr.splice( pos-1, 5, [oper, expr[pos-1] || 0, expr[pos], expr[pos+1] || 0, expr[pos+2] || 0, expr[pos+3] || 0 ] );
}

function isValue( expr ){
	return typeof expr === 'object' || ( typeof expr === 'number' && ['IDENTIFIER','NUMBER','STRING','BOOL'].indexOf( TOKENS[expr].token ) > -1 );
}

function isIdentifier( expr ){
	return typeof expr === 'number' && TOKENS[expr].token === 'IDENTIFIER' ;
}

/////////////////////////////////
// tokenizer
function tokenizer(){
	var source = SOURCE ;
	var i = 0, line = 1, match = [], wspace = '';
	// start
	TOKENS = [{token:'BegFile', value:'', line:1, ws:'' }];
	// cycle tokens
	for(; i < LEXICON.length && source.length > 0 && !ERROR ; ++i ){
		// pull off and keep whitespace
		if( i === 0 ){
			wspace = source.match( /^\s*/ )[0];
			source = source.substr( wspace.length ) ;
			line  += wspace.match( /\n|$/g ).length - 1 ;
		}
		// 
		if( match = source.match( LEXICON[i][1] ) ){
			match  = match[1] || match[0] ;
			source = source.substr( match.length ) ;
			line  += match.match( /\n|$/g ).length - 1 ;
			if( typeof LEXICON[i][2] === 'function' )
				match = LEXICON[i][2]( match );
			TOKENS.push({ token:LEXICON[i][0], value:match, line:line, wspace:wspace });
			//if( LEXICON[err][0] === 'error' )
			//	;
			i = -1 ; 
		}
	}
	TOKENS.push({token:'EndFile', value:'{EndFile}', line:line, ws:'' });
	return !source;
}

var LEXICON = [
	// whitespace & comments remove
 	['COMMENT', /^\/\/[^\n]*(?:\n|$)/],	['COMMENT', /^\/\*[^]*\*\//],
	// keywords statements control
	['IF', /^(if)(?![_a-zA-Z0-9])/],	['ELSE', /^(else)(?![_a-zA-Z0-9])/], 
	['SWITCH', /^(switch)(?![_a-zA-Z0-9])/], 	['CASE', /^(case)(?![_a-zA-Z0-9])/],	['DEFAULT', /^(default)(?![_a-zA-Z0-9])/],
	['WHILE', /^(while)(?![_a-zA-Z0-9])/],		['FOR', /^(for)(?![_a-zA-Z0-9])/],		['DO', /^(do)(?![_a-zA-Z0-9])/],
	['BREAK', /^(break)(?![_a-zA-Z0-9])/],		['CONTINUE', /^(continue)(?![_a-zA-Z0-9])/], 
	['FUNCTION', /^(function)(?![_a-zA-Z0-9])/],['RETURN', /^(return)(?![_a-zA-Z0-9])/], 
	['ECHO', /^(echo)(?![_a-zA-Z0-9])/],		['VAR', /^(var)(?![_a-zA-Z0-9])/],
	// comparison & relational operators
	['<=>', /^<=>/], ['==', /^==/], ['!=', /^==|<>/], ['<=', /^<=/], ['<', /^</], ['>=', /^>=/], ['>', /^>/], 
	// logic operators
	['&&', /^\&\&/], ['||', /^\|\|/], ['!', /^\!/], ['?', /^\?/],
	// increment decrement
	['++', /^\+\+/], ['--', /^\-\-/],
	// assignment operator
	['=', /^=/], ['*=', /^\*=/], ['/=', /^\/=/], ['%=', /^%=/], ['+=', /^\+=/], ['-=', /^\-=/], 
	// arithmatic operators
	['*', /^\*/], ['/', /^\//], ['%', /^%/], ['+', /^\+/], ['-', /^\-/],
	// syntax general punctuation
	[';', /^;/], [',', /^,/], [':', /^:/], ['(', /^\(/], [')', /^\)/], ['[', /^\[/], [']', /^\]/], ['{', /^\{/], ['}', /^\}/],
	// constants
	['BOOL', /^(true|false)(?![_a-zA-Z0-9])/,	function(v){ return v === 'true' ? true : false } ],
	['NUMBER', /^[0-9]*\.?[0-9]+/, 			 	Number],
	// strings coming later still developement
	//['STRING', /^"([^"\\]*(?:\\.[^"\\]*)*)"/i, 	function(s){ return s.substr(1, s.length-2); } ],
	//['STRING', /^'([^"\\]*(?:\\.[^'\\]*)*)'/i, 	function(s){ return s.substr(1, s.length-2); } ],
	// identifier
	['IDENTIFIER', /^[_a-zA-Z][_a-zA-Z0-9]*/],
	// error
	['ERROR', /^./]
];

/////////////////////////////////
// 
function flatten( expr ){
	var ret = [], i = 0, j = 0, arr = [];
	if( typeof expr === 'number' ){
		return [expr];
	}else if( typeof expr === 'object' ){
		for(; i < expr.length; ++i ){
			if( typeof expr[i] === 'number' ){
				ret.push( expr[i] );
			}else if( typeof expr[i] === 'object' ){
				arr = flatten( expr[i] );
				for(j = 0; j < arr.length; ++j )
					ret.push( arr[j] );
			}
		}
	}
	return ret ;
}

function message( msg ){
	$('#msg').html( msg );
}

//// error ////
function error( msg, token ){
	if( typeof token === 'number' ){
		message( 'error line '+ TOKENS[token].line +' token`'+ TOKENS[token].token +'` value`'+ TOKENS[token].value +'` msg:"'+ msg +'" ' );
	}
	else if( typeof token === 'object' ){
		token = flatten( token );
		if( token.length > 0 )
			message( 'error near line '+ TOKENS[token[0]].line +' token`'+ TOKENS[token[0]].token +'` value`'+ TOKENS[token[0]].value +'` - "'+ msg +'" ' );
		else
			message( 'error "'+ msg + '"');
	}
	return ERROR = true;
}

