// import { command } from '@robert.tools/cmd';
// import { getHttpStatusValue, getResponse } from '@robert.tools/http';
// import { LOG } from '@robert.tools/log';

// const url = 'http://localhost:3000/@vite/client';
// const timeout = 5_000;
// const interval = 500; // in ms
// const started = Date.now();

// let isReady = false;
// while (Date.now() - started < timeout) {
//     try {
//         const remaining = timeout - (Date.now() - started);

//         const httpStatus: string = getHttpStatusValue(url, {
//             forwarding: true,
//             method: 'GET',
//             timeout: 200,
//         });
//         // const httpResponse: string = getResponse(url, {
//         //     forwarding: true,
//         //     method: 'GET',
//         //     timeout: 200,
//         // });
//         // const httpResponse2: string = getResponse(url, {
//         //     forwarding: true,
//         //     method: 'POST',
//         //     timeout: 200,
//         // });
//         // const httpStatus2: string = getHttpStatusValue(url, {s
//         //     forwarding: true,
//         //     method: 'POST',
//         //     timeout: 200,
//         // });
//         console.log(`httpStatus: ${httpStatus}`);
//         // console.log(`httpStatus: ${httpStatus}, httpStatus2: ${httpStatus2}`);
//         // if (httpStatus !== '0') {
//         //     LOG.OK(`Vite is ready. [🌐 http: ${httpStatus}]`);
//         //     isReady = true;
//         //     break;
//         // } else {
//         //     const debug = `[🌐 http: ${httpStatus} / ⏳ remain: ${remaining}ms]`;
//         //     LOG.INFO(`WAITING for Vite. ${debug}`);
//         // }
//         command(`sleep ${interval / 1000}`);
//     } catch {
//         // retry
//     }
//     // wait 200ms
//     // await new Promise((resolve) => setTimeout(resolve, interval));
// }
// if (isReady) {
//     LOG.OK('Vite is ready');
// } else {
//     LOG.FAIL(`foo`);
// }

// // if (Date.now() - started >= timeout) {
// //     throw new Error(`Vite not ready after ${timeout}ms`);
// // }
