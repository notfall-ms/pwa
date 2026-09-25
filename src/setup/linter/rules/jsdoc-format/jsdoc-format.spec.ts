import type { TSESLint } from '@typescript-eslint/utils';
import {
    checkProperty,
    getLoc,
    getPosParts,
    hasLeadingJsdoc,
    isJsdocBlockComment,
} from './jsdoc-format';
import type { ISSUE, PROPERTY_POS } from './jsdoc-format.d';
import { SERIES } from './jsdoc-format.config';

const makeMockContext = (
    lineBefore: string,
    allComments: any[] = []
): TSESLint.RuleContext<string, []> => {
    const fakeSource = {
        getText: jest.fn().mockReturnValue(lineBefore),
        getCommentsBefore: jest.fn().mockReturnValue([]),
        getAllComments: jest.fn().mockReturnValue(allComments),
    };

    return {
        report: jest.fn(),
        getSourceCode: () => fakeSource as any,
    } as unknown as TSESLint.RuleContext<string, []>;
};
describe('jsdoc-emoji-format', () => {
    describe('isJsdocBlockComment()', () => {
        describe('valid cases', () => {
            it('has valid block comment before', () => {
                const context = makeMockContext('/** its a comment */');
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments()[0];
                expect(isJsdocBlockComment(comments, source)).toEqual(true);
                spy.mockRestore();
            });
            it('has valid block comment before', () => {
                const context = makeMockContext('*/');
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments()[0];
                expect(isJsdocBlockComment(comments, source)).toEqual(true);
                spy.mockRestore();
            });
            it('has valid block comment before', () => {
                const context = makeMockContext('/**');
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments()[0];
                expect(isJsdocBlockComment(comments, source)).toEqual(true);
                spy.mockRestore();
            });
        });
        describe('invalid cases', () => {
            it('has no block comment before', () => {
                const context = makeMockContext('const foobar = 1;');
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments()[0];
                expect(isJsdocBlockComment(comments, source)).toEqual(false);
                spy.mockRestore();
            });
            it('has no block comment before', () => {
                const context = makeMockContext('// its a comment;');
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments()[0];
                expect(isJsdocBlockComment(comments, source)).toEqual(false);
                spy.mockRestore();
            });
        });
    });
    describe('getLoc()', () => {
        const FN = getLoc;
        it('should return correct loc', () => {
            const pos: PROPERTY_POS = {
                all: [0, 10],
                property: [2, 7],
                type: [-1, -1],
                name: [18, 21],
                emoji: [23, 23],
                description: [26, 40],
            };
            expect(FN(SERIES, pos, 1, 'type')).toEqual({
                line: 1,
                column: 8,
                width: 10,
            });
        });
    });
    describe('hasLeadingJsdoc()', () => {
        const TEST_VALUE = `/** its a comment */`;
        const TEST_COMMENT = {
            type: 'Block',
            value: TEST_VALUE,
            loc: {
                start: { line: 1, column: 0 },
                end: { line: 2, column: 0 },
            },
        };
        describe('valid cases', () => {
            it('has valid JSDoc block comment before', () => {
                const testCode = TEST_VALUE;
                const allComments = [TEST_COMMENT];
                const context = makeMockContext(testCode, allComments);
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments();
                const node = { loc: { start: { line: 3 } } } as any;
                expect(hasLeadingJsdoc(node, source, comments)).toEqual(true);
                spy.mockRestore();
            });
        });
        describe('invalid cases', () => {
            it('has no valid jsdoc when not comments array ', () => {
                const testCode = `/** its a comment */`;
                const allComments: any[] = [];
                const context = makeMockContext(testCode, allComments);
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments();
                const node = { loc: { start: { line: 3 } } } as any;
                expect(hasLeadingJsdoc(node, source, comments)).toEqual(false);
                spy.mockRestore();
            });
            it('has no valid jsdoc when comment is at the same line ', () => {
                const testCode = `/** its a comment */`;
                const allComments: any[] = [];
                const context = makeMockContext(testCode, allComments);
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments();
                const node = { loc: { start: { line: 3 } } } as any;
                expect(hasLeadingJsdoc(node, source, comments)).toEqual(false);
                spy.mockRestore();
            });
            it('has no valid JSDoc block comment before', () => {
                const testCode = TEST_VALUE;
                const allComments = [TEST_COMMENT];
                const context = makeMockContext(testCode, allComments);
                const source = context.getSourceCode();
                const spy = jest.spyOn(source, 'getText');
                const comments = source.getAllComments();
                const node = { loc: { start: { line: 2 } } } as any;
                expect(hasLeadingJsdoc(node, source, comments)).toEqual(false);
                spy.mockRestore();
            });
        });
    });
    describe('getPosParts()', () => {
        const FN = getPosParts;
        it('should return correct parts', () => {
            const INPUT = `* @param {string} name ➡️ description`;
            const EXPECTED = {
                all: [0, INPUT.length - 1],
                property: [2, 7],
                type: [9, 16],
                name: [18, 21],
                emoji: [23, 23],
                description: [26, INPUT.length - 1],
            };
            expect(FN(INPUT)).toEqual(EXPECTED);
        });
        it('should return correct parts [no description]', () => {
            const INPUT = `* @param {string} name ➡️`;
            const EXPECTED = {
                all: [0, INPUT.length - 1],
                property: [2, 7],
                type: [9, 16],
                name: [18, 21],
                emoji: [23, 23],
                description: [-1, -1],
            };
            expect(FN(INPUT)).toEqual(EXPECTED);
        });
        it('should return correct parts [no type]', () => {
            const INPUT = `* @param name ➡️ description`;
            const EXPECTED = {
                all: [0, INPUT.length - 1],
                property: [2, 7],
                type: [-1, -1],
                name: [9, 12],
                emoji: [14, 14],
                description: [17, INPUT.length - 1],
            };
            expect(FN(INPUT)).toEqual(EXPECTED);
        });
        it('should return correct parts [no name]', () => {
            const INPUT = `* @param {string} ➡️ description`;
            const EXPECTED = {
                all: [0, INPUT.length - 1],
                property: [2, 7],
                type: [9, 16],
                name: [-1, -1],
                emoji: [18, 18],
                description: [21, INPUT.length - 1],
            };
            expect(FN(INPUT)).toEqual(EXPECTED);
        });
        it('should return correct parts [no name]', () => {
            const INPUT = `* @param {string} neme description`;
            const EXPECTED = {
                all: [0, INPUT.length - 1],
                property: [2, 7],
                type: [9, 16],
                name: [18, 21],
                emoji: [-1, -1],
                description: [23, INPUT.length - 1],
            };
            expect(FN(INPUT)).toEqual(EXPECTED);
        });
        it('should return correct parts [no name]', () => {
            const INPUT = `* @param {URL} url name of an url`;
            const EXPECTED = {
                all: [0, INPUT.length - 1],
                property: [2, 7],
                type: [9, 13],
                name: [15, 17],
                emoji: [-1, -1],
                description: [19, INPUT.length - 1],
            };
            expect(FN(INPUT)).toEqual(EXPECTED);
        });
    });

    describe('checkProperty()', () => {
        xit('should detect missing description', () => {
            const INPUT = `* @param {string} name`;
            const EXPECTED: ISSUE[] = [
                {
                    key: 'missingEmojiParam',
                    loc: { line: 1, column: 2, width: 6 },
                },
                {
                    key: 'emptyDescriptionParam',
                    loc: { line: 1, column: 18, width: 4 },
                }, // TODO: falsch
            ];
            const result = checkProperty('param', INPUT, 1);
            expect(result).toEqual(EXPECTED);
        });
    });
});
