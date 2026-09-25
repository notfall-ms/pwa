import { FS } from '@robert.tools/fs';
import { LOG } from '@robert.tools/log';

const arg = process.argv.slice(2);
console.log(arg);
console.log('ENV');
// console.log(process.env);
LOG.INFO(`NODE_ENV=${process.env.NODE_ENV}`);

FS.writeFile('src/_data/test.json', JSON.stringify({ hello: 'world!!' }));
LOG.INFO('Test JSON file written successfully.');
