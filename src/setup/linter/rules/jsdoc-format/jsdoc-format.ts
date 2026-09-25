// src/setup/linter/rules/jsdoc-emoji-format.ts
// comments are in english
import { ESLintUtils, TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ISSUE, PROPERTY_POS } from './jsdoc-format.d';
import { EMOJIS, messages, SERIES } from './jsdoc-format.config';

export type LOC = {
    line: number;
    column: number;
    width?: number;
};
type SourceCode = TSESLint.SourceCode;
export type RuleAlias<
    TOptions extends readonly unknown[],
    TMessageIds extends string,
> = TSESLint.RuleModule<TMessageIds, TOptions>;

// 2) derive MsgId from keys of messages
type MsgId = keyof typeof messages;
type CTX = TSESLint.RuleContext<MsgId, []>;
const createRule = ESLintUtils.RuleCreator(
    (name) => `https://example.com/rule/${name}`
);

const findFirstContentColumn = (rawLine: string): number => {
    // column of the first visible content (after optional leading spaces and '* ')
    const m = rawLine.match(/^\s*\*?\s*/);
    return m ? m[0].length : 0;
};

const reportAt = (messageId: MsgId, start: LOC, context: CTX) => {
    const line = start.line;
    const column = start.column;
    const width = start.width || 1;
    context.report({
        messageId,
        loc: {
            start: { line, column },
            end: { line, column: column + Math.max(1, width) },
        },
    });
};
/**
 * 🎯 check if the current code block comment is a JSDoc block comment
 * @param {TSESTree.Comment} comment ➡️ comment to handle
 * @param {SourceCode} source ➡️ current source code node
 * @returns {boolean} 📤 true if comment is a JSDoc block comment
 */
export const isJsdocBlockComment = (
    comment: TSESTree.Comment,
    source: SourceCode
): boolean => {
    const full = source.getText(comment);
    return full.startsWith('/**') || full.endsWith('*/');
};

// helper: is there a leading JSDoc directly above this node?
export const hasLeadingJsdoc = (
    node: TSESTree.Node,
    source: SourceCode,
    allComments: any[]
): boolean => {
    const lineBefore = node.loc.start.line - 1;
    const comments = allComments.filter((c) => c.loc.end.line === lineBefore);
    if (comments.length === 0) return false;
    const last = comments[comments.length - 1];
    const isBlockComment = isJsdocBlockComment(last, source);
    return isBlockComment;

    // ensure only whitespace between comment end and node start
    // const [cEnd, nStart] = [last.range![1], node.range![0]];
    // const between = source.getText().slice(cEnd, nStart);
    // console.log('BETWEEN:', JSON.stringify(between));
    // return /^[\s\r\n]*$/.test(between);
};

const acceptedStmtTypes = [
    'ExportNamedDeclaration',
    'ExportDefaultDeclaration',
    'FunctionDeclaration',
];
const acceptedStmtTypes2 = [
    'ExportNamedDeclaration',
    'ExportDefaultDeclaration',
];

const isDeclaration = (stmt: any, type: string, hasStmtType: boolean): any => {
    const fnDecl =
        hasStmtType && stmt.declaration && stmt.declaration.type === type
            ? stmt.declaration
            : null;
    return fnDecl;
};
// new: report missing JSDoc on exported functions (declarations and const arrow/functions)
const checkExportedFunctionsForJsdoc = (
    program: TSESTree.Program,
    context: CTX
): void => {
    const source = context.sourceCode;
    const comments = source.getAllComments();
    const statements: TSESTree.ProgramStatement[] = program.body;
    for (const stmt of statements) {
        const hasFnType = acceptedStmtTypes.indexOf(stmt.type) !== -1;
        if (!hasFnType) continue;
        const fnDecl = isDeclaration(stmt, 'FunctionDeclaration', hasFnType);

        if (fnDecl) {
            if (!hasLeadingJsdoc(fnDecl, source, comments)) {
                const line = fnDecl.loc.start.line;
                const col = fnDecl.loc.start.column;
                const loc = { line, column: col, width: 'function'.length };
                reportAt('missingDoc4ExportedFunction', loc, context);
            } else {
                const params = fnDecl.params.map((p: any) => p.name);
                const anchorNode: TSESTree.Node = fnDecl;
                const comment = comments.find(
                    (c) => c.loc.end.line === anchorNode.loc.start.line - 1
                );
                if (comment) {
                    checkJsdocBlockContent(comment, context, params);
                }
            }
        }
        const hasVarType = acceptedStmtTypes2.indexOf(stmt.type) !== -1;
        const varDecl = isDeclaration(stmt, 'VariableDeclaration', hasVarType);

        if (varDecl) {
            for (const decl of varDecl.declarations) {
                const init = decl.init;

                const isFunctionLike =
                    !!init &&
                    (init.type === 'ArrowFunctionExpression' ||
                        init.type === 'FunctionExpression');

                if (isFunctionLike) {
                    const params = init
                        ? init.params.map((p: any) => p.name)
                        : [];
                    // JSDoc typically sits above the VariableDeclaration
                    const anchorNode: TSESTree.Node = varDecl;
                    if (!hasLeadingJsdoc(anchorNode, source, comments)) {
                        const idNode = decl.id as TSESTree.Identifier;
                        const line = idNode.loc.start.line;
                        const column = idNode.loc.start.column;
                        const width = idNode.name.length;
                        const loc: LOC = { line, column, width };
                        reportAt('missDoc4ExportedConstFunction', loc, context);
                    } else {
                        const comment = comments.find(
                            (c) =>
                                c.loc.end.line === anchorNode.loc.start.line - 1
                        );
                        if (comment) {
                            checkJsdocBlockContent(comment, context, params);
                        }
                    }
                }
            }
        }
    }
};

export const getPosParts = (
    input: string,
    params: string[] = []
): PROPERTY_POS => {
    const parts = input.split(/\s{1,}/).filter((p) => p.length > 0);
    const result: PROPERTY_POS = {
        all: [0, input.length - 1],
        property: [-1, -1],
        type: [-1, -1],
        description: [-1, -1],
        name: [-1, -1],
        emoji: [-1, -1],
    };
    let hasEmoji = false;
    let hasName = false;
    let hasDescription = false;
    let hasStart = false;
    for (const p of parts) {
        if (p === '*') {
            hasStart = true;
        } else if (p.startsWith('@')) {
            const propStart = input.indexOf(p);
            result['property'] = [propStart, propStart + p.length - 1];
            //
        } else if (p.startsWith('{') && p.endsWith('}')) {
            const typeStart = input.indexOf(p);
            result['type'] = [typeStart, typeStart + p.length - 1];
        } else if (EMOJIS.includes(p)) {
            const emojiStart = input.indexOf(p);
            result['emoji'] = [emojiStart, emojiStart]; //length = 2
            hasEmoji = true;
            if (!hasName && hasStart) {
                hasName = true;
            }
        } else {
            if (!hasEmoji && !hasName && !hasDescription && hasStart) {
                const nameStart = input.indexOf(p);
                // console.log(p);
                result['name'] = [nameStart, nameStart + p.length - 1];
                hasName = true;
            } else if (hasName && !hasDescription) {
                const descriptionStart = input.indexOf(p);
                result['description'] = [descriptionStart, input.length - 1];
                hasDescription = true;
            }
        }
    }
    return { ...result };
};
// type which has the keys of PROPERTY_POS
type SeriesKey = keyof PROPERTY_POS;

export const getLoc = (
    series: string[],
    pos: PROPERTY_POS,
    line: number,
    search: string
): LOC => {
    const filtered = series.filter(
        (s) => pos[s as keyof PROPERTY_POS][0] !== -1
    );
    // console.log('filtered', filtered);
    const indexSearch = series.indexOf(search);
    let beforeKey: SeriesKey = filtered[0] as SeriesKey;
    for (let i = indexSearch - 1; i >= 0; i--) {
        const maybe = series[i];
        if (filtered.includes(maybe)) {
            beforeKey = maybe as SeriesKey;
            break;
        }
    }
    let afterKey: SeriesKey = filtered[filtered.length - 1] as SeriesKey;
    for (let i = indexSearch + 1; i < series.length; i++) {
        const maybe = series[i];
        if (filtered.includes(maybe)) {
            afterKey = maybe as SeriesKey;
            break;
        }
    }
    if (!pos[beforeKey] || !pos[afterKey]) {
        // console.log('ERROR getLoc', {
        //     series,
        //     pos,
        //     line,
        //     search,
        //     beforeKey,
        //     afterKey,
        // });
    }
    return {
        line,
        column: pos[beforeKey][1] + 1,
        width: pos[afterKey][0] - pos[beforeKey][1] - 1,
    };
    // }
    return { line, column: 0, width: 1 };
};
export const getIssue = (
    pos: PROPERTY_POS,
    search: SeriesKey,
    line: number,
    name: string,
    errorType: string,
    issues: ISSUE[]
) => {
    const issue = pos[search][0];
    if (issue === -1) {
        const newLoc = getLoc(SERIES, pos, line, search);
        const key =
            errorType + name.replace(/^([a-z])/, (str) => str.toUpperCase());
        if (messages[key as keyof typeof messages] !== undefined) {
            // console.log('key', key);
            issues.push({ key, loc: newLoc });
        } else {
            // console.log(`Unknown key: ${key}`);
        }
    }
};

export const checkProperty = (
    name: string,
    rawLine: string,
    line: number,
    params: string[] = []
): ISSUE[] => {
    const issues: ISSUE[] = [];
    const trimmedLine: string = rawLine.replace(/^\s*\*\s?/, '').trim();
    const HAS_PROP_REGEX = new RegExp(`^@${name}\\b`);
    const pos = getPosParts(rawLine, params); // nicht trimmed line
    if (!HAS_PROP_REGEX.test(trimmedLine)) return issues; // only check lines with @param or @returns
    getIssue(pos, 'type', line, name, 'missingType', issues);
    getIssue(pos, 'emoji', line, name, 'missingEmoji', issues);
    getIssue(pos, 'name', line, name, 'emptyName', issues);
    getIssue(pos, 'description', line, name, 'emptyDescription', issues);
    return issues;
};

const checkJsdocBlockContent = (
    comment: TSESTree.Comment,
    context: CTX,
    params: string[]
) => {
    const source = context.sourceCode;
    if (!isJsdocBlockComment(comment, source)) return;

    const raw = comment.value; // inner text between /** and */
    const rawLines = raw.split('\n'); // includes leading " * " etc.
    const baseLine = comment.loc.start.line; // 1-based

    const trimmed = rawLines.map((l) => l.replace(/^\s*\*\s?/, '').trim());

    // summary: first non-empty line
    const summaryIdx = trimmed.findIndex((l) => l.length > 0);
    if (summaryIdx >= 0) {
        const summaryText = trimmed[summaryIdx];
        if (!summaryText.includes('🎯')) {
            const srcLine = baseLine + summaryIdx;
            const col = findFirstContentColumn(rawLines[summaryIdx]);
            const loc = { line: srcLine, column: col, width: 1 };
            reportAt('missingSummaryEmoji', loc, context);
        }
    }

    // per-line validations
    rawLines.forEach((rawLine, idx) => {
        const srcLine = baseLine + idx;
        const issuesParam = checkProperty('param', rawLine, srcLine, params);
        const issuesReturn = checkProperty('returns', rawLine, srcLine, params);
        const issues = [...issuesParam, ...issuesReturn];
        for (const issue of issues) {
            // console.log(issue);
            reportAt(issue.key as MsgId, issue.loc, context);
        }
    });
};

export const customJSDocFormat = createRule<[], MsgId>({
    name: 'robertz-jsdoc-format',
    meta: {
        type: 'problem',
        docs: {
            description:
                'enforce 🎯 in summary, ➡️ in @param, 📤 in @returns and require {type} blocks for JSDoc',
            // recommended: 'recommended'
        },
        messages,
        schema: [],
    },
    defaultOptions: [],
    create: (context) => {
        return {
            Program: (node) => {
                //ensure exported functions have a JSDoc block
                checkExportedFunctionsForJsdoc(node, context);
            },
        };
    },
});
