import type { HEALTH_CHECK, TEST_URL } from './checks.d';
import { getHttpStatusValue } from '@robert.tools/http';

export const checkUrlStatus = (item: TEST_URL): HEALTH_CHECK => {
    const httpStatus: string = getHttpStatusValue(item.url);
    const httpValue = parseInt(httpStatus, 10);
    const name = item.name;
    const url = item.url;
    const result = httpValue >= 200 && httpValue < 400 ? true : false;
    let message = `❌ ${url} [${name}] is not reachable (status: ${httpStatus})`;
    if (result === true) {
        message = `✅ ${url} [${name}] is reachable (status: ${httpStatus})`;
    }
    return { name, result, message };
};