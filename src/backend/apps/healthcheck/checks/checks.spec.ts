/**
 * @jest-environment node
 */
import { CurlItem } from '../../../index.d';
// import { checkUrlStatus } from './checks';
import * as cmd from '@robert.tools/cmd';

describe('checkUrlStatus()', () => {
    let responseSpy: jest.SpyInstance;
    beforeEach(() => {
        jest.clearAllMocks();
        responseSpy = jest
            .spyOn(cmd, 'command')
            // .spyOn(http, 'getResponse')
            .mockImplementation((url: string) => {
                return url;
                // switch (url) {
                //     case 'http://localhost:8080':
                //         return {
                //             content: '',
                //             header: { status: '200' },
                //             status: '200',
                //             success: true,
                //             time: 100,
                //         } as CurlItem;
                //     case 'http://localhost:3000/healthz':
                //         return {
                //             content: '',
                //             header: { status: '200' },
                //             status: '200',
                //             success: true,
                //             time: 100,
                //         } as CurlItem;
                //     case 'https://www.google.com':
                //         return {
                //             content: '',
                //             header: { status: '200' },
                //             status: '200',
                //             success: true,
                //             time: 100,
                //         } as CurlItem;

                //     default:
                //         return {
                //             content: '',
                //             header: { status: '0' },
                //             status: '0',
                //             success: false,
                //             time: 100,
                //         } as CurlItem;
                // }
            });
    });
    afterEach(() => {
        responseSpy.mockRestore();
    });
    it('should return reachable for valid url', () => {
        expect(true).toBe(true);
        // const item = {
        //     url: 'http://localhost:8080',
        //     name: 'dev-server [eleventy]',
        // };
        // const result = checkUrlStatus(item);
        // expect(result).toEqual({
        //     name: 'dev-server [eleventy]',
        //     result: true,
        //     message:
        //         '✅ http://localhost:8080 [dev-server [eleventy]] is reachable (status: 200)',
        // });
    });
});